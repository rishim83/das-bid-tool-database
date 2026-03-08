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
  const travelLaborTotal = roundTrips * buyHourlyRate;
  const airfareTotal = roundTrips * config.airfarePricePerTrip;
  const lodgingTotal = projectDays * config.lodgingRatePerNight;
  const fuelTotal = config.fuel;

  const rawTotal = perDiemTotal + travelLaborTotal + airfareTotal + lodgingTotal + fuelTotal;
  const markedUpTotal = rawTotal * travelIndirectMarkup;

  return {
    travelHours,
    projectDays,
    roundTrips,
    perDiemTotal,
    travelLaborTotal,
    airfareTotal,
    lodgingTotal,
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
