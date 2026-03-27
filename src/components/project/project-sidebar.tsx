"use client";

import { useState } from "react";
import type {
  Project,
  TechnologyConfig,
  TechnologyType,
  ProjectSpecificDetails,
  ColoSite,
  InputParameters,
  Schedule,
  PMTravelEstimate,
  InstallTravelConfig,
  InstallTravelCalculated,
  PMTravelCalculated,
} from "@/types";
import {
  DEFAULT_RENTAL_EQUIPMENT,
  DEFAULT_INSTALL_TRAVEL,
} from "@/types";
import { TECHNOLOGY_LABELS, TECHNOLOGY_DOT } from "@/lib/constants";
import { formatCurrency } from "@/lib/calculations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsUpDown,
  MapPin,
  SlidersHorizontal,
  PackageOpen,
  X,
} from "lucide-react";
import { ParametersPanel } from "./parameters-panel";
import { ColoManager } from "./colo-manager";
import { InputValuesTable } from "./input-values-table";
import { BomImportDialog } from "./bom-import-dialog";
import { PerTechDetailsCard } from "./per-tech-details-card";

// ─── Panel ID type ───────────────────────────────────────────────
export type SidebarPanelId =
  | "colos"
  | "parameters"
  | `input-values-${TechnologyType}`
  | `tech-details-${TechnologyType}`;

// ─── Sidebar section (collapsible) ──────────────────────────────

function SidebarSection({
  title,
  icon,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-sidebar-border/70">
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-sidebar-accent/60 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {icon && <span className="text-muted-foreground/60 shrink-0">{icon}</span>}
        <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {!open && summary && (
          <span className="text-[11px] text-muted-foreground/50 truncate max-w-[120px]">{summary}</span>
        )}
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

// ─── Panel trigger row (click to open overlay) ──────────────────

function PanelTrigger({
  label,
  summary,
  onClick,
  accent,
}: {
  label: string;
  summary?: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 hover:bg-sidebar-accent/70 transition-colors group ${accent ? "hover:bg-primary/5" : ""}`}
    >
      <span className="text-xs text-foreground/80">{label}</span>
      <div className="flex items-center gap-1.5">
        {summary && (
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground/60">{summary}</span>
        )}
        <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
      </div>
    </button>
  );
}

// ─── Simple inline row (label + input, fits in sidebar) ─────────

function InlineField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = "any",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: string;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="text-xs text-muted-foreground/80 shrink-0 mr-2">{label}</span>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-xs text-muted-foreground/60">{prefix}</span>}
        <Input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="h-7 w-20 bg-input/40 border-border/50 text-right text-xs font-mono tabular-nums rounded-md"
        />
        {suffix && <span className="text-xs text-muted-foreground/60">{suffix}</span>}
      </div>
    </div>
  );
}

// ─── Tech enable toggle ──────────────────────────────────────────

function TechToggle({
  tech,
  onChange,
}: {
  tech: TechnologyConfig;
  onChange: (t: TechnologyConfig) => void;
}) {
  return (
    <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-sidebar-accent/50 transition-colors">
      <input
        type="checkbox"
        checked={tech.enabled}
        onChange={(e) => onChange({ ...tech, enabled: e.target.checked })}
        className="h-3.5 w-3.5 rounded border-border/50 accent-primary cursor-pointer shrink-0"
      />
      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${TECHNOLOGY_DOT[tech.type]}`} />
      <span className="text-xs font-medium text-foreground/80">
        {TECHNOLOGY_LABELS[tech.type]}
      </span>
      <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
        tech.enabled
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-muted text-muted-foreground"
      }`}>
        {tech.enabled ? "On" : "Off"}
      </span>
    </label>
  );
}

// ─── Main ProjectSidebar component ──────────────────────────────

interface Props {
  project: Project;
  activeTab: TechnologyType;
  isNTI: boolean;
  onUpdateTechnology: (t: TechnologyConfig) => void;
  onUpdateProjectMeta: (patch: Partial<Project>) => void;
  onTabChange: (tab: TechnologyType) => void;
  onOpenPanel: (id: SidebarPanelId) => void;
}

const TECH_TYPES: TechnologyType[] = ["DAS", "PUBLIC_SAFETY", "ROIP"];

export function ProjectSidebar({
  project,
  activeTab,
  isNTI,
  onUpdateTechnology,
  onUpdateProjectMeta,
  onTabChange,
  onOpenPanel,
}: Props) {
  const ip = project.inputParameters;
  const colos = project.coloSites;

  // ── Summary helpers ─────────────────────────────────────────
  const coloSummary = colos.length === 0
    ? "No sites"
    : colos.length === 1
    ? colos[0].name
    : `${colos.length} sites`;

  const paramSummary = `${ip.markUp ?? 1}× markup · $${ip.hourlyRate ?? 0}/hr`;

  const getTechInputSummary = (tech: TechnologyConfig) => {
    const bom = Object.values(tech.equipmentCost).reduce((s, v) => s + (v || 0), 0);
    const hours = Object.values(tech.installLaborHours).reduce((s, v) => s + (v || 0), 0);
    if (bom === 0 && hours === 0) return "Not imported";
    return `${formatCurrency(bom)} BOM · ${hours.toFixed(0)}h`;
  };

  const getTechDetailSummary = (tech: TechnologyConfig) => {
    const rental = tech.rentalEquipment ?? DEFAULT_RENTAL_EQUIPMENT;
    const liftTotal = (rental.lift.numberOfLifts ?? 1) * rental.lift.months * rental.lift.costPerMonth;
    const addlTotal = (rental.additionalItems ?? []).reduce((s, i) => s + i.months * i.costPerMonth, 0);
    const rentalTotal = liftTotal + addlTotal;
    const subTotal = (tech.subContractors ?? []).reduce((s, sub) => s + sub.value, 0);
    const addlLaborHrs = (tech.additionalLaborItems ?? []).reduce((s, i) => s + (i.hours || 0), 0);
    const addlMat = (tech.waterAndIce ?? 0) + (tech.additionalMaterials ?? []).reduce((s, m) => s + m.value, 0);
    const parts: string[] = [];
    if (rentalTotal > 0) parts.push(`Rental ${formatCurrency(rentalTotal)}`);
    if (subTotal > 0) parts.push(`Subs ${formatCurrency(subTotal)}`);
    if (addlLaborHrs > 0) parts.push(`+${addlLaborHrs.toFixed(0)}h`);
    if (addlMat > 0) parts.push(`Mat ${formatCurrency(addlMat)}`);
    return parts.length > 0 ? parts.join(" · ") : "No extras";
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── SITE SETUP ───────────────────────────────── */}
      <SidebarSection
        title="Site Setup"
        icon={<MapPin className="h-3.5 w-3.5" />}
        summary={coloSummary}
        defaultOpen={colos.length === 0}
      >
        <PanelTrigger
          label={coloSummary === "No sites" ? "Add colo sites…" : coloSummary}
          summary={colos.length > 0 ? `${colos.length} site${colos.length !== 1 ? "s" : ""}` : undefined}
          onClick={() => onOpenPanel("colos")}
        />
      </SidebarSection>

      {/* ── PRICING PARAMETERS (NC only) ─────────────── */}
      {!isNTI && (
        <SidebarSection
          title="Parameters"
          icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
          summary={paramSummary}
        >
          <PanelTrigger
            label="Rates, Markup & Factors"
            summary={paramSummary}
            onClick={() => onOpenPanel("parameters")}
          />
        </SidebarSection>
      )}

      {/* ── NTI CONTINGENCY ──────────────────────────── */}
      {isNTI && (
        <SidebarSection
          title="Contingency"
          icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
          defaultOpen
        >
          <InlineField
            label="Material"
            value={project.ntiMaterialContingency ?? 0}
            onChange={(v) => onUpdateProjectMeta({ ntiMaterialContingency: v })}
            suffix="%"
          />
          <InlineField
            label="Labor"
            value={project.ntiLaborContingency ?? 0}
            onChange={(v) => onUpdateProjectMeta({ ntiLaborContingency: v })}
            suffix="%"
          />
          <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-sidebar-accent/50 transition-colors">
            <input
              type="checkbox"
              checked={!!project.ntiLiftAdder}
              onChange={(e) => onUpdateProjectMeta({ ntiLiftAdder: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-border/50 accent-primary cursor-pointer shrink-0"
            />
            <span className="text-xs text-foreground/80">Include Lift Adder</span>
          </label>
        </SidebarSection>
      )}


      {/* ── PER-TECH INPUTS ──────────────────────────── */}
      <SidebarSection
        title="Technology Inputs"
        icon={<PackageOpen className="h-3.5 w-3.5" />}
        defaultOpen
      >
        {/* Mini tech tabs */}
        <div className="flex border-b border-sidebar-border/50 mx-3 mt-1 mb-2 gap-0.5">
          {TECH_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => onTabChange(type)}
              className={`flex-1 py-1.5 text-[11px] font-medium rounded-t transition-colors ${
                activeTab === type
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {type === "PUBLIC_SAFETY" ? "PS" : type}
            </button>
          ))}
        </div>

        {/* Active tech content */}
        {TECH_TYPES.map((type) => {
          if (type !== activeTab) return null;
          const tech = project.technologies.find((t) => t.type === type);
          if (!tech) return null;

          return (
            <div key={type}>
              {/* Enable toggle */}
              <TechToggle tech={tech} onChange={onUpdateTechnology} />

              {tech.enabled && (
                <>
                  {/* Input Values */}
                  <PanelTrigger
                    label="Input Values & BOM"
                    summary={getTechInputSummary(tech)}
                    onClick={() => onOpenPanel(`input-values-${type}`)}
                    accent
                  />

                  {/* Quick inline fields */}
                  <div className="px-3 pt-1 pb-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1">
                      Labor Hours
                    </p>
                  </div>
                  <InlineField
                    label="Material Handling"
                    value={tech.materialHandlingHours ?? 0}
                    onChange={(v) => onUpdateTechnology({ ...tech, materialHandlingHours: v })}
                    suffix="hrs"
                  />
                  <InlineField
                    label="Commissioning"
                    value={tech.commissioningSupport ?? 0}
                    onChange={(v) => onUpdateTechnology({ ...tech, commissioningSupport: v })}
                    suffix="hrs"
                  />

                  <div className="px-3 pt-2 pb-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1">
                      Extras & Details
                    </p>
                  </div>
                  {/* Per-tech Details (panel) */}
                  <PanelTrigger
                    label="Rental, Subs & Materials"
                    summary={getTechDetailSummary(tech)}
                    onClick={() => onOpenPanel(`tech-details-${type}`)}
                    accent
                  />
                </>
              )}
            </div>
          );
        })}
      </SidebarSection>

    </div>
  );
}

// ─── Overlay Panel (rendered in page.tsx) ────────────────────────

interface OverlayProps {
  panelId: SidebarPanelId;
  project: Project;
  psd: ProjectSpecificDetails;
  fullSchedule: Schedule;
  pmTravelCalculated: PMTravelCalculated;
  installTravelCalc: InstallTravelCalculated | null;
  onUpdateInputParameters: (p: InputParameters) => void;
  onUpdateSchedule: (s: Schedule) => void;
  onUpdatePMTravel: (t: PMTravelEstimate) => void;
  onUpdateInstallTravel: (t: InstallTravelConfig) => void;
  onUpdateColoSites: (sites: ColoSite[]) => void;
  onUpdateTechnology: (t: TechnologyConfig) => void;
  onUpdateProjectSpecificDetails: (psd: ProjectSpecificDetails) => void;
  onClose: () => void;
  sidebarWidth: number;
}

export function SidebarOverlayPanel({
  panelId,
  project,
  psd,
  fullSchedule,
  pmTravelCalculated,
  installTravelCalc,
  onUpdateInputParameters,
  onUpdateSchedule,
  onUpdatePMTravel,
  onUpdateInstallTravel,
  onUpdateColoSites,
  onUpdateTechnology,
  onUpdateProjectSpecificDetails,
  onClose,
  sidebarWidth,
}: OverlayProps) {
  // Derive tech type from panelId if applicable
  const techType = (panelId.includes("-") && !panelId.startsWith("colos") && !panelId.startsWith("param"))
    ? (panelId.split("-").pop() as TechnologyType)
    : null;
  const tech = techType ? project.technologies.find((t) => t.type === techType) : null;

  const panelTitles: Record<string, string> = {
    colos: "Colo Sites",
    parameters: "Pricing Parameters",
  };
  if (techType) {
    panelTitles[`input-values-${techType}`] = `${TECHNOLOGY_LABELS[techType]} — Input Values`;
    panelTitles[`tech-details-${techType}`] = `${TECHNOLOGY_LABELS[techType]} — Details`;
  }

  const title = panelTitles[panelId] ?? "Settings";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        style={{ left: sidebarWidth }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="fixed top-0 bottom-0 z-50 panel-overlay flex flex-col"
        style={{ left: sidebarWidth, right: 0, maxWidth: 720, borderLeft: "1px solid var(--border)" }}
      >
        {/* Panel header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-border/60 header-gradient">
          <div className="flex items-center gap-2">
            {techType && (
              <div className={`h-2.5 w-2.5 rounded-full ${TECHNOLOGY_DOT[techType]}`} />
            )}
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto p-5">
          {panelId === "colos" && (
            <ColoManager coloSites={project.coloSites} onChange={onUpdateColoSites} />
          )}

          {panelId === "parameters" && (
            <ParametersPanel
              params={project.inputParameters}
              onParamsChange={onUpdateInputParameters}
              pmTravel={project.pmTravel}
              pmTravelCalculated={pmTravelCalculated}
              onPMTravelChange={onUpdatePMTravel}
              installTravel={project.installTravel ?? DEFAULT_INSTALL_TRAVEL}
              installTravelCalc={installTravelCalc}
              onInstallTravelChange={onUpdateInstallTravel}
              numberOfGuys={fullSchedule.numberOfGuys}
              onNumberOfGuysChange={(n) => onUpdateSchedule({ ...fullSchedule, numberOfGuys: n })}
              projectSpecificDetails={psd}
              onProjectSpecificDetailsChange={onUpdateProjectSpecificDetails}
            />
          )}

          {panelId.startsWith("input-values-") && tech && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <BomImportDialog
                  tech={tech}
                  coloSites={project.coloSites}
                  onApply={onUpdateTechnology}
                  projectSpecificDetails={psd}
                  numberOfGuys={project.schedule.numberOfGuys}
                  hoursPerDay={project.inputParameters.hoursPerDay ?? 8}
                  daysPerWeek={project.inputParameters.daysPerWeek ?? 5}
                />
              </div>
              <InputValuesTable
                tech={tech}
                coloSites={project.coloSites}
                onChange={onUpdateTechnology}
              />
            </div>
          )}

          {panelId.startsWith("tech-details-") && tech && (
            <PerTechDetailsCard
              technologies={[tech]}
              onChange={onUpdateTechnology}
            />
          )}
        </div>

        {/* Done button */}
        <div className="shrink-0 px-5 py-3 border-t border-border/60 flex justify-end">
          <Button size="sm" onClick={onClose} className="h-8 px-5 text-sm">
            <ChevronLeft className="h-3.5 w-3.5 mr-1.5" /> Done
          </Button>
        </div>
      </div>
    </>
  );
}

// suppress unused import warning
void ChevronsUpDown;
