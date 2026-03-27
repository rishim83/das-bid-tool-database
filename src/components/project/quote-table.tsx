"use client";

import React, { useState } from "react";
import type { TechnologyQuote, ColoSite, TechnologyType } from "@/types";
import { formatCurrency } from "@/lib/calculations";
import { TECHNOLOGY_LABELS, TECHNOLOGY_DOT, TECHNOLOGY_BG, TECHNOLOGY_TINT, TECHNOLOGY_TINT_DARK } from "@/lib/constants";

const TECH_BORDER: Record<TechnologyType, string> = {
  DAS: "#3b82f6",
  PUBLIC_SAFETY: "#ef4444",
  ROIP: "#f97316",
};
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronRight, ChevronDown } from "lucide-react";

// Lines 5 and 6 are folded into Install (2) and PM (4) sub-rows
const FOLDED_ITEMS = new Set([5, 6]);

// Formulas for simple (non-compound) main rows
const SIMPLE_FORMULAS: Record<number, string> = {
  1: "SUM(RF Line Items) × Sub Mark Up",
  3: "Equipment Cost × Material Safety × Mark Up",
};

interface SubRowDef {
  label: string;
  formula: string;
  getValue: (coloId: string) => number;
  total: number;
}

interface Props {
  quote: TechnologyQuote;
  coloSites: ColoSite[];
  rentalMarkupCost?: number;
  adminPercent?: number;
  subContractorTotal?: number;
  taxPercent?: number;
  installTravelActive?: boolean;
  materialSafety?: number;
  equipMarkUp?: number;
}

function FormulaCell({
  label,
  formula,
  className,
}: {
  label: React.ReactNode;
  formula: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`cursor-default ${className ?? ""}`}>{label}</span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        <span className="font-mono text-[11px]">{formula}</span>
      </TooltipContent>
    </Tooltip>
  );
}

export function QuoteTable({
  quote,
  coloSites,
  rentalMarkupCost = 0,
  adminPercent = 0,
  subContractorTotal = 0,
  taxPercent = 0,
  installTravelActive = false,
  materialSafety = 1,
  equipMarkUp = 1,
}: Props) {
  const tableLabel = TECHNOLOGY_LABELS[quote.type];
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());
  const isSingleColo = coloSites.length === 1;

  const toggleExpand = (item: number) => {
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  // Look up folded lines for compound display
  const installTravelLine = quote.lines.find((l) => l.item === 6);
  const pmTravelLine = quote.lines.find((l) => l.item === 5);

  return (
    <TooltipProvider>
      <div
        className="w-fit min-w-[50vw] border border-border/60 rounded-lg overflow-hidden card-elevated bg-card"
        style={{ borderLeft: `3px solid ${TECH_BORDER[quote.type]}` }}
      >
        <div className={`px-4 py-2.5 border-b flex items-center gap-2.5 ${TECHNOLOGY_TINT[quote.type]} ${TECHNOLOGY_TINT_DARK[quote.type]}`}>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${TECHNOLOGY_BG[quote.type]}`}>
            {tableLabel}
          </span>
          <h3 className="text-xs font-semibold tracking-wide opacity-60">Quote</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-card">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-10">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground min-w-[200px]">Description</th>
                {!isSingleColo && coloSites.map((colo) => (
                  <th key={colo.id} className="px-3 py-2 text-right text-xs font-medium text-muted-foreground min-w-[120px]">
                    {colo.name}
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground min-w-[120px]">
                  {isSingleColo ? "Price" : "Total"}
                </th>
              </tr>
            </thead>
            <tbody>
              {quote.lines.map((line) => {
                // Lines 5 and 6 are rendered as sub-rows of PM and Install — skip as main rows
                if (FOLDED_ITEMS.has(line.item)) return null;

                const isInstall = line.item === 2;
                const isEquipment = line.item === 3;
                const isPM = line.item === 4;
                const isExpanded = expandedLines.has(line.item);

                // ── Build sub-rows ───────────────────────────────────
                const subRows: SubRowDef[] = [];

                if (isInstall) {
                  subRows.push({
                    label: "Install Labor",
                    formula: "Labor Hours × Hourly Rate × Labor Safety",
                    getValue: (coloId) => line.values[coloId] || 0,
                    total: line.totalPrice,
                  });
                  // Install Travel (line 6 folded in)
                  if (installTravelLine) {
                    subRows.push({
                      label: "Install Travel",
                      formula: installTravelActive
                        ? "Per Diem + Travel Labor + Airfare + Lodging + Fuel (× T&I Markup)"
                        : "Labor Hours × Travel per Day",
                      getValue: (coloId) => installTravelLine.values[coloId] || 0,
                      total: installTravelLine.totalPrice,
                    });
                  }
                  // Rental Equipment
                  if (rentalMarkupCost > 0) {
                    subRows.push({
                      label: "Rental Equipment",
                      formula: "Rental Total × T&I Markup",
                      getValue: (coloId) => {
                        const base = line.values[coloId] || 0;
                        const share = line.totalPrice > 0 ? base / line.totalPrice : 1 / coloSites.length;
                        return rentalMarkupCost * share;
                      },
                      total: rentalMarkupCost,
                    });
                  }
                  // Subcontractors (per-tech — no per-COLO split)
                  if (subContractorTotal > 0) {
                    subRows.push({
                      label: "Subcontractors",
                      formula: "Sum of Subs × Sub Mark Up",
                      getValue: () => 0,
                      total: subContractorTotal,
                    });
                  }
                }

                const equipTaxTotal = taxPercent > 0 ? line.totalPrice * (taxPercent / 100) : 0;
                if (isEquipment) {
                  const hasMaterialContingency = materialSafety !== 1 || equipMarkUp !== 1;
                  if (hasMaterialContingency) {
                    // Raw BOM cost (back-calculated)
                    const rawBase = materialSafety * equipMarkUp !== 0
                      ? line.totalPrice / materialSafety / equipMarkUp
                      : line.totalPrice;
                    subRows.push({
                      label: "Equipment Base",
                      formula: "Raw BOM Equipment Cost",
                      getValue: (coloId) => materialSafety * equipMarkUp !== 0
                        ? (line.values[coloId] || 0) / materialSafety / equipMarkUp
                        : line.values[coloId] || 0,
                      total: rawBase,
                    });
                    if (materialSafety !== 1) {
                      const safetyAdder = rawBase * (materialSafety - 1) * equipMarkUp;
                      subRows.push({
                        label: `Material Safety (×${materialSafety.toFixed(2)})`,
                        formula: `Base × (Material Safety − 1) × Mark Up`,
                        getValue: (coloId) => {
                          const base = materialSafety * equipMarkUp !== 0
                            ? (line.values[coloId] || 0) / materialSafety / equipMarkUp
                            : line.values[coloId] || 0;
                          return base * (materialSafety - 1) * equipMarkUp;
                        },
                        total: safetyAdder,
                      });
                    }
                    if (equipMarkUp !== 1) {
                      const markupAdder = rawBase * materialSafety * (equipMarkUp - 1);
                      subRows.push({
                        label: `Mark Up (×${equipMarkUp.toFixed(2)})`,
                        formula: `Base × Material Safety × (Mark Up − 1)`,
                        getValue: (coloId) => {
                          const base = materialSafety * equipMarkUp !== 0
                            ? (line.values[coloId] || 0) / materialSafety / equipMarkUp
                            : line.values[coloId] || 0;
                          return base * materialSafety * (equipMarkUp - 1);
                        },
                        total: markupAdder,
                      });
                    }
                  } else {
                    subRows.push({
                      label: "Equipment",
                      formula: "Equipment Cost × Material Safety × Mark Up",
                      getValue: (coloId) => line.values[coloId] || 0,
                      total: line.totalPrice,
                    });
                  }
                  if (equipTaxTotal > 0) {
                    subRows.push({
                      label: "Tax",
                      formula: `${taxPercent}% × Equipment Sell`,
                      getValue: (coloId) => (line.values[coloId] || 0) * (taxPercent / 100),
                      total: equipTaxTotal,
                    });
                  }
                }

                if (isPM) {
                  // PM base (line 4)
                  subRows.push({
                    label: "PM",
                    formula: "(Labor Hours ÷ # Techs) × PM on Job % × PM Hourly Rate",
                    getValue: (coloId) => line.values[coloId] || 0,
                    total: line.totalPrice,
                  });
                  // PM Travel (line 5 folded in)
                  if (pmTravelLine) {
                    subRows.push({
                      label: "PM Travel",
                      formula: "PM Trips × PM Total per Trip",
                      getValue: (coloId) => pmTravelLine.values[coloId] || 0,
                      total: pmTravelLine.totalPrice,
                    });
                  }
                  // Admin
                  if (adminPercent > 0) {
                    subRows.push({
                      label: "Admin",
                      formula: `${adminPercent}% × PM`,
                      getValue: (coloId) => (line.values[coloId] || 0) * (adminPercent / 100),
                      total: line.totalPrice * (adminPercent / 100),
                    });
                  }
                }

                // Any line with 2+ sub-rows is expandable
                const hasSubRows = subRows.length >= 2;

                // ── Main row display values (sum of all components) ──
                const getDisplayValue = (coloId: string) => {
                  const base = line.values[coloId] || 0;
                  if (isInstall) {
                    const travelVal = installTravelLine?.values[coloId] || 0;
                    const rentalShare = rentalMarkupCost > 0
                      ? rentalMarkupCost * (line.totalPrice > 0 ? base / line.totalPrice : 1 / coloSites.length)
                      : 0;
                    return base + travelVal + rentalShare;
                  }
                  if (isPM) {
                    const travelVal = pmTravelLine?.values[coloId] || 0;
                    const adminVal = base * (adminPercent / 100);
                    return base + travelVal + adminVal;
                  }
                  return base;
                };

                const displayTotal = isInstall
                  ? line.totalPrice + (installTravelLine?.totalPrice || 0) + rentalMarkupCost + subContractorTotal
                  : isEquipment
                  ? line.totalPrice + equipTaxTotal
                  : isPM
                  ? line.totalPrice + (pmTravelLine?.totalPrice || 0) + line.totalPrice * (adminPercent / 100)
                  : line.totalPrice;

                // ── Main row formula tooltip ─────────────────────────
                let mainFormula: string;
                if (isInstall) {
                  const parts = ["Install Labor", "Install Travel"];
                  if (rentalMarkupCost > 0) parts.push("Rental Equipment");
                  if (subContractorTotal > 0) parts.push("Subcontractors");
                  mainFormula = parts.join(" + ");
                } else if (isEquipment) {
                  const parts = ["Equipment Cost × Material Safety × Mark Up"];
                  if (equipTaxTotal > 0) parts.push(`Tax (${taxPercent}%)`);
                  mainFormula = parts.join(" + ");
                } else if (isPM) {
                  const parts = ["PM", "PM Travel"];
                  if (adminPercent > 0) parts.push(`Admin (${adminPercent}%)`);
                  mainFormula = parts.join(" + ");
                } else {
                  mainFormula = SIMPLE_FORMULAS[line.item] ?? "";
                }

                return (
                  <React.Fragment key={line.item}>
                    <tr className="border-t border-border/25 hover:bg-accent/30 transition-colors">
                      <td className="px-3 py-1.5 text-xs text-muted-foreground/60 tabular-nums">{line.item}</td>
                      <td className="px-3 py-1.5 text-sm">
                        <div className="flex items-center gap-1.5">
                          {hasSubRows && (
                            <button
                              onClick={() => toggleExpand(line.item)}
                              className="h-4 w-4 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors rounded shrink-0"
                            >
                              {isExpanded
                                ? <ChevronDown className="h-3 w-3" />
                                : <ChevronRight className="h-3 w-3" />
                              }
                            </button>
                          )}
                          {mainFormula ? (
                            <FormulaCell label={line.description} formula={mainFormula} />
                          ) : (
                            <span>{line.description}</span>
                          )}
                        </div>
                      </td>
                      {!isSingleColo && coloSites.map((colo) => (
                        <td key={colo.id} className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {formatCurrency(getDisplayValue(colo.id))}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums font-medium">
                        {formatCurrency(displayTotal)}
                      </td>
                    </tr>

                    {/* Expanded sub-rows */}
                    {hasSubRows && isExpanded && subRows.map((subRow) => (
                      <tr key={subRow.label} className="border-t border-border/15 bg-muted/10">
                        <td className="px-3 py-1 text-xs text-muted-foreground/40" />
                        <td className="px-3 py-1 pl-8">
                          <FormulaCell
                            label={`└ ${subRow.label}`}
                            formula={subRow.formula}
                            className="text-xs text-muted-foreground"
                          />
                        </td>
                        {!isSingleColo && coloSites.map((colo) => (
                          <td key={colo.id} className="px-3 py-1 text-right font-mono text-xs tabular-nums text-muted-foreground/60">
                            {formatCurrency(subRow.getValue(colo.id))}
                          </td>
                        ))}
                        <td className="px-3 py-1 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {formatCurrency(subRow.total)}
                        </td>
                      </tr>
                    ))}

                  </React.Fragment>
                );
              })}

              {/* Table total row — sums all lines (1–6) + rental + admin + materials */}
              <tr className="border-t-2 border-primary/20 total-row-gradient">
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 font-semibold text-sm">Total</td>
                {!isSingleColo && coloSites.map((colo) => {
                  const coloTotal = quote.lines.reduce((sum, line) => {
                    const base = line.values[colo.id] || 0;
                    if (line.item === 2 && rentalMarkupCost > 0) {
                      const share = line.totalPrice > 0 ? base / line.totalPrice : 1 / coloSites.length;
                      return sum + base + rentalMarkupCost * share;
                    }
                    if (line.item === 4 && adminPercent > 0) {
                      return sum + base * (1 + adminPercent / 100);
                    }
                    return sum + base;
                  }, 0);
                  return (
                    <td key={colo.id} className="px-3 py-2 text-right font-mono text-xs tabular-nums font-semibold">
                      {formatCurrency(coloTotal)}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right font-mono text-sm tabular-nums font-bold">
                  {(() => {
                    const pmLine = quote.lines.find((l) => l.item === 4);
                    const adminValue = pmLine ? pmLine.totalPrice * (adminPercent / 100) : 0;
                    const equipLine = quote.lines.find((l) => l.item === 3);
                    const taxValue = equipLine ? equipLine.totalPrice * (taxPercent / 100) : 0;
                    return formatCurrency(
                      quote.totalCost + rentalMarkupCost + adminValue + subContractorTotal + taxValue
                    );
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}
