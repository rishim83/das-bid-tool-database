"use client";

import { useState } from "react";
import type { TechnologyConfig, TechnologyType, EquipmentCostBreakdown } from "@/types";
import { TECHNOLOGY_LABELS, TECHNOLOGY_DOT } from "@/lib/constants";
import { formatCurrency } from "@/lib/calculations";
import { ChevronDown, ChevronRight } from "lucide-react";

const SCOPE_TYPES: TechnologyType[] = ["DAS", "PUBLIC_SAFETY", "ROIP"];

interface Props {
  technologies: TechnologyConfig[];
}

export function MaterialsSummary({ technologies }: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const scopeData = SCOPE_TYPES.map((type) => {
    const tech = technologies.find((t) => t.type === type && t.enabled);
    if (!tech) return { type, total: 0, breakdown: null as EquipmentCostBreakdown | null };

    const total = Object.values(tech.equipmentCost).reduce((s, v) => s + (v || 0), 0);
    return { type, total, breakdown: tech.equipmentCostBreakdown ?? null };
  });

  const anyMaterials = scopeData.some((s) => s.total > 0);
  if (!anyMaterials) return null;

  const hasAnyBreakdown = scopeData.some((s) => s.breakdown !== null);

  // Collect all unique additional material names across all scopes
  const allAdditionalMaterialNames = Array.from(
    new Set(
      scopeData.flatMap((s) =>
        (s.breakdown?.additionalMaterials ?? []).map(
          (m: { name: string; value: number }) => m.name || "Additional Material"
        )
      )
    )
  );

  type BreakdownRow =
    | { kind: "divider" }
    | { kind: "row"; label: string; getValue: (s: typeof scopeData[0]) => number };

  const breakdownRows: BreakdownRow[] = [
    {
      kind: "row",
      label: "Materials Pricing",
      getValue: (s) => s.breakdown?.bom ?? 0,
    },
    { kind: "divider" },
    {
      kind: "row",
      label: "+ Water & Ice",
      getValue: (s) => s.breakdown?.waterAndIce ?? 0,
    },
    ...allAdditionalMaterialNames.map((name): BreakdownRow => ({
      kind: "row",
      label: `+ ${name}`,
      getValue: (s) =>
        s.breakdown?.additionalMaterials.find(
          (m: { name: string; value: number }) => (m.name || "Additional Material") === name
        )?.value ?? 0,
    })),
  ];

  // Only keep rows that have at least one non-zero value
  const visibleRows = breakdownRows.filter((row) => {
    if (row.kind === "divider") return true;
    return scopeData.some((s) => s.breakdown && row.getValue(s) > 0);
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
    <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card">
      <div className="px-3 py-2 border-b border-border/50 header-gradient">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Materials Summary
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-card">
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground min-w-[160px]" />
              {scopeData.map(({ type }) => (
                <th
                  key={type}
                  className="px-4 py-2 text-right text-xs font-medium text-muted-foreground min-w-[120px]"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <div className={`h-1.5 w-1.5 rounded-full ${TECHNOLOGY_DOT[type]}`} />
                    {TECHNOLOGY_LABELS[type]}
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
              {scopeData.map(({ type, total }) => (
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
                    <td colSpan={scopeData.length + 1} className="h-px p-0" />
                  </tr>
                );
              }
              return (
                <tr key={row.label} className="border-t border-border/15 bg-muted/10">
                  <td className="px-4 py-1 pl-10 text-xs text-muted-foreground/70">
                    {row.label}
                  </td>
                  {scopeData.map((s) => {
                    const val = s.breakdown ? row.getValue(s) : null;
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
