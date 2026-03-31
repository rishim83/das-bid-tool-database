"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { loadProject } from "@/lib/storage";
import { useProject } from "@/hooks/use-project";
import type { SaveStatus } from "@/hooks/use-project";
import type { Project, TechnologyConfig, TechnologyType } from "@/types";
import { DEFAULT_PROJECT_SPECIFIC_DETAILS, DEFAULT_PROJECT_EXTRAS, DEFAULT_RENTAL_EQUIPMENT, DEFAULT_INPUT_PARAMETERS, DEFAULT_INSTALL_TRAVEL } from "@/types";
import { QuoteTable } from "@/components/project/quote-table";
import { FinancialReview, type FinancialItem } from "@/components/project/financial-review";
import { LaborSummary } from "@/components/project/labor-summary";
import { MaterialsSummary } from "@/components/project/materials-summary";
import { AIEstimateDialog } from "@/components/project/ai-estimate-dialog";
import { NTIReportPreview } from "@/components/project/nti-report-preview";
import { ProjectSidebar, SidebarOverlayPanel, type SidebarPanelId } from "@/components/project/project-sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TECHNOLOGY_LABELS, TECHNOLOGY_DOT, TECHNOLOGY_BG, TECHNOLOGY_TINT_DARK } from "@/lib/constants";

const TECH_ACCENT_HEX: Record<string, string> = {
  DAS: "#3b82f6",
  PUBLIC_SAFETY: "#ef4444",
  ROIP: "#f97316",
};
import { formatCurrency } from "@/lib/calculations";
import { ArrowLeft, Check, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
// ExcelJS loaded dynamically inside downloadDetailedExcel to keep bundle lean
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

// ─── Migration: move project-level fields to per-tech ────────────────────────
function migrateProject(p: Project): Project {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacyPsd = p.projectSpecificDetails as any;
  // Fill in any inputParameters fields added after initial release
  const inputParameters = { ...DEFAULT_INPUT_PARAMETERS, ...p.inputParameters };
  // Migrate waterAndIce from legacy psd.extras to first tech (it was project-level before)
  const legacyWaterAndIce: number = legacyPsd?.extras?.waterAndIce ?? 0;
  const technologies = p.technologies.map((tech: TechnologyConfig, idx: number) => {
    const base = {
      ...tech,
      materialHandlingHours: tech.materialHandlingHours ?? (legacyPsd?.materialHandlingHours ?? 0),
      commissioningSupport: tech.commissioningSupport ?? (legacyPsd?.commissioningSupport ?? 0),
      additionalLaborItems: tech.additionalLaborItems ?? (legacyPsd?.additionalLaborItems ?? []),
      subContractors: tech.subContractors ?? (idx === 0 ? (p.subContractors ?? []) : []),
      rentalEquipment: tech.rentalEquipment ?? (idx === 0 ? (p.rentalEquipment ?? DEFAULT_RENTAL_EQUIPMENT) : DEFAULT_RENTAL_EQUIPMENT),
      waterAndIce: tech.waterAndIce ?? (idx === 0 ? legacyWaterAndIce : 0),
      additionalMaterials: tech.additionalMaterials ?? [],
    };

    // Strip extras baked into equipmentCost by pre-fix imports.
    // If equipmentCostBreakdown exists and its bom + extras ≈ current equipmentCost total,
    // the extras were baked in — redistribute only the raw BOM across colos.
    const ebd = base.equipmentCostBreakdown;
    if (ebd) {
      const extras = (ebd.waterAndIce ?? 0) +
        (ebd.additionalMaterials ?? []).reduce((s: number, m: { value: number }) => s + m.value, 0);
      if (extras > 0) {
        const oldTotal = Object.values(base.equipmentCost).reduce((s: number, v) => s + (v || 0), 0);
        const bom = ebd.bom ?? 0;
        if (Math.abs(oldTotal - bom - extras) < 1) {
          // Extras are baked in — strip them out, keeping only raw BOM per colo
          const fixedCost: Record<string, number> = {};
          for (const [coloId, oldVal] of Object.entries(base.equipmentCost)) {
            const pct = oldTotal > 0 ? (oldVal || 0) / oldTotal : 0;
            fixedCost[coloId] = Math.round(bom * pct * 100) / 100;
          }
          return { ...base, equipmentCost: fixedCost };
        }
      }
    }

    return base;
  });
  return { ...p, inputParameters, technologies };
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mr-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving…
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex items-center gap-1 text-[11px] text-destructive mr-1">
        <AlertCircle className="h-3 w-3" />
        Error saving
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mr-1">
      <Check className="h-3 w-3 text-emerald-500" />
      Saved
    </div>
  );
}

function ProjectWorksheet({ initialProject }: { initialProject: Project }) {
  const {
    project,
    saveStatus,
    fullSchedule,
    pmTravelCalculated,
    installTravelCalc,
    quotes,
    updateInputParameters,
    updateSchedule,
    updatePMTravel,
    updateInstallTravel,
    updateColoSites,
    updateTechnology,
    updateProjectMeta,
    updateProjectSpecificDetails,
    applyBulkUpdate,
  } = useProject(initialProject);

  const rawPsd = project.projectSpecificDetails ?? DEFAULT_PROJECT_SPECIFIC_DETAILS;
  // Guard: if an older saved project has psd but no extras field, merge in the defaults
  const psd = rawPsd.extras ? rawPsd : { ...rawPsd, extras: { ...DEFAULT_PROJECT_EXTRAS } };

  const [activeTab, setActiveTab] = useState<TechnologyType>("DAS");
  const [activePanel, setActivePanel] = useState<SidebarPanelId | null>(null);
  const SIDEBAR_WIDTH = 288;

  // Per-tech rental/sub helpers
  const travelMarkupMultiplier = project.inputParameters.travelIndirectMarkup ?? 1.23;
  const subMarkupMultiplier = project.inputParameters.subMarkUp ?? 1.10;

  const getTechRentalRaw = (tech: TechnologyConfig) => {
    const r = tech.rentalEquipment ?? DEFAULT_RENTAL_EQUIPMENT;
    return (r.lift.numberOfLifts ?? 1) * r.lift.months * r.lift.costPerMonth +
      (r.additionalItems ?? []).reduce((s, i) => s + i.months * i.costPerMonth, 0);
  };
  const getTechRentalMarkup = (tech: TechnologyConfig) => {
    const raw = getTechRentalRaw(tech);
    return raw > 0 ? raw * travelMarkupMultiplier : 0;
  };
  const getTechSubRaw = (tech: TechnologyConfig) =>
    (tech.subContractors ?? []).reduce((s, sub) => s + sub.value, 0);
  const getTechSubMarkup = (tech: TechnologyConfig) => {
    const raw = getTechSubRaw(tech);
    return raw > 0 ? raw * subMarkupMultiplier : 0;
  };

  // Aggregated totals across all enabled techs (for FinancialReview / ProjectSummary / grand total)
  const enabledTechs = project.technologies.filter((t) => t.enabled);
  const rentalRawTotal = enabledTechs.reduce((s, t) => s + getTechRentalRaw(t), 0);
  const rentalMarkupTotal = enabledTechs.reduce((s, t) => s + getTechRentalMarkup(t), 0);
  const subRawTotal = enabledTechs.reduce((s, t) => s + getTechSubRaw(t), 0);
  const subMarkupTotal = enabledTechs.reduce((s, t) => s + getTechSubMarkup(t), 0);
  const adminPercent = psd.extras?.adminHours ?? 15;
  const totalAdminValue = quotes.reduce((sum, q) => {
    const pmLine = q.lines.find((l) => l.item === 4);
    return sum + (pmLine ? pmLine.totalPrice * (adminPercent / 100) : 0);
  }, 0);

  // Tax on equipment — per-tech, based on each quote's equipment line (item 3)
  const taxPercent = project.inputParameters.taxPercent ?? 0;
  const totalTaxValue = quotes.reduce((sum, q) => {
    const equipLine = q.lines.find((l) => l.item === 3);
    return sum + (equipLine ? equipLine.totalPrice * (taxPercent / 100) : 0);
  }, 0);

  const grandTotal = quotes.reduce((sum, q) => sum + q.totalCost, 0) + totalAdminValue + rentalMarkupTotal + subMarkupTotal + totalTaxValue;

  // Per-tech totals matching quote page formula (used by ProjectSummary per-row display)
  const techTotals: Record<string, number> = Object.fromEntries(
    quotes.map((q) => {
      const tech = enabledTechs.find((t) => t.type === q.type)!;
      const techRentalMarkup = getTechRentalMarkup(tech);
      const techSubMarkup = getTechSubMarkup(tech);
      const pmLine = q.lines.find((l) => l.item === 4);
      const equipLine = q.lines.find((l) => l.item === 3);
      const adminVal = pmLine ? pmLine.totalPrice * (adminPercent / 100) : 0;
      const taxVal = equipLine ? equipLine.totalPrice * (taxPercent / 100) : 0;
      return [q.type, q.totalCost + techRentalMarkup + adminVal + techSubMarkup + taxVal];
    })
  );

  // ── Financial review ──────────────────────────────────────────────
  const finP = project.inputParameters;
  const travelMarkup     = finP.travelIndirectMarkup ?? 1.23;
  const buyRate          = finP.buyHourlyRate ?? 55;
  const sellRate         = finP.hourlyRate ?? 0;
  const buyPMRate        = finP.buyPMHourlyRate ?? 95;
  const sellPMRate       = finP.pmHourlyRate ?? 0;

  // Per-line sell totals across all active technologies
  const rfSell           = quotes.reduce((s, q) => s + (q.lines.find((l) => l.item === 1)?.totalPrice || 0), 0);
  const installLaborSell = quotes.reduce((s, q) => s + (q.lines.find((l) => l.item === 2)?.totalPrice || 0), 0);
  const equipSell        = quotes.reduce((s, q) => s + (q.lines.find((l) => l.item === 3)?.totalPrice || 0), 0);
  const pmBaseSell       = quotes.reduce((s, q) => s + (q.lines.find((l) => l.item === 4)?.totalPrice || 0), 0);
  const pmTravelSell     = quotes.reduce((s, q) => s + (q.lines.find((l) => l.item === 5)?.totalPrice || 0), 0);
  const installTravelSell= quotes.reduce((s, q) => s + (q.lines.find((l) => l.item === 6)?.totalPrice || 0), 0);

  // Back-calculate costs (including contingency, excluding markup)
  const rfCost           = finP.subMarkUp > 1 ? rfSell / finP.subMarkUp : rfSell;
  const installLaborCost = sellRate > 0 ? installLaborSell * buyRate / sellRate : installLaborSell;
  const equipCost        = finP.markUp > 0 ? equipSell / finP.markUp : equipSell;
  const pmBaseCost       = sellPMRate > 0 ? pmBaseSell * buyPMRate / sellPMRate : pmBaseSell;
  const adminCost        = sellPMRate > 0 ? totalAdminValue * buyPMRate / sellPMRate : totalAdminValue;
  const installTravelCost= travelMarkup > 0 ? installTravelSell / travelMarkup : installTravelSell;
  const pmTravelCost     = travelMarkup > 0 ? pmTravelSell / travelMarkup : pmTravelSell;

  // Sub-item arrays for expandable rows
  const installChildren: FinancialItem[] = [
    ...(installLaborSell > 0  ? [{ label: "Labor Hours",      cost: installLaborCost,  sell: installLaborSell }]  : []),
    ...(installTravelSell > 0 ? [{ label: "Travel",           cost: installTravelCost, sell: installTravelSell }] : []),
    ...(rentalMarkupTotal > 0 ? [{ label: "Rental Equipment", cost: rentalRawTotal,    sell: rentalMarkupTotal }]  : []),
  ];
  const pmChildren: FinancialItem[] = [
    ...(pmBaseSell > 0      ? [{ label: "PM Hours",  cost: pmBaseCost,  sell: pmBaseSell }]      : []),
    ...(pmTravelSell > 0    ? [{ label: "PM Travel", cost: pmTravelCost,sell: pmTravelSell }]    : []),
    ...(totalAdminValue > 0 ? [{ label: "Admin",     cost: adminCost,   sell: totalAdminValue }] : []),
  ];
  const equipChildren: FinancialItem[] = [
    ...(equipSell > 0 ? [{ label: "Equipment", cost: equipCost, sell: equipSell }] : []),
  ];

  const financialItems: FinancialItem[] = [
    { label: "RF Engineering", cost: rfCost, sell: rfSell },
    {
      label: "Installation",
      cost: installLaborCost + installTravelCost + rentalRawTotal,
      sell: installLaborSell + installTravelSell + rentalMarkupTotal,
      children: installChildren.length > 1 ? installChildren : undefined,
    },
    {
      label: "Materials & Equipment",
      cost: equipCost,
      sell: equipSell,
      children: equipChildren.length > 1 ? equipChildren : undefined,
    },
    {
      label: "Project Management",
      cost: pmBaseCost + pmTravelCost + adminCost,
      sell: pmBaseSell + pmTravelSell + totalAdminValue,
      children: pmChildren.length > 1 ? pmChildren : undefined,
    },
    ...(subMarkupTotal > 0 ? [{ label: "Subcontractors", cost: subRawTotal,   sell: subMarkupTotal }] : []),
    ...(totalTaxValue > 0  ? [{ label: "Tax",             cost: totalTaxValue, sell: totalTaxValue }]  : []),
  ];

  // ─── Export Details Excel ─────────────────────────────────────────────────
  const downloadDetailedExcel = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { Workbook } = (await import("exceljs")) as any;
    const wb = new Workbook();
    wb.creator = "DAS Bid Tool";
    wb.created = new Date();

    const p = project;
    const ip = p.inputParameters;
    const pmCalc = pmTravelCalculated;
    const installConfig = p.installTravel ?? DEFAULT_INSTALL_TRAVEL;

    // ── Palette ──────────────────────────────────────────────────────────────
    const NAVY   = { argb: "FF1B3A6B" };
    const GREEN  = { argb: "FF16A34A" };
    const RED    = { argb: "FFDC2626" };
    const GRAY   = { argb: "FF64748B" };
    const WHITE  = { argb: "FFFFFFFF" };
    const fill = (argb: string) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
    const NAVY_FILL  = fill("FF1B3A6B");
    const BLUE_FILL  = fill("FF2563EB");
    const ALT_FILL   = fill("FFF0F4FF");
    const WHITE_FILL = fill("FFFFFFFF");
    const TOTAL_FILL = fill("FFE2E8F0");
    const BORDER = {
      top:    { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      left:   { style: "thin", color: { argb: "FFCBD5E1" } },
      right:  { style: "thin", color: { argb: "FFCBD5E1" } },
    };
    // Per-technology section header colors
    const TECH_FILL: Record<string, ReturnType<typeof fill>> = {
      DAS:           fill("FF1E3A5F"),  // deep navy-blue
      PUBLIC_SAFETY: fill("FF7C2D12"),  // deep rust/orange-red
      ROIP:          fill("FF14532D"),  // deep green
    };
    const USD     = '"$"#,##0.00';
    const PCT_FMT = '0.0"%"';
    const HRS_FMT = "0.00";

    // ── Style helpers ────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const secHeader = (ws: any, title: string, cols: number, customFill?: ReturnType<typeof fill>) => {
      const row = ws.addRow([title]);
      ws.mergeCells(row.number, 1, row.number, cols);
      row.getCell(1).fill = customFill ?? NAVY_FILL;
      row.getCell(1).font = { bold: true, size: 11, color: WHITE };
      row.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      row.height = 22;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const colHdrs = (ws: any, headers: string[]) => {
      const row = ws.addRow(headers);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      row.eachCell({ includeEmpty: true }, (cell: any, cn: number) => {
        cell.fill = BLUE_FILL;
        cell.font = { bold: true, size: 9, color: WHITE };
        cell.alignment = { vertical: "middle", horizontal: cn === 1 ? "left" : "right" };
        cell.border = BORDER;
      });
      row.height = 18;
      return row;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataRow = (ws: any, values: (string | number | null)[], isAlt: boolean, isTotal = false) => {
      const row = ws.addRow(values);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      row.eachCell({ includeEmpty: true }, (cell: any, cn: number) => {
        cell.fill = isTotal ? TOTAL_FILL : isAlt ? ALT_FILL : WHITE_FILL;
        cell.font = { bold: isTotal, size: 9 };
        cell.alignment = { vertical: "middle", horizontal: cn === 1 ? "left" : "right" };
        cell.border = BORDER;
      });
      row.height = 16;
      return row;
    };

    // Key-value pair row (label | value | label | value | —)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kvRow = (ws: any, pairs: (string | number)[], isAlt: boolean) => {
      const row = dataRow(ws, pairs, isAlt);
      row.getCell(1).font = { size: 9, color: GRAY };
      row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
      row.getCell(3).font = { size: 9, color: GRAY };
      row.getCell(3).alignment = { horizontal: "left", vertical: "middle" };
    };

    // ════════════════════════════════════════════════════════════════════════
    // SHEET 1 — Project Summary  (all data in one place)
    // ════════════════════════════════════════════════════════════════════════
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws: any = wb.addWorksheet("Project Summary");
    ws.columns = [
      { width: 32 }, { width: 16 }, { width: 32 }, { width: 16 }, { width: 4 },
    ];

    // ── Title block ────────────────────────────────────────────────────────
    const titleRow = ws.addRow([p.name || "Project"]);
    ws.mergeCells(titleRow.number, 1, titleRow.number, 5);
    titleRow.getCell(1).font = { bold: true, size: 20, color: NAVY };
    titleRow.getCell(1).alignment = { vertical: "middle" };
    titleRow.height = 38;

    const subRow = ws.addRow([
      `${p.client || ""}   ·   ${p.status.charAt(0).toUpperCase() + p.status.slice(1)}   ·   Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    ]);
    ws.mergeCells(subRow.number, 1, subRow.number, 5);
    subRow.getCell(1).font = { size: 9, italic: true, color: GRAY };
    subRow.height = 15;

    ws.addRow([]);

    const gtRow = ws.addRow(["GRAND TOTAL", null, null, grandTotal, null]);
    ws.mergeCells(gtRow.number, 1, gtRow.number, 3);
    ws.mergeCells(gtRow.number, 4, gtRow.number, 5);
    gtRow.getCell(1).font = { size: 10, color: GRAY };
    gtRow.getCell(1).alignment = { vertical: "middle" };
    gtRow.getCell(4).font = { bold: true, size: 22, color: NAVY };
    gtRow.getCell(4).numFmt = USD;
    gtRow.getCell(4).alignment = { horizontal: "right", vertical: "middle" };
    gtRow.height = 34;

    ws.addRow([]);

    // ── Financial Summary ──────────────────────────────────────────────────
    secHeader(ws, "FINANCIAL SUMMARY", 5);
    colHdrs(ws, ["Category", "Cost ($)", "Sell ($)", "Gross Margin ($)", "GM %"]);
    let finAlt = false;
    const writeFin = (items: FinancialItem[], depth = 0) => {
      items.filter((i) => i.sell > 0 || i.cost > 0).forEach((item) => {
        const margin = item.sell - item.cost;
        const mPct   = item.sell > 0 ? (margin / item.sell) * 100 : 0;
        const pass   = Math.abs(margin) < 0.01;
        const label  = depth > 0 ? `    ${item.label}` : item.label;
        const row = dataRow(ws, [label, item.cost, item.sell, pass ? null : margin, pass ? null : mPct], finAlt);
        finAlt = !finAlt;
        row.getCell(1).font = { bold: depth === 0 && (item.children?.length ?? 0) > 0, size: 9 };
        row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
        row.getCell(2).numFmt = USD;
        row.getCell(3).numFmt = USD;
        if (!pass) {
          row.getCell(4).numFmt = USD;
          row.getCell(4).font = { size: 9, color: margin >= 0 ? GREEN : RED };
          row.getCell(5).numFmt = PCT_FMT;
          row.getCell(5).font = { size: 9, color: mPct >= 0 ? GREEN : RED };
        }
        if (item.children) writeFin(item.children, depth + 1);
      });
    };
    writeFin(financialItems);

    const fVis = financialItems.filter((i) => i.sell > 0 || i.cost > 0);
    const fTC  = fVis.reduce((s, i) => s + i.cost, 0);
    const fTS  = fVis.reduce((s, i) => s + i.sell, 0);
    const fTM  = fTS - fTC;
    const fTP  = fTS > 0 ? (fTM / fTS) * 100 : 0;
    const fTotRow = dataRow(ws, ["Total", fTC, fTS, fTM, fTP], false, true);
    fTotRow.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
    fTotRow.getCell(2).numFmt = USD;
    fTotRow.getCell(3).numFmt = USD;
    fTotRow.getCell(4).numFmt = USD;
    fTotRow.getCell(4).font = { bold: true, size: 9, color: fTM >= 0 ? GREEN : RED };
    fTotRow.getCell(5).numFmt = PCT_FMT;
    fTotRow.getCell(5).font = { bold: true, size: 9, color: fTP >= 0 ? GREEN : RED };

    ws.addRow([]);

    // ── Pricing Parameters ─────────────────────────────────────────────────
    secHeader(ws, "PRICING PARAMETERS", 5);
    const paramPairs: (string | number)[][] = [
      ["Sell Hourly Rate ($)",          ip.hourlyRate,                        "Buy Hourly Rate ($)",          ip.buyHourlyRate],
      ["PM Sell Rate ($/hr)",           ip.pmHourlyRate,                      "PM Buy Rate ($/hr)",           ip.buyPMHourlyRate],
      ["Non-Union Rate ($/hr)",         ip.nonUnionRate,                      "Mark Up (×)",                  ip.markUp],
      ["Sub Mark Up (×)",               ip.subMarkUp,                         "Tax (%)",                      ip.taxPercent],
      ["Material Safety Factor",        ip.materialSafety,                    "Labor Safety Factor",          ip.laborSafety],
      ["PM on Job (%)",                 Number((ip.pmOnJob * 100).toFixed(0)), "Travel Indirect Markup (×)",  ip.travelIndirectMarkup],
      ["Travel per Day ($)",            ip.travelPerDay,                      "",                             ""],
    ];
    paramPairs.forEach((pair, i) => kvRow(ws, pair, i % 2 === 1));

    ws.addRow([]);

    // ── Schedule ───────────────────────────────────────────────────────────
    secHeader(ws, "SCHEDULE", 5);
    [
      ["Hours per Day", ip.hoursPerDay, "Days per Week", ip.daysPerWeek],
      ["Number of Techs", p.schedule.numberOfGuys, "", ""],
    ].forEach((pair, i) => kvRow(ws, pair, i % 2 === 1));

    ws.addRow([]);

    // ── Install Travel (always shown, separate from PM Travel) ──────────────
    secHeader(ws, "INSTALL TRAVEL", 5);
    [
      ["Travel (%)",             installConfig.travelPercent,         "Per Diem Rate ($/day)",    installConfig.perDiemRate],
      ["Airfare per Trip ($)",   installConfig.airfarePricePerTrip,   "Lodging per Night ($)",    installConfig.lodgingRatePerNight],
      ["Fuel - flat ($)",        installConfig.fuel,                  "",                          ""],
      ...(installTravelCalc ? [
        ["Travel Hours",           Number(installTravelCalc.travelHours.toFixed(1)),      "Project Days",       Number(installTravelCalc.projectDays.toFixed(1))],
        ["Round Trips",            installTravelCalc.roundTrips,                           "Per Diem Total ($)", Number(installTravelCalc.perDiemTotal.toFixed(2))],
        ["Travel Labor Total ($)", Number(installTravelCalc.travelLaborTotal.toFixed(2)), "Airfare Total ($)",  Number(installTravelCalc.airfareTotal.toFixed(2))],
        ["Lodging Total ($)",      Number(installTravelCalc.lodgingTotal.toFixed(2)),     "Raw Total ($)",      Number(installTravelCalc.rawTotal.toFixed(2))],
        ["Marked Up Total ($)",    Number(installTravelCalc.markedUpTotal.toFixed(2)),    "",                   ""],
      ] : []),
    ].forEach((pair, i) => kvRow(ws, pair, i % 2 === 1));

    ws.addRow([]);

    // ── PM Travel ──────────────────────────────────────────────────────────
    secHeader(ws, "PM TRAVEL (per trip)", 5);
    [
      ["Days per Trip",           p.pmTravel.daysPerTrip,    "Flight ($)",           p.pmTravel.flight],
      ["Hotel per Day ($)",       p.pmTravel.hotelPerDay,    "Total Hotel ($)",       pmCalc.hotel],
      ["Car Rental per Day ($)",  p.pmTravel.carRentalPerDay,"Total Car Rental ($)",  pmCalc.carRental],
      ["Per Diem per Day ($)",    p.pmTravel.perDiemPerDay,  "Total Per Diem ($)",    pmCalc.perDiem],
      ["Total per Trip ($)",      pmCalc.totalPerTrip,       "",                      ""],
    ].forEach((pair, i) => kvRow(ws, pair, i % 2 === 1));

    ws.addRow([]);

    // ── Per-tech sections ──────────────────────────────────────────────────
    enabledTechs.forEach((tech) => {
      const quote = quotes.find((q) => q.type === tech.type);
      if (!quote) return;

      const techRentalMarkup  = getTechRentalMarkup(tech);
      const techSubMarkup     = getTechSubMarkup(tech);
      const installTravelLine = quote.lines.find((l) => l.item === 6);
      const pmTravelLine      = quote.lines.find((l) => l.item === 5);
      const pmLine            = quote.lines.find((l) => l.item === 4);
      const equipLine         = quote.lines.find((l) => l.item === 3);
      const adminVal          = pmLine   ? pmLine.totalPrice   * (adminPercent / 100) : 0;
      const taxVal            = equipLine ? equipLine.totalPrice * (taxPercent  / 100) : 0;
      const techTotal         = quote.totalCost + techRentalMarkup + adminVal + techSubMarkup + taxVal;

      // Quote table
      const tFill = TECH_FILL[tech.type] ?? NAVY_FILL;
      secHeader(ws, `${TECHNOLOGY_LABELS[tech.type]}`, 5, tFill);
      colHdrs(ws, ["#", "Line Item", "", "Total ($)", ""]);
      let qAlt = false;
      quote.lines.forEach((line) => {
        if (line.item === 5 || line.item === 6) return;
        const isInstall = line.item === 2;
        const isPM      = line.item === 4;
        const isEquip   = line.item === 3;
        const displayTotal = isInstall
          ? line.totalPrice + (installTravelLine?.totalPrice || 0) + techRentalMarkup + techSubMarkup
          : isEquip ? line.totalPrice + line.totalPrice * (taxPercent / 100)
          : isPM    ? line.totalPrice + (pmTravelLine?.totalPrice || 0) + line.totalPrice * (adminPercent / 100)
          : line.totalPrice;
        const row = dataRow(ws, [line.item, line.description, null, displayTotal, null], qAlt);
        qAlt = !qAlt;
        row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(2).alignment = { horizontal: "left",   vertical: "middle" };
        row.getCell(4).numFmt = USD;
      });
      const qTotRow = dataRow(ws, ["", "Total", null, techTotal, null], false, true);
      qTotRow.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
      qTotRow.getCell(4).numFmt = USD;

      ws.addRow([]);

      // Labor hours — computed dynamically to match current settings (same as Labor Summary)
      secHeader(ws, `${TECHNOLOGY_LABELS[tech.type]} — Labor Hours`, 5, tFill);
      colHdrs(ws, ["Item", "Hours", "", "", ""]);
      const expPsd  = p.projectSpecificDetails;
      const expGuys = Math.max(p.schedule.numberOfGuys, 1);
      const expHpd  = ip.hoursPerDay > 0 ? ip.hoursPerDay : 8;
      const expDpw  = ip.daysPerWeek  > 0 ? ip.daysPerWeek  : 5;
      const expBomHrs  = Object.values(tech.installLaborHours).reduce((s, h) => s + (h || 0), 0);
      const expBadging = !!(expPsd?.badgingSafety) ? expGuys * 4 : 0;
      const expMH      = tech.materialHandlingHours ?? 0;
      const expComm    = tech.commissioningSupport  ?? 0;
      const expAddlLabor = (tech.additionalLaborItems ?? []).filter((i) => (i.hours || 0) > 0);
      const expAddlHrs   = expAddlLabor.reduce((s, i) => s + (i.hours || 0), 0);
      const expBase      = expBomHrs + expBadging + expMH + expComm + expAddlHrs;
      const expBaseDays  = expBase > 0 ? expBase / expHpd : 0;
      const expBaseWeeks = expBaseDays > 0 ? expBaseDays / expDpw : 0;
      const expShuttle   = !!(expPsd?.extras?.shuttleServices) && expBase > 0 ? expBaseDays : 0;
      const expStretch   = !!(expPsd?.extras?.stretchAndFlex)  && expBase > 0 ? expBaseDays * 0.5 : 0;
      const expComposite = Number(expPsd?.extras?.compositeCleanup ?? 0);
      const expLift      = !!(expPsd?.extras?.liftSpotters) && expBase > 0 ? (0.65 * expBase) / expGuys : 0;
      const expEffective = expBase + expShuttle + expStretch + expComposite + expLift;
      const expSafety    = ip.laborSafety ?? 1;
      const expContingency = expEffective * (expSafety - 1);
      const expBilled    = expEffective * expSafety;
      void expBaseWeeks; // used for reference only

      const laborItems: [string, number][] = [];
      if (expBomHrs > 0)  laborItems.push(["BOM Labor Hours (from database)", expBomHrs]);
      if (expBadging > 0) laborItems.push(["Badging / Safety", expBadging]);
      if (expMH > 0)      laborItems.push(["Material Handling", expMH]);
      if (expComm > 0)    laborItems.push(["Commissioning Support", expComm]);
      expAddlLabor.forEach((it) => { if (it.hours > 0) laborItems.push([it.description || "Additional Labor", it.hours]); });
      if (expShuttle > 0)   laborItems.push(["Shuttle Services", expShuttle]);
      if (expStretch > 0)   laborItems.push(["Stretch & Flex", expStretch]);
      if (expComposite > 0) laborItems.push(["Composite Cleanup", expComposite]);
      if (expLift > 0)      laborItems.push(["Lift Spotters", expLift]);
      if (expContingency > 0) laborItems.push([`Labor Contingency (×${expSafety.toFixed(2)})`, expContingency]);
      const totalLaborHrs = expBilled;
      laborItems.forEach(([label, hrs], i) => {
        const r = dataRow(ws, [label, hrs, null, null, null], i % 2 === 1);
        r.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
        r.getCell(2).numFmt = "0.0";
      });
      const labTotRow = dataRow(ws, ["Total Hours", totalLaborHrs, null, null, null], false, true);
      labTotRow.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
      labTotRow.getCell(2).numFmt = "0.0";

      ws.addRow([]);

      // Materials — always use live tech values so export matches the tool display
      secHeader(ws, `${TECHNOLOGY_LABELS[tech.type]} — Materials & Equipment`, 5, tFill);
      colHdrs(ws, ["Item", "Raw ($)", "Sell ($)", "", ""]);
      const rawBOM = Object.values(tech.equipmentCost).reduce((s, c) => s + (c || 0), 0);
      const matItems: [string, number, number | null][] = [
        ["BOM Equipment (from database)", rawBOM, rawBOM * ip.materialSafety * ip.markUp],
      ];
      if ((tech.waterAndIce ?? 0) > 0) matItems.push(["Water & Ice", tech.waterAndIce!, tech.waterAndIce! * ip.materialSafety * ip.markUp]);
      (tech.additionalMaterials ?? []).filter((m) => m.value > 0).forEach((m) => {
        matItems.push([m.name || "Additional Material", m.value, m.value * ip.materialSafety * ip.markUp]);
      });
      const rental  = tech.rentalEquipment ?? DEFAULT_RENTAL_EQUIPMENT;
      const liftRaw = (rental.lift.numberOfLifts ?? 1) * rental.lift.months * rental.lift.costPerMonth;
      if (liftRaw > 0) matItems.push(["Lift Rental", liftRaw, liftRaw * travelMarkupMultiplier]);
      (rental.additionalItems ?? []).forEach((item) => {
        const val = item.months * item.costPerMonth;
        if (val > 0) matItems.push([`Rental: ${item.name}`, val, val * travelMarkupMultiplier]);
      });
      matItems.forEach(([label, raw, sell], i) => {
        const r = dataRow(ws, [label, raw, sell ?? null, null, null], i % 2 === 1);
        r.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
        r.getCell(2).numFmt = USD;
        if (sell !== null) r.getCell(3).numFmt = USD;
      });
      const subs = (tech.subContractors ?? []).filter((s) => s.value > 0);
      if (subs.length > 0) {
        colHdrs(ws, ["Subcontractor", "Raw ($)", "Sell ($)", "", ""]);
        subs.forEach((sub, i) => {
          const r = dataRow(ws, [sub.task, sub.value, sub.value * ip.subMarkUp, null, null], i % 2 === 1);
          r.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
          r.getCell(2).numFmt = USD;
          r.getCell(3).numFmt = USD;
        });
      }

      ws.addRow([]);
    });

    // ════════════════════════════════════════════════════════════════════════
    // SHEET 2 — BOM Report  (matches the in-app "Download Report" button)
    // ════════════════════════════════════════════════════════════════════════
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws2: any = wb.addWorksheet("BOM Report");
    ws2.columns = [
      { width: 14 }, { width: 36 }, { width: 7 }, { width: 7 }, { width: 7 },
      { width: 18 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 40 },
    ];

    let hasBOM = false;
    enabledTechs.forEach((tech, tIdx) => {
      const rows = tech.bomReportRows;
      if (!rows || rows.length === 0) return;
      hasBOM = true;

      if (tIdx > 0) { ws2.addRow([]); ws2.addRow([]); }

      // Tech section header (tech colour)
      const t2Fill = TECH_FILL[tech.type] ?? NAVY_FILL;
      const thRow = ws2.addRow([TECHNOLOGY_LABELS[tech.type]]);
      ws2.mergeCells(thRow.number, 1, thRow.number, 10);
      thRow.getCell(1).fill = t2Fill;
      thRow.getCell(1).font = { bold: true, size: 13, color: WHITE };
      thRow.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      thRow.height = 26;

      // Column headers
      const hRow = ws2.addRow(["Part #", "Description / Manufacturer", "QTY", "", "", "Equip Unit ($)", "Equip Total ($)", "Labor Hrs/Unit", "Total Labor Hrs", "Labor Code Description"]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hRow.eachCell({ includeEmpty: true }, (cell: any, cn: number) => {
        cell.fill = BLUE_FILL;
        cell.font = { bold: true, size: 9, color: WHITE };
        cell.alignment = { vertical: "middle", horizontal: cn <= 2 ? "left" : "right" };
        cell.border = BORDER;
      });
      hRow.height = 18;

      let bAlt = false;
      rows.forEach((row) => {
        const desc = row.manufacturer || row.code;
        const r = ws2.addRow([
          row.code,
          desc,
          row.qty,
          null,
          null,
          row.unitEquipPrice || null,
          row.totalEquipPrice || null,
          row.unitLaborHrs || null,
          row.totalLaborHrs || null,
          row.laborCodeDesc || null,
        ]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        r.eachCell({ includeEmpty: true }, (cell: any, cn: number) => {
          cell.fill = bAlt ? ALT_FILL : WHITE_FILL;
          cell.font = { size: 9 };
          cell.alignment = { vertical: "middle", horizontal: cn <= 2 ? "left" : "right" };
          cell.border = BORDER;
        });
        if (row.unitEquipPrice)  r.getCell(6).numFmt = USD;
        if (row.totalEquipPrice) r.getCell(7).numFmt = USD;
        if (row.unitLaborHrs)    r.getCell(8).numFmt = HRS_FMT;
        if (row.totalLaborHrs)   r.getCell(9).numFmt = HRS_FMT;
        r.height = 16;
        bAlt = !bAlt;
      });

      // Totals row
      const totEquip = rows.reduce((s, r) => s + (r.totalEquipPrice || 0), 0);
      const totLabor = rows.reduce((s, r) => s + (r.totalLaborHrs  || 0), 0);
      const tRow = ws2.addRow(["", "TOTAL", null, null, null, null, totEquip, null, totLabor]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tRow.eachCell({ includeEmpty: true }, (cell: any, cn: number) => {
        cell.fill = TOTAL_FILL;
        cell.font = { bold: true, size: 9 };
        cell.alignment = { vertical: "middle", horizontal: cn <= 2 ? "left" : "right" };
        cell.border = BORDER;
      });
      tRow.getCell(7).numFmt = USD;
      tRow.getCell(9).numFmt = HRS_FMT;
      tRow.height = 18;
    });

    if (!hasBOM) {
      const nRow = ws2.addRow(["No BOM data available. Import and apply a BOM on the project page first, then re-export."]);
      ws2.mergeCells(nRow.number, 1, nRow.number, 10);
      nRow.getCell(1).font = { italic: true, color: GRAY, size: 10 };
      nRow.height = 20;
    }

    // ── Download ────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.name || "Project"} - Details.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── NTI Export ────────────────────────────────────────────────────────────
  const downloadNTIExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "DAS Bid Tool";

    const p = project;
    const techs = p.technologies.filter((t) => t.enabled);

    // Style helpers (same palette as detailed export)
    const NAVY_FILL   = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1E3A5F" } };
    const BLUE_FILL   = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF2563EB" } };
    const TOTAL_FILL  = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE2E8F0" } };
    const WHITE_FILL  = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFFFF" } };
    const ALT_FILL    = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8FAFC" } };
    const WHITE       = { argb: "FFFFFFFF" };
    const BORDER      = { top: { style: "thin" as const, color: { argb: "FFE2E8F0" } }, bottom: { style: "thin" as const, color: { argb: "FFE2E8F0" } }, left: { style: "thin" as const, color: { argb: "FFE2E8F0" } }, right: { style: "thin" as const, color: { argb: "FFE2E8F0" } } };
    const USD         = '"$"#,##0.00';
    const TECH_FILL: Record<string, typeof NAVY_FILL> = {
      DAS:           { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } },
      PUBLIC_SAFETY: { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } },
      ROIP:          { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } },
    };

    const ws = wb.addWorksheet("NTI Bid");
    ws.columns = [
      { width: 28 }, { width: 36 }, ...p.coloSites.map(() => ({ width: 18 as number })), { width: 18 },
    ];

    // Title row
    const titleRow = ws.addRow([`NTI BID — ${p.name || "Project"}${p.client ? ` (${p.client})` : ""}`]);
    ws.mergeCells(titleRow.number, 1, titleRow.number, 2 + p.coloSites.length + 1);
    titleRow.getCell(1).fill = NAVY_FILL;
    titleRow.getCell(1).font = { bold: true, size: 14, color: WHITE };
    titleRow.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    titleRow.height = 30;

    ws.addRow([]);

    // Column header row: Section | Description | [colo names...] | Total
    const colHdr = ws.addRow(["Section", "Description", ...p.coloSites.map((c) => c.name), "Total"]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    colHdr.eachCell({ includeEmpty: true }, (cell: any, cn: number) => {
      cell.fill = BLUE_FILL;
      cell.font = { bold: true, size: 10, color: WHITE };
      cell.alignment = { vertical: "middle", horizontal: cn <= 2 ? "left" : "right" };
      cell.border = BORDER;
    });
    colHdr.height = 20;

    let grandTotal = 0;

    techs.forEach((tech) => {
      const tFill = TECH_FILL[tech.type] ?? NAVY_FILL;
      // Tech header
      const thRow = ws.addRow([TECHNOLOGY_LABELS[tech.type]]);
      ws.mergeCells(thRow.number, 1, thRow.number, 2 + p.coloSites.length + 1);
      thRow.getCell(1).fill = tFill;
      thRow.getCell(1).font = { bold: true, size: 12, color: WHITE };
      thRow.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      thRow.height = 24;

      let techGrandTotal = 0;
      let alt = false;

      // RF Engineering items
      tech.rfLineItems.forEach((item, idx) => {
        const coloVals = p.coloSites.map((c) => item.values[c.id] || 0);
        const rowTotal = coloVals.reduce((s, v) => s + v, 0);
        techGrandTotal += rowTotal;
        const r = ws.addRow([idx === 0 ? "RF Engineering" : "", item.description, ...coloVals, rowTotal]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        r.eachCell({ includeEmpty: true }, (cell: any, cn: number) => {
          cell.fill = alt ? ALT_FILL : WHITE_FILL;
          cell.font = { size: 10 };
          cell.alignment = { vertical: "middle", horizontal: cn <= 2 ? "left" : "right" };
          cell.border = BORDER;
        });
        p.coloSites.forEach((_, i) => { r.getCell(3 + i).numFmt = USD; });
        r.getCell(3 + p.coloSites.length).numFmt = USD;
        r.height = 16;
        alt = !alt;
      });

      // RF subtotal
      const rfColoTotals = p.coloSites.map((c) => tech.rfLineItems.reduce((s, item) => s + (item.values[c.id] || 0), 0));
      const rfTotal = rfColoTotals.reduce((s, v) => s + v, 0);
      if (tech.rfLineItems.length > 0) {
        const stRow = ws.addRow(["", "RF Engineering Total", ...rfColoTotals, rfTotal]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stRow.eachCell({ includeEmpty: true }, (cell: any, cn: number) => {
          cell.fill = TOTAL_FILL;
          cell.font = { bold: true, size: 10 };
          cell.alignment = { vertical: "middle", horizontal: cn <= 2 ? "left" : "right" };
          cell.border = BORDER;
        });
        p.coloSites.forEach((_, i) => { stRow.getCell(3 + i).numFmt = USD; });
        stRow.getCell(3 + p.coloSites.length).numFmt = USD;
        stRow.height = 17;
        alt = false;
      }

      // Install Cost row
      const installColoVals = p.coloSites.map((c) => tech.installLaborHours[c.id] || 0);
      const installTotal = installColoVals.reduce((s, v) => s + v, 0);
      techGrandTotal += installTotal;
      const instRow = ws.addRow(["Install Cost", "", ...installColoVals, installTotal]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      instRow.eachCell({ includeEmpty: true }, (cell: any, cn: number) => {
        cell.fill = alt ? ALT_FILL : WHITE_FILL;
        cell.font = { size: 10 };
        cell.alignment = { vertical: "middle", horizontal: cn <= 2 ? "left" : "right" };
        cell.border = BORDER;
      });
      p.coloSites.forEach((_, i) => { instRow.getCell(3 + i).numFmt = USD; });
      instRow.getCell(3 + p.coloSites.length).numFmt = USD;
      instRow.height = 16;
      alt = !alt;

      // Equipment Cost row
      const equipColoVals = p.coloSites.map((c) => tech.equipmentCost[c.id] || 0);
      const equipTotal = equipColoVals.reduce((s, v) => s + v, 0);
      techGrandTotal += equipTotal;
      const eqRow = ws.addRow(["Equipment Cost", "", ...equipColoVals, equipTotal]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eqRow.eachCell({ includeEmpty: true }, (cell: any, cn: number) => {
        cell.fill = alt ? ALT_FILL : WHITE_FILL;
        cell.font = { size: 10 };
        cell.alignment = { vertical: "middle", horizontal: cn <= 2 ? "left" : "right" };
        cell.border = BORDER;
      });
      p.coloSites.forEach((_, i) => { eqRow.getCell(3 + i).numFmt = USD; });
      eqRow.getCell(3 + p.coloSites.length).numFmt = USD;
      eqRow.height = 16;

      // Tech total
      const techColoTotals = p.coloSites.map((c) =>
        tech.rfLineItems.reduce((s, item) => s + (item.values[c.id] || 0), 0) +
        (tech.installLaborHours[c.id] || 0) +
        (tech.equipmentCost[c.id] || 0)
      );
      const tTotRow = ws.addRow(["", `${TECHNOLOGY_LABELS[tech.type]} Total`, ...techColoTotals, techGrandTotal]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tTotRow.eachCell({ includeEmpty: true }, (cell: any, cn: number) => {
        cell.fill = tFill;
        cell.font = { bold: true, size: 10, color: WHITE };
        cell.alignment = { vertical: "middle", horizontal: cn <= 2 ? "left" : "right" };
        cell.border = BORDER;
      });
      p.coloSites.forEach((_, i) => { tTotRow.getCell(3 + i).numFmt = USD; });
      tTotRow.getCell(3 + p.coloSites.length).numFmt = USD;
      tTotRow.height = 18;
      ws.addRow([]);

      grandTotal += techGrandTotal;
    });

    // Grand total row
    const gtRow = ws.addRow(["GRAND TOTAL", "", ...p.coloSites.map(() => null), grandTotal]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtRow.eachCell({ includeEmpty: true }, (cell: any, cn: number) => {
      cell.fill = NAVY_FILL;
      cell.font = { bold: true, size: 11, color: WHITE };
      cell.alignment = { vertical: "middle", horizontal: cn <= 2 ? "left" : "right" };
      cell.border = BORDER;
    });
    gtRow.getCell(3 + p.coloSites.length).numFmt = USD;
    gtRow.height = 22;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.name || "Project"} - NTI Bid.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isNTI = project.bidType === "nti";

  // Shared sidebar props
  const sidebarProps = {
    project,
    psd,
    fullSchedule,
    pmTravelCalculated,
    installTravelCalc,
    activeTab,
    isNTI,
    onUpdateInputParameters: updateInputParameters,
    onUpdateSchedule: updateSchedule,
    onUpdatePMTravel: updatePMTravel,
    onUpdateInstallTravel: updateInstallTravel,
    onUpdateColoSites: updateColoSites,
    onUpdateTechnology: updateTechnology,
    onUpdateProjectMeta: updateProjectMeta,
    onUpdateProjectSpecificDetails: updateProjectSpecificDetails,
    onTabChange: (tab: TechnologyType) => setActiveTab(tab),
    onOpenPanel: (id: SidebarPanelId) => setActivePanel(id),
  };

  const overlayProps = {
    project,
    psd,
    fullSchedule,
    pmTravelCalculated,
    installTravelCalc,
    onUpdateInputParameters: updateInputParameters,
    onUpdateSchedule: updateSchedule,
    onUpdatePMTravel: updatePMTravel,
    onUpdateInstallTravel: updateInstallTravel,
    onUpdateColoSites: updateColoSites,
    onUpdateTechnology: updateTechnology,
    onUpdateProjectSpecificDetails: updateProjectSpecificDetails,
    onClose: () => setActivePanel(null),
    sidebarWidth: SIDEBAR_WIDTH,
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-border/60 bg-card/90 backdrop-blur-md z-30">
        <div className="px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground px-2">
                <ArrowLeft className="h-3 w-3 mr-1" /> Back
              </Button>
            </Link>
            <div className="h-4 w-px bg-border" />
            <Input
              value={project.name}
              onChange={(e) => updateProjectMeta({ name: e.target.value })}
              className="h-7 w-48 text-sm font-semibold border-transparent hover:border-border/60 bg-transparent focus:bg-background"
            />
            <Input
              value={project.client}
              onChange={(e) => updateProjectMeta({ client: e.target.value })}
              placeholder="Client…"
              className="h-7 w-36 text-xs text-muted-foreground border-transparent hover:border-border/60 bg-transparent focus:bg-background"
            />
          </div>
          <div className="flex items-center gap-2">
            <SaveIndicator status={saveStatus} />
            {/* Bid type toggle */}
            <div className="flex items-center rounded-md border border-border/60 overflow-hidden h-7 text-xs">
              <button
                onClick={() => updateProjectMeta({ bidType: "network_connex" })}
                className={`px-3 h-full transition-colors ${!isNTI ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-accent"}`}
              >
                Network Connex
              </button>
              <button
                onClick={() => updateProjectMeta({ bidType: "nti" })}
                className={`px-3 h-full border-l border-border/60 transition-colors ${isNTI ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-accent"}`}
              >
                NTI
              </button>
            </div>
            {!isNTI && <AIEstimateDialog project={project} onApply={applyBulkUpdate} />}
            <Button
              onClick={() => { (isNTI ? downloadNTIExcel() : downloadDetailedExcel()).catch(console.error); }}
              size="sm" variant="outline" className="h-7 text-xs"
            >
              <FileSpreadsheet className="h-3 w-3 mr-1" /> Export
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Body: Sidebar + Main ──────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar ──────────────────────────── */}
        <aside
          className="shrink-0 overflow-y-auto sidebar-bg"
          style={{ width: SIDEBAR_WIDTH }}
        >
          <ProjectSidebar {...sidebarProps} />
        </aside>

        {/* ── Main area ────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-background">

          {isNTI ? (
            /* ── NTI main ─────────────────────────────── */
            <div className="p-5 space-y-4">
              {/* NTI tech tabs — report preview only */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TechnologyType)}>
                <TabsList className="h-8 p-0.5 bg-muted/60 rounded-lg w-auto inline-flex gap-0.5 border border-border/30">
                  {(["DAS", "PUBLIC_SAFETY", "ROIP"] as TechnologyType[]).map((type) => (
                    <TabsTrigger key={type} value={type} className="h-7 px-4 rounded-md text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      {TECHNOLOGY_LABELS[type]}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {(["DAS", "PUBLIC_SAFETY", "ROIP"] as TechnologyType[]).map((type) => {
                  const tech = project.technologies.find((t) => t.type === type);
                  if (!tech) return null;
                  return (
                    <TabsContent key={type} value={type} className="mt-3">
                      <NTIReportPreview
                        tech={tech}
                        coloSites={project.coloSites}
                        materialContingency={project.ntiMaterialContingency ?? 0}
                        laborContingency={project.ntiLaborContingency ?? 0}
                      />
                    </TabsContent>
                  );
                })}
              </Tabs>
            </div>

          ) : (
            /* ── NC main ──────────────────────────────── */
            <>
              {/* KPI strip — per-tech totals */}
              {quotes.length > 0 && (
                <div className="kpi-strip px-5 py-3 flex items-center gap-6 flex-wrap">
                  {quotes.map((q) => {
                    const total = techTotals[q.type] ?? q.totalCost;
                    const isActive = activeTab === q.type;
                    return (
                      <button
                        key={q.type}
                        onClick={() => setActiveTab(q.type)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all hover:bg-muted/40"
                        style={isActive ? {
                          background: `${TECH_ACCENT_HEX[q.type]}0d`,
                          boxShadow: `inset 0 0 0 1px ${TECH_ACCENT_HEX[q.type]}30`,
                        } : undefined}
                      >
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shrink-0 ${TECHNOLOGY_BG[q.type]} ${TECHNOLOGY_TINT_DARK[q.type]}`}>
                          {TECHNOLOGY_LABELS[q.type]}
                        </span>
                        <span className="text-base font-bold font-mono tabular-nums text-foreground leading-tight">
                          {formatCurrency(total)}
                        </span>
                      </button>
                    );
                  })}
                  <div className="ml-auto flex flex-col items-end">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Grand Total</span>
                    <span className="text-lg font-bold font-mono tabular-nums text-foreground leading-tight">
                      {formatCurrency(grandTotal)}
                    </span>
                  </div>
                </div>
              )}

              {/* Quote tabs */}
              <div className="p-5 space-y-5">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TechnologyType)}>
                  <TabsList className="h-8 p-0.5 bg-muted/60 rounded-lg w-auto inline-flex gap-0.5 border border-border/30">
                    {(["DAS", "PUBLIC_SAFETY", "ROIP"] as TechnologyType[]).map((type) => {
                      const tech = project.technologies.find((t) => t.type === type);
                      if (!tech?.enabled) return null;
                      const q = quotes.find((q) => q.type === type);
                      return (
                        <TabsTrigger
                          key={type}
                          value={type}
                          className="h-7 px-4 rounded-md text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                        >
                          <div className={`h-1.5 w-1.5 rounded-full mr-1.5 ${TECHNOLOGY_DOT[type]}`} />
                          {TECHNOLOGY_LABELS[type]}
                          {q && (
                            <span className="ml-2 text-[10px] font-mono text-muted-foreground tabular-nums">
                              {formatCurrency(techTotals[type] ?? q.totalCost)}
                            </span>
                          )}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {(["DAS", "PUBLIC_SAFETY", "ROIP"] as TechnologyType[]).map((type) => {
                    const tech = project.technologies.find((t) => t.type === type);
                    const quote = quotes.find((q) => q.type === type);
                    if (!tech?.enabled || !quote) return null;
                    const techRentalMarkup = getTechRentalMarkup(tech);
                    const techSubMarkup = getTechSubMarkup(tech);
                    return (
                      <TabsContent key={type} value={type} className="mt-3">
                        <QuoteTable
                          quote={quote}
                          coloSites={project.coloSites}
                          rentalMarkupCost={techRentalMarkup}
                          adminPercent={adminPercent}
                          subContractorTotal={techSubMarkup}
                          taxPercent={taxPercent}
                          installTravelActive={installTravelCalc !== null}
                          materialSafety={project.inputParameters.materialSafety ?? 1}
                          equipMarkUp={project.inputParameters.markUp ?? 1}
                        />
                      </TabsContent>
                    );
                  })}
                </Tabs>

                {/* Output summaries */}
                <div className="flex flex-wrap gap-4">
                  <LaborSummary
                    technologies={project.technologies}
                    hoursPerDay={project.inputParameters.hoursPerDay ?? 8}
                    daysPerWeek={project.inputParameters.daysPerWeek ?? 5}
                    numberOfGuys={project.schedule.numberOfGuys}
                    projectSpecificDetails={psd}
                    laborSafety={project.inputParameters.laborSafety ?? 1}
                  />
                  <MaterialsSummary technologies={project.technologies} />
                </div>
                {quotes.length > 0 && (
                  <FinancialReview
                    items={financialItems}
                    techTotals={techTotals}
                    grandTotal={grandTotal}
                  />
                )}
                <div className="h-4" />
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── Overlay panel ─────────────────────────────────────────── */}
      {activePanel && (
        <SidebarOverlayPanel panelId={activePanel} {...overlayProps} />
      )}
    </div>
  );
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id as string;
    loadProject(id).then((p) => {
      if (!p) {
        router.push("/");
        return;
      }
      setProject(migrateProject(p));
      setLoading(false);
    });
  }, [params.id, router]);

  if (loading || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return <ProjectWorksheet initialProject={project} />;
}
