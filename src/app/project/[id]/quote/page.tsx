"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Project, TechnologyConfig, TechnologyQuote } from "@/types";
import {
  DEFAULT_PROJECT_SPECIFIC_DETAILS,
  DEFAULT_PROJECT_EXTRAS,
  DEFAULT_RENTAL_EQUIPMENT,
  DEFAULT_INPUT_PARAMETERS,
  DEFAULT_INSTALL_TRAVEL,
} from "@/types";
import { loadProject } from "@/lib/storage";
import {
  calculatePMTravel,
  calculateTechnologyQuote,
  calculateInstallTravel,
  computeEffectiveLaborHoursPerColo,
  computeEffectiveEquipmentCostPerColo,
  formatCurrency,
} from "@/lib/calculations";
import { TECHNOLOGY_LABELS, TECHNOLOGY_DOT } from "@/lib/constants";
import { QuoteTable } from "@/components/project/quote-table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";

// ─── Migration (same as main project page) ────────────────────────────────────
function migrateProject(p: Project): Project {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacyPsd = p.projectSpecificDetails as any;
  const inputParameters = { ...DEFAULT_INPUT_PARAMETERS, ...p.inputParameters };
  const legacyWaterAndIce: number = legacyPsd?.extras?.waterAndIce ?? 0;
  const technologies = p.technologies.map((tech: TechnologyConfig, idx: number) => ({
    ...tech,
    materialHandlingHours: tech.materialHandlingHours ?? (legacyPsd?.materialHandlingHours ?? 0),
    commissioningSupport: tech.commissioningSupport ?? (legacyPsd?.commissioningSupport ?? 0),
    additionalLaborItems: tech.additionalLaborItems ?? (legacyPsd?.additionalLaborItems ?? []),
    subContractors: tech.subContractors ?? (idx === 0 ? (p.subContractors ?? []) : []),
    rentalEquipment: tech.rentalEquipment ?? (idx === 0 ? (p.rentalEquipment ?? DEFAULT_RENTAL_EQUIPMENT) : DEFAULT_RENTAL_EQUIPMENT),
    waterAndIce: tech.waterAndIce ?? (idx === 0 ? legacyWaterAndIce : 0),
    additionalMaterials: tech.additionalMaterials ?? [],
  }));
  return { ...p, inputParameters, technologies };
}

function QuoteDocument({ project }: { project: Project }) {
  const pmTravelCalculated = useMemo(
    () => calculatePMTravel(project.pmTravel),
    [project.pmTravel]
  );

  const techPsd = project.projectSpecificDetails;
  const hpd = project.inputParameters.hoursPerDay ?? 8;
  const numGuys = project.schedule.numberOfGuys;

  // Effective techs: same as useProject — installLaborHours and equipmentCost include dynamic extras
  const effectiveTechs = useMemo(() => {
    const coloIds = project.coloSites.map((c) => c.id);
    return project.technologies.map((tech) => {
      if (!tech.enabled) return tech;
      const effectiveHours = computeEffectiveLaborHoursPerColo(tech, techPsd, numGuys, hpd);
      const effectiveEquipment = computeEffectiveEquipmentCostPerColo(tech, coloIds);
      return { ...tech, installLaborHours: effectiveHours, equipmentCost: effectiveEquipment };
    });
  }, [project.technologies, project.coloSites, techPsd, numGuys, hpd]);

  // Total install labor hours across all enabled techs (matches LaborSummary)
  const totalAllLaborHours = useMemo(() => {
    return effectiveTechs
      .filter((t) => t.enabled)
      .reduce((sum, tech) => {
        return sum + Object.values(tech.installLaborHours).reduce((s, h) => s + (h || 0), 0);
      }, 0);
  }, [effectiveTechs]);

  // Install travel
  const installTravelCalc = useMemo(() => {
    const config = project.installTravel ?? DEFAULT_INSTALL_TRAVEL;
    if (!config.travelPercent) return null;
    return calculateInstallTravel(
      config,
      totalAllLaborHours,
      hpd,
      numGuys,
      project.inputParameters.travelIndirectMarkup ?? 1.23,
      project.inputParameters.buyHourlyRate ?? 55
    );
  }, [project.installTravel, totalAllLaborHours, project.inputParameters, numGuys, hpd]);

  // Technology quotes (same logic as useProject)
  const quotes: TechnologyQuote[] = useMemo(
    () =>
      effectiveTechs
        .filter((t) => t.enabled)
        .map((tech) => {
          let installTravelOverride: number | undefined;
          if (installTravelCalc) {
            const techHours = Object.values(tech.installLaborHours).reduce((s, h) => s + (h || 0), 0);
            const share = totalAllLaborHours > 0 ? techHours / totalAllLaborHours : 0;
            installTravelOverride = installTravelCalc.markedUpTotal * share;
          }
          return calculateTechnologyQuote(
            tech,
            project.coloSites,
            project.inputParameters,
            pmTravelCalculated.totalPerTrip,
            numGuys,
            0,
            installTravelOverride
          );
        }),
    [effectiveTechs, project.coloSites, project.inputParameters, pmTravelCalculated, numGuys, installTravelCalc, totalAllLaborHours]
  );

  // Per-tech helpers
  const travelMarkupMultiplier = project.inputParameters.travelIndirectMarkup ?? 1.23;
  const subMarkupMultiplier = project.inputParameters.subMarkUp ?? 1.10;

  const getTechRentalRaw = useCallback((tech: TechnologyConfig) => {
    const r = tech.rentalEquipment ?? DEFAULT_RENTAL_EQUIPMENT;
    return (r.lift.numberOfLifts ?? 1) * r.lift.months * r.lift.costPerMonth +
      (r.additionalItems ?? []).reduce((s: number, i: { months: number; costPerMonth: number }) => s + i.months * i.costPerMonth, 0);
  }, []);

  const getTechRentalMarkup = useCallback((tech: TechnologyConfig) => {
    const raw = getTechRentalRaw(tech);
    return raw > 0 ? raw * travelMarkupMultiplier : 0;
  }, [getTechRentalRaw, travelMarkupMultiplier]);

  const getTechSubMarkup = useCallback((tech: TechnologyConfig) => {
    const raw = (tech.subContractors ?? []).reduce((s: number, sub: { value: number }) => s + sub.value, 0);
    return raw > 0 ? raw * subMarkupMultiplier : 0;
  }, [subMarkupMultiplier]);

  const rawPsd = project.projectSpecificDetails ?? DEFAULT_PROJECT_SPECIFIC_DETAILS;
  const psd = rawPsd.extras ? rawPsd : { ...rawPsd, extras: { ...DEFAULT_PROJECT_EXTRAS } };
  const adminPercent = psd.extras?.adminHours ?? 15;
  const taxPercent = project.inputParameters.taxPercent ?? 0;

  const enabledTechs = project.technologies.filter((t) => t.enabled);
  const rentalMarkupTotal = enabledTechs.reduce((s, t) => s + getTechRentalMarkup(t), 0);
  const subMarkupTotal = enabledTechs.reduce((s, t) => s + getTechSubMarkup(t), 0);

  const totalAdminValue = quotes.reduce((sum, q) => {
    const pmLine = q.lines.find((l) => l.item === 4);
    return sum + (pmLine ? pmLine.totalPrice * (adminPercent / 100) : 0);
  }, 0);

  const totalTaxValue = quotes.reduce((sum, q) => {
    const equipLine = q.lines.find((l) => l.item === 3);
    return sum + (equipLine ? equipLine.totalPrice * (taxPercent / 100) : 0);
  }, 0);

  const grandTotal =
    quotes.reduce((sum, q) => sum + q.totalCost, 0) +
    totalAdminValue +
    rentalMarkupTotal +
    subMarkupTotal +
    totalTaxValue;

  // ── Excel download ────────────────────────────────────────────────────────
  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();
    const coloSites = project.coloSites;
    const isSingleColo = coloSites.length === 1;

    // One sheet per technology
    quotes.forEach((quote) => {
      const tech = project.technologies.find((t) => t.type === quote.type)!;
      const techRentalMarkup = getTechRentalMarkup(tech);
      const techSubMarkup = getTechSubMarkup(tech);
      const installTravelLine = quote.lines.find((l) => l.item === 6);
      const pmTravelLine = quote.lines.find((l) => l.item === 5);

      // Headers
      const headers: string[] = ["#", "Description"];
      if (!isSingleColo) coloSites.forEach((c) => headers.push(c.name));
      headers.push("Total");

      const rows: (string | number)[][] = [headers];

      // Data rows (skip folded items 5 & 6 — they appear inside Install/PM)
      quote.lines.forEach((line) => {
        if (line.item === 5 || line.item === 6) return;

        const isInstall = line.item === 2;
        const isPM = line.item === 4;
        const isEquipment = line.item === 3;

        const equipTaxTotal = isEquipment && taxPercent > 0
          ? line.totalPrice * (taxPercent / 100)
          : 0;
        const adminValue = isPM ? line.totalPrice * (adminPercent / 100) : 0;

        const displayTotal = isInstall
          ? line.totalPrice + (installTravelLine?.totalPrice || 0) + techRentalMarkup + techSubMarkup
          : isEquipment
          ? line.totalPrice + equipTaxTotal
          : isPM
          ? line.totalPrice + (pmTravelLine?.totalPrice || 0) + adminValue
          : line.totalPrice;

        const row: (string | number)[] = [line.item, line.description];

        if (!isSingleColo) {
          coloSites.forEach((c) => {
            const base = line.values[c.id] || 0;
            let displayValue = base;
            if (isInstall) {
              const travelVal = installTravelLine?.values[c.id] || 0;
              const rentalShare = techRentalMarkup > 0
                ? techRentalMarkup * (line.totalPrice > 0 ? base / line.totalPrice : 1 / coloSites.length)
                : 0;
              displayValue = base + travelVal + rentalShare;
            } else if (isPM) {
              const travelVal = pmTravelLine?.values[c.id] || 0;
              const adminVal = base * (adminPercent / 100);
              displayValue = base + travelVal + adminVal;
            }
            row.push(Number(displayValue.toFixed(2)));
          });
        }

        row.push(Number(displayTotal.toFixed(2)));
        rows.push(row);
      });

      // Total row
      const pmLine = quote.lines.find((l) => l.item === 4);
      const equipLine = quote.lines.find((l) => l.item === 3);
      const adminValue = pmLine ? pmLine.totalPrice * (adminPercent / 100) : 0;
      const taxValue = equipLine ? equipLine.totalPrice * (taxPercent / 100) : 0;
      const sheetTotal = quote.totalCost + techRentalMarkup + adminValue + techSubMarkup + taxValue;

      const totalRow: (string | number)[] = ["", "Total"];
      if (!isSingleColo) {
        coloSites.forEach((c) => {
          const coloTotal = quote.lines.reduce((sum, line) => {
            if (line.item === 5 || line.item === 6) return sum;
            const base = line.values[c.id] || 0;
            if (line.item === 2) {
              const travelVal = installTravelLine?.values[c.id] || 0;
              const rentalShare = techRentalMarkup > 0
                ? techRentalMarkup * (line.totalPrice > 0 ? base / line.totalPrice : 1 / coloSites.length)
                : 0;
              return sum + base + travelVal + rentalShare;
            }
            if (line.item === 4) {
              const travelVal = pmTravelLine?.values[c.id] || 0;
              const adminVal = base * (adminPercent / 100);
              return sum + base + travelVal + adminVal;
            }
            if (line.item === 3 && taxPercent > 0) {
              return sum + base + base * (taxPercent / 100);
            }
            return sum + base;
          }, 0);
          totalRow.push(Number(coloTotal.toFixed(2)));
        });
      }
      totalRow.push(Number(sheetTotal.toFixed(2)));
      rows.push(totalRow);

      const ws = XLSX.utils.aoa_to_sheet(rows);

      // Format number columns as currency
      const numColStart = isSingleColo ? 2 : 2 + coloSites.length;
      const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
      for (let r = 1; r <= range.e.r; r++) {
        for (let c = isSingleColo ? 2 : 2; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          if (cell && typeof cell.v === "number") {
            cell.z = '"$"#,##0.00';
          }
        }
      }
      void numColStart;

      // Column widths
      const colWidths = [
        { wch: 4 },  // #
        { wch: 30 }, // Description
        ...(!isSingleColo ? coloSites.map(() => ({ wch: 16 })) : []),
        { wch: 16 }, // Total
      ];
      ws["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, TECHNOLOGY_LABELS[quote.type].slice(0, 31));
    });

    // Summary sheet
    const summaryRows: (string | number)[][] = [
      ["Technology", "Total"],
      ...quotes.map((q) => {
        const tech = project.technologies.find((t) => t.type === q.type)!;
        const techRentalMarkup = getTechRentalMarkup(tech);
        const techSubMarkup = getTechSubMarkup(tech);
        const pmLine = q.lines.find((l) => l.item === 4);
        const equipLine = q.lines.find((l) => l.item === 3);
        const adminVal = pmLine ? pmLine.totalPrice * (adminPercent / 100) : 0;
        const taxVal = equipLine ? equipLine.totalPrice * (taxPercent / 100) : 0;
        const techTotal = q.totalCost + techRentalMarkup + adminVal + techSubMarkup + taxVal;
        return [TECHNOLOGY_LABELS[q.type], Number(techTotal.toFixed(2))];
      }),
      ["Grand Total", Number(grandTotal.toFixed(2))],
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
    summaryWs["!cols"] = [{ wch: 20 }, { wch: 16 }];
    // Format total column
    for (let r = 1; r < summaryRows.length; r++) {
      const cell = summaryWs[XLSX.utils.encode_cell({ r, c: 1 })];
      if (cell && typeof cell.v === "number") cell.z = '"$"#,##0.00';
    }
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

    XLSX.writeFile(wb, `${project.name || "Quote"}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Controls — hidden when printing */}
      <div className="print:hidden border-b border-border/60 bg-background/85 backdrop-blur-xl backdrop-saturate-150 sticky top-0 z-10">
        <div className="max-w-[1200px] mx-auto px-6 py-2 flex items-center justify-between">
          <Link href={`/project/${project.id}`}>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
              <ArrowLeft className="h-3 w-3 mr-1" /> Back to Project
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button onClick={downloadExcel} size="sm" variant="outline" className="h-7 text-xs">
              <FileSpreadsheet className="h-3 w-3 mr-1" /> Download Excel
            </Button>
            <Button onClick={() => window.print()} size="sm" className="h-7 text-xs">
              <Printer className="h-3 w-3 mr-1" /> Print / Save PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Quote Content */}
      <div className="max-w-[1200px] mx-auto px-6 py-8 print:px-0 print:py-0 space-y-5">
        {/* Header */}
        <div className="print:mb-4">
          <h1 className="text-xl font-semibold tracking-tight mb-0.5">{project.name}</h1>
          {project.client && (
            <p className="text-sm text-muted-foreground">Client: {project.client}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Generated:{" "}
            {new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Technology Quote Tables */}
        {quotes.map((quote) => {
          const tech = project.technologies.find((t) => t.type === quote.type)!;
          const techRentalMarkup = getTechRentalMarkup(tech);
          const techSubMarkup = getTechSubMarkup(tech);
          return (
            <div key={quote.type} className="print:break-inside-avoid">
              <QuoteTable
                quote={quote}
                coloSites={project.coloSites}
                rentalMarkupCost={techRentalMarkup}
                adminPercent={adminPercent}
                subContractorTotal={techSubMarkup}
                taxPercent={taxPercent}
                installTravelActive={installTravelCalc !== null}
              />
            </div>
          );
        })}

        {/* Project Summary */}
        {quotes.length > 0 && (
          <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card print:break-inside-avoid print:shadow-none">
            <div className="px-3 py-2 border-b border-border/50 header-gradient">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Project Summary
              </h3>
            </div>
            <div className="divide-y divide-border/30">
              {quotes.map((q) => {
                const tech = project.technologies.find((t) => t.type === q.type)!;
                const techRentalMarkup = getTechRentalMarkup(tech);
                const techSubMarkup = getTechSubMarkup(tech);
                const pmLine = q.lines.find((l) => l.item === 4);
                const equipLine = q.lines.find((l) => l.item === 3);
                const adminVal = pmLine ? pmLine.totalPrice * (adminPercent / 100) : 0;
                const taxVal = equipLine ? equipLine.totalPrice * (taxPercent / 100) : 0;
                const techTotal = q.totalCost + techRentalMarkup + adminVal + techSubMarkup + taxVal;
                return (
                  <div key={q.type} className="flex items-center justify-between py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${TECHNOLOGY_DOT[q.type]}`} />
                      <span className="text-sm">{TECHNOLOGY_LABELS[q.type]}</span>
                    </div>
                    <span className="font-mono text-sm tabular-nums">{formatCurrency(techTotal)}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between py-3 px-4 total-row-gradient border-t border-primary/10">
                <span className="font-bold text-foreground">Grand Total</span>
                <span className="font-mono text-lg tabular-nums font-bold text-foreground">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QuotePage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    const id = params.id as string;
    loadProject(id).then((p) => {
      if (!p) {
        router.push("/");
        return;
      }
      setProject(migrateProject(p));
    });
  }, [params.id, router]);

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading quote...</div>
      </div>
    );
  }

  return <QuoteDocument project={project} />;
}
