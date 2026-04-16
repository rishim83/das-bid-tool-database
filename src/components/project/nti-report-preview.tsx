"use client";

import { useState } from "react";
import type { TechnologyConfig, ColoSite } from "@/types";
import { formatCurrency } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { TECHNOLOGY_LABELS, TECHNOLOGY_DOT } from "@/lib/constants";

const NC_ONLY_CODES = new Set([
  "PCC", "BADGE", "MH", "COMM", "ADDL",
  "SHUTTLE", "S&F", "CLEANUP", "LIFT", "W&I", "ADDL-MAT",
]);

interface Row {
  code: string;
  manufacturer: string;
  qty: number | string;
  unitEquipPrice: number;
  unitLaborHrs: number;
  rfServices: number;
  matTotal: number;
  laborTotal: number;
  isRF?: boolean;
}

interface Props {
  tech: TechnologyConfig;
  coloSites: ColoSite[];
  materialContingency: number;
  laborContingency: number;
}

export function NTIReportPreview({ tech, coloSites, materialContingency, laborContingency }: Props) {
  const [copied, setCopied] = useState(false);

  const matMult = 1 + materialContingency / 100;
  const labMult = 1 + laborContingency / 100;

  const rfRows: Row[] = tech.rfLineItems
    .filter((item) => coloSites.some((c) => (item.values[c.id] || 0) > 0))
    .map((item) => ({
      code: "RF",
      manufacturer: item.description || "RF Engineering",
      qty: 1,
      unitEquipPrice: 0,
      unitLaborHrs: 0,
      rfServices: coloSites.reduce((s, c) => s + (item.values[c.id] || 0), 0),
      matTotal: 0,
      laborTotal: 0,
      isRF: true,
    }));

  const bomRows: Row[] = (tech.bomReportRows ?? [])
    .filter((row) => !NC_ONLY_CODES.has(row.code))
    .map((row) => {
      const adjPrice = row.unitEquipPrice * matMult;
      const adjLabor = row.unitLaborHrs * labMult;
      return {
        code: row.code,
        manufacturer: row.manufacturer,
        qty: row.qty,
        unitEquipPrice: adjPrice,
        unitLaborHrs: adjLabor,
        rfServices: 0,
        matTotal: adjPrice * row.qty,
        laborTotal: adjLabor * row.qty,
      };
    });

  const allRows = [...rfRows, ...bomRows];
  if (allRows.length === 0) return null;

  const totalRF  = rfRows.reduce((s, r) => s + r.rfServices, 0);
  const totalMat = bomRows.reduce((s, r) => s + r.matTotal, 0);
  const totalLab = bomRows.reduce((s, r) => s + r.laborTotal, 0);

  const matLabel  = `Material Unit Cost${materialContingency > 0 ? ` (+${materialContingency}%)` : ""}`;
  const labLabel  = `Labor Unit Hours${laborContingency > 0 ? ` (+${laborContingency}%)` : ""}`;

  const handleCopy = () => {
    const headers = [
      "Part Number", "Manufacturer", "", "QTY", "", "",
      matLabel, labLabel, "RF Services ($)",
    ];
    const dataRows = allRows.map((r) => [
      r.code,
      r.manufacturer,
      "",
      r.qty,
      "",
      "",
      r.unitEquipPrice > 0 ? r.unitEquipPrice.toFixed(2) : "",
      r.unitLaborHrs > 0  ? r.unitLaborHrs.toFixed(4)   : "",
      r.rfServices > 0    ? r.rfServices.toFixed(2)      : "",
    ]);
    const totalRow = [
      "", "TOTAL", "", "", "", "",
      "", "",
      totalRF  > 0 ? totalRF.toFixed(2)  : "",
    ];
    const tsv = [...dataRows, totalRow]
      .map((row) => row.join("\t"))
      .join("\n");
    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border/50 header-gradient-accent flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`h-2 w-2 rounded-full ${TECHNOLOGY_DOT[tech.type]}`} />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {TECHNOLOGY_LABELS[tech.type]} &mdash; Report Preview
          </h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={handleCopy}
        >
          {copied
            ? <><Check className="h-3 w-3 mr-1 text-emerald-500" /> Copied!</>
            : <><Copy className="h-3 w-3 mr-1" /> Copy for Excel</>}
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50 bg-card">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Part Number</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Manufacturer / Description</th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">QTY</th>
              <th className="px-2 py-2" />
              <th className="px-2 py-2" />
              <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">{matLabel}</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">{labLabel}</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">RF Services ($)</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((row, i) => (
              <tr
                key={i}
                className={`border-t border-border/20 ${i % 2 === 0 ? "bg-card" : "bg-secondary/20"} ${row.isRF ? "text-primary/80" : ""}`}
              >
                <td className="px-3 py-1.5 font-mono">{row.code}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{row.manufacturer}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{row.qty}</td>
                <td className="px-2 py-1.5" />
                <td className="px-2 py-1.5" />
                <td className="px-3 py-1.5 text-right tabular-nums font-mono">
                  {row.unitEquipPrice > 0 ? formatCurrency(row.unitEquipPrice) : ""}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums font-mono">
                  {row.unitLaborHrs > 0 ? row.unitLaborHrs.toFixed(4) : ""}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums font-mono">
                  {row.rfServices > 0 ? formatCurrency(row.rfServices) : ""}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border/60 bg-secondary/40 font-semibold">
              <td className="px-3 py-2" colSpan={2}>TOTAL</td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right tabular-nums font-mono">
                {totalRF > 0 ? formatCurrency(totalRF) : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
