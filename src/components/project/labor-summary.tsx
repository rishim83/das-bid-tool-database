"use client";

import { useState } from "react";
import type { TechnologyConfig, TechnologyType, ProjectSpecificDetails } from "@/types";
import { TECHNOLOGY_LABELS, TECHNOLOGY_BG, TECHNOLOGY_TINT_DARK } from "@/lib/constants";
import { ChevronDown, ChevronRight } from "lucide-react";

const SCOPE_TYPES: TechnologyType[] = ["DAS", "PUBLIC_SAFETY", "ROIP"];

interface Props {
  technologies: TechnologyConfig[];
  hoursPerDay: number;
  daysPerWeek: number;
  numberOfGuys: number;
  projectSpecificDetails?: ProjectSpecificDetails;
  laborSafety?: number;
}

function fmt(n: number, decimals = 1): string {
  if (n === 0) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function LaborSummary({ technologies, hoursPerDay, daysPerWeek, numberOfGuys, projectSpecificDetails, laborSafety = 1 }: Props) {
  const [showBreakdown, setShowBreakdown] = useState(true);

  const hpd = hoursPerDay > 0 ? hoursPerDay : 8;
  const dpw = daysPerWeek > 0 ? daysPerWeek : 5;
  const guys = numberOfGuys > 0 ? numberOfGuys : 1;
  const psd = projectSpecificDetails;

  const scopeData = SCOPE_TYPES.map((type) => {
    const tech = technologies.find((t) => t.type === type && t.enabled);
    if (!tech) return { type, totalHours: 0, contingencyHours: 0, billedHours: 0, totalDays: 0, totalWeeks: 0, breakdown: null as null, dynBreakdown: null as null };

    // Build dynamic breakdown first — mirrors computeEffectiveLaborHoursPerColo exactly
    const rawBomHours = Object.values(tech.installLaborHours).reduce((s, h) => s + (h || 0), 0);
    const badgingHours = !!(psd?.badgingSafety) ? guys * 4 : 0;
    const materialHandlingHours = tech.materialHandlingHours ?? 0;
    const commissioningHours = tech.commissioningSupport ?? 0;
    const additionalLaborItems = (tech.additionalLaborItems ?? []).filter((i) => (i.hours || 0) > 0);
    const additionalLaborHours = additionalLaborItems.reduce((s, i) => s + (i.hours || 0), 0);
    const baseHours = rawBomHours + badgingHours + materialHandlingHours + commissioningHours + additionalLaborHours;
    const baseDays = baseHours > 0 ? baseHours / hpd : 0;
    const shuttleHours   = !!(psd?.extras?.shuttleServices) && baseHours > 0 ? baseDays : 0;
    const stretchHours   = !!(psd?.extras?.stretchAndFlex)  && baseHours > 0 ? baseDays * 0.5 : 0;
    const compositeHours = Number(psd?.extras?.compositeCleanup ?? 0);
    const liftHours      = !!(psd?.extras?.liftSpotters)    && baseHours > 0 ? (0.65 * baseHours) / guys : 0;

    // Total effective hours: sum of all components (consistent with effectiveTechs in use-project.ts)
    const totalHours = baseHours + shuttleHours + stretchHours + compositeHours + liftHours;
    // Apply labor safety factor to get the billed-equivalent hours
    const contingencyHours = totalHours * (laborSafety - 1);
    const billedHours = totalHours * laborSafety;
    const totalDays = billedHours / hpd / guys;
    const totalWeeks = totalDays / dpw;

    const dynBreakdown = {
      bom: rawBomHours,
      badging: badgingHours,
      materialHandling: materialHandlingHours,
      commissioningSupport: commissioningHours,
      additionalLaborItems,
      shuttleServices: shuttleHours,
      stretchAndFlex: stretchHours,
      compositeCleanup: compositeHours,
      liftSpotters: liftHours,
    };

    return { type, totalHours, contingencyHours, billedHours, totalDays, totalWeeks, dynBreakdown };
  });

  // Only show columns for enabled technologies
  const visibleScopeData = scopeData.filter((s) => s.dynBreakdown !== null);

  const anyHours = visibleScopeData.some((s) => (s.billedHours ?? 0) > 0);
  if (!anyHours) return null;

  const hasAnyBreakdown = visibleScopeData.some((s) => s.totalHours > 0);

  // Collect all unique additional labor item descriptions across all scopes
  const allAdditionalLabels = Array.from(
    new Set(
      visibleScopeData.flatMap((s) => (s.dynBreakdown?.additionalLaborItems ?? []).map((i) => i.description))
    )
  );

  // Breakdown rows definition
  type BreakdownRow =
    | { kind: "divider" }
    | { kind: "row"; label: string; getValue: (s: typeof scopeData[0]) => number };

  const breakdownRows: BreakdownRow[] = [
    { kind: "row", label: "Import BOM", getValue: (s) => s.dynBreakdown?.bom ?? 0 },
    { kind: "row", label: "+ Badging / Safety", getValue: (s) => s.dynBreakdown?.badging ?? 0 },
    { kind: "row", label: "+ Material Handling", getValue: (s) => s.dynBreakdown?.materialHandling ?? 0 },
    { kind: "row", label: "+ Commissioning Support", getValue: (s) => s.dynBreakdown?.commissioningSupport ?? 0 },
    ...allAdditionalLabels.map((desc): BreakdownRow => ({
      kind: "row",
      label: `+ ${desc || "Additional Labor"}`,
      getValue: (s) => s.dynBreakdown?.additionalLaborItems.find((i) => i.description === desc)?.hours ?? 0,
    })),
    { kind: "divider" },
    { kind: "row", label: "+ Shuttle Services", getValue: (s) => s.dynBreakdown?.shuttleServices ?? 0 },
    { kind: "row", label: "+ Stretch & Flex", getValue: (s) => s.dynBreakdown?.stretchAndFlex ?? 0 },
    { kind: "row", label: "+ Composite Cleanup", getValue: (s) => s.dynBreakdown?.compositeCleanup ?? 0 },
    { kind: "row", label: "+ Lift Spotters", getValue: (s) => s.dynBreakdown?.liftSpotters ?? 0 },
    ...(laborSafety !== 1 ? [
      { kind: "divider" as const },
      {
        kind: "row" as const,
        label: `+ Labor Contingency (×${laborSafety.toFixed(2)})`,
        getValue: (s: typeof scopeData[0]) => s.contingencyHours ?? 0,
      },
    ] : []),
  ];

  // Only show breakdown rows that have at least one non-zero value (excluding dividers)
  const visibleBreakdownRows = breakdownRows.filter((row) => {
    if (row.kind === "divider") return true;
    return visibleScopeData.some((s) => s.dynBreakdown && row.getValue(s) > 0);
  });

  // Remove divider if it's first, last, or adjacent to another divider
  const cleanedBreakdownRows = visibleBreakdownRows.filter((row, i, arr) => {
    if (row.kind !== "divider") return true;
    const prev = arr[i - 1];
    const next = arr[i + 1];
    if (!prev || !next) return false;
    if (prev.kind === "divider" || next.kind === "divider") return false;
    return true;
  });

  return (
    <div className="flex-1 min-w-0 border border-border/60 rounded-lg overflow-hidden card-elevated bg-card" style={{ borderLeft: "2px solid oklch(0.50 0.18 255 / 0.35)" }}>
      <div className="px-3 py-2 border-b border-border/50 header-gradient">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">Labor Summary</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm w-full">
          <thead>
            <tr className="border-b border-border/40 bg-card">
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground min-w-[160px]" />
              {visibleScopeData.map(({ type }) => (
                <th key={type} className="px-4 py-2 text-right text-xs font-medium min-w-[120px]">
                  <div className="flex items-center justify-end">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${TECHNOLOGY_BG[type]} ${TECHNOLOGY_TINT_DARK[type]}`}>
                      {TECHNOLOGY_LABELS[type]}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Total Hours row with expand toggle */}
            <tr className="border-t border-border/25">
              <td className="px-4 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  {hasAnyBreakdown && (
                    <button
                      onClick={() => setShowBreakdown((v) => !v)}
                      className="h-4 w-4 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors rounded shrink-0"
                    >
                      {showBreakdown
                        ? <ChevronDown className="h-3 w-3" />
                        : <ChevronRight className="h-3 w-3" />}
                    </button>
                  )}
                  Total Hours
                </div>
              </td>
              {visibleScopeData.map(({ type, billedHours }) => (
                <td key={type} className="px-4 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {fmt(billedHours ?? 0, 0)}
                </td>
              ))}
            </tr>

            {/* Expandable breakdown rows */}
            {showBreakdown && hasAnyBreakdown && cleanedBreakdownRows.map((row, i) => {
              if (row.kind === "divider") {
                return (
                  <tr key={`div-${i}`} className="border-t border-border/15">
                    <td colSpan={visibleScopeData.length + 1} className="h-px p-0" />
                  </tr>
                );
              }
              return (
                <tr key={row.label} className="border-t border-border/15 bg-muted/10">
                  <td className="px-4 py-1 pl-10 text-xs text-muted-foreground/70">{row.label}</td>
                  {visibleScopeData.map((s) => {
                    const val = s.dynBreakdown ? row.getValue(s) : null;
                    return (
                      <td key={s.type} className="px-4 py-1 text-right font-mono text-xs tabular-nums text-muted-foreground/60">
                        {val === null || val === 0 ? "—" : fmt(val, 1)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            <tr className="border-t border-border/25">
              <td className="px-4 py-2 text-xs text-muted-foreground">
                Total Days
                <span className="ml-1 text-muted-foreground/50">({hpd}h/day, {guys} {guys === 1 ? "guy" : "guys"})</span>
              </td>
              {visibleScopeData.map(({ type, totalDays }) => (
                <td key={type} className="px-4 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {fmt(totalDays)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-border/25 total-row-gradient">
              <td className="px-4 py-2 text-xs font-semibold">
                Total Weeks
                <span className="ml-1 font-normal text-muted-foreground/50">({dpw}d/wk)</span>
              </td>
              {visibleScopeData.map(({ type, totalWeeks }) => (
                <td key={type} className="px-4 py-2 text-right font-mono text-xs tabular-nums font-semibold">
                  {fmt(totalWeeks)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
