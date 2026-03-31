"use client";

import { useState } from "react";
import type {
  InputParameters,
  PMTravelEstimate,
  PMTravelCalculated,
  InstallTravelConfig,
  InstallTravelCalculated,
  ProjectSpecificDetails,
  ProjectExtras,
} from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { DEFAULT_INPUT_PARAMETERS, DEFAULT_INSTALL_TRAVEL, DEFAULT_PM_TRAVEL, DEFAULT_PROJECT_SPECIFIC_DETAILS, DEFAULT_SCHEDULE } from "@/types";
import { formatCurrency } from "@/lib/calculations";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Shared helpers ───────────────────────────────────────────────

function ParamRow({
  label,
  value,
  prefix,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
        <Input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function EmptyPlaceholder() {
  return (
    <div className="px-3 py-5 text-center text-xs text-muted-foreground/40 italic">
      No parameters yet
    </div>
  );
}

// ─── Category card (collapsible) ─────────────────────────────────

function CategoryCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card">
      <button
        className="w-full px-3 py-2 border-b border-border/50 header-gradient flex items-center justify-between hover:bg-muted/20 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
        )}
      </button>
      {open && <div className="divide-y divide-border/30">{children}</div>}
    </div>
  );
}

// ─── Sub-collapsible (used inside Travel for PM Travel) ──────────

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors bg-muted/20 hover:bg-muted/30"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        {open ? (
          <ChevronDown className="h-3 w-3 opacity-50" />
        ) : (
          <ChevronRight className="h-3 w-3 opacity-50" />
        )}
      </button>
      {open && <div className="divide-y divide-border/20">{children}</div>}
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────

interface Props {
  params: InputParameters;
  onParamsChange: (params: InputParameters) => void;
  pmTravel: PMTravelEstimate;
  pmTravelCalculated: PMTravelCalculated;
  onPMTravelChange: (travel: PMTravelEstimate) => void;
  installTravel: InstallTravelConfig;
  installTravelCalc: InstallTravelCalculated | null;
  onInstallTravelChange: (config: InstallTravelConfig) => void;
  numberOfGuys: number;
  onNumberOfGuysChange: (n: number) => void;
  projectSpecificDetails: ProjectSpecificDetails;
  onProjectSpecificDetailsChange: (psd: ProjectSpecificDetails) => void;
}

// ─── Main panel ──────────────────────────────────────────────────

export function ParametersPanel({
  params,
  onParamsChange,
  pmTravel,
  pmTravelCalculated,
  onPMTravelChange,
  installTravel,
  installTravelCalc,
  onInstallTravelChange,
  numberOfGuys,
  onNumberOfGuysChange,
  projectSpecificDetails: psd,
  onProjectSpecificDetailsChange,
}: Props) {
  const updatePSD = (update: Partial<ProjectSpecificDetails>) => {
    onProjectSpecificDetailsChange({ ...psd, ...update });
  };
  const updateParam = (field: keyof InputParameters, value: number) => {
    onParamsChange({ ...params, [field]: value });
  };

  const handleReset = () => {
    onParamsChange({ ...DEFAULT_INPUT_PARAMETERS });
    onPMTravelChange({ ...DEFAULT_PM_TRAVEL });
    onInstallTravelChange({ ...DEFAULT_INSTALL_TRAVEL });
    onNumberOfGuysChange(DEFAULT_SCHEDULE.numberOfGuys);
    onProjectSpecificDetailsChange({ ...DEFAULT_PROJECT_SPECIFIC_DETAILS });
  };

  const updateTravel = (field: keyof PMTravelEstimate, value: number) => {
    onPMTravelChange({ ...pmTravel, [field]: value });
  };

  const updateInstallTravel = (field: keyof InstallTravelConfig, value: number) => {
    onInstallTravelChange({ ...installTravel, [field]: value });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleReset}
        >
          <RotateCcw className="h-3 w-3 mr-1" /> Reset to Defaults
        </Button>
      </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      {/* ── Mark Ups ─────────────────────────────────────────── */}
      <CategoryCard title="Mark Ups">
        <ParamRow label="Equipment Mark Up" value={Math.round((params.markUp - 1) * 10000) / 100} suffix="%" onChange={(v) => updateParam("markUp", 1 + v / 100)} />
        <ParamRow label="Sub Mark Up" value={Math.round(((params.subMarkUp ?? 1.10) - 1) * 10000) / 100} suffix="%" onChange={(v) => updateParam("subMarkUp", 1 + v / 100)} />
        <ParamRow label="Material Contingency" value={Math.round((params.materialSafety - 1) * 10000) / 100} suffix="%" onChange={(v) => updateParam("materialSafety", 1 + v / 100)} />
        <ParamRow label="Labor Contingency" value={Math.round((params.laborSafety - 1) * 10000) / 100} suffix="%" onChange={(v) => updateParam("laborSafety", 1 + v / 100)} />
        <ParamRow label="Travel / Indirects" value={Math.round(((params.travelIndirectMarkup ?? 1.23) - 1) * 10000) / 100} suffix="%" onChange={(v) => updateParam("travelIndirectMarkup", 1 + v / 100)} />
        <ParamRow label="Tax" value={params.taxPercent ?? 0} suffix="%" onChange={(v) => updateParam("taxPercent", v)} />
      </CategoryCard>

      {/* ── Travel ───────────────────────────────────────────── */}
      <CategoryCard title="Travel">
        <SubSection title="PM Travel Estimate">
          <div className="flex items-center justify-between py-2 px-3">
            <span className="text-sm text-muted-foreground">Days / trip</span>
            <Input
              type="number"
              step="1"
              value={pmTravel.daysPerTrip}
              onChange={(e) => updateTravel("daysPerTrip", parseFloat(e.target.value) || 0)}
              className="h-7 w-20 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
            />
          </div>
          <div className="flex items-center justify-between py-2 px-3">
            <span className="text-sm text-muted-foreground">Flight</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                step="any"
                value={pmTravel.flight}
                onChange={(e) => updateTravel("flight", parseFloat(e.target.value) || 0)}
                className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
              />
            </div>
          </div>
          <div className="flex items-center justify-between py-2 px-3">
            <span className="text-sm text-muted-foreground">Hotel / day</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                step="any"
                value={pmTravel.hotelPerDay}
                onChange={(e) => updateTravel("hotelPerDay", parseFloat(e.target.value) || 0)}
                className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
              />
              <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                = {formatCurrency(pmTravelCalculated.hotel)}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between py-2 px-3">
            <span className="text-sm text-muted-foreground">Car Rental / day</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                step="any"
                value={pmTravel.carRentalPerDay}
                onChange={(e) => updateTravel("carRentalPerDay", parseFloat(e.target.value) || 0)}
                className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
              />
              <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                = {formatCurrency(pmTravelCalculated.carRental)}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between py-2 px-3">
            <span className="text-sm text-muted-foreground">Per Diem / day</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                step="any"
                value={pmTravel.perDiemPerDay}
                onChange={(e) => updateTravel("perDiemPerDay", parseFloat(e.target.value) || 0)}
                className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
              />
              <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                = {formatCurrency(pmTravelCalculated.perDiem)}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between py-2.5 px-3 total-row-gradient">
            <span className="text-sm font-semibold">Total / trip</span>
            <span className="text-sm font-mono tabular-nums font-bold">
              {formatCurrency(pmTravelCalculated.totalPerTrip)}
            </span>
          </div>
        </SubSection>

        <SubSection title="Install Travel Estimate">
          {/* Travel % */}
          <div className="flex items-center justify-between py-2 px-3">
            <span className="text-sm text-muted-foreground">Travel %</span>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                step="any"
                min={0}
                max={100}
                value={installTravel.travelPercent}
                onChange={(e) => updateInstallTravel("travelPercent", parseFloat(e.target.value) || 0)}
                className="h-7 w-20 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
              />
              <span className="text-xs text-muted-foreground">%</span>
              {installTravelCalc && (
                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  → {installTravelCalc.travelHours.toFixed(1)} hrs
                </span>
              )}
            </div>
          </div>

          {/* Per Diem */}
          <div className="flex items-center justify-between py-2 px-3">
            <span className="text-sm text-muted-foreground">Per Diem</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                step="any"
                value={installTravel.perDiemRate}
                onChange={(e) => updateInstallTravel("perDiemRate", parseFloat(e.target.value) || 0)}
                className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
              />
              <span className="text-xs text-muted-foreground">/day</span>
              {installTravelCalc && (
                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  = {formatCurrency(installTravelCalc.perDiemTotal)}
                </span>
              )}
            </div>
          </div>

          {/* Travel Labor (auto) */}
          <div className="flex items-center justify-between py-2 px-3">
            <span className="text-sm text-muted-foreground">Travel Labor</span>
            <span className="text-xs text-muted-foreground tabular-nums text-right">
              {installTravelCalc
                ? `${installTravelCalc.roundTrips} trips × $${params.buyHourlyRate ?? 55}/hr = ${formatCurrency(installTravelCalc.travelLaborTotal)}`
                : <span className="italic opacity-50">auto (set % above)</span>
              }
            </span>
          </div>

          {/* Round Trips */}
          <div className="flex items-center justify-between py-2 px-3">
            <span className="text-sm text-muted-foreground">Round Trips</span>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                step="1"
                min={0}
                value={installTravel.roundTrips ?? 1}
                onChange={(e) => updateInstallTravel("roundTrips", parseFloat(e.target.value) || 0)}
                className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
              />
            </div>
          </div>

          {/* Airfare */}
          <div className="flex items-center justify-between py-2 px-3">
            <span className="text-sm text-muted-foreground">Airfare</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                step="any"
                value={installTravel.airfarePricePerTrip}
                onChange={(e) => updateInstallTravel("airfarePricePerTrip", parseFloat(e.target.value) || 0)}
                className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
              />
              <span className="text-xs text-muted-foreground">/trip</span>
              {installTravelCalc && (
                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  = {formatCurrency(installTravelCalc.airfareTotal)}
                </span>
              )}
            </div>
          </div>

          {/* Lodging */}
          <div className="flex items-center justify-between py-2 px-3">
            <span className="text-sm text-muted-foreground">Lodging</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                step="any"
                value={installTravel.lodgingRatePerNight}
                onChange={(e) => updateInstallTravel("lodgingRatePerNight", parseFloat(e.target.value) || 0)}
                className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
              />
              <span className="text-xs text-muted-foreground">/night</span>
              {installTravelCalc && (
                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  = {formatCurrency(installTravelCalc.lodgingTotal)}
                </span>
              )}
            </div>
          </div>

          {/* Car Rental */}
          <div className="flex items-center justify-between py-2 px-3">
            <span className="text-sm text-muted-foreground">Car Rental</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                step="any"
                value={installTravel.carRentalPerDay ?? 0}
                onChange={(e) => updateInstallTravel("carRentalPerDay", parseFloat(e.target.value) || 0)}
                className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
              />
              <span className="text-xs text-muted-foreground">/day</span>
              {installTravelCalc && (
                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  = {formatCurrency(installTravelCalc.carRentalTotal)}
                </span>
              )}
            </div>
          </div>

          {/* Fuel */}
          <div className="flex items-center justify-between py-2 px-3">
            <span className="text-sm text-muted-foreground">Fuel</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                step="any"
                value={installTravel.fuel}
                onChange={(e) => updateInstallTravel("fuel", parseFloat(e.target.value) || 0)}
                className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
              />
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between py-2.5 px-3 total-row-gradient">
            <span className="text-sm font-semibold">Total (w/ markup)</span>
            <span className="text-sm font-mono tabular-nums font-bold">
              {formatCurrency(installTravelCalc?.markedUpTotal ?? 0)}
            </span>
          </div>
        </SubSection>
      </CategoryCard>

      {/* ── Labor ────────────────────────────────────────────── */}
      <CategoryCard title="Labor">
        {/* Hourly Rate — Buy / Sell */}
        <div className="flex items-center gap-2 py-2 px-3">
          <span className="text-sm text-muted-foreground w-28 shrink-0">Hourly Rate</span>
          <span className="text-xs text-muted-foreground shrink-0">Cost $</span>
          <Input
            type="number"
            step="any"
            value={params.buyHourlyRate ?? 55}
            onChange={(e) => updateParam("buyHourlyRate", parseFloat(e.target.value) || 0)}
            className="h-7 w-20 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
          />
          <span className="text-xs text-muted-foreground shrink-0 ml-2">Sell $</span>
          <Input
            type="number"
            step="any"
            value={params.hourlyRate}
            onChange={(e) => updateParam("hourlyRate", parseFloat(e.target.value) || 0)}
            className="h-7 w-20 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
          />
        </div>
        {/* PM Rate — Buy / Sell */}
        <div className="flex items-center gap-2 py-2 px-3 border-t border-border/20">
          <span className="text-sm text-muted-foreground w-28 shrink-0">PM Rate</span>
          <span className="text-xs text-muted-foreground shrink-0">Cost $</span>
          <Input
            type="number"
            step="any"
            value={params.buyPMHourlyRate ?? 95}
            onChange={(e) => updateParam("buyPMHourlyRate", parseFloat(e.target.value) || 0)}
            className="h-7 w-20 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
          />
          <span className="text-xs text-muted-foreground shrink-0 ml-2">Sell $</span>
          <Input
            type="number"
            step="any"
            value={params.pmHourlyRate}
            onChange={(e) => updateParam("pmHourlyRate", parseFloat(e.target.value) || 0)}
            className="h-7 w-20 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
          />
        </div>
        <ParamRow
          label="PM on Job"
          value={params.pmOnJob * 100}
          suffix="%"
          onChange={(v) => updateParam("pmOnJob", v / 100)}
        />
        <div className="flex items-center justify-between py-2 px-3 border-t border-border/20">
          <span className="text-sm text-muted-foreground"># of Guys</span>
          <Input
            type="number"
            step="1"
            value={numberOfGuys}
            onChange={(e) => onNumberOfGuysChange(parseFloat(e.target.value) || 0)}
            className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
          />
        </div>
        <ParamRow
          label="Admin"
          value={psd.extras.adminHours}
          suffix="%"
          onChange={(v) => onProjectSpecificDetailsChange({ ...psd, extras: { ...psd.extras, adminHours: v } })}
        />
        <ParamRow
          label="Hours per Day"
          value={params.hoursPerDay ?? 8}
          onChange={(v) => updateParam("hoursPerDay", v)}
        />
        <ParamRow
          label="Days per Week"
          value={params.daysPerWeek ?? 5}
          onChange={(v) => updateParam("daysPerWeek", v)}
        />
      </CategoryCard>

      {/* ── Project Specific Details ──────────────────────────── */}
      <CategoryCard title="Project Specific Details">
        {/* J Hooks for Pathway */}
        <div className="flex items-center gap-2.5 px-3 py-2">
          <input
            id="jhooks-cb"
            type="checkbox"
            checked={psd.jHooks}
            onChange={(e) => updatePSD({ jHooks: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-border/50 accent-primary cursor-pointer"
          />
          <label htmlFor="jhooks-cb" className="text-sm text-muted-foreground cursor-pointer select-none">
            J Hooks for Pathway
          </label>
        </div>


        {/* Badging / Safety */}
        <div className="flex items-center gap-2.5 px-3 py-2 border-t border-border/20">
          <input
            id="badging-cb"
            type="checkbox"
            checked={psd.badgingSafety}
            onChange={(e) => updatePSD({ badgingSafety: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-border/50 accent-primary cursor-pointer"
          />
          <label htmlFor="badging-cb" className="text-sm text-muted-foreground cursor-pointer select-none">
            Badging / Safety
          </label>
        </div>

        {/* Exclude Materials */}
        <div className="flex items-center gap-2.5 px-3 py-2 border-t border-border/20">
          <input
            id="exclude-materials-cb"
            type="checkbox"
            checked={!!psd.extras?.excludeMaterials}
            onChange={(e) => updatePSD({ extras: { ...psd.extras, excludeMaterials: e.target.checked } })}
            className="h-3.5 w-3.5 rounded border-border/50 accent-primary cursor-pointer"
          />
          <label htmlFor="exclude-materials-cb" className="text-sm text-muted-foreground cursor-pointer select-none">
            Exclude Materials?
          </label>
        </div>

      </CategoryCard>

      {/* ── Extras ───────────────────────────────────────────── */}
      <TooltipProvider>
        <CategoryCard title="Extras">
          {/* Shuttle Services — checkbox */}
          <div className="flex items-center gap-2.5 px-3 py-2">
            <input
              id="shuttle-cb"
              type="checkbox"
              checked={!!psd.extras.shuttleServices}
              onChange={(e) => updatePSD({ extras: { ...psd.extras, shuttleServices: e.target.checked } })}
              className="h-3.5 w-3.5 rounded border-border/50 accent-primary cursor-pointer shrink-0"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <label htmlFor="shuttle-cb" className="text-sm text-muted-foreground cursor-pointer select-none">
                  Shuttle Services
                </label>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <span className="font-mono text-[11px]">Project Days × Hourly Rate → added to Install</span>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Stretch and Flex — checkbox */}
          <div className="flex items-center gap-2.5 px-3 py-2 border-t border-border/20">
            <input
              id="stretch-cb"
              type="checkbox"
              checked={!!psd.extras.stretchAndFlex}
              onChange={(e) => updatePSD({ extras: { ...psd.extras, stretchAndFlex: e.target.checked } })}
              className="h-3.5 w-3.5 rounded border-border/50 accent-primary cursor-pointer shrink-0"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <label htmlFor="stretch-cb" className="text-sm text-muted-foreground cursor-pointer select-none">
                  Stretch and Flex
                </label>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <span className="font-mono text-[11px]">Project Days × 0.5 hrs × Hourly Rate → added to Install</span>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Composite Cleanup — hours input */}
          <div className="flex items-center gap-2.5 px-3 py-2 border-t border-border/20">
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="text-sm text-muted-foreground select-none cursor-default">
                  Composite Cleanup
                </label>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <span className="font-mono text-[11px]">NTI value is # of weeks on the job × 8 hours a day</span>
              </TooltipContent>
            </Tooltip>
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="hrs"
              value={psd.extras.compositeCleanup || ""}
              onChange={(e) => updatePSD({ extras: { ...psd.extras, compositeCleanup: parseFloat(e.target.value) || 0 } })}
              className="h-6 w-20 text-xs text-right ml-auto"
            />
          </div>

          {/* Lift Spotters — checkbox */}
          <div className="flex items-center gap-2.5 px-3 py-2 border-t border-border/20">
            <input
              id="liftspot-cb"
              type="checkbox"
              checked={!!psd.extras.liftSpotters}
              onChange={(e) => updatePSD({ extras: { ...psd.extras, liftSpotters: e.target.checked } })}
              className="h-3.5 w-3.5 rounded border-border/50 accent-primary cursor-pointer shrink-0"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <label htmlFor="liftspot-cb" className="text-sm text-muted-foreground cursor-pointer select-none">
                  Lift Spotters
                </label>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <span className="font-mono text-[11px]">65% × Total Hours ÷ # of Guys × Hourly Rate → added to Install</span>
              </TooltipContent>
            </Tooltip>
          </div>
        </CategoryCard>
      </TooltipProvider>

    </div>
    </div>
  );
}
