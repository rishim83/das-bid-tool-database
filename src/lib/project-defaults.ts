import { v4 as uuid } from "uuid";
import type { Project } from "@/types";
import {
  DEFAULT_INPUT_PARAMETERS,
  DEFAULT_SCHEDULE,
  DEFAULT_PM_TRAVEL,
  DEFAULT_COLO_SITES,
  DEFAULT_PROJECT_SPECIFIC_DETAILS,
} from "@/types";
import { createDefaultTechnology } from "./constants";

export function createNewProject(name: string = "New Project", client: string = ""): Project {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    name,
    client,
    status: "draft",
    inputParameters: { ...DEFAULT_INPUT_PARAMETERS },
    schedule: { ...DEFAULT_SCHEDULE },
    pmTravel: { ...DEFAULT_PM_TRAVEL },
    coloSites: DEFAULT_COLO_SITES.map((c) => ({ ...c })),
    subContractors: [],
    rentalEquipment: {
      lift: { numberOfLifts: 1, months: 0, costPerMonth: 0, includeLiftAdder: false },
      additionalItems: [],
    },
    projectSpecificDetails: { ...DEFAULT_PROJECT_SPECIFIC_DETAILS },
    technologies: [
      createDefaultTechnology("DAS"),
      createDefaultTechnology("PUBLIC_SAFETY"),
      createDefaultTechnology("ROIP"),
    ],
    createdAt: now,
    updatedAt: now,
  };
}
