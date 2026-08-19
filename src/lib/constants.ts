import type { RFLineItem, TechnologyConfig, TechnologyType } from "@/types";
import { DEFAULT_RENTAL_EQUIPMENT } from "@/types";
import { v4 as uuid } from "uuid";

// ─── Default RF Line Items per Technology ───────────────────────

function makeRFItems(descriptions: string[]): RFLineItem[] {
  return descriptions.map((desc) => ({
    id: uuid(),
    description: desc,
    values: {},
  }));
}

export const DEFAULT_DAS_RF_ITEMS: string[] = [
  "iBwave Design",
  "Site Survey",
  "Pre-Data Collection Walk with Scanner Only",
  "Carrier Coordination",
  "Greenlighting and Commissioning (DAS + Repeaters/Donor Antenna)",
  "CW Testing",
  "Post Installation final data collection walk",
  "Additional Days",
];

export const DEFAULT_PS_RF_ITEMS: string[] = [
  "iBwave Design",
  "Site Survey",
  "Pre-Data Collection Walk with Scanner Only",
  "AHJ Coordination",
  "Greenlighting and Commissioning (DAS + Repeaters/Donor Antenna)",
  "CW Testing",
  "Post Install Grid and DAQ testing",
  "Cost of Additional Day",
  "Approximate Travel Cost/Visit",
];

export const DEFAULT_ROIP_RF_ITEMS: string[] = [
  "Design",
  "Site Survey",
  "Predeployment Work",
  "Licensing",
  "Commissioning and Final Testing",
  "Radio Programming",
  "Post Install Requirements",
  "Training to the Customer",
  "Cost of Additional Day",
  "Approximate Travel Cost/Visit",
];

export function getDefaultRFItems(type: TechnologyType): RFLineItem[] {
  switch (type) {
    case "DAS":
      return makeRFItems(DEFAULT_DAS_RF_ITEMS);
    case "PUBLIC_SAFETY":
      return makeRFItems(DEFAULT_PS_RF_ITEMS);
    case "ROIP":
      return makeRFItems(DEFAULT_ROIP_RF_ITEMS);
  }
}

export function createDefaultTechnology(type: TechnologyType): TechnologyConfig {
  return {
    type,
    enabled: true,
    rfLineItems: getDefaultRFItems(type),
    installLaborHours: { total: 0 },
    equipmentCost: { total: 0 },
    pmTrips: { total: 0 },
    materialHandlingHours: 0,
    commissioningSupport: 0,
    compositeCleanup: 0,
    additionalLaborItems: [],
    subContractors: [],
    rentalEquipment: DEFAULT_RENTAL_EQUIPMENT,
    waterAndIce: 0,
    additionalMaterials: [],
  };
}

export const TECHNOLOGY_LABELS: Record<TechnologyType, string> = {
  DAS: "DAS",
  PUBLIC_SAFETY: "Public Safety",
  ROIP: "ROIP",
};

export const TECHNOLOGY_COLORS: Record<TechnologyType, string> = {
  DAS: "bg-blue-600",
  PUBLIC_SAFETY: "bg-red-600",
  ROIP: "bg-orange-500",
};

export const TECHNOLOGY_ACCENT: Record<TechnologyType, string> = {
  DAS: "text-blue-600",
  PUBLIC_SAFETY: "text-red-600",
  ROIP: "text-orange-500",
};

export const TECHNOLOGY_DOT: Record<TechnologyType, string> = {
  DAS: "bg-blue-500 shadow-[0_0_6px_oklch(0.55_0.22_255/0.45)]",
  PUBLIC_SAFETY: "bg-red-500 shadow-[0_0_6px_oklch(0.55_0.22_29/0.45)]",
  ROIP: "bg-orange-400 shadow-[0_0_6px_oklch(0.72_0.19_55/0.45)]",
};

/* Solid background color for tech badges / headers (Tailwind classes) */
export const TECHNOLOGY_BG: Record<TechnologyType, string> = {
  DAS: "bg-blue-600 text-white",
  PUBLIC_SAFETY: "bg-red-600 text-white",
  ROIP: "bg-orange-500 text-white",
};

/* Subtle tinted background for tech-tinted rows / borders */
export const TECHNOLOGY_TINT: Record<TechnologyType, string> = {
  DAS: "bg-blue-50 border-blue-200 text-blue-700",
  PUBLIC_SAFETY: "bg-red-50 border-red-200 text-red-700",
  ROIP: "bg-orange-50 border-orange-200 text-orange-700",
};

export const TECHNOLOGY_TINT_DARK: Record<TechnologyType, string> = {
  DAS: "dark:bg-blue-950/30 dark:border-blue-800/40 dark:text-blue-300",
  PUBLIC_SAFETY: "dark:bg-red-950/30 dark:border-red-800/40 dark:text-red-300",
  ROIP: "dark:bg-orange-950/30 dark:border-orange-800/40 dark:text-orange-300",
};
