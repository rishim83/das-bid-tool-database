// ─── Technology Types ─────────────────────────────────────────────

export type TechnologyType = "DAS" | "PUBLIC_SAFETY" | "ROIP";

// ─── Input Parameters (shared across all technologies) ───────────

export interface InputParameters {
  markUp: number;           // e.g., 1.35
  hourlyRate: number;       // sell rate, e.g., 150
  buyHourlyRate: number;    // buy rate, e.g., 55
  travelPerDay: number;     // e.g., 80
  materialSafety: number;   // e.g., 1.2
  laborSafety: number;      // e.g., 1.2
  pmOnJob: number;          // e.g., 0.50 (50%)
  pmHourlyRate: number;          // sell rate, e.g., 100
  buyPMHourlyRate: number;       // buy rate, e.g., 95
  nonUnionRate: number;          // e.g., 130
  travelIndirectMarkup: number;  // multiplier, e.g., 1.23
  subMarkUp: number;             // multiplier, e.g., 1.10
  taxPercent: number;            // e.g., 8 (8%)
  hoursPerDay: number;           // e.g., 8
  daysPerWeek: number;           // e.g., 5
}

// ─── Schedule ────────────────────────────────────────────────────

export interface Schedule {
  numberOfGuys: number;     // e.g., 4
  dasInstallWeeks: number;  // calculated
  psInstallWeeks: number;   // calculated
  roipInstallWeeks: number; // calculated
}

// ─── Install Travel Estimate ─────────────────────────────────────

export interface InstallTravelConfig {
  travelPercent: number;        // % of total all-labor hours → travel hours
  perDiemRate: number;          // $ per project day, default 60
  roundTrips: number;           // user-specified number of round trips
  airfarePricePerTrip: number;  // $ per round trip, default 500
  lodgingRatePerNight: number;  // $ per night, default 175
  carRentalPerDay: number;      // $ per project day, default 0
  fuel: number;                 // flat $ amount, default 500
}

export interface InstallTravelCalculated {
  travelHours: number;
  projectDays: number;
  calendarDays: number;
  roundTrips: number;
  perDiemTotal: number;
  travelLaborTotal: number;
  airfareTotal: number;
  lodgingTotal: number;
  carRentalTotal: number;
  fuelTotal: number;
  rawTotal: number;
  markedUpTotal: number;
}

// ─── PM Travel Estimate ─────────────────────────────────────────

export interface PMTravelEstimate {
  daysPerTrip: number;      // e.g., 3
  flight: number;           // e.g., 500
  hotelPerDay: number;      // daily rate, e.g., 150
  carRentalPerDay: number;  // daily rate, e.g., 100
  perDiemPerDay: number;    // daily rate, e.g., 100
}

// Calculated from PMTravelEstimate
export interface PMTravelCalculated {
  hotel: number;        // hotelPerDay × daysPerTrip
  carRental: number;    // carRentalPerDay × daysPerTrip
  perDiem: number;      // perDiemPerDay × daysPerTrip
  totalPerTrip: number; // flight + hotel + carRental + perDiem
}

// ─── RF Line Item ───────────────────────────────────────────────

export interface RFLineItem {
  id: string;
  description: string;
  values: Record<string, number>; // coloId -> dollar amount
}

// ─── Equipment Cost Breakdown (stored when BOM is applied) ──────

export interface EquipmentCostBreakdown {
  bom: number;                                            // base BOM equipment cost
  waterAndIce: number;
  additionalMaterials: Array<{ name: string; value: number }>;
}

// ─── Labor Hours Breakdown (stored when BOM is applied) ─────────

export interface LaborHoursBreakdown {
  bom: number;
  badging: number;
  materialHandling: number;
  commissioningSupport: number;
  additionalLaborItems: Array<{ description: string; hours: number }>;
  shuttleServices: number;
  stretchAndFlex: number;
  compositeCleanup: number;
  liftSpotters: number;
}

// ─── BOM Report Row (stored when BOM is applied for Excel export) ───────────

export interface BOMReportRow {
  code: string;           // part number or adder label (e.g. "PCC", "BADGE")
  manufacturer: string;
  qty: number;
  unitEquipPrice: number;
  unitLaborHrs: number;
  totalEquipPrice: number;
  totalLaborHrs: number;
  laborCodeDesc?: string; // human-readable labor code description(s) from DB
}

// ─── Technology Configuration ───────────────────────────────────

export interface TechnologyConfig {
  type: TechnologyType;
  enabled: boolean;
  rfLineItems: RFLineItem[];
  installLaborHours: Record<string, number>;  // coloId -> hours
  equipmentCost: Record<string, number>;      // coloId -> cost
  pmTrips: Record<string, number>;            // coloId -> trip count
  laborHoursBreakdown?: LaborHoursBreakdown;      // snapshot set when BOM is applied
  equipmentCostBreakdown?: EquipmentCostBreakdown; // snapshot set when BOM is applied
  bomReportRows?: BOMReportRow[];                  // per-item rows stored when BOM is applied
  // Per-technology project details
  materialHandlingHours: number;
  commissioningSupport: number;
  compositeCleanup: number;
  additionalLaborItems: AdditionalLaborItem[];
  subContractors: SubContractor[];
  rentalEquipment: RentalEquipment;
  waterAndIce: number;                          // raw dollar value per tech
  additionalMaterials: AdditionalMaterialItem[];
}

// ─── SubContractor ──────────────────────────────────────────────

export interface SubContractor {
  id: string;
  task: string;
  value: number;
}

// ─── Rental Equipment ───────────────────────────────────────────

export interface LiftConfig {
  numberOfLifts: number;
  months: number;
  costPerMonth: number;
  includeLiftAdder: boolean; // if true, use column E labor hours from DB
}

export interface RentalEquipmentItem {
  id: string;
  name: string;
  months: number;
  costPerMonth: number;
}

export interface RentalEquipment {
  lift: LiftConfig;
  additionalItems: RentalEquipmentItem[];
}

// ─── COLO Site ──────────────────────────────────────────────────

export interface ColoSite {
  id: string;
  name: string; // e.g., "COLO 1 + ADMIN", "COLO 2"
}

// ─── Quote Line (calculated) ────────────────────────────────────

export interface QuoteLine {
  item: number;
  description: string;
  values: Record<string, number>; // coloId -> calculated amount
  totalPrice: number;
}

export interface TechnologyQuote {
  type: TechnologyType;
  lines: QuoteLine[];
  totalCost: number;
}

// ─── Project Specific Details ────────────────────────────────────

export interface ProjectExtras {
  adminHours: number;        // percentage, e.g. 15 = 15%
  shuttleServices: boolean;  // enabled = include in cost
  stretchAndFlex: boolean;
  compositeCleanup: number;  // direct hours input
  liftSpotters: boolean;
  miscMaterials: number;
  miscLabor: number;
  projectContingency: number;
  excludeMaterials: boolean; // force BOM equipment costs to $0
}

export interface AdditionalLaborItem {
  id: string;
  description: string;
  hours: number;
}

export interface AdditionalMaterialItem {
  id: string;
  name: string;
  value: number; // raw dollar amount (× materialSafety applied during calculation)
}

export interface ProjectSpecificDetails {
  jHooks: boolean;
  badgingSafety: boolean;
  extras: ProjectExtras;
}

export const DEFAULT_PROJECT_EXTRAS: ProjectExtras = {
  adminHours: 15,
  shuttleServices: false,
  stretchAndFlex: false,
  compositeCleanup: 0,
  liftSpotters: false,
  miscMaterials: 0,
  miscLabor: 0,
  projectContingency: 0,
  excludeMaterials: false,
};

export const DEFAULT_PROJECT_SPECIFIC_DETAILS: ProjectSpecificDetails = {
  jHooks: false,
  badgingSafety: false,
  extras: { ...DEFAULT_PROJECT_EXTRAS },
};

export const DEFAULT_RENTAL_EQUIPMENT: RentalEquipment = {
  lift: { numberOfLifts: 1, months: 0, costPerMonth: 0, includeLiftAdder: false },
  additionalItems: [],
};

// ─── Full Project ───────────────────────────────────────────────

export type BidType = "network_connex" | "nti";

export interface Project {
  id: string;
  name: string;
  client: string;
  status: "draft" | "completed" | "archived";
  bidType?: BidType;
  ntiMaterialContingency?: number;  // percentage, e.g. 5 = 5%
  ntiLaborContingency?: number;     // percentage, e.g. 5 = 5%
  ntiLiftAdder?: boolean;
  inputParameters: InputParameters;
  schedule: Schedule;
  pmTravel: PMTravelEstimate;
  installTravel?: InstallTravelConfig;
  coloSites: ColoSite[];
  technologies: TechnologyConfig[];
  subContractors?: SubContractor[];
  rentalEquipment?: RentalEquipment;
  projectSpecificDetails?: ProjectSpecificDetails;
  createdAt: string;
  updatedAt: string;
}

// ─── Default Values ─────────────────────────────────────────────

export const DEFAULT_INPUT_PARAMETERS: InputParameters = {
  markUp: 1.35,
  hourlyRate: 150,
  buyHourlyRate: 55,
  travelPerDay: 80,
  materialSafety: 1.05,
  laborSafety: 1.05,
  pmOnJob: 0.75,
  pmHourlyRate: 100,
  buyPMHourlyRate: 95,
  nonUnionRate: 130,
  travelIndirectMarkup: 1.23,
  subMarkUp: 1.35,
  taxPercent: 8,
  hoursPerDay: 8,
  daysPerWeek: 5,
};

export const DEFAULT_SCHEDULE: Schedule = {
  numberOfGuys: 4,
  dasInstallWeeks: 0,
  psInstallWeeks: 0,
  roipInstallWeeks: 0,
};

export const DEFAULT_INSTALL_TRAVEL: InstallTravelConfig = {
  travelPercent: 0,
  perDiemRate: 60,
  roundTrips: 1,
  airfarePricePerTrip: 500,
  lodgingRatePerNight: 175,
  carRentalPerDay: 0,
  fuel: 500,
};

export const DEFAULT_PM_TRAVEL: PMTravelEstimate = {
  daysPerTrip: 3,
  flight: 500,
  hotelPerDay: 150,
  carRentalPerDay: 100,
  perDiemPerDay: 100,
};

export const DEFAULT_COLO_SITES: ColoSite[] = [
  { id: "total", name: "" },
];

// ─── Parts Database ──────────────────────────────────────────────

export interface LaborCode {
  code: string;
  description: string;
  hoursPerUnit: number;
}

export interface DatabaseEntry {
  partNumber: string;
  description: string;
  uom: string;
  equipmentUnitPrice: number;
  laborCode: string;
  laborHoursPerUnit: number;
  liftLaborHoursPerUnit: number; // hours from column E (lift adder)
}

export interface PartsDatabase {
  entries: DatabaseEntry[];
  laborCodes: LaborCode[];
  uploadedAt: string;
  fileName: string;
}

// ─── BOM Processing ──────────────────────────────────────────────

export interface BOMLineItem {
  partNumber: string;
  quantity: number;
  description?: string;
  uom?: string;
  manufacturer?: string;
}

export interface MatchedBOMItem {
  partNumber: string;
  manufacturer?: string;
  description: string;
  quantity: number;
  uom: string;
  unitEquipmentPrice: number;
  unitLaborHours: number;
  totalEquipmentCost: number;
  totalLaborHours: number;
  /** True if the database entry had at least one install code (even if hours resolve to 0). */
  hasLaborCode: boolean;
}

export interface UnmatchedBOMItem {
  partNumber: string;
  manufacturer?: string;
  description?: string;
  quantity: number;
  uom?: string;
  unitEquipmentPrice: number;
  unitLaborHours: number;
  isResolved: boolean;
}

export interface BOMAnalysisResult {
  matched: MatchedBOMItem[];
  unmatched: UnmatchedBOMItem[];
  totalEquipmentCost: number;
  totalLaborHours: number;
}

export interface ColoDistribution {
  coloId: string;
  percentage: number;
}
