import type {
  InputParameters,
  PMTravelEstimate,
  PMTravelCalculated,
  InstallTravelConfig,
  InstallTravelCalculated,
  TechnologyConfig,
  ColoSite,
  QuoteLine,
  TechnologyQuote,
  Schedule,
  ProjectSpecificDetails,
} from "@/types";

// ─── PM Travel Calculation ──────────────────────────────────────

export function calculatePMTravel(travel: PMTravelEstimate): PMTravelCalculated {
  const hotel = travel.hotelPerDay * travel.daysPerTrip;
  const carRental = travel.carRentalPerDay * travel.daysPerTrip;
  const perDiem = travel.perDiemPerDay * travel.daysPerTrip;
  const totalPerTrip = travel.flight + hotel + carRental + perDiem;
  return { hotel, carRental, perDiem, totalPerTrip };
}

// ─── Install Travel Calculation ─────────────────────────────────

export function calculateInstallTravel(
  config: InstallTravelConfig,
  totalAllLaborHours: number,
  hoursPerDay: number,
  numberOfGuys: number,
  travelIndirectMarkup: number,
  buyHourlyRate: number
): InstallTravelCalculated {
  const travelHours = totalAllLaborHours * (config.travelPercent / 100);
  const projectDays =
    numberOfGuys > 0 && hoursPerDay > 0
      ? travelHours / hoursPerDay / numberOfGuys
      : 0;
  const roundTrips = config.roundTrips ?? 1;

  const calendarDays = projectDays + Math.floor(projectDays / 5) * 2;
  const guys = Math.max(numberOfGuys, 1);
  const perDiemTotal = calendarDays * config.perDiemRate * guys;
  const travelLaborTotal = roundTrips * buyHourlyRate * 16; // 2 travel days × 8 hrs per round trip
  const airfareTotal = roundTrips * config.airfarePricePerTrip * guys;
  const lodgingTotal = calendarDays * config.lodgingRatePerNight * guys;
  const carRentalTotal = calendarDays * (config.carRentalPerDay ?? 0) * (guys / 2);
  const fuelTotal = config.fuel;

  const rawTotal = perDiemTotal + travelLaborTotal + airfareTotal + lodgingTotal + carRentalTotal + fuelTotal;
  const markedUpTotal = rawTotal * travelIndirectMarkup;

  return {
    travelHours,
    projectDays,
    calendarDays,
    roundTrips,
    perDiemTotal,
    travelLaborTotal,
    airfareTotal,
    lodgingTotal,
    carRentalTotal,
    fuelTotal,
    rawTotal,
    markedUpTotal,
  };
}

// ─── Schedule Calculation ───────────────────────────────────────

export function calculateInstallWeeks(
  laborHours: number,
  numberOfGuys: number
): number {
  if (numberOfGuys <= 0) return 0;
  // Based on spreadsheet: 1320 hours / 4 guys / 60 = 5.5 weeks
  return laborHours / numberOfGuys / 60;
}

export function calculateSchedule(
  technologies: TechnologyConfig[],
  numberOfGuys: number
): Pick<Schedule, "dasInstallWeeks" | "psInstallWeeks" | "roipInstallWeeks"> {
  const getTotalLaborHours = (type: string) => {
    const tech = technologies.find((t) => t.type === type);
    if (!tech) return 0;
    return Object.values(tech.installLaborHours).reduce((sum, h) => sum + (h || 0), 0);
  };

  return {
    dasInstallWeeks: calculateInstallWeeks(getTotalLaborHours("DAS"), numberOfGuys),
    psInstallWeeks: calculateInstallWeeks(getTotalLaborHours("PUBLIC_SAFETY"), numberOfGuys),
    roipInstallWeeks: calculateInstallWeeks(getTotalLaborHours("ROIP"), numberOfGuys),
  };
}

// ─── Quote Calculations (per technology, per COLO) ──────────────

/**
 * Line 1: RF Engineering Services = SUM(RF line items for COLO) × Sub Mark Up
 */
function calcRFEngineering(
  tech: TechnologyConfig,
  coloId: string,
  params: InputParameters
): number {
  const sum = tech.rfLineItems.reduce(
    (total, item) => total + (item.values[coloId] || 0),
    0
  );
  return sum * (params.subMarkUp ?? params.markUp);
}

/**
 * Line 2: Install = Labor Hours × Hourly Rate × Labor Safety
 */
function calcInstall(
  tech: TechnologyConfig,
  coloId: string,
  params: InputParameters
): number {
  const hours = tech.installLaborHours[coloId] || 0;
  return hours * params.hourlyRate * params.laborSafety;
}

/**
 * Line 3: Equipment and Materials = Equipment Cost × Material Safety × Mark Up
 */
function calcEquipment(
  tech: TechnologyConfig,
  coloId: string,
  params: InputParameters
): number {
  const cost = tech.equipmentCost[coloId] || 0;
  return cost * params.materialSafety * params.markUp;
}

/**
 * Line 4: PM = (Labor Hours / # Techs) × PM on Job % × PM Hourly Rate
 */
function calcPM(
  tech: TechnologyConfig,
  coloId: string,
  params: InputParameters,
  numberOfGuys: number
): number {
  const hours = tech.installLaborHours[coloId] || 0;
  const techs = numberOfGuys > 0 ? numberOfGuys : 1;
  return (hours / techs) * params.pmOnJob * params.pmHourlyRate;
}

/**
 * Line 5: PM Travel = PM Trips × PM Travel Total per Trip
 */
function calcPMTravel(
  tech: TechnologyConfig,
  coloId: string,
  pmTravelPerTrip: number
): number {
  const trips = tech.pmTrips[coloId] || 0;
  return trips * pmTravelPerTrip;
}

/**
 * Line 6: Install Travel = Labor Hours × Travel/day
 */
function calcInstallTravel(
  tech: TechnologyConfig,
  coloId: string,
  params: InputParameters
): number {
  const hours = tech.installLaborHours[coloId] || 0;
  return hours * params.travelPerDay;
}

// ─── Effective labor hours (NC dynamic extras) ──────────────────

export interface LaborExtrasBreakdown {
  commissioningHours: number;
  shuttleHours: number;
  stretchHours: number;
  compositeHours: number;
  liftHours: number;
}

/**
 * Returns the pre-contingency hour totals for each named extra that is folded
 * into the effective labor hours. Used by calling pages to build labeled
 * sub-rows in the quote table and Excel export.
 */
export function computeLaborExtrasBreakdown(
  tech: TechnologyConfig,
  psd: ProjectSpecificDetails | undefined,
  numberOfGuys: number,
  hoursPerDay: number,
  laborSafety: number = 1,
): LaborExtrasBreakdown {
  const rawHoursPerColo = tech.installLaborHours;
  const totalBomHours = Object.values(rawHoursPerColo).reduce((s, h) => s + (h || 0), 0);

  const badgingHours = !!(psd?.badgingSafety) ? Math.max(numberOfGuys, 1) * 4 : 0;
  const materialHandlingHours = tech.materialHandlingHours ?? 0;
  const commissioningHours = tech.commissioningSupport ?? 0;
  const compositeHours = tech.compositeCleanup ?? 0;
  const additionalLaborHours = (tech.additionalLaborItems ?? []).reduce((s, i) => s + (i.hours || 0), 0);
  const baseHours = totalBomHours + badgingHours + materialHandlingHours + commissioningHours + compositeHours + additionalLaborHours;

  if (baseHours === 0) {
    return { commissioningHours: 0, shuttleHours: 0, stretchHours: 0, compositeHours: 0, liftHours: 0 };
  }

  const hpd = hoursPerDay || 8;
  const guys = Math.max(numberOfGuys, 1);
  // Shuttle/stretch/lift computed from billed base hours (after contingency)
  const billedBaseHours = baseHours * laborSafety;
  const billedDays = billedBaseHours / hpd;
  const shuttleHours   = !!(psd?.extras?.shuttleServices) && billedBaseHours > 0 ? billedDays : 0;
  const stretchHours   = !!(psd?.extras?.stretchAndFlex)  && billedBaseHours > 0 ? billedDays * 0.5 : 0;
  const liftHours      = !!(psd?.extras?.liftSpotters)    && billedBaseHours > 0 ? (0.65 * billedBaseHours) / guys : 0;

  return { commissioningHours, shuttleHours, stretchHours, compositeHours, liftHours };
}

/**
 * Returns effective per-colo labor hours for a NC tech by dynamically
 * layering all extras (shuttle, stretch, lift, badging, MH, commissioning,
 * additional labor) on top of the raw BOM hours stored in installLaborHours.
 * Pass allColoIds so extras can be distributed even when there are no BOM entries.
 */
export function computeEffectiveLaborHoursPerColo(
  tech: TechnologyConfig,
  psd: ProjectSpecificDetails | undefined,
  numberOfGuys: number,
  hoursPerDay: number,
  allColoIds: string[] = [],
): Record<string, number> {
  const rawHoursPerColo = tech.installLaborHours;
  const totalBomHours = Object.values(rawHoursPerColo).reduce((s, h) => s + (h || 0), 0);

  const badgingHours = !!(psd?.badgingSafety) ? Math.max(numberOfGuys, 1) * 4 : 0;
  const materialHandlingHours = tech.materialHandlingHours ?? 0;
  const commissioningHours = tech.commissioningSupport ?? 0;
  const compositeCleanup = tech.compositeCleanup ?? 0;
  const additionalLaborHours = (tech.additionalLaborItems ?? []).reduce((s, i) => s + (i.hours || 0), 0);
  const baseHours = totalBomHours + badgingHours + materialHandlingHours + commissioningHours + compositeCleanup + additionalLaborHours;

  // Nothing to compute at all
  if (baseHours === 0) return rawHoursPerColo;

  const hpd = hoursPerDay || 8;
  const baseDays = baseHours > 0 ? baseHours / hpd : 0;
  const guys = Math.max(numberOfGuys, 1);
  const shuttleHours   = !!(psd?.extras?.shuttleServices) && baseHours > 0 ? baseDays : 0;
  const stretchHours   = !!(psd?.extras?.stretchAndFlex)  && baseHours > 0 ? baseDays * 0.5 : 0;
  const liftHours      = !!(psd?.extras?.liftSpotters)    && baseHours > 0 ? (0.65 * baseHours) / guys : 0;

  const totalEffectiveHours = baseHours + shuttleHours + stretchHours + liftHours;

  // Use BOM keys for distribution, falling back to allColoIds when no BOM entries
  const coloIds = Object.keys(rawHoursPerColo).length > 0 ? Object.keys(rawHoursPerColo) : allColoIds;
  if (coloIds.length === 0) return rawHoursPerColo;

  const result: Record<string, number> = {};
  if (totalBomHours === 0) {
    // No BOM weights — distribute equally across colos
    const equalShare = totalEffectiveHours / coloIds.length;
    for (const coloId of coloIds) {
      result[coloId] = Math.round(equalShare * 100) / 100;
    }
  } else {
    for (const [coloId, rawHours] of Object.entries(rawHoursPerColo)) {
      const pct = (rawHours || 0) / totalBomHours;
      result[coloId] = Math.round(totalEffectiveHours * pct * 100) / 100;
    }
  }
  return result;
}

// ─── Effective equipment cost (NC dynamic extras) ───────────────

/**
 * Returns effective per-colo equipment cost for a NC tech by adding
 * waterAndIce and additionalMaterials on top of the raw BOM equipment cost.
 * Extras are distributed proportionally using raw BOM cost as weights.
 * Techs with no BOM cost use equal distribution across colos.
 */
export function computeEffectiveEquipmentCostPerColo(
  tech: TechnologyConfig,
  allColoIds: string[] = [],
): Record<string, number> {
  const rawCostPerColo = tech.equipmentCost;
  const totalBomCost = Object.values(rawCostPerColo).reduce((s, v) => s + (v || 0), 0);

  const waterAndIce = tech.waterAndIce ?? 0;
  const additionalMaterials = (tech.additionalMaterials ?? []).reduce((s, m) => s + (m.value || 0), 0);
  const totalExtras = waterAndIce + additionalMaterials;

  if (totalExtras === 0) return rawCostPerColo;

  // Use BOM keys, falling back to the full project colo list when BOM has no entries
  const coloIds = Object.keys(rawCostPerColo).length > 0 ? Object.keys(rawCostPerColo) : allColoIds;
  if (coloIds.length === 0) return rawCostPerColo;

  const result: Record<string, number> = {};
  if (totalBomCost === 0) {
    // No BOM cost to use as weights — distribute extras equally
    const equalShare = totalExtras / coloIds.length;
    for (const coloId of coloIds) {
      result[coloId] = Math.round(equalShare * 100) / 100;
    }
  } else {
    for (const [coloId, rawCost] of Object.entries(rawCostPerColo)) {
      const pct = (rawCost || 0) / totalBomCost;
      result[coloId] = Math.round(((rawCost || 0) + totalExtras * pct) * 100) / 100;
    }
  }
  return result;
}

// ─── Full Quote Calculation ─────────────────────────────────────

export function calculateTechnologyQuote(
  tech: TechnologyConfig,
  coloSites: ColoSite[],
  params: InputParameters,
  pmTravelPerTrip: number,
  numberOfGuys: number,
  extraHours: number = 0,  // badging + material handling — distributed proportionally across COLOs
  installTravelOverride?: number  // when set, replaces line 6 formula for this tech (project-level travel calc share)
): TechnologyQuote {
  const coloIds = coloSites.map((c) => c.id);

  // Distribute extra hours proportionally across COLOs based on existing labor hour weights.
  // If no base hours exist yet, split equally.
  let effectiveTech = tech;
  if (extraHours > 0 && coloIds.length > 0) {
    const totalBase = coloIds.reduce((sum, id) => sum + (tech.installLaborHours[id] || 0), 0);
    const adjustedLaborHours: Record<string, number> = {};
    for (const id of coloIds) {
      const base = tech.installLaborHours[id] || 0;
      const share = totalBase > 0 ? base / totalBase : 1 / coloIds.length;
      adjustedLaborHours[id] = base + extraHours * share;
    }
    effectiveTech = { ...tech, installLaborHours: adjustedLaborHours };
  }

  // Line 6: distribute the per-tech override across COLOs proportionally, or fall back to formula
  let line6Calc: (coloId: string) => number;
  if (installTravelOverride !== undefined) {
    const totalBase = coloIds.reduce(
      (sum, id) => sum + (effectiveTech.installLaborHours[id] || 0),
      0
    );
    line6Calc = (c) => {
      const base = effectiveTech.installLaborHours[c] || 0;
      const share = totalBase > 0 ? base / totalBase : 1 / coloIds.length;
      return installTravelOverride * share;
    };
  } else {
    line6Calc = () => 0;
  }

  const lineDefinitions: Array<{
    item: number;
    description: string;
    calc: (coloId: string) => number;
  }> = [
    { item: 1, description: "RF Engineering Services", calc: (c) => calcRFEngineering(effectiveTech, c, params) },
    { item: 2, description: "Install", calc: (c) => calcInstall(effectiveTech, c, params) },
    { item: 3, description: "Equipment and Materials", calc: (c) => calcEquipment(effectiveTech, c, params) },
    { item: 4, description: "PM", calc: (c) => calcPM(effectiveTech, c, params, numberOfGuys) },
    { item: 5, description: "PM Travel", calc: (c) => calcPMTravel(effectiveTech, c, pmTravelPerTrip) },
    { item: 6, description: "Install Travel", calc: line6Calc },
  ];

  const lines: QuoteLine[] = lineDefinitions.map(({ item, description, calc }) => {
    const values: Record<string, number> = {};
    let totalPrice = 0;
    for (const coloId of coloIds) {
      const val = calc(coloId);
      values[coloId] = val;
      totalPrice += val;
    }
    return { item, description, values, totalPrice };
  });

  const totalCost = lines.reduce((sum, line) => sum + line.totalPrice, 0);

  return { type: tech.type, lines, totalCost };
}

// ─── Formatting Helpers ─────────────────────────────────────────

export function formatCurrency(amount: number): string {
  if (amount === 0) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number, decimals = 2): string {
  return num.toFixed(decimals);
}
