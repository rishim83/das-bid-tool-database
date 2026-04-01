"use client";

import { useState } from "react";
import { v4 as uuid } from "uuid";
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
import { TECHNOLOGY_LABELS, TECHNOLOGY_DOT, TECHNOLOGY_BG, TECHNOLOGY_TINT_DARK } from "@/lib/constants";

const TECH_ACCENT_HEX: Record<string, string> = {
  DAS: "#3b82f6",
  PUBLIC_SAFETY: "#ef4444",
  ROIP: "#f97316",
};
import { formatCurrency, calculateInstallTravel, computeEffectiveLaborHoursPerColo } from "@/lib/calculations";
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
  Plus,
  Trash2,
  CopyCheck,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  | `tech-details-${TechnologyType}`
  | `rf-services-${TechnologyType}`;

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
    <div className="border-b border-sidebar-border">
      <button
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors text-left ${
          open
            ? "bg-sidebar-accent/50 hover:bg-sidebar-accent/70"
            : "hover:bg-sidebar-accent/40"
        }`}
        onClick={() => setOpen((v) => !v)}
      >
        {icon && (
          <span className="h-5 w-5 flex items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
            {icon}
          </span>
        )}
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
          {title}
        </span>
        {!open && summary && (
          <span className="text-[11px] text-muted-foreground/50 truncate max-w-[120px]">{summary}</span>
        )}
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />}
      </button>
      {open && (
        <div className="pb-2 bg-card border-t border-sidebar-border/40">
          {children}
        </div>
      )}
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
      className={`w-full flex items-center justify-between px-3 py-2 transition-colors group ${
        accent
          ? "bg-primary/5 hover:bg-primary/10 border-y border-primary/10"
          : "hover:bg-sidebar-accent/70"
      }`}
    >
      <span className={`text-xs font-medium ${accent ? "text-primary/80 group-hover:text-primary" : "text-foreground/80"}`}>{label}</span>
      <div className="flex items-center gap-1.5">
        {summary && (
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground/60">{summary}</span>
        )}
        <ChevronRight className={`h-3 w-3 transition-colors ${accent ? "text-primary/40 group-hover:text-primary/70" : "text-muted-foreground/30 group-hover:text-muted-foreground/60"}`} />
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
  total,
  tooltip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: string;
  total?: string;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 gap-2">
      {tooltip ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[10.5px] text-muted-foreground/60 shrink-0 cursor-help border-b border-dashed border-muted-foreground/30">{label}</span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[220px] text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <span className="text-[10.5px] text-muted-foreground/60 shrink-0">{label}</span>
      )}
      <div className="flex items-center gap-1.5 shrink-0">
      {total && <span className="text-[10px] font-mono tabular-nums text-muted-foreground/40">{total}</span>}
      <div className="flex items-stretch rounded-md border border-border/50 bg-input/50 overflow-hidden focus-within:border-primary/40 transition-colors">
        {prefix && (
          <span className="flex items-center px-2 text-[11px] text-muted-foreground/50 bg-muted/20 border-r border-border/40 shrink-0">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="h-7 w-20 border-0 shadow-none bg-transparent text-right text-xs font-mono tabular-nums focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {suffix && (
          <span className="flex items-center px-2 text-[11px] text-muted-foreground/50 bg-muted/20 border-l border-border/40 shrink-0">
            {suffix}
          </span>
        )}
      </div>
      </div>
    </div>
  );
}

// ─── Checkbox field ─────────────────────────────────────────────

function CheckboxField({
  label,
  checked,
  onChange,
  tooltip,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  tooltip?: string;
}) {
  return (
    <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-sidebar-accent/50 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-border/50 accent-primary cursor-pointer shrink-0"
      />
      {tooltip ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-foreground/80 cursor-help border-b border-dashed border-muted-foreground/30">{label}</span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[220px] text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <span className="text-xs text-foreground/80">{label}</span>
      )}
    </label>
  );
}

// ─── Read-only display row ───────────────────────────────────────

function DisplayRow({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  const inner = (
    <div className={`flex items-center justify-between px-3 py-1.5 bg-muted/20 ${tooltip ? "cursor-help" : ""}`}>
      <span className={`text-xs text-muted-foreground/70 ${tooltip ? "underline decoration-dotted underline-offset-2" : ""}`}>
        {label}
      </span>
      <span className="text-xs font-mono font-semibold tabular-nums">{value}</span>
    </div>
  );
  if (!tooltip) return inner;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        <span className="font-mono text-[11px]">{tooltip}</span>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Field group — flat label or collapsible section ────────────

function FieldGroup({
  title,
  children,
  collapsible = false,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const labelClass = "text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/40";

  if (collapsible) {
    return (
      <div className="mt-2 border-t border-border/20">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-sidebar-accent/40 transition-colors"
        >
          <span className={labelClass}>{title}</span>
          {open
            ? <ChevronDown className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            : <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
        </button>
        {open && <div className="pb-1">{children}</div>}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="mx-3 mb-1 pb-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/35 border-b border-border/25">
        {title}
      </div>
      {children}
    </div>
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
  onUpdateColoSites: (sites: ColoSite[]) => void;
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
  onUpdateColoSites,
  onUpdateTechnology,
  onUpdateProjectMeta,
  onUpdateProjectSpecificDetails,
  onTabChange,
  onOpenPanel,
}: Props) {
  const ip = project.inputParameters;
  const colos = project.coloSites;
  const [travelTechView, setTravelTechView] = useState<"ALL" | TechnologyType>("ALL");

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
        <div className="px-3 pt-1 pb-2 flex flex-col gap-1.5">
          {colos.map((site) => (
            <div key={site.id} className="flex items-center gap-1">
              <Input
                value={site.name}
                onChange={(e) => onUpdateColoSites(colos.map((s) => s.id === site.id ? { ...s, name: e.target.value } : s))}
                className="h-7 flex-1 text-xs bg-input/40 border-border/50 rounded-md"
              />
              {colos.length > 1 && (
                <button
                  onClick={() => onUpdateColoSites(colos.filter((s) => s.id !== site.id))}
                  className="h-5 w-5 flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <Button
            variant="ghost" size="sm"
            onClick={() => onUpdateColoSites([...colos, { id: uuid(), name: `COLO ${colos.length}` }])}
            className="h-6 text-xs text-muted-foreground border border-dashed border-border/50 hover:border-primary/40 hover:text-primary transition-colors w-full"
          >
            <Plus className="h-3 w-3 mr-1" /> Add COLO
          </Button>
        </div>
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
          <div className="mx-3 mt-3 mb-1 pb-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/35 border-b border-border/25">
            Install Rate
          </div>
          <InlineField
            label="Cost"
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
          <div className="mx-3 mt-3 mb-1 pb-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/35 border-b border-border/25">
            PM Rate
          </div>
          <InlineField
            label="Cost"
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
            const guys = Math.max(fullSchedule.numberOfGuys, 1);
            return (
              <>
                <InlineField
                  label="Travel %"
                  value={it.travelPercent}
                  onChange={(v) => onUpdateInstallTravel({ ...it, travelPercent: v })}
                  suffix="%"
                  tooltip="% of total billed labor hours used as travel hours"
                />
                <InlineField
                  label="Per Diem / Day"
                  value={it.perDiemRate}
                  onChange={(v) => onUpdateInstallTravel({ ...it, perDiemRate: v })}
                  prefix="$"
                  tooltip={installTravelCalc
                    ? `Rate/day × Calendar Days (w/ weekends) × ${guys} techs = ${formatCurrency(installTravelCalc.perDiemTotal)}`
                    : `Rate/day × Calendar Days (w/ weekends) × ${guys} techs`}
                />
                <InlineField
                  label="Round Trips"
                  value={it.roundTrips ?? 1}
                  onChange={(v) => onUpdateInstallTravel({ ...it, roundTrips: Math.max(0, v) })}
                  step="1"
                  tooltip="Number of round trips for the crew (used for airfare & travel labor)"
                />
                <InlineField
                  label="Airfare / Trip"
                  value={it.airfarePricePerTrip}
                  onChange={(v) => onUpdateInstallTravel({ ...it, airfarePricePerTrip: v })}
                  prefix="$"
                  tooltip={installTravelCalc
                    ? `Price/trip × ${it.roundTrips ?? 1} round trips × ${guys} techs = ${formatCurrency(installTravelCalc.airfareTotal)}`
                    : `Price/trip × ${it.roundTrips ?? 1} round trips × ${guys} techs`}
                />
                <InlineField
                  label="Lodging / Night"
                  value={it.lodgingRatePerNight}
                  onChange={(v) => onUpdateInstallTravel({ ...it, lodgingRatePerNight: v })}
                  prefix="$"
                  tooltip={installTravelCalc
                    ? `Rate/night × Calendar Days (w/ weekends) × ${guys} techs = ${formatCurrency(installTravelCalc.lodgingTotal)}`
                    : `Rate/night × Calendar Days (w/ weekends) × ${guys} techs`}
                />
                <InlineField
                  label="Car Rental / Day"
                  value={it.carRentalPerDay ?? 0}
                  onChange={(v) => onUpdateInstallTravel({ ...it, carRentalPerDay: v })}
                  prefix="$"
                  tooltip={installTravelCalc
                    ? `Rate/day × Calendar Days (w/ weekends) × ${(guys / 2).toFixed(1)} cars (# techs ÷ 2) = ${formatCurrency(installTravelCalc.carRentalTotal)}`
                    : `Rate/day × Calendar Days (w/ weekends) × ${(guys / 2).toFixed(1)} cars (# techs ÷ 2)`}
                />
                <InlineField
                  label="Fuel (flat)"
                  value={it.fuel}
                  onChange={(v) => onUpdateInstallTravel({ ...it, fuel: v })}
                  prefix="$"
                  tooltip="Flat fuel cost added to travel total"
                />
                {installTravelCalc && (() => {
                  const itCfg = project.installTravel ?? DEFAULT_INSTALL_TRAVEL;
                  const ipCfg = project.inputParameters;
                  const hpd = ipCfg.hoursPerDay ?? 8;
                  const numGuys = fullSchedule.numberOfGuys;
                  const laborSafety = ipCfg.laborSafety ?? 1;

                  // Enabled techs with their effective hours
                  const enabledTechs = project.technologies.filter((t) => t.enabled);
                  const techHoursMap = enabledTechs.map((t) => {
                    const eff = computeEffectiveLaborHoursPerColo(t, psd, numGuys, hpd);
                    return {
                      type: t.type,
                      hours: Object.values(eff).reduce((s, h) => s + (h || 0), 0) * laborSafety,
                    };
                  });
                  const totalHours = techHoursMap.reduce((s, t) => s + t.hours, 0);

                  // Toggle options: All + each enabled tech
                  const toggleOptions: Array<"ALL" | TechnologyType> = [
                    "ALL",
                    ...enabledTechs.map((t) => t.type as TechnologyType),
                  ];

                  // For ALL: use the already-computed installTravelCalc prop directly
                  // For per-tech: recompute with that tech's proportional hours
                  const viewCalc = travelTechView === "ALL"
                    ? installTravelCalc
                    : (() => {
                        const techHours = techHoursMap.find((t) => t.type === travelTechView)?.hours ?? 0;
                        if (techHours <= 0 || totalHours <= 0) return null;
                        return calculateInstallTravel(
                          itCfg,
                          techHours,
                          hpd,
                          numGuys,
                          ipCfg.travelIndirectMarkup ?? 1.23,
                          ipCfg.buyHourlyRate ?? 55
                        );
                      })();

                  const travelDays = viewCalc?.projectDays ?? 0;
                  const calendarDays = viewCalc?.calendarDays ?? 0;

                  return (
                    <TooltipProvider>
                      {/* Tech toggle — always show when at least one tech is enabled */}
                      {toggleOptions.length > 1 && (
                        <div className="flex gap-1 px-3 pt-2 pb-1 flex-wrap">
                          {toggleOptions.map((opt) => (
                            <button
                              key={opt}
                              onClick={() => setTravelTechView(opt)}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                                travelTechView === opt
                                  ? "bg-primary/20 text-primary border border-primary/30"
                                  : "bg-muted/30 text-muted-foreground/60 border border-border/30 hover:bg-muted/50"
                              }`}
                            >
                              {opt === "ALL" ? "All" : opt === "PUBLIC_SAFETY" ? "PS" : opt === "ROIP" ? "RoIP" : opt}
                            </button>
                          ))}
                        </div>
                      )}
                      {viewCalc && viewCalc.travelHours > 0 && (
                        <DisplayRow
                          label="Travel Hours"
                          value={`${viewCalc.travelHours.toFixed(1)} h`}
                          tooltip="Total Labor Hours × Travel %"
                        />
                      )}
                      {travelDays > 0 && (
                        <DisplayRow
                          label="Travel Days"
                          value={`${travelDays.toFixed(1)} d`}
                          tooltip="Travel Hours ÷ Hours/Day ÷ # of Guys"
                        />
                      )}
                      {calendarDays > 0 && (
                        <DisplayRow
                          label="Calendar Days (w/ weekends)"
                          value={`${calendarDays.toFixed(1)} d`}
                          tooltip="Travel Days + floor(Travel Days ÷ 5) × 2"
                        />
                      )}
                      {viewCalc && (
                        <>
                          <DisplayRow
                            label="Travel Labor"
                            value={formatCurrency(viewCalc.travelLaborTotal)}
                            tooltip="Round Trips × Cost Rate × 16  (2 travel days × 8 hrs per round trip)"
                          />
                          <DisplayRow
                            label="Subtotal"
                            value={formatCurrency(viewCalc.rawTotal)}
                            tooltip="(Per Diem + Lodging) × Cal Days (w/ weekends) × # Guys  |  Airfare × Round Trips × # Guys  |  Car Rental × Cal Days (w/ weekends) × (# Guys ÷ 2)  |  + Travel Labor + Fuel"
                          />
                          <DisplayRow
                            label="Total (w/ markup)"
                            value={formatCurrency(viewCalc.markedUpTotal)}
                            tooltip={`Subtotal × ${ipCfg.travelIndirectMarkup ?? 1.23} (T&I Markup)`}
                          />
                        </>
                      )}
                    </TooltipProvider>
                  );
                })()}
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
          summary={[psd.jHooks && "J Hooks"].filter(Boolean).join(" · ") || "None"}
        >
          <CheckboxField
            label="J Hooks for Pathway"
            checked={psd.jHooks}
            onChange={(v) => onUpdateProjectSpecificDetails({ ...psd, jHooks: v })}
          />
          <CheckboxField
            label="Exclude Materials"
            checked={!!psd.extras?.excludeMaterials}
            onChange={(v) => onUpdateProjectSpecificDetails({ ...psd, extras: { ...psd.extras, excludeMaterials: v } })}
          />
        </SidebarSection>
      )}

      {/* ── EXTRAS (NC only) ──────────────────────────── */}
      {!isNTI && (
        <SidebarSection
          title="Extras"
          icon={<Wrench className="h-3.5 w-3.5" />}
          summary={[
            psd.badgingSafety && "Badging",
            psd.extras?.shuttleServices && "Shuttle",
            psd.extras?.stretchAndFlex && "Stretch",
            psd.extras?.liftSpotters && "Lift",
          ].filter(Boolean).join(" · ") || "None"}
        >
          <CheckboxField
            label="Badging / Safety"
            checked={psd.badgingSafety}
            onChange={(v) => onUpdateProjectSpecificDetails({ ...psd, badgingSafety: v })}
            tooltip="Adds 4 hrs per tech (# of Guys × 4 hrs)"
          />
          <CheckboxField
            label="Shuttle Services"
            checked={!!psd.extras?.shuttleServices}
            onChange={(v) => onUpdateProjectSpecificDetails({ ...psd, extras: { ...psd.extras, shuttleServices: v } })}
            tooltip="Adds 1 hr per project day (Base Hours ÷ Hours/Day)"
          />
          <CheckboxField
            label="Stretch & Flex"
            checked={!!psd.extras?.stretchAndFlex}
            onChange={(v) => onUpdateProjectSpecificDetails({ ...psd, extras: { ...psd.extras, stretchAndFlex: v } })}
            tooltip="Adds 0.5 hrs per project day (Base Hours ÷ Hours/Day × 0.5)"
          />
          <CheckboxField
            label="Lift Spotters"
            checked={!!psd.extras?.liftSpotters}
            onChange={(v) => onUpdateProjectSpecificDetails({ ...psd, extras: { ...psd.extras, liftSpotters: v } })}
            tooltip="Adds 65% of Base Hours ÷ # of Guys"
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
        {/* ── Enable toggles (all 3 at top) ── */}
        <div className="grid grid-cols-3 gap-px border-b border-sidebar-border/40 bg-sidebar-border/40">
          {TECH_TYPES.map((type) => {
            const t = project.technologies.find((x) => x.type === type);
            if (!t) return null;
            return (
              <label
                key={type}
                className="flex flex-col items-center gap-1.5 py-2.5 px-1 cursor-pointer bg-card hover:bg-sidebar-accent/50 transition-colors"
              >
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${TECHNOLOGY_BG[type]} ${TECHNOLOGY_TINT_DARK[type]}`}>
                  {type === "PUBLIC_SAFETY" ? "PS" : type}
                </span>
                <input
                  type="checkbox"
                  checked={t.enabled}
                  onChange={(e) => onUpdateTechnology({ ...t, enabled: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-border/50 accent-primary cursor-pointer"
                />
              </label>
            );
          })}
        </div>

        {/* ── Tech tabs ── */}
        <div className="flex border-b border-sidebar-border/50 mx-3 mt-2 mb-1 gap-0.5">
          {TECH_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => onTabChange(type)}
              className={`flex-1 py-1.5 text-[11px] font-semibold rounded-t transition-colors ${
                activeTab === type ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              style={activeTab === type
                ? { borderBottom: `2px solid ${TECH_ACCENT_HEX[type]}` }
                : { borderBottom: "2px solid transparent" }}
            >
              {type === "PUBLIC_SAFETY" ? "PS" : type}
            </button>
          ))}
        </div>

        {/* ── Active tech content ── */}
        {TECH_TYPES.map((type) => {
          if (type !== activeTab) return null;
          const tech = project.technologies.find((t) => t.type === type);
          if (!tech) return null;

          if (!tech.enabled) {
            return (
              <p key={type} className="px-3 py-3 text-xs text-muted-foreground/50 text-center">
                {type === "PUBLIC_SAFETY" ? "PS" : type} is disabled
              </p>
            );
          }

          const rental = tech.rentalEquipment ?? DEFAULT_RENTAL_EQUIPMENT;
          const additionalLabor = tech.additionalLaborItems ?? [];
          const additionalMaterials = tech.additionalMaterials ?? [];
          const subs = tech.subContractors ?? [];

          const update = (patch: Partial<typeof tech>) =>
            onUpdateTechnology({ ...tech, ...patch });

          const addLaborItem = () =>
            update({ additionalLaborItems: [...additionalLabor, { id: uuid(), description: "", hours: 0 }] });
          const updateLaborItem = (id: string, field: "description" | "hours", val: string | number) =>
            update({ additionalLaborItems: additionalLabor.map((i) => i.id === id ? { ...i, [field]: val } : i) });
          const removeLaborItem = (id: string) =>
            update({ additionalLaborItems: additionalLabor.filter((i) => i.id !== id) });

          const addMaterialItem = () =>
            update({ additionalMaterials: [...additionalMaterials, { id: uuid(), name: "", value: 0 }] });
          const updateMaterialItem = (id: string, field: "name" | "value", val: string | number) =>
            update({ additionalMaterials: additionalMaterials.map((m) => m.id === id ? { ...m, [field]: val } : m) });
          const removeMaterialItem = (id: string) =>
            update({ additionalMaterials: additionalMaterials.filter((m) => m.id !== id) });

          const addSub = () =>
            update({ subContractors: [...subs, { id: uuid(), task: "", value: 0 }] });
          const updateSub = (id: string, field: "task" | "value", val: string | number) =>
            update({ subContractors: subs.map((s) => s.id === id ? { ...s, [field]: val } : s) });
          const removeSub = (id: string) =>
            update({ subContractors: subs.filter((s) => s.id !== id) });

          const rfItems = tech.rfLineItems ?? [];
          const addRFItem = () =>
            update({ rfLineItems: [...rfItems, { id: uuid(), description: "New Item", values: {} }] });
          const updateRFItem = (id: string, field: string, val: string | number, coloId?: string) => {
            if (field === "description") {
              update({ rfLineItems: rfItems.map((i) => i.id === id ? { ...i, description: String(val) } : i) });
            } else if (coloId) {
              update({ rfLineItems: rfItems.map((i) => i.id === id ? { ...i, values: { ...i.values, [coloId]: Number(val) } } : i) });
            }
          };
          const removeRFItem = (id: string) =>
            update({ rfLineItems: rfItems.filter((i) => i.id !== id) });
          const rfTotal = rfItems.reduce((s, i) => s + Object.values(i.values).reduce((vs, v) => vs + (v || 0), 0), 0);

          const updateLift = (field: string, val: number | boolean) =>
            update({ rentalEquipment: { ...rental, lift: { ...rental.lift, [field]: val } } });
          const addRentalItem = () =>
            update({ rentalEquipment: { ...rental, additionalItems: [...(rental.additionalItems ?? []), { id: uuid(), name: "", months: 0, costPerMonth: 0 }] } });
          const updateRentalItem = (id: string, field: string, val: string | number) =>
            update({ rentalEquipment: { ...rental, additionalItems: (rental.additionalItems ?? []).map((i) => i.id === id ? { ...i, [field]: val } : i) } });
          const removeRentalItem = (id: string) =>
            update({ rentalEquipment: { ...rental, additionalItems: (rental.additionalItems ?? []).filter((i) => i.id !== id) } });

          const liftTotal = (rental.lift.numberOfLifts ?? 1) * rental.lift.months * rental.lift.costPerMonth;
          const addlRentalTotal = (rental.additionalItems ?? []).reduce((s, i) => s + i.months * i.costPerMonth, 0);
          const addlLaborTotal = additionalLabor.reduce((s, i) => s + (i.hours || 0), 0);
          const addlMatTotal = additionalMaterials.reduce((s, m) => s + (m.value || 0), 0);
          const subTotal = subs.reduce((s, sub) => s + (sub.value || 0), 0);

          return (
            <div key={type} className="pb-3">
              {/* Upload BOM */}
              <PanelTrigger
                label="Click here to Upload BOM"
                summary={getTechInputSummary(tech)}
                onClick={() => onOpenPanel(`input-values-${type}`)}
              />

              {/* Inline fields */}
              {!isNTI && project.coloSites.map((colo) => (
                <InlineField
                  key={colo.id}
                  label={project.coloSites.length > 1 ? `PM Trips (${colo.name})` : "PM Trips"}
                  value={tech.pmTrips[colo.id] ?? 0}
                  onChange={(v) => update({ pmTrips: { ...tech.pmTrips, [colo.id]: v } })}
                  step="1"
                />
              ))}
              <InlineField
                label="Material Handling"
                value={tech.materialHandlingHours ?? 0}
                onChange={(v) => update({ materialHandlingHours: v })}
                suffix="hrs"
              />
              <InlineField
                label="Commissioning"
                value={tech.commissioningSupport ?? 0}
                onChange={(v) => update({ commissioningSupport: v })}
                suffix="hrs"
              />
              <InlineField
                label="Water & Ice"
                value={tech.waterAndIce ?? 0}
                onChange={(v) => update({ waterAndIce: v })}
                prefix="$"
              />

              {/* RF Services */}
              <PanelTrigger
                label="RF Services"
                summary={rfTotal > 0 ? formatCurrency(rfTotal) : `${rfItems.length} items`}
                onClick={() => onOpenPanel(`rf-services-${type}`)}
              />

              {/* Additional Labor */}
              <FieldGroup title="Additional Labor" collapsible>
                <div className="px-3 pb-2 flex flex-col gap-1.5">
                  {additionalLabor.map((item) => (
                    <div key={item.id} className="flex items-center gap-1">
                      <Input
                        value={item.description}
                        onChange={(e) => updateLaborItem(item.id, "description", e.target.value)}
                        placeholder="Description"
                        className="h-7 flex-1 bg-input/50 border-border/50 text-xs rounded-md min-w-0"
                      />
                      <Input
                        type="number" step="any" min={0}
                        value={item.hours}
                        onChange={(e) => updateLaborItem(item.id, "hours", parseFloat(e.target.value) || 0)}
                        className="h-7 w-14 bg-input/50 border-border/50 text-right text-xs font-mono tabular-nums rounded-md shrink-0"
                      />
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">h</span>
                      <button onClick={() => removeLaborItem(item.id)} className="h-5 w-5 flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors shrink-0">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={addLaborItem}
                    className="h-6 text-xs text-muted-foreground border border-dashed border-border/40 hover:border-primary/40 hover:text-primary w-full">
                    <Plus className="h-3 w-3 mr-1" /> Add Labor
                  </Button>
                </div>
              </FieldGroup>

              {/* Additional Materials */}
              <FieldGroup title="Additional Materials" collapsible>
                <div className="px-3 pb-2 flex flex-col gap-1.5">
                  {additionalMaterials.map((item) => (
                    <div key={item.id} className="flex items-center gap-1">
                      <Input
                        value={item.name}
                        onChange={(e) => updateMaterialItem(item.id, "name", e.target.value)}
                        placeholder="Name"
                        className="h-7 flex-1 bg-input/50 border-border/50 text-xs rounded-md min-w-0"
                      />
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">$</span>
                      <Input
                        type="number" step="any" min={0}
                        value={item.value}
                        onChange={(e) => updateMaterialItem(item.id, "value", parseFloat(e.target.value) || 0)}
                        className="h-7 w-20 bg-input/50 border-border/50 text-right text-xs font-mono tabular-nums rounded-md shrink-0"
                      />
                      <button onClick={() => removeMaterialItem(item.id)} className="h-5 w-5 flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors shrink-0">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={addMaterialItem}
                    className="h-6 text-xs text-muted-foreground border border-dashed border-border/40 hover:border-primary/40 hover:text-primary w-full">
                    <Plus className="h-3 w-3 mr-1" /> Add Material
                  </Button>
                </div>
              </FieldGroup>

              {/* Subcontractors */}
              <FieldGroup title="Subcontractors" collapsible>
                <div className="px-3 pb-2 flex flex-col gap-1.5">
                  {subs.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-1">
                      <Input
                        value={sub.task}
                        onChange={(e) => updateSub(sub.id, "task", e.target.value)}
                        placeholder="Task"
                        className="h-7 flex-1 bg-input/50 border-border/50 text-xs rounded-md min-w-0"
                      />
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">$</span>
                      <Input
                        type="number" step="any" min={0}
                        value={sub.value}
                        onChange={(e) => updateSub(sub.id, "value", parseFloat(e.target.value) || 0)}
                        className="h-7 w-20 bg-input/50 border-border/50 text-right text-xs font-mono tabular-nums rounded-md shrink-0"
                      />
                      <button onClick={() => removeSub(sub.id)} className="h-5 w-5 flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors shrink-0">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={addSub}
                    className="h-6 text-xs text-muted-foreground border border-dashed border-border/40 hover:border-primary/40 hover:text-primary w-full">
                    <Plus className="h-3 w-3 mr-1" /> Add Subcontractor
                  </Button>
                </div>
              </FieldGroup>

              {/* Rental Equipment */}
              <FieldGroup title="Rental Equipment" collapsible>
                <div className="px-3 pb-2 flex flex-col gap-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">Lift</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Input
                      type="number" step="1" min={0}
                      value={rental.lift.numberOfLifts ?? 1}
                      onChange={(e) => updateLift("numberOfLifts", parseFloat(e.target.value) || 0)}
                      className="h-7 w-10 bg-input/50 border-border/50 text-right text-xs font-mono rounded-md shrink-0"
                    />
                    <span className="text-[10px] text-muted-foreground/60">×</span>
                    <Input
                      type="number" step="any" min={0}
                      value={rental.lift.months}
                      onChange={(e) => updateLift("months", parseFloat(e.target.value) || 0)}
                      className="h-7 w-10 bg-input/50 border-border/50 text-right text-xs font-mono rounded-md shrink-0"
                    />
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">mo @$</span>
                    <Input
                      type="number" step="any" min={0}
                      value={rental.lift.costPerMonth}
                      onChange={(e) => updateLift("costPerMonth", parseFloat(e.target.value) || 0)}
                      className="h-7 w-16 bg-input/50 border-border/50 text-right text-xs font-mono rounded-md shrink-0"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!rental.lift.includeLiftAdder}
                      onChange={(e) => updateLift("includeLiftAdder", e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border/50 accent-primary cursor-pointer shrink-0"
                    />
                    <span className="text-[10.5px] text-muted-foreground/70">Include Lift Adder</span>
                  </label>
                  {(rental.additionalItems ?? []).map((item) => (
                    <div key={item.id} className="flex items-center gap-1">
                      <Input
                        value={item.name}
                        onChange={(e) => updateRentalItem(item.id, "name", e.target.value)}
                        placeholder="Item"
                        className="h-7 flex-1 bg-input/50 border-border/50 text-xs rounded-md min-w-0"
                      />
                      <Input
                        type="number" step="any" min={0}
                        value={item.months}
                        onChange={(e) => updateRentalItem(item.id, "months", parseFloat(e.target.value) || 0)}
                        className="h-7 w-10 bg-input/50 border-border/50 text-right text-xs font-mono rounded-md shrink-0"
                      />
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">mo</span>
                      <Input
                        type="number" step="any" min={0}
                        value={item.costPerMonth}
                        onChange={(e) => updateRentalItem(item.id, "costPerMonth", parseFloat(e.target.value) || 0)}
                        className="h-7 w-16 bg-input/50 border-border/50 text-right text-xs font-mono rounded-md shrink-0"
                      />
                      <button onClick={() => removeRentalItem(item.id)} className="h-5 w-5 flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors shrink-0">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={addRentalItem}
                    className="h-6 text-xs text-muted-foreground border border-dashed border-border/40 hover:border-primary/40 hover:text-primary w-full">
                    <Plus className="h-3 w-3 mr-1" /> Add Equipment
                  </Button>
                </div>
              </FieldGroup>
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
    panelTitles[`rf-services-${techType}`] = `${TECHNOLOGY_LABELS[techType]} — RF Services`;
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

          {panelId.startsWith("rf-services-") && tech && (() => {
            const rfItems = tech.rfLineItems ?? [];
            const updateTech = (patch: Partial<TechnologyConfig>) => onUpdateTechnology({ ...tech, ...patch });
            const addRF = () => updateTech({ rfLineItems: [...rfItems, { id: uuid(), description: "New Item", values: {} }] });
            const removeRF = (id: string) => updateTech({ rfLineItems: rfItems.filter((i) => i.id !== id) });
            const updateRFDesc = (id: string, desc: string) =>
              updateTech({ rfLineItems: rfItems.map((i) => i.id === id ? { ...i, description: desc } : i) });
            const updateRFVal = (id: string, coloId: string, val: number) =>
              updateTech({ rfLineItems: rfItems.map((i) => i.id === id ? { ...i, values: { ...i.values, [coloId]: val } } : i) });
            const copyToAll = (id: string) => {
              const item = rfItems.find((i) => i.id === id);
              const firstColo = project.coloSites[0];
              if (!item || !firstColo) return;
              const srcVal = item.values[firstColo.id] || 0;
              const newVals: Record<string, number> = {};
              project.coloSites.forEach((c) => { newVals[c.id] = srcVal; });
              updateTech({ rfLineItems: rfItems.map((i) => i.id === id ? { ...i, values: newVals } : i) });
            };

            return (
              <div className="space-y-3">
                <div className="border border-border/60 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/20">
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-8">#</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
                        {project.coloSites.map((c) => (
                          <th key={c.id} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground min-w-[120px]">{c.name}</th>
                        ))}
                        <th className="px-2 py-2 w-16" />
                      </tr>
                    </thead>
                    <tbody>
                      {rfItems.map((item, idx) => (
                        <tr key={item.id} className="border-t border-border/25 group hover:bg-accent/30 transition-colors">
                          <td className="px-3 py-1.5 text-xs text-muted-foreground/60">{idx + 1}</td>
                          <td className="px-3 py-1.5">
                            <Input
                              value={item.description}
                              onChange={(e) => updateRFDesc(item.id, e.target.value)}
                              className="h-7 text-xs border-transparent hover:border-border/50 bg-transparent"
                            />
                          </td>
                          {project.coloSites.map((c) => (
                            <td key={c.id} className="px-2 py-1.5 text-center">
                              <Input
                                type="number" step="any"
                                value={item.values[c.id] || ""}
                                onChange={(e) => updateRFVal(item.id, c.id, parseFloat(e.target.value) || 0)}
                                placeholder="-"
                                className="h-7 w-28 bg-input/30 border-border/40 text-right text-xs font-mono tabular-nums rounded-md"
                              />
                            </td>
                          ))}
                          <td className="px-1 py-1.5">
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-foreground" onClick={() => copyToAll(item.id)} title={`Copy ${project.coloSites[0]?.name || "first"} to all`}>
                                <CopyCheck className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-destructive" onClick={() => removeRF(item.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {rfItems.length > 0 && (
                        <tr className="border-t border-border/40 bg-muted/10">
                          <td className="px-3 py-1.5" />
                          <td className="px-3 py-1.5 text-xs font-medium text-muted-foreground text-right">Total</td>
                          {project.coloSites.map((c) => (
                            <td key={c.id} className="px-2 py-1.5 text-center text-xs font-mono tabular-nums font-medium">
                              {formatCurrency(rfItems.reduce((s, i) => s + (i.values[c.id] || 0), 0))}
                            </td>
                          ))}
                          <td />
                        </tr>
                      )}
                      <tr className="border-t border-border/30">
                        <td colSpan={project.coloSites.length + 3} className="px-3 py-1.5">
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground/60 hover:text-primary" onClick={addRF}>
                            <Plus className="h-3 w-3 mr-1" /> Add Line Item
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

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
