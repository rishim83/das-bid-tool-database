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
  DollarSign,
  Clock,
  Plane,
  Car,
  Clipboard,
  Wrench,
  PackageOpen,
  X,
  SlidersHorizontal,
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

// ─── Checkbox field ─────────────────────────────────────────────

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-sidebar-accent/50 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-border/50 accent-primary cursor-pointer shrink-0"
      />
      <span className="text-xs text-foreground/80">{label}</span>
    </label>
  );
}

// ─── Read-only display row ───────────────────────────────────────

function DisplayRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20">
      <span className="text-xs text-muted-foreground/70">{label}</span>
      <span className="text-xs font-mono font-semibold tabular-nums">{value}</span>
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
  psd: ProjectSpecificDetails;
  fullSchedule: Schedule;
  pmTravelCalculated: PMTravelCalculated;
  installTravelCalc: InstallTravelCalculated | null;
  activeTab: TechnologyType;
  isNTI: boolean;
  onUpdateInputParameters: (p: InputParameters) => void;
  onUpdateSchedule: (s: Schedule) => void;
  onUpdatePMTravel: (t: PMTravelEstimate) => void;
  onUpdateInstallTravel: (t: InstallTravelConfig) => void;
  onUpdateTechnology: (t: TechnologyConfig) => void;
  onUpdateProjectMeta: (patch: Partial<Project>) => void;
  onUpdateProjectSpecificDetails: (psd: ProjectSpecificDetails) => void;
  onTabChange: (tab: TechnologyType) => void;
  onOpenPanel: (id: SidebarPanelId) => void;
}

const TECH_TYPES: TechnologyType[] = ["DAS", "PUBLIC_SAFETY", "ROIP"];

export function ProjectSidebar({
  project,
  psd,
  fullSchedule,
  pmTravelCalculated,
  installTravelCalc,
  activeTab,
  isNTI,
  onUpdateInputParameters,
  onUpdateSchedule,
  onUpdatePMTravel,
  onUpdateInstallTravel,
  onUpdateTechnology,
  onUpdateProjectMeta,
  onUpdateProjectSpecificDetails,
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

      {/* ── MARK UPS (NC only) ───────────────────────── */}
      {!isNTI && (
        <SidebarSection
          title="Mark Ups"
          icon={<DollarSign className="h-3.5 w-3.5" />}
          summary={`${Math.round((ip.markUp - 1) * 100)}% equip`}
        >
          <InlineField
            label="Equipment Markup"
            value={Math.round((ip.markUp - 1) * 10000) / 100}
            onChange={(v) => onUpdateInputParameters({ ...ip, markUp: 1 + v / 100 })}
            suffix="%"
          />
          <InlineField
            label="Sub Markup"
            value={Math.round(((ip.subMarkUp ?? 1.1) - 1) * 10000) / 100}
            onChange={(v) => onUpdateInputParameters({ ...ip, subMarkUp: 1 + v / 100 })}
            suffix="%"
          />
          <InlineField
            label="Material Contingency"
            value={Math.round((ip.materialSafety - 1) * 10000) / 100}
            onChange={(v) => onUpdateInputParameters({ ...ip, materialSafety: 1 + v / 100 })}
            suffix="%"
          />
          <InlineField
            label="Labor Contingency"
            value={Math.round((ip.laborSafety - 1) * 10000) / 100}
            onChange={(v) => onUpdateInputParameters({ ...ip, laborSafety: 1 + v / 100 })}
            suffix="%"
          />
          <InlineField
            label="Travel / Indirects"
            value={Math.round(((ip.travelIndirectMarkup ?? 1.23) - 1) * 10000) / 100}
            onChange={(v) => onUpdateInputParameters({ ...ip, travelIndirectMarkup: 1 + v / 100 })}
            suffix="%"
          />
          <InlineField
            label="Tax"
            value={ip.taxPercent ?? 0}
            onChange={(v) => onUpdateInputParameters({ ...ip, taxPercent: v })}
            suffix="%"
          />
        </SidebarSection>
      )}

      {/* ── LABOR & SCHEDULE (NC only) ────────────────── */}
      {!isNTI && (
        <SidebarSection
          title="Labor & Schedule"
          icon={<Clock className="h-3.5 w-3.5" />}
          summary={`${fullSchedule.numberOfGuys} techs · $${ip.hourlyRate ?? 0}/hr`}
        >
          <InlineField
            label="# of Techs"
            value={fullSchedule.numberOfGuys}
            onChange={(v) => onUpdateSchedule({ ...fullSchedule, numberOfGuys: Math.max(1, Math.round(v)) })}
            step="1"
          />
          <InlineField
            label="Hours / Day"
            value={ip.hoursPerDay ?? 8}
            onChange={(v) => onUpdateInputParameters({ ...ip, hoursPerDay: v })}
          />
          <InlineField
            label="Days / Week"
            value={ip.daysPerWeek ?? 5}
            onChange={(v) => onUpdateInputParameters({ ...ip, daysPerWeek: v })}
          />
          <InlineField
            label="PM on Job"
            value={Math.round((ip.pmOnJob ?? 0.1) * 100)}
            onChange={(v) => onUpdateInputParameters({ ...ip, pmOnJob: v / 100 })}
            suffix="%"
          />
          <InlineField
            label="Admin"
            value={psd.extras?.adminHours ?? 15}
            onChange={(v) => onUpdateProjectSpecificDetails({ ...psd, extras: { ...psd.extras, adminHours: v } })}
            suffix="%"
          />
          <div className="px-3 pt-2 pb-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">Install Rate</p>
          </div>
          <InlineField
            label="Buy"
            value={ip.buyHourlyRate ?? 55}
            onChange={(v) => onUpdateInputParameters({ ...ip, buyHourlyRate: v })}
            prefix="$"
          />
          <InlineField
            label="Sell"
            value={ip.hourlyRate ?? 0}
            onChange={(v) => onUpdateInputParameters({ ...ip, hourlyRate: v })}
            prefix="$"
          />
          <div className="px-3 pt-2 pb-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">PM Rate</p>
          </div>
          <InlineField
            label="Buy"
            value={ip.buyPMHourlyRate ?? 95}
            onChange={(v) => onUpdateInputParameters({ ...ip, buyPMHourlyRate: v })}
            prefix="$"
          />
          <InlineField
            label="Sell"
            value={ip.pmHourlyRate ?? 0}
            onChange={(v) => onUpdateInputParameters({ ...ip, pmHourlyRate: v })}
            prefix="$"
          />
        </SidebarSection>
      )}

      {/* ── PM TRAVEL (NC only) ───────────────────────── */}
      {!isNTI && (
        <SidebarSection
          title="PM Travel"
          icon={<Plane className="h-3.5 w-3.5" />}
          summary={pmTravelCalculated.totalPerTrip > 0 ? `${formatCurrency(pmTravelCalculated.totalPerTrip)}/trip` : "Not set"}
        >
          <InlineField
            label="Days / Trip"
            value={project.pmTravel.daysPerTrip}
            onChange={(v) => onUpdatePMTravel({ ...project.pmTravel, daysPerTrip: v })}
            step="1"
          />
          <InlineField
            label="Flight"
            value={project.pmTravel.flight}
            onChange={(v) => onUpdatePMTravel({ ...project.pmTravel, flight: v })}
            prefix="$"
          />
          <InlineField
            label="Hotel / Day"
            value={project.pmTravel.hotelPerDay}
            onChange={(v) => onUpdatePMTravel({ ...project.pmTravel, hotelPerDay: v })}
            prefix="$"
          />
          <InlineField
            label="Car Rental / Day"
            value={project.pmTravel.carRentalPerDay}
            onChange={(v) => onUpdatePMTravel({ ...project.pmTravel, carRentalPerDay: v })}
            prefix="$"
          />
          <InlineField
            label="Per Diem / Day"
            value={project.pmTravel.perDiemPerDay}
            onChange={(v) => onUpdatePMTravel({ ...project.pmTravel, perDiemPerDay: v })}
            prefix="$"
          />
          {pmTravelCalculated.totalPerTrip > 0 && (
            <DisplayRow label="Total / Trip" value={formatCurrency(pmTravelCalculated.totalPerTrip)} />
          )}
        </SidebarSection>
      )}

      {/* ── INSTALL TRAVEL (NC only) ──────────────────── */}
      {!isNTI && (
        <SidebarSection
          title="Install Travel"
          icon={<Car className="h-3.5 w-3.5" />}
          summary={installTravelCalc ? formatCurrency(installTravelCalc.markedUpTotal) : "Not set"}
        >
          {(() => {
            const it = project.installTravel ?? DEFAULT_INSTALL_TRAVEL;
            return (
              <>
                <InlineField
                  label="Travel %"
                  value={it.travelPercent}
                  onChange={(v) => onUpdateInstallTravel({ ...it, travelPercent: v })}
                  suffix="%"
                />
                <InlineField
                  label="Per Diem / Day"
                  value={it.perDiemRate}
                  onChange={(v) => onUpdateInstallTravel({ ...it, perDiemRate: v })}
                  prefix="$"
                />
                <InlineField
                  label="Airfare / Trip"
                  value={it.airfarePricePerTrip}
                  onChange={(v) => onUpdateInstallTravel({ ...it, airfarePricePerTrip: v })}
                  prefix="$"
                />
                <InlineField
                  label="Lodging / Night"
                  value={it.lodgingRatePerNight}
                  onChange={(v) => onUpdateInstallTravel({ ...it, lodgingRatePerNight: v })}
                  prefix="$"
                />
                <InlineField
                  label="Fuel (flat)"
                  value={it.fuel}
                  onChange={(v) => onUpdateInstallTravel({ ...it, fuel: v })}
                  prefix="$"
                />
                {installTravelCalc && (
                  <DisplayRow label="Total (w/ markup)" value={formatCurrency(installTravelCalc.markedUpTotal)} />
                )}
              </>
            );
          })()}
        </SidebarSection>
      )}

      {/* ── PROJECT DETAILS (NC only) ─────────────────── */}
      {!isNTI && (
        <SidebarSection
          title="Project Details"
          icon={<Clipboard className="h-3.5 w-3.5" />}
          summary={[psd.jHooks && "J Hooks", psd.badgingSafety && "Badging", psd.cores.enabled && "Cores"].filter(Boolean).join(" · ") || "None"}
        >
          <CheckboxField
            label="J Hooks for Pathway"
            checked={psd.jHooks}
            onChange={(v) => onUpdateProjectSpecificDetails({ ...psd, jHooks: v })}
          />
          <CheckboxField
            label="Badging / Safety"
            checked={psd.badgingSafety}
            onChange={(v) => onUpdateProjectSpecificDetails({ ...psd, badgingSafety: v })}
          />
          <CheckboxField
            label="Exclude Materials"
            checked={!!psd.extras?.excludeMaterials}
            onChange={(v) => onUpdateProjectSpecificDetails({ ...psd, extras: { ...psd.extras, excludeMaterials: v } })}
          />
          <div className="flex items-center gap-2 px-3 py-1.5">
            <input
              type="checkbox"
              checked={psd.cores.enabled}
              onChange={(e) => onUpdateProjectSpecificDetails({ ...psd, cores: { ...psd.cores, enabled: e.target.checked } })}
              className="h-3.5 w-3.5 rounded border-border/50 accent-primary cursor-pointer shrink-0"
            />
            <span className="text-xs text-foreground/80 flex-1">Cores</span>
            {psd.cores.enabled && (
              <Input
                type="number"
                step="1"
                value={psd.cores.count}
                onChange={(e) => onUpdateProjectSpecificDetails({ ...psd, cores: { ...psd.cores, count: parseFloat(e.target.value) || 0 } })}
                className="h-7 w-16 bg-input/40 border-border/50 text-right text-xs font-mono tabular-nums rounded-md"
              />
            )}
          </div>
        </SidebarSection>
      )}

      {/* ── EXTRAS (NC only) ──────────────────────────── */}
      {!isNTI && (
        <SidebarSection
          title="Extras"
          icon={<Wrench className="h-3.5 w-3.5" />}
          summary={[
            psd.extras?.shuttleServices && "Shuttle",
            psd.extras?.stretchAndFlex && "Stretch",
            psd.extras?.liftSpotters && "Lift",
          ].filter(Boolean).join(" · ") || "None"}
        >
          <CheckboxField
            label="Shuttle Services"
            checked={!!psd.extras?.shuttleServices}
            onChange={(v) => onUpdateProjectSpecificDetails({ ...psd, extras: { ...psd.extras, shuttleServices: v } })}
          />
          <CheckboxField
            label="Stretch & Flex"
            checked={!!psd.extras?.stretchAndFlex}
            onChange={(v) => onUpdateProjectSpecificDetails({ ...psd, extras: { ...psd.extras, stretchAndFlex: v } })}
          />
          <CheckboxField
            label="Lift Spotters"
            checked={!!psd.extras?.liftSpotters}
            onChange={(v) => onUpdateProjectSpecificDetails({ ...psd, extras: { ...psd.extras, liftSpotters: v } })}
          />
          <InlineField
            label="Composite Cleanup"
            value={Number(psd.extras?.compositeCleanup ?? 0)}
            onChange={(v) => onUpdateProjectSpecificDetails({ ...psd, extras: { ...psd.extras, compositeCleanup: v } })}
            suffix="hrs"
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
