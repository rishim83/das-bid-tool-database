"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import type { TechnologyType } from "@/types";
import { TECHNOLOGY_LABELS, TECHNOLOGY_DOT } from "@/lib/constants";

export interface FinancialItem {
  label: string;
  cost: number;
  sell: number;
  children?: FinancialItem[];
}

interface Props {
  items: FinancialItem[];
  techTotals?: Record<TechnologyType, number>;
  grandTotal?: number;
}

function pct(n: number): string {
  return n.toFixed(1) + "%";
}

export function FinancialReview({ items, techTotals, grandTotal }: Props) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const visible = items.filter((i) => i.sell > 0 || i.cost > 0);
  if (visible.length === 0) return null;

  const totalCost = visible.reduce((s, i) => s + i.cost, 0);
  const totalSell = visible.reduce((s, i) => s + i.sell, 0);
  const totalMargin = totalSell - totalCost;
  const totalMarginPct = totalSell > 0 ? (totalMargin / totalSell) * 100 : 0;

  const toggleExpand = (label: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card">
      <button
        className="w-full px-4 py-2.5 border-b border-border/50 header-gradient flex items-center justify-between hover:bg-muted/20 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Financial Review
        </h3>
        <div className="flex items-center gap-3">
          {!open && (
            <span className="text-xs font-mono tabular-nums text-muted-foreground">
              {pct(totalMarginPct)} margin
            </span>
          )}
          {open
            ? <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
            : <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
        </div>
      </button>

      {open && techTotals && (
        <div className="px-4 py-3 border-b border-border/30 bg-muted/20 flex items-center gap-6 flex-wrap">
          {(Object.entries(techTotals) as [TechnologyType, number][]).map(([type, total]) => (
            <div key={type} className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full shrink-0 ${TECHNOLOGY_DOT[type]}`} />
              <div className="flex flex-col">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {TECHNOLOGY_LABELS[type]}
                </span>
                <span className="text-xs font-semibold font-mono tabular-nums">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          ))}
          {grandTotal !== undefined && (
            <div className="ml-auto flex flex-col items-end">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Grand Total</span>
              <span className="text-sm font-bold font-mono tabular-nums">{formatCurrency(grandTotal)}</span>
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-card">
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground min-w-[200px]">
                  Category
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground min-w-[110px]">
                  Cost
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground min-w-[110px]">
                  Sell
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground min-w-[110px]">
                  Gross Margin
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground min-w-[90px]">
                  Gross Margin %
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.flatMap((item) => {
                const margin = item.sell - item.cost;
                const marginPct = item.sell > 0 ? (margin / item.sell) * 100 : 0;
                const isPassThrough = Math.abs(margin) < 0.01;
                const hasChildren = (item.children?.length ?? 0) > 0;
                const isExpanded = expanded.has(item.label);

                const parentRow = (
                  <tr
                    key={item.label}
                    className="border-t border-border/25 hover:bg-accent/30 transition-colors"
                  >
                    <td className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-1.5">
                        {hasChildren ? (
                          <button
                            onClick={() => toggleExpand(item.label)}
                            className="text-muted-foreground/60 hover:text-foreground transition-colors shrink-0"
                          >
                            {isExpanded
                              ? <ChevronDown className="h-3 w-3" />
                              : <ChevronRight className="h-3 w-3" />}
                          </button>
                        ) : (
                          <span className="inline-block w-3 shrink-0" />
                        )}
                        <span className={hasChildren ? "font-medium" : ""}>{item.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {formatCurrency(item.cost)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">
                      {formatCurrency(item.sell)}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono text-xs tabular-nums ${
                      isPassThrough ? "text-muted-foreground/50" : margin >= 0 ? "text-emerald-500" : "text-destructive"
                    }`}>
                      {isPassThrough ? "—" : formatCurrency(margin)}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono text-xs tabular-nums ${
                      isPassThrough ? "text-muted-foreground/50" : marginPct >= 0 ? "text-emerald-500" : "text-destructive"
                    }`}>
                      {isPassThrough ? "—" : pct(marginPct)}
                    </td>
                  </tr>
                );

                const childRows = hasChildren && isExpanded
                  ? item.children!.map((child) => {
                      const cm = child.sell - child.cost;
                      const cmPct = child.sell > 0 ? (cm / child.sell) * 100 : 0;
                      const cPass = Math.abs(cm) < 0.01;
                      return (
                        <tr
                          key={`${item.label}::${child.label}`}
                          className="border-t border-border/15 bg-muted/10 hover:bg-accent/20 transition-colors"
                        >
                          <td className="py-1.5 text-xs text-muted-foreground pl-10 pr-4">
                            {child.label}
                          </td>
                          <td className="px-4 py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground/60">
                            {formatCurrency(child.cost)}
                          </td>
                          <td className="px-4 py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground/70">
                            {formatCurrency(child.sell)}
                          </td>
                          <td className={`px-4 py-1.5 text-right font-mono text-xs tabular-nums ${
                            cPass ? "text-muted-foreground/40" : cm >= 0 ? "text-emerald-500/70" : "text-destructive/70"
                          }`}>
                            {cPass ? "—" : formatCurrency(cm)}
                          </td>
                          <td className={`px-4 py-1.5 text-right font-mono text-xs tabular-nums ${
                            cPass ? "text-muted-foreground/40" : cmPct >= 0 ? "text-emerald-500/70" : "text-destructive/70"
                          }`}>
                            {cPass ? "—" : pct(cmPct)}
                          </td>
                        </tr>
                      );
                    })
                  : [];

                return [parentRow, ...childRows];
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-primary/20 total-row-gradient">
                <td className="px-4 py-2 font-semibold text-sm pl-8">Total</td>
                <td className="px-4 py-2 text-right font-mono text-xs tabular-nums font-semibold">
                  {formatCurrency(totalCost)}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs tabular-nums font-semibold">
                  {formatCurrency(totalSell)}
                </td>
                <td className={`px-4 py-2 text-right font-mono text-xs tabular-nums font-semibold ${
                  totalMargin >= 0 ? "text-emerald-500" : "text-destructive"
                }`}>
                  {formatCurrency(totalMargin)}
                </td>
                <td className={`px-4 py-2 text-right font-mono text-xs tabular-nums font-bold ${
                  totalMarginPct >= 0 ? "text-emerald-500" : "text-destructive"
                }`}>
                  {pct(totalMarginPct)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
