"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type {
  Project,
  InputParameters,
  Schedule,
  PMTravelEstimate,
  InstallTravelConfig,
  InstallTravelCalculated,
  ColoSite,
  TechnologyConfig,
  TechnologyQuote,
  PMTravelCalculated,
  ProjectSpecificDetails,
} from "@/types";
import { DEFAULT_INSTALL_TRAVEL } from "@/types";
import {
  calculateInstallTravel,
  calculatePMTravel,
  calculateSchedule,
  calculateTechnologyQuote,
  computeEffectiveLaborHoursPerColo,
  computeEffectiveEquipmentCostPerColo,
} from "@/lib/calculations";
import { saveProject } from "@/lib/storage";

export type SaveStatus = "saved" | "saving" | "error";

export function useProject(initialProject: Project) {
  const [project, setProject] = useState<Project>(initialProject);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");

  // Auto-save on change (debounced)
  useEffect(() => {
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        await saveProject(project);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [project]);

  // Calculate PM travel
  const pmTravelCalculated: PMTravelCalculated = useMemo(
    () => calculatePMTravel(project.pmTravel),
    [project.pmTravel]
  );

  const psd = project.projectSpecificDetails;
  const hpd = project.inputParameters.hoursPerDay ?? 8;
  const numGuys = project.schedule.numberOfGuys;

  // Effective techs: installLaborHours replaced with dynamically-computed totals
  // (raw BOM hours + current extras from project settings). NC only — NTI is unchanged.
  const effectiveTechs = useMemo(() => {
    return project.technologies.map((tech) => {
      if (!tech.enabled) return tech;
      const effectiveHours = computeEffectiveLaborHoursPerColo(tech, psd, numGuys, hpd);
      const effectiveEquipment = computeEffectiveEquipmentCostPerColo(tech);
      return { ...tech, installLaborHours: effectiveHours, equipmentCost: effectiveEquipment };
    });
  }, [project.technologies, psd, numGuys, hpd]);

  // Calculate schedule
  const scheduleCalculated = useMemo(
    () => calculateSchedule(effectiveTechs, numGuys),
    [effectiveTechs, numGuys]
  );

  // Merge calculated schedule into schedule state
  const fullSchedule: Schedule = useMemo(
    () => ({
      ...project.schedule,
      ...scheduleCalculated,
    }),
    [project.schedule, scheduleCalculated]
  );

  // Total install labor hours across all enabled techs — effective hours × labor safety
  const totalAllLaborHours = useMemo(() => {
    const laborSafety = project.inputParameters.laborSafety ?? 1;
    return effectiveTechs
      .filter((t) => t.enabled)
      .reduce((sum, tech) => {
        return sum + Object.values(tech.installLaborHours).reduce((s, h) => s + (h || 0), 0);
      }, 0) * laborSafety;
  }, [effectiveTechs, project.inputParameters.laborSafety]);

  // Calculate install travel (null when travelPercent = 0 → use old travelPerDay formula)
  const installTravelCalc: InstallTravelCalculated | null = useMemo(() => {
    const config = project.installTravel ?? DEFAULT_INSTALL_TRAVEL;
    if (!config.travelPercent) return null;
    return calculateInstallTravel(
      config,
      totalAllLaborHours,
      hpd,
      numGuys,
      project.inputParameters.travelIndirectMarkup ?? 1.23,
      project.inputParameters.buyHourlyRate ?? 55
    );
  }, [project.installTravel, totalAllLaborHours, project.inputParameters, numGuys, hpd]);

  // Calculate quotes for all technologies
  const quotes: TechnologyQuote[] = useMemo(
    () =>
      effectiveTechs
        .filter((t) => t.enabled)
        .map((tech) => {
          // When install travel is configured, distribute the tech's share of the total
          let installTravelOverride: number | undefined;
          if (installTravelCalc) {
            const techHours = Object.values(tech.installLaborHours).reduce((s, h) => s + (h || 0), 0);
            const share = totalAllLaborHours > 0 ? techHours / totalAllLaborHours : 0;
            installTravelOverride = installTravelCalc.markedUpTotal * share;
          }
          return calculateTechnologyQuote(
            tech,
            project.coloSites,
            project.inputParameters,
            pmTravelCalculated.totalPerTrip,
            numGuys,
            0,
            installTravelOverride
          );
        }),
    [effectiveTechs, project.coloSites, project.inputParameters, pmTravelCalculated, numGuys, installTravelCalc, totalAllLaborHours]
  );

  // Update functions
  const updateInputParameters = useCallback((params: InputParameters) => {
    setProject((p) => ({ ...p, inputParameters: params }));
  }, []);

  const updateSchedule = useCallback((schedule: Schedule) => {
    setProject((p) => ({ ...p, schedule }));
  }, []);

  const updatePMTravel = useCallback((travel: PMTravelEstimate) => {
    setProject((p) => ({ ...p, pmTravel: travel }));
  }, []);

  const updateInstallTravel = useCallback((config: InstallTravelConfig) => {
    setProject((p) => ({ ...p, installTravel: config }));
  }, []);

  const updateColoSites = useCallback((sites: ColoSite[]) => {
    setProject((p) => ({ ...p, coloSites: sites }));
  }, []);

  const updateTechnology = useCallback((tech: TechnologyConfig) => {
    setProject((p) => ({
      ...p,
      technologies: p.technologies.map((t) =>
        t.type === tech.type ? tech : t
      ),
    }));
  }, []);

  const updateProjectMeta = useCallback(
    (fields: Partial<Pick<Project, "name" | "client" | "status" | "bidType" | "ntiMaterialContingency" | "ntiLaborContingency" | "ntiLiftAdder">>) => {
      setProject((p) => ({ ...p, ...fields }));
    },
    []
  );

  const updateProjectSpecificDetails = useCallback((psd: ProjectSpecificDetails) => {
    setProject((p) => ({ ...p, projectSpecificDetails: psd }));
  }, []);

  const applyBulkUpdate = useCallback(
    (updates: {
      name?: string;
      client?: string;
      coloSites?: ColoSite[];
      technologies?: TechnologyConfig[];
    }) => {
      setProject((p) => ({
        ...p,
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.client !== undefined && { client: updates.client }),
        ...(updates.coloSites && { coloSites: updates.coloSites }),
        ...(updates.technologies && { technologies: updates.technologies }),
      }));
    },
    []
  );

  return {
    project,
    saveStatus,
    fullSchedule,
    pmTravelCalculated,
    installTravelCalc,
    quotes,
    updateInputParameters,
    updateSchedule,
    updatePMTravel,
    updateInstallTravel,
    updateColoSites,
    updateTechnology,
    updateProjectMeta,
    updateProjectSpecificDetails,
    applyBulkUpdate,
  };
}
