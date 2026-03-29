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
  const roundTrips = Math.ceil(travelHours / 100);

  const perDiemTotal = projectDays * config.perDiemRate;
  const travelLaborTotal = roundTrips * buyHourlyRate * 16; // 2 travel days × 8 hrs per round trip
  const airfareTotal = roundTrips * config.airfarePricePerTrip;
  const lodgingTotal = projectDays * config.lodgingRatePerNight;
  const carRentalTotal = projectDays * (config.carRentalPerDay ?? 0);
  const fuelTotal = config.fuel;

  const rawTotal = perDiemTotal + travelLaborTotal + airfareTotal + lodgingTotal + carRentalTotal + fuelTotal;
  const markedUpTotal = rawTotal * travelIndirectMarkup;

  return {
    travelHours,
    projectDays,
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

/**
 * Returns effective per-colo labor hours for a NC tech by dynamically
 * layering all extras (shuttle, stretch, lift, badging, MH, commissioning,
 * additional labor) on top of the raw BOM hours stored in installLaborHours.
 * Cores hours come from the stored laborHoursBreakdown (requires DB at import time).
 * Techs with no BOM applied are returned unchanged.
 */
export function computeEffectiveLaborHoursPerColo(
  tech: TechnologyConfig,
  psd: ProjectSpecificDetails | undefined,
  numberOfGuys: number,
  hoursPerDay: number,
): Record<string, number> {
  const rawHoursPerColo = tech.installLaborHours;
  const totalBomHours = Object.values(rawHoursPerColo).reduce((s, h) => s + (h || 0), 0);

  if (totalBomHours === 0) return rawHoursPerColo;

  // Cores hours need pccHoursPerUnit from DB — use value stored at last import
  const coresHours = tech.laborHoursBreakdown?.cores ?? 0;
  // Badging: 4 hrs per tech (no DB lookup needed)
  const badgingHours = !!(psd?.badgingSafety) ? Math.max(numberOfGuys, 1) * 4 : 0;
  // Per-tech fixed extras (live from current tech state)
  const materialHandlingHours = tech.materialHandlingHours ?? 0;
  const commissioningHours = tech.commissioningSupport ?? 0;
  const additionalLaborHours = (tech.additionalLaborItems ?? []).reduce((s, i) => s + (i.hours || 0), 0);

  const baseHours = totalBomHours + coresHours + badgingHours + materialHandlingHours + commissioningHours + additionalLaborHours;

  // Percentage-based extras — recomputed from CURRENT settings
  const hpd = hoursPerDay || 8;
  const baseDays = baseHours > 0 ? baseHours / hpd : 0;
  const guys = Math.max(numberOfGuys, 1);
  const shuttleHours    = !!(psd?.extras?.shuttleServices) && baseHours > 0 ? baseDays : 0;
  const stretchHours    = !!(psd?.extras?.stretchAndFlex)  && baseHours > 0 ? baseDays * 0.5 : 0;
  const compositeHours  = Number(psd?.extras?.compositeCleanup ?? 0);
  const liftHours       = !!(psd?.extras?.liftSpotters)    && baseHours > 0 ? (0.65 * baseHours) / guys : 0;

  const totalEffectiveHours = baseHours + shuttleHours + stretchHours + compositeHours + liftHours;

  // Distribute proportionally using raw BOM hours as the weight per colo
  const result: Record<string, number> = {};
  for (const [coloId, rawHours] of Object.entries(rawHoursPerColo)) {
    const pct = (rawHours || 0) / totalBomHours;
    result[coloId] = Math.round(totalEffectiveHours * pct * 100) / 100;
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
): Record<string, number> {
  const rawCostPerColo = tech.equipmentCost;
  const totalBomCost = Object.values(rawCostPerColo).reduce((s, v) => s + (v || 0), 0);

  const waterAndIce = tech.waterAndIce ?? 0;
  const additionalMaterials = (tech.additionalMaterials ?? []).reduce((s, m) => s + (m.value || 0), 0);
  const totalExtras = waterAndIce + additionalMaterials;

  if (totalExtras === 0) return rawCostPerColo;

  const coloIds = Object.keys(rawCostPerColo);
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
