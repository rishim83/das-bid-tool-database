"use client";

import type { TechnologyQuote, ProjectSpecificDetails } from "@/types";
import { formatCurrency } from "@/lib/calculations";
import { TECHNOLOGY_LABELS, TECHNOLOGY_DOT } from "@/lib/constants";

interface Props {
  quotes: TechnologyQuote[];
  projectSpecificDetails?: ProjectSpecificDetails;
  rentalMarkupTotal?: number;
  totalAdminValue?: number;
  subMarkupTotal?: number;
  techTotals?: Record<string, number>;
  totalTaxValue?: number;
}

export function ProjectSummary({ quotes, projectSpecificDetails: _psd, rentalMarkupTotal = 0, totalAdminValue = 0, subMarkupTotal = 0, techTotals, totalTaxValue = 0 }: Props) {
  const techTotal = quotes.reduce((sum, q) => sum + q.totalCost, 0);

  const grandTotal = techTotal + totalAdminValue + rentalMarkupTotal + subMarkupTotal + totalTaxValue;

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card">
      <div className="px-3 py-2 border-b border-border/50 header-gradient">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project Summary</h3>
      </div>
      <div className="divide-y divide-border/30">
        {quotes.map((q) => (
          <div key={q.type} className="flex items-center justify-between py-2.5 px-4">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${TECHNOLOGY_DOT[q.type]}`} />
              <span className="text-sm">{TECHNOLOGY_LABELS[q.type]}</span>
            </div>
            <span className="font-mono text-sm tabular-nums">{formatCurrency(techTotals ? (techTotals[q.type] ?? q.totalCost) : q.totalCost)}</span>
          </div>
        ))}
        {totalTaxValue > 0 && (
          <div className="flex items-center justify-between py-2.5 px-4">
            <span className="text-sm text-muted-foreground">Tax</span>
            <span className="font-mono text-sm tabular-nums">{formatCurrency(totalTaxValue)}</span>
          </div>
        )}
        <div className="flex items-center justify-between py-3 px-4 total-row-gradient border-t border-primary/10">
          <span className="font-bold text-foreground">Grand Total</span>
          <span className="font-mono text-lg tabular-nums font-bold text-foreground">
            {formatCurrency(grandTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}
