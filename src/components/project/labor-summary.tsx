"use client";

import { useState } from "react";
import type { TechnologyConfig, TechnologyType } from "@/types";
import { TECHNOLOGY_LABELS, TECHNOLOGY_DOT } from "@/lib/constants";
import { ChevronDown, ChevronRight } from "lucide-react";

const SCOPE_TYPES: TechnologyType[] = ["DAS", "PUBLIC_SAFETY", "ROIP"];

interface Props {
  technologies: TechnologyConfig[];
  hoursPerDay: number;
  daysPerWeek: number;
  numberOfGuys: number;
}

function fmt(n: number, decimals = 1): string {
  if (n === 0) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function LaborSummary({ technologies, hoursPerDay, daysPerWeek, numberOfGuys }: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const hpd = hoursPerDay > 0 ? hoursPerDay : 8;
  const dpw = daysPerWeek > 0 ? daysPerWeek : 5;
  const guys = numberOfGuys > 0 ? numberOfGuys : 1;

  const scopeData = SCOPE_TYPES.map((type) => {
    const tech = technologies.find((t) => t.type === type);
    const totalHours = tech
      ? Object.values(tech.installLaborHours).reduce((sum, h) => sum + (h || 0), 0)
      : 0;
    const totalDays = totalHours / hpd / guys;
    const totalWeeks = totalDays / dpw;
    const breakdown = tech?.laborHoursBreakdown ?? null;
    return { type, totalHours, totalDays, totalWeeks, breakdown };
  });

  const anyHours = scopeData.some((s) => s.totalHours > 0);
  if (!anyHours) return null;

  const hasAnyBreakdown = scopeData.some((s) => s.breakdown !== null);

  // Collect all unique additional labor item descriptions across all scopes
  const allAdditionalLabels = Array.from(
    new Set(
      scopeData.flatMap((s) => (s.breakdown?.additionalLaborItems ?? []).map((i) => i.description))
    )
  );

  // Breakdown rows definition
  type BreakdownRow =
    | { kind: "divider" }
    | { kind: "row"; label: string; getValue: (s: typeof scopeData[0]) => number };

  const breakdownRows: BreakdownRow[] = [
    { kind: "row", label: "Import BOM", getValue: (s) => s.breakdown?.bom ?? 0 },
    { kind: "row", label: "+ Cores", getValue: (s) => s.breakdown?.cores ?? 0 },
    { kind: "row", label: "+ Badging / Safety", getValue: (s) => s.breakdown?.badging ?? 0 },
    { kind: "row", label: "+ Material Handling", getValue: (s) => s.breakdown?.materialHandling ?? 0 },
    { kind: "row", label: "+ Commissioning Support", getValue: (s) => s.breakdown?.commissioningSupport ?? 0 },
    ...allAdditionalLabels.map((desc): BreakdownRow => ({
      kind: "row",
      label: `+ ${desc || "Additional Labor"}`,
      getValue: (s) => s.breakdown?.additionalLaborItems.find((i) => i.description === desc)?.hours ?? 0,
    })),
    { kind: "divider" },
    { kind: "row", label: "+ Shuttle Services", getValue: (s) => s.breakdown?.shuttleServices ?? 0 },
    { kind: "row", label: "+ Stretch & Flex", getValue: (s) => s.breakdown?.stretchAndFlex ?? 0 },
    { kind: "row", label: "+ Composite Cleanup", getValue: (s) => s.breakdown?.compositeCleanup ?? 0 },
    { kind: "row", label: "+ Lift Spotters", getValue: (s) => s.breakdown?.liftSpotters ?? 0 },
  ];

  // Only show breakdown rows that have at least one non-zero value (excluding dividers)
  const visibleBreakdownRows = breakdownRows.filter((row) => {
    if (row.kind === "divider") return true;
    return scopeData.some((s) => s.breakdown && row.getValue(s) > 0);
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
    <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card">
      <div className="px-3 py-2 border-b border-border/50 header-gradient">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Labor Summary</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-card">
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground min-w-[160px]" />
              {scopeData.map(({ type }) => (
                <th key={type} className="px-4 py-2 text-right text-xs font-medium text-muted-foreground min-w-[120px]">
                  <div className="flex items-center justify-end gap-1.5">
                    <div className={`h-1.5 w-1.5 rounded-full ${TECHNOLOGY_DOT[type]}`} />
                    {TECHNOLOGY_LABELS[type]}
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
              {scopeData.map(({ type, totalHours }) => (
                <td key={type} className="px-4 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {fmt(totalHours, 0)}
                </td>
              ))}
            </tr>

            {/* Expandable breakdown rows */}
            {showBreakdown && hasAnyBreakdown && cleanedBreakdownRows.map((row, i) => {
              if (row.kind === "divider") {
                return (
                  <tr key={`div-${i}`} className="border-t border-border/15">
                    <td colSpan={scopeData.length + 1} className="h-px p-0" />
                  </tr>
                );
              }
              return (
                <tr key={row.label} className="border-t border-border/15 bg-muted/10">
                  <td className="px-4 py-1 pl-10 text-xs text-muted-foreground/70">{row.label}</td>
                  {scopeData.map((s) => {
                    const val = s.breakdown ? row.getValue(s) : null;
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
              {scopeData.map(({ type, totalDays }) => (
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
              {scopeData.map(({ type, totalWeeks }) => (
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
