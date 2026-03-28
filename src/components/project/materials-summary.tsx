"use client";

import { useState } from "react";
import type { TechnologyConfig, TechnologyType } from "@/types";
import { TECHNOLOGY_LABELS, TECHNOLOGY_BG, TECHNOLOGY_TINT_DARK } from "@/lib/constants";
import { formatCurrency } from "@/lib/calculations";
import { ChevronDown, ChevronRight } from "lucide-react";

const SCOPE_TYPES: TechnologyType[] = ["DAS", "PUBLIC_SAFETY", "ROIP"];

interface Props {
  technologies: TechnologyConfig[];
}

export function MaterialsSummary({ technologies }: Props) {
  const [showBreakdown, setShowBreakdown] = useState(true);

  const scopeData = SCOPE_TYPES.map((type) => {
    const tech = technologies.find((t) => t.type === type && t.enabled);
    if (!tech) return { type, total: 0, dynBreakdown: null as null };

    // Raw BOM cost (stored per colo)
    const bomCost = Object.values(tech.equipmentCost).reduce((s, v) => s + (v || 0), 0);
    // Dynamic extras (live from current tech state)
    const waterAndIce = tech.waterAndIce ?? 0;
    const additionalMaterials = (tech.additionalMaterials ?? []).filter((m) => (m.value || 0) > 0);
    const total = bomCost + waterAndIce + additionalMaterials.reduce((s, m) => s + m.value, 0);

    const dynBreakdown = {
      bom: bomCost,
      waterAndIce,
      additionalMaterials,
    };

    return { type, total, dynBreakdown };
  });

  // Only show columns for enabled technologies
  const visibleScopeData = scopeData.filter((s) => s.dynBreakdown !== null);

  const anyMaterials = visibleScopeData.some((s) => s.total > 0);
  if (!anyMaterials) return null;

  // Show breakdown chevron whenever any enabled tech exists
  const hasAnyBreakdown = visibleScopeData.some((s) => s.dynBreakdown !== null);

  // Collect all unique additional material names across all scopes
  const allAdditionalMaterialNames = Array.from(
    new Set(
      visibleScopeData.flatMap((s) =>
        (s.dynBreakdown?.additionalMaterials ?? []).map(
          (m: { name: string; value: number }) => m.name || "Additional Material"
        )
      )
    )
  );

  type BreakdownRow =
    | { kind: "divider" }
    | { kind: "row"; label: string; getValue: (s: typeof scopeData[0]) => number };

  const breakdownRows: Array<BreakdownRow & { alwaysShow?: boolean }> = [
    {
      kind: "row",
      label: "BOM Equipment",
      getValue: (s) => s.dynBreakdown?.bom ?? 0,
      alwaysShow: true,
    },
    { kind: "divider" },
    {
      kind: "row",
      label: "+ Water & Ice",
      getValue: (s) => s.dynBreakdown?.waterAndIce ?? 0,
    },
    ...allAdditionalMaterialNames.map((name): BreakdownRow => ({
      kind: "row",
      label: `+ ${name}`,
      getValue: (s) =>
        s.dynBreakdown?.additionalMaterials.find(
          (m: { name: string; value: number }) => (m.name || "Additional Material") === name
        )?.value ?? 0,
    })),
  ];

  // BOM row always shows; extras rows only show when at least one scope has a non-zero value
  const visibleRows = breakdownRows.filter((row) => {
    if (row.kind === "divider") return true;
    if (row.alwaysShow) return true;
    return visibleScopeData.some((s) => s.dynBreakdown && row.getValue(s) > 0);
  });

  // Clean up dividers at boundaries or adjacent to each other
  const cleanedRows = visibleRows.filter((row, i, arr) => {
    if (row.kind !== "divider") return true;
    const prev = arr[i - 1];
    const next = arr[i + 1];
    if (!prev || !next) return false;
    if (prev.kind === "divider" || next.kind === "divider") return false;
    return true;
  });

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card" style={{ borderLeft: "2px solid oklch(0.50 0.18 255 / 0.35)" }}>
      <div className="px-3 py-2 border-b border-border/50 header-gradient">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
          Materials Summary
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm w-full">
          <thead>
            <tr className="border-b border-border/40 bg-card">
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground min-w-[160px]" />
              {visibleScopeData.map(({ type }) => (
                <th
                  key={type}
                  className="px-4 py-2 text-right text-xs font-medium min-w-[120px]"
                >
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
            {/* Total row */}
            <tr className="border-t border-border/25 total-row-gradient">
              <td className="px-4 py-2 text-xs font-semibold">
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
                  Total Equipment &amp; Materials
                </div>
              </td>
              {visibleScopeData.map(({ type, total }) => (
                <td
                  key={type}
                  className="px-4 py-2 text-right font-mono text-xs tabular-nums font-semibold"
                >
                  {total > 0 ? formatCurrency(total) : "—"}
                </td>
              ))}
            </tr>

            {/* Expandable breakdown rows */}
            {showBreakdown && hasAnyBreakdown && cleanedRows.map((row, i) => {
              if (row.kind === "divider") {
                return (
                  <tr key={`div-${i}`} className="border-t border-border/15">
                    <td colSpan={visibleScopeData.length + 1} className="h-px p-0" />
                  </tr>
                );
              }
              return (
                <tr key={row.label} className="border-t border-border/15 bg-muted/10">
                  <td className="px-4 py-1 pl-10 text-xs text-muted-foreground/70">
                    {row.label}
                  </td>
                  {visibleScopeData.map((s) => {
                    const val = s.dynBreakdown ? row.getValue(s) : null;
                    return (
                      <td
                        key={s.type}
                        className="px-4 py-1 text-right font-mono text-xs tabular-nums text-muted-foreground/60"
                      >
                        {val === null || val === 0 ? "—" : formatCurrency(val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
