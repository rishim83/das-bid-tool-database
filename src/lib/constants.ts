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
    installLaborHours: {},
    equipmentCost: {},
    pmTrips: {},
    materialHandlingHours: 0,
    commissioningSupport: 0,
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
  DAS: "bg-blue-500",
  PUBLIC_SAFETY: "bg-emerald-500",
  ROIP: "bg-cyan-500",
};

export const TECHNOLOGY_ACCENT: Record<TechnologyType, string> = {
  DAS: "text-blue-400",
  PUBLIC_SAFETY: "text-emerald-400",
  ROIP: "text-cyan-400",
};

export const TECHNOLOGY_DOT: Record<TechnologyType, string> = {
  DAS: "bg-blue-400 shadow-[0_0_6px_oklch(0.62_0.18_255/0.4)]",
  PUBLIC_SAFETY: "bg-emerald-400 shadow-[0_0_6px_oklch(0.62_0.17_162/0.4)]",
  ROIP: "bg-cyan-400 shadow-[0_0_6px_oklch(0.70_0.12_200/0.4)]",
};
