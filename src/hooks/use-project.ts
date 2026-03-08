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
} from "@/lib/calculations";
import { saveProject } from "@/lib/storage";

export function useProject(initialProject: Project) {
  const [project, setProject] = useState<Project>(initialProject);

  // Auto-save on change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveProject(project);
    }, 500);
    return () => clearTimeout(timer);
  }, [project]);

  // Calculate PM travel
  const pmTravelCalculated: PMTravelCalculated = useMemo(
    () => calculatePMTravel(project.pmTravel),
    [project.pmTravel]
  );

  // Calculate schedule
  const scheduleCalculated = useMemo(
    () => calculateSchedule(project.technologies, project.schedule.numberOfGuys),
    [project.technologies, project.schedule.numberOfGuys]
  );

  // Merge calculated schedule into schedule state
  const fullSchedule: Schedule = useMemo(
    () => ({
      ...project.schedule,
      ...scheduleCalculated,
    }),
    [project.schedule, scheduleCalculated]
  );

  // Total install labor hours across all enabled techs — matches what LaborSummary shows
  const totalAllLaborHours = useMemo(() => {
    return project.technologies
      .filter((t) => t.enabled)
      .reduce((sum, tech) => {
        return sum + Object.values(tech.installLaborHours).reduce((s, h) => s + (h || 0), 0);
      }, 0);
  }, [project.technologies]);

  // Calculate install travel (null when travelPercent = 0 → use old travelPerDay formula)
  const installTravelCalc: InstallTravelCalculated | null = useMemo(() => {
    const config = project.installTravel ?? DEFAULT_INSTALL_TRAVEL;
    if (!config.travelPercent) return null;
    return calculateInstallTravel(
      config,
      totalAllLaborHours,
      project.inputParameters.hoursPerDay ?? 8,
      project.schedule.numberOfGuys,
      project.inputParameters.travelIndirectMarkup ?? 1.23,
      project.inputParameters.buyHourlyRate ?? 55
    );
  }, [project.installTravel, totalAllLaborHours, project.inputParameters, project.schedule.numberOfGuys]);

  // Calculate quotes for all technologies
  const quotes: TechnologyQuote[] = useMemo(
    () =>
      project.technologies
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
            project.schedule.numberOfGuys,
            0,
            installTravelOverride
          );
        }),
    [project.technologies, project.coloSites, project.inputParameters, pmTravelCalculated, project.schedule.numberOfGuys, installTravelCalc, totalAllLaborHours]
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
    (fields: Partial<Pick<Project, "name" | "client" | "status">>) => {
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
