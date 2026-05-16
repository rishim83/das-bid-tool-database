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
  3: "Equipment Cost × Material Contingency × Mark Up",
};

interface SubRowDef {
  label: string;
  formula: string;
  getValue: (coloId: string) => number;
  total: number;
}

interface AdditionalMaterial { name: string; value: number; }

interface Props {
  quote: TechnologyQuote;
  coloSites: ColoSite[];
  rentalMarkupCost?: number;
  adminPercent?: number;
  subContractorTotal?: number;
  taxPercent?: number;
  installTravelActive?: boolean;
  materialSafety?: number;
  laborSafety?: number;
  equipMarkUp?: number;
  additionalMaterials?: AdditionalMaterial[];
  /** Pre-contingency (hourlyRate × hours, no laborSafety) named sub-items under Install */
  laborSubItems?: { label: string; baseCost: number }[];
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
  laborSafety = 1,
  equipMarkUp = 1,
  additionalMaterials = [],
  laborSubItems = [],
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
        className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card"
        style={{ borderLeft: `3px solid ${TECH_BORDER[quote.type]}` }}
      >
        <div className={`px-4 py-2.5 border-b flex items-center gap-2.5 ${TECHNOLOGY_TINT[quote.type]} ${TECHNOLOGY_TINT_DARK[quote.type]}`}>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${TECHNOLOGY_BG[quote.type]}`}>
            {tableLabel}
          </span>
          <h3 className="text-xs font-semibold tracking-wide opacity-60">Quote</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="text-sm w-full">
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
                  // Base = all effective hours × hourlyRate (before contingency)
                  const baseLaborTotal = laborSafety !== 0 ? line.totalPrice / laborSafety : line.totalPrice;
                  // Sum of named sub-item base costs (pre-contingency)
                  const activeSubItems = laborSubItems.filter((s) => s.baseCost > 0);
                  const subItemBaseTotal = activeSubItems.reduce((sum, s) => sum + s.baseCost, 0);
                  const coreInstallBase = baseLaborTotal - subItemBaseTotal;

                  // Install Labor row (all hours minus named sub-items, pre-contingency)
                  subRows.push({
                    label: activeSubItems.length > 0 ? "Install Labor" : (laborSafety !== 1 ? "Install Labor Base" : "Install Labor"),
                    formula: "Labor Hours × Hourly Rate",
                    getValue: (coloId) => {
                      const ratio = line.totalPrice > 0 ? (line.values[coloId] || 0) / line.totalPrice : 1 / coloSites.length;
                      return activeSubItems.length > 0
                        ? ratio * coreInstallBase
                        : laborSafety !== 0 ? (line.values[coloId] || 0) / laborSafety : line.values[coloId] || 0;
                    },
                    total: activeSubItems.length > 0 ? coreInstallBase : baseLaborTotal,
                  });

                  // Named sub-items (commissioning, shuttle, etc.) — shown at pre-contingency cost
                  activeSubItems.forEach((subItem) => {
                    subRows.push({
                      label: subItem.label,
                      formula: "Hours × Hourly Rate",
                      getValue: (coloId) => {
                        const ratio = line.totalPrice > 0 ? (line.values[coloId] || 0) / line.totalPrice : 1 / coloSites.length;
                        return ratio * subItem.baseCost;
                      },
                      total: subItem.baseCost,
                    });
                  });

                  // Labor Contingency row — covers all hours uniformly
                  if (laborSafety !== 1) {
                    subRows.push({
                      label: `+ Labor Contingency (×${laborSafety.toFixed(2)})`,
                      formula: "Base × (Labor Contingency − 1)",
                      getValue: (coloId) => {
                        const base = laborSafety !== 0 ? (line.values[coloId] || 0) / laborSafety : 0;
                        return base * (laborSafety - 1);
                      },
                      total: baseLaborTotal * (laborSafety - 1),
                    });
                  }
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
                  const addlMatTotal = additionalMaterials.filter((m) => m.value > 0).reduce((s, m) => s + m.value, 0);
                  const divisor = materialSafety * equipMarkUp;
                  // rawCombined = bomEquip + additionalMaterials (before contingency + markup)
                  const rawCombined = divisor !== 0 ? line.totalPrice / divisor : line.totalPrice;
                  const rawBOMOnly = Math.max(0, rawCombined - addlMatTotal);
                  const hasBreakdown = materialSafety !== 1 || equipMarkUp !== 1 || addlMatTotal > 0;

                  if (hasBreakdown) {
                    // Equipment Base (BOM only)
                    subRows.push({
                      label: "Equipment Base",
                      formula: "Raw BOM Equipment Cost",
                      getValue: (coloId) => {
                        const raw = divisor !== 0 ? (line.values[coloId] || 0) / divisor : line.values[coloId] || 0;
                        return Math.max(0, raw - (line.totalPrice > 0 ? addlMatTotal * (line.values[coloId] || 0) / line.totalPrice : 0));
                      },
                      total: rawBOMOnly,
                    });
                    // Individual additional material lines
                    additionalMaterials.filter((m) => m.value > 0).forEach((m) => {
                      subRows.push({
                        label: m.name || "Additional Material",
                        formula: "Additional Material (raw cost)",
                        getValue: (coloId) => line.totalPrice > 0
                          ? m.value * (line.values[coloId] || 0) / line.totalPrice
                          : 0,
                        total: m.value,
                      });
                    });
                    // Contingency on combined base
                    if (materialSafety !== 1) {
                      subRows.push({
                        label: `Material Contingency (×${materialSafety.toFixed(2)})`,
                        formula: `(Equipment Base + Additional Materials) × (Material Contingency − 1)`,
                        getValue: (coloId) => {
                          const raw = divisor !== 0 ? (line.values[coloId] || 0) / divisor : line.values[coloId] || 0;
                          return raw * (materialSafety - 1);
                        },
                        total: rawCombined * (materialSafety - 1),
                      });
                    }
                    // Markup on combined base × contingency
                    if (equipMarkUp !== 1) {
                      subRows.push({
                        label: `Mark Up (×${equipMarkUp.toFixed(2)})`,
                        formula: `(Equipment Base + Additional Materials) × Material Contingency × (Mark Up − 1)`,
                        getValue: (coloId) => {
                          const raw = divisor !== 0 ? (line.values[coloId] || 0) / divisor : line.values[coloId] || 0;
                          return raw * materialSafety * (equipMarkUp - 1);
                        },
                        total: rawCombined * materialSafety * (equipMarkUp - 1),
                      });
                    }
                  } else {
                    subRows.push({
                      label: "Equipment",
                      formula: "Equipment Cost × Material Contingency × Mark Up",
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
                  const parts = ["Equipment Cost × Material Contingency × Mark Up"];
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
