"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";
import type {
  TechnologyConfig,
  ColoSite,
  UnmatchedBOMItem,
  BOMAnalysisResult,
  ColoDistribution,
  PartsDatabase,
  ProjectSpecificDetails,
  LaborHoursBreakdown,
  EquipmentCostBreakdown,
  BOMReportRow,
} from "@/types";
import { loadDatabase } from "@/lib/database";
import { extractBOMRows, applyBOMMapping, analyzeBOM, applyDistribution } from "@/lib/bom-processor";
import type { BOMColumnMapping } from "@/app/api/ai/parse-bom/route";
import { formatCurrency } from "@/lib/calculations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Upload,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Download,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  tech: TechnologyConfig;
  coloSites: ColoSite[];
  onApply: (updatedTech: TechnologyConfig) => void;
  projectSpecificDetails?: ProjectSpecificDetails;
  numberOfGuys?: number;
  hoursPerDay?: number;
  daysPerWeek?: number;
  materialContingency?: number;  // percentage, e.g. 5 = 5%
  laborContingency?: number;     // percentage, e.g. 5 = 5%
  ntiMode?: boolean;
  ntiLiftAdder?: boolean;
}

export function BomImportDialog({
  tech,
  coloSites,
  onApply,
  projectSpecificDetails,
  numberOfGuys = 1,
  hoursPerDay = 8,
  daysPerWeek = 5,
  materialContingency = 0,
  laborContingency = 0,
  ntiMode = false,
  ntiLiftAdder = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [db, setDb] = useState<PartsDatabase | null>(null);
  const [analysis, setAnalysis] = useState<BOMAnalysisResult | null>(null);
  const [unmatched, setUnmatched] = useState<UnmatchedBOMItem[]>([]);
  const [distribution, setDistribution] = useState<ColoDistribution[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load database on mount and whenever dialog opens
  useEffect(() => {
    loadDatabase().then(setDb);
  }, []);
  useEffect(() => {
    if (open) loadDatabase().then(setDb);
  }, [open]);

  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const [laborOverrides, setLaborOverrides] = useState<Record<string, number>>({});
  // codes[i] = 4-element array of install code strings for unmatched item at index i
  const [unmatchedCodes, setUnmatchedCodes] = useState<Record<number, string[]>>({});

  // Labor code lookup maps built from the loaded database
  const lcMap = useMemo(() => {
    const map = new Map<string, number>();
    (db?.laborCodes ?? []).forEach((lc) => map.set(lc.code.toLowerCase(), lc.hoursPerUnit));
    return map;
  }, [db]);

  // code → description
  const lcDescMap = useMemo(() => {
    const map = new Map<string, string>();
    (db?.laborCodes ?? []).forEach((lc) => map.set(lc.code.toLowerCase(), lc.description));
    return map;
  }, [db]);

  // Returns combined descriptions for a comma-separated labor code string
  const getLaborCodeDesc = (laborCode: string): string => {
    if (!laborCode) return "";
    return laborCode.split(",").map((c) => lcDescMap.get(c.trim().toLowerCase()) ?? c.trim()).filter(Boolean).join(", ");
  };

  // Badging: hardcoded 4 hrs per tech (no DB lookup)
  const badgingAddedHours = useMemo(() => {
    if (!projectSpecificDetails?.badgingSafety) return 0;
    return numberOfGuys * 4;
  }, [projectSpecificDetails?.badgingSafety, numberOfGuys]);

  const materialHandlingHours = tech.materialHandlingHours ?? 0;
  const commissioningHours = tech.commissioningSupport ?? 0;

  const reset = () => {
    setAnalysis(null);
    setUnmatched([]);
    setDistribution([]);
    setStatusMsg("");
    setPriceOverrides({});
    setLaborOverrides({});
    setUnmatchedCodes({});
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    // Do NOT reset on close — analysis persists so Download is available any time.
    // State is only cleared by the "Upload Different" button.
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    setLoading(true);
    setStatusMsg("Reading file…");

    try {
      // Step 1: extract raw rows client-side
      const rows = await extractBOMRows(file);
      setStatusMsg("AI is identifying column structure…");

      // Step 2: send sample to Claude Haiku
      const res = await fetch("/api/ai/parse-bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rows.slice(0, 40) }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "AI analysis failed");
      }

      const mapping = (await res.json()) as BOMColumnMapping;

      if (!mapping.partNumber) {
        throw new Error(
          "AI could not identify a Part Number column. Make sure the file has a column like \"Part Number\", \"Part#\", or \"Item Number\"."
        );
      }

      setStatusMsg("Matching against database…");

      // Step 3: apply mapping → analyze against database
      const bomItems = applyBOMMapping(rows, mapping);

      if (bomItems.length === 0) {
        throw new Error(
          "No line items found after parsing. Check that the file has data rows below the header."
        );
      }

      const includeLift = ntiMode ? ntiLiftAdder : (tech.rentalEquipment?.lift.includeLiftAdder ?? false);
      const result = analyzeBOM(bomItems, db, includeLift, projectSpecificDetails?.jHooks ?? true);
      setAnalysis(result);
      setUnmatched(result.unmatched.map((u) => ({ ...u })));
      // Default: 100% to first COLO
      setDistribution(
        coloSites.map((c, i) => ({ coloId: c.id, percentage: i === 0 ? 100 : 0 }))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse BOM");
    } finally {
      setLoading(false);
      setStatusMsg("");
    }
  };

  const updateUnmatched = (
    index: number,
    field: keyof UnmatchedBOMItem,
    value: number | string
  ) => {
    setUnmatched((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Update one of the 4 install code inputs for an unmatched item,
  // then auto-compute labor hours from the updated codes.
  const updateUnmatchedCode = (itemIndex: number, codeIndex: number, value: string) => {
    const current = unmatchedCodes[itemIndex] ?? ["", "", "", ""];
    const next = [...current];
    next[codeIndex] = value;
    setUnmatchedCodes((prev) => ({ ...prev, [itemIndex]: next }));
    const hours = next
      .filter(Boolean)
      .reduce((sum, code) => sum + (lcMap.get(code.toLowerCase()) ?? 0), 0);
    setUnmatched((prev) => {
      const updated = [...prev];
      updated[itemIndex] = { ...updated[itemIndex], unitLaborHours: hours };
      return updated;
    });
  };

  const resolveUnmatched = (index: number) => {
    setUnmatched((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], isResolved: true };
      return updated;
    });
  };

  const updateDistribution = (coloId: string, percentage: number) => {
    setDistribution((prev) =>
      prev.map((d) => (d.coloId === coloId ? { ...d, percentage } : d))
    );
  };

  // Derived state
  const unresolvedCount = unmatched.filter((u) => !u.isResolved).length;
  const allResolved = unresolvedCount === 0;
  const distSum = distribution.reduce((s, d) => s + (d.percentage || 0), 0);
  const distValid = Math.abs(distSum - 100) < 0.01;

  // Price of $0 in the database is treated as $0 — never prompt for a price override.
  const needsPriceItems = (analysis?.matched ?? []).filter((_m) => false as boolean);
  const unresolvedPriceCount = 0;

  // Only ask for labor hours if there is NO install code at all in the database.
  // If a code exists but resolves to 0 hours, that is correct — don't prompt.
  const needsLaborItems = (analysis?.matched ?? []).filter(
    (m) => m.unitLaborHours === 0 && !m.hasLaborCode
  );
  // resolved = key exists in map (even value 0 is an explicit confirmation)
  const unresolvedLaborCount = needsLaborItems.filter(
    (m) => !(m.partNumber in laborOverrides)
  ).length;

  const canApply =
    analysis !== null &&
    allResolved &&
    unresolvedPriceCount === 0 &&
    unresolvedLaborCount === 0 &&
    distValid;

  // Running totals (matched + price/labor overrides + resolved unmatched)
  const resolvedUnmatched = unmatched.filter((u) => u.isResolved);
  const extraEquip = resolvedUnmatched.reduce(
    (s, u) => s + u.unitEquipmentPrice * u.quantity,
    0
  );
  const extraHours = resolvedUnmatched.reduce(
    (s, u) => s + u.unitLaborHours * u.quantity,
    0
  );
  const overrideEquipTotal = needsPriceItems.reduce(
    (s, m) => s + (priceOverrides[m.partNumber] ?? 0) * m.quantity,
    0
  );
  const overrideLaborTotal = needsLaborItems.reduce(
    (s, m) => s + (laborOverrides[m.partNumber] ?? 0) * m.quantity,
    0
  );
  const excludeMaterials = !ntiMode && !!(projectSpecificDetails?.extras?.excludeMaterials);
  const totalEquipment = excludeMaterials ? 0 : (analysis?.totalEquipmentCost ?? 0) + extraEquip + overrideEquipTotal;
  // What will actually be stored in equipmentCost (matches handleApply logic):
  // NTI: BOM × material contingency; NC: raw BOM only (extras applied dynamically)
  const matMult = 1 + materialContingency / 100;
  const equipCostPreview = ntiMode ? totalEquipment * matMult : totalEquipment;

  // ── Labor hour breakdown ──────────────────────────────────────
  // BOM hours = matched + overrides + resolved unmatched
  const bomHours = (analysis?.totalLaborHours ?? 0) + extraHours + overrideLaborTotal;

  // Additional labor items from per-tech config
  const additionalLaborItemsData = useMemo(
    () => (tech.additionalLaborItems ?? []).filter((i) => (i.hours || 0) > 0),
    [tech.additionalLaborItems]
  );
  const additionalLaborTotalHours = additionalLaborItemsData.reduce((s, i) => s + (i.hours || 0), 0);

  // Base hours = BOM + badging + MH + commissioning + additional labor
  const baseHours = bomHours + badgingAddedHours + materialHandlingHours + commissioningHours + additionalLaborTotalHours;

  // Extras computed from base hours (same formulas as before, but producing hours not dollars)
  const hpd = (hoursPerDay || 8);
  const dpw = (daysPerWeek || 5);
  const baseDays = baseHours > 0 ? baseHours / hpd : 0;
  const baseWeeks = baseDays > 0 ? baseDays / dpw : 0;
  const guys = Math.max(numberOfGuys, 1);

  const shuttleHours = !!(projectSpecificDetails?.extras?.shuttleServices) && baseHours > 0 ? baseDays : 0;
  const stretchHours = !!(projectSpecificDetails?.extras?.stretchAndFlex) && baseHours > 0 ? baseDays * 0.5 : 0;
  const compositeHours = Number(projectSpecificDetails?.extras?.compositeCleanup ?? 0);
  const liftHours = !!(projectSpecificDetails?.extras?.liftSpotters) && baseHours > 0 ? (0.65 * baseHours) / guys : 0;

  // Final total (baked into installLaborHours on Apply)
  const totalHours = baseHours + shuttleHours + stretchHours + compositeHours + liftHours;

  const handleApply = () => {
    if (!analysis || !canApply) return;

    const installLaborHours: Record<string, number> = { ...tech.installLaborHours };
    const equipmentCost: Record<string, number> = { ...tech.equipmentCost };

    const waterAndIceRaw = tech.waterAndIce ?? 0;
    const addlMaterialsRaw = (tech.additionalMaterials ?? []).reduce((s, m) => s + (m.value || 0), 0);
    // matMult defined at component level; labMult only needed here
    const labMult = 1 + laborContingency / 100;
    // NTI: BOM equipment × material contingency
    // NC:  raw BOM equipment only — waterAndIce and additionalMaterials are added
    //      dynamically at quote-calculation time (like labor extras)
    const equipCostToStore = ntiMode
      ? totalEquipment * matMult
      : totalEquipment;
    // NTI: raw BOM hours × labor contingency
    // NC:  raw BOM hours only — extras are added dynamically at quote-calculation time
    const hoursToStore = ntiMode ? bomHours * labMult : bomHours;
    // Use equipCostToStore for the toast so the user sees exactly what was stored in Input Values

    for (const d of distribution) {
      const pct = d.percentage / 100;
      installLaborHours[d.coloId] = Math.round(hoursToStore * pct * 100) / 100;
      equipmentCost[d.coloId] = Math.round(equipCostToStore * pct * 100) / 100;
    }

    const laborHoursBreakdown: LaborHoursBreakdown = {
      bom: bomHours,
      badging: badgingAddedHours,
      materialHandling: materialHandlingHours,
      commissioningSupport: commissioningHours,
      additionalLaborItems: additionalLaborItemsData.map((i) => ({ description: i.description, hours: i.hours })),
      shuttleServices: shuttleHours,
      stretchAndFlex: stretchHours,
      compositeCleanup: compositeHours,
      liftSpotters: liftHours,
    };

    const equipmentCostBreakdown: EquipmentCostBreakdown = {
      bom: totalEquipment,
      waterAndIce: waterAndIceRaw,
      additionalMaterials: (tech.additionalMaterials ?? [])
        .filter((m) => (m.value || 0) > 0)
        .map((m) => ({ name: m.name || "Additional Material", value: m.value })),
    };

    // Build per-item BOM report rows (same data as Download Report)
    const bomReportRows: BOMReportRow[] = [
      ...analysis.matched.map((item) => {
        const up = excludeMaterials ? 0 : (item.unitEquipmentPrice === 0 ? (priceOverrides[item.partNumber] ?? 0) : item.unitEquipmentPrice);
        const ul = item.unitLaborHours === 0 ? (laborOverrides[item.partNumber] ?? 0) : item.unitLaborHours;
        const dbEntry = db?.entries.find((e) => e.partNumber === item.partNumber);
        const laborCodeDesc = dbEntry ? getLaborCodeDesc(dbEntry.laborCode) : "";
        return { code: item.partNumber, manufacturer: item.manufacturer || "", qty: item.quantity, unitEquipPrice: up, unitLaborHrs: ul, totalEquipPrice: up * item.quantity, totalLaborHrs: ul * item.quantity, laborCodeDesc };
      }),
      ...unmatched.map((item) => ({ code: item.partNumber, manufacturer: item.manufacturer || "", qty: item.quantity, unitEquipPrice: excludeMaterials ? 0 : item.unitEquipmentPrice, unitLaborHrs: item.unitLaborHours, totalEquipPrice: excludeMaterials ? 0 : item.unitEquipmentPrice * item.quantity, totalLaborHrs: item.unitLaborHours * item.quantity })),
      ...(badgingAddedHours > 0 ? [{ code: "BADGE", manufacturer: "", qty: numberOfGuys, unitEquipPrice: 0, unitLaborHrs: 4, totalEquipPrice: 0, totalLaborHrs: badgingAddedHours }] : []),
      ...(materialHandlingHours > 0 ? [{ code: "MH", manufacturer: "", qty: 1, unitEquipPrice: 0, unitLaborHrs: materialHandlingHours, totalEquipPrice: 0, totalLaborHrs: materialHandlingHours }] : []),
      ...(commissioningHours > 0 ? [{ code: "COMM", manufacturer: "", qty: 1, unitEquipPrice: 0, unitLaborHrs: commissioningHours, totalEquipPrice: 0, totalLaborHrs: commissioningHours }] : []),
      ...additionalLaborItemsData.map((item) => ({ code: "ADDL", manufacturer: item.description || "Additional Labor", qty: 1, unitEquipPrice: 0, unitLaborHrs: item.hours, totalEquipPrice: 0, totalLaborHrs: item.hours })),
      ...(shuttleHours > 0 ? [{ code: "SHUTTLE", manufacturer: "", qty: 1, unitEquipPrice: 0, unitLaborHrs: shuttleHours, totalEquipPrice: 0, totalLaborHrs: shuttleHours }] : []),
      ...(stretchHours > 0 ? [{ code: "S&F", manufacturer: "", qty: 1, unitEquipPrice: 0, unitLaborHrs: stretchHours, totalEquipPrice: 0, totalLaborHrs: stretchHours }] : []),
      ...(compositeHours > 0 ? [{ code: "CLEANUP", manufacturer: "", qty: 1, unitEquipPrice: 0, unitLaborHrs: compositeHours, totalEquipPrice: 0, totalLaborHrs: compositeHours }] : []),
      ...(liftHours > 0 ? [{ code: "LIFT", manufacturer: "", qty: 1, unitEquipPrice: 0, unitLaborHrs: liftHours, totalEquipPrice: 0, totalLaborHrs: liftHours }] : []),
      ...((tech.waterAndIce ?? 0) > 0 ? [{ code: "W&I", manufacturer: "Water & Ice", qty: 1, unitEquipPrice: tech.waterAndIce!, unitLaborHrs: 0, totalEquipPrice: tech.waterAndIce!, totalLaborHrs: 0 }] : []),
      ...(tech.additionalMaterials ?? []).filter((m) => (m.value || 0) > 0).map((m) => ({ code: "ADDL-MAT", manufacturer: m.name || "Additional Material", qty: 1, unitEquipPrice: m.value, unitLaborHrs: 0, totalEquipPrice: m.value, totalLaborHrs: 0 })),
    ];

    onApply({ ...tech, installLaborHours, equipmentCost, laborHoursBreakdown, equipmentCostBreakdown, bomReportRows });
    toast.success(
      `BOM applied — ${hoursToStore.toFixed(1)} BOM hrs · ${formatCurrency(equipCostToStore)} equipment`
    );
    setOpen(false);
    // Do not reset — keep analysis alive so Download Report stays available.
  };

  const canDownload = !!analysis || (tech.bomReportRows?.length ?? 0) > 0;

  const handleDownloadFromStored = () => {
    const rows = tech.bomReportRows ?? [];
    const header = [
      "Part Number", "Manufacturer", "", "QTY", "", "",
      "Material Unit Cost", "Labor Unit Hours", "RF Services ($)",
      "Material Total Cost", "Labor Total Hours", "Labor Code Description",
    ];
    const dataRows = rows.map((row) => [
      row.code, row.manufacturer, "", row.qty, "", "",
      row.unitEquipPrice, row.unitLaborHrs, "",
      row.totalEquipPrice, row.totalLaborHrs, row.laborCodeDesc ?? "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    ws["!cols"] = [
      { wch: 22 }, { wch: 28 }, { wch: 4 }, { wch: 6 }, { wch: 4 }, { wch: 4 },
      { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 36 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BOM Report");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bom-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = () => {
    if (!analysis) {
      handleDownloadFromStored();
      return;
    }

    // Columns: A=Part#, B=Manufacturer, C=(empty), D=QTY,
    //          E=Material Unit Cost (w/ contingency), F=Labor Unit Hours (w/ contingency),
    //          G=RF Services ($), H=Material Total Cost, I=Labor Total Hours
    // matMult defined at component level
    const labMult = 1 + laborContingency / 100;

    const header = [
      "Part Number",
      "Manufacturer",
      "",
      "QTY",
      "",
      "",
      `Material Unit Cost${materialContingency > 0 ? ` (+${materialContingency}%)` : ""}`,
      `Labor Unit Hours${laborContingency > 0 ? ` (+${laborContingency}%)` : ""}`,
      "RF Services ($)",
      "Material Total Cost",
      "Labor Total Hours",
      "Labor Code Description",
    ];

    // RF Services rows — one row per line item, value = sum across all colos
    const rfRows = tech.rfLineItems
      .filter((item) => coloSites.some((c) => (item.values[c.id] || 0) > 0))
      .map((item) => {
        const rfTotal = coloSites.reduce((s, c) => s + (item.values[c.id] || 0), 0);
        return ["RF", item.description || "RF Engineering", "", 1, "", "", 0, 0, rfTotal, 0, 0, ""];
      });

    const dataRows = [
      // RF Services section first
      ...rfRows,
      // Matched items
      ...analysis.matched.map((item) => {
        const unitPrice = excludeMaterials ? 0 :
          (item.unitEquipmentPrice === 0
            ? (priceOverrides[item.partNumber] ?? 0)
            : item.unitEquipmentPrice);
        const unitLabor =
          item.unitLaborHours === 0
            ? (laborOverrides[item.partNumber] ?? 0)
            : item.unitLaborHours;
        const adjPrice = unitPrice * matMult;
        const adjLabor = unitLabor * labMult;
        const dbEntry = db?.entries.find((e) => e.partNumber === item.partNumber);
        const desc = dbEntry ? getLaborCodeDesc(dbEntry.laborCode) : "";
        return [
          item.partNumber,
          item.manufacturer || "",
          "",
          item.quantity,
          "",
          "",
          adjPrice,
          adjLabor,
          "",
          adjPrice * item.quantity,
          adjLabor * item.quantity,
          desc,
        ];
      }),
      // Unmatched items (with current user-entered values)
      ...unmatched.map((item) => {
        const adjPrice = (excludeMaterials ? 0 : item.unitEquipmentPrice) * matMult;
        const adjLabor = item.unitLaborHours * labMult;
        return [
          item.partNumber,
          item.manufacturer || "",
          "",
          item.quantity,
          "",
          "",
          adjPrice,
          adjLabor,
          "",
          adjPrice * item.quantity,
          adjLabor * item.quantity,
          "",
        ];
      }),
      // NC-only adder rows — excluded in NTI mode
      ...(!ntiMode ? [
        // Badging/Safety
        ...(badgingAddedHours > 0
          ? [["BADGE", `Badging / Safety (${numberOfGuys} techs × 4 hrs)`, "", numberOfGuys, "", "", 0, 4 * labMult, "", 0, badgingAddedHours * labMult, ""]]
          : []),
        // Material Handling
        ...(materialHandlingHours > 0
          ? [["MH", "Material Handling (Tech Level)", "", 1, "", "", 0, materialHandlingHours * labMult, "", 0, materialHandlingHours * labMult, ""]]
          : []),
        // Commissioning Support
        ...(commissioningHours > 0
          ? [["COMM", "Commissioning Support (Tech Level)", "", 1, "", "", 0, commissioningHours * labMult, "", 0, commissioningHours * labMult, ""]]
          : []),
        // Additional Labor items
        ...additionalLaborItemsData.map((item) => ["ADDL", item.description || "Additional Labor", "", 1, "", "", 0, item.hours * labMult, "", 0, item.hours * labMult, ""]),
        // Extras
        ...(shuttleHours > 0   ? [["SHUTTLE", `Shuttle Services (${baseDays.toFixed(1)} project days × 1 hr)`,        "", 1, "", "", 0, shuttleHours   * labMult, "", 0, shuttleHours   * labMult, ""]] : []),
        ...(stretchHours > 0   ? [["S&F",     `Stretch & Flex (${baseDays.toFixed(1)} project days × 0.5 hrs)`,       "", 1, "", "", 0, stretchHours   * labMult, "", 0, stretchHours   * labMult, ""]] : []),
        ...(compositeHours > 0 ? [["CLEANUP", `Composite Cleanup (${baseWeeks.toFixed(1)} wks × 8 hrs)`,              "", 1, "", "", 0, compositeHours * labMult, "", 0, compositeHours * labMult, ""]] : []),
        ...(liftHours > 0      ? [["LIFT",    `Lift Spotters (65% × ${baseHours.toFixed(1)} hrs ÷ ${guys} guys)`,     "", 1, "", "", 0, liftHours      * labMult, "", 0, liftHours      * labMult, ""]] : []),
        // Water & Ice
        ...((tech.waterAndIce ?? 0) > 0
          ? [["W&I", "Water & Ice (Tech Level)", "", 1, "", "", tech.waterAndIce, 0, "", tech.waterAndIce, 0, ""]]
          : []),
        // Additional Materials
        ...(tech.additionalMaterials ?? [])
          .filter((m) => (m.value || 0) > 0)
          .map((m) => ["ADDL-MAT", m.name || "Additional Material", "", 1, "", "", m.value, 0, "", m.value, 0, ""]),
      ] : []),
    ];

    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    // Set column widths
    ws["!cols"] = [
      { wch: 22 }, { wch: 28 }, { wch: 4 }, { wch: 6 }, { wch: 4 }, { wch: 4 },
      { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 36 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BOM Report");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bom-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={handleDownload}
        disabled={!canDownload}
        title={!canDownload ? "Import a BOM first" : "Download BOM report"}
      >
        <Download className="h-3 w-3 mr-1" /> Download Report
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          <FileSpreadsheet className="h-3 w-3 mr-1" /> Import BOM
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Import BOM
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* ── No database warning ─────────────────────────────── */}
          {!db && (
            <div className="border border-amber-500/30 rounded-lg px-4 py-3 bg-amber-500/5 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-amber-400 mb-1">No parts database loaded</p>
                <p className="text-muted-foreground">
                  Upload your master parts database first.{" "}
                  <Link
                    href="/database"
                    className="text-primary underline underline-offset-2"
                    onClick={() => setOpen(false)}
                  >
                    Go to Database →
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* ── File upload ─────────────────────────────────────── */}
          {!analysis && (
            <div>
              {db && (
                <p className="text-xs text-muted-foreground mb-3">
                  Database:{" "}
                  <span className="font-medium text-foreground">{db.entries.length} parts</span>
                  {" · "}
                  {db.fileName}
                </p>
              )}
              {loading ? (
                <div className="border border-border/60 rounded-lg py-10 flex flex-col items-center text-center bg-card/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    <Sparkles className="h-4 w-4 text-primary/60" />
                  </div>
                  <p className="text-sm font-medium mb-1">{statusMsg}</p>
                  <p className="text-xs text-muted-foreground">
                    AI is reading your file and identifying columns
                  </p>
                </div>
              ) : (
                <div
                  className={`border border-dashed rounded-lg p-8 flex flex-col items-center transition-colors ${db ? "border-border/60 hover:border-border cursor-pointer" : "border-border/30 opacity-50 cursor-not-allowed"}`}
                  onClick={() => db && !loading && fileInputRef.current?.click()}
                >
                  <Upload className="h-6 w-6 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload BOM file (.xlsx, .csv)
                  </p>
                  <p className="text-xs text-muted-foreground/50 mt-1">
                    AI will automatically detect columns — only Part Number &amp; Qty required
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileUpload}
                disabled={!db || loading}
              />
            </div>
          )}

          {/* ── Analysis results ─────────────────────────────────── */}
          {analysis && (
            <>
              {/* Summary banner */}
              <div className="border border-border/60 rounded-lg bg-card/50 overflow-hidden">
                <div className="px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{analysis.matched.length} matched</span>
                    </div>
                    {needsPriceItems.length > 0 && (
                      <div
                        className={`flex items-center gap-1.5 ${unresolvedPriceCount > 0 ? "text-amber-400" : "text-emerald-400"}`}
                      >
                        {unresolvedPriceCount > 0 ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {unresolvedPriceCount > 0
                            ? `${unresolvedPriceCount} need price`
                            : `${needsPriceItems.length} prices entered`}
                        </span>
                      </div>
                    )}
                    {needsLaborItems.length > 0 && (
                      <div
                        className={`flex items-center gap-1.5 ${unresolvedLaborCount > 0 ? "text-amber-400" : "text-emerald-400"}`}
                      >
                        {unresolvedLaborCount > 0 ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {unresolvedLaborCount > 0
                            ? `${unresolvedLaborCount} need labor hrs`
                            : `${needsLaborItems.length} labor hrs entered`}
                        </span>
                      </div>
                    )}
                    {unmatched.length > 0 && (
                      <div
                        className={`flex items-center gap-1.5 ${unresolvedCount > 0 ? "text-amber-400" : "text-emerald-400"}`}
                      >
                        {unresolvedCount > 0 ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {unresolvedCount > 0
                            ? `${unresolvedCount} unresolved`
                            : `${unmatched.length} resolved`}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <button
                      onClick={() => setShowBreakdown((v) => !v)}
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showBreakdown ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <span className="font-mono font-medium text-foreground">
                        {totalHours.toFixed(1)} hrs
                      </span>
                    </button>
                    <span className="text-muted-foreground">
                      Equipment:{" "}
                      <span className="font-mono font-medium text-foreground">
                        {formatCurrency(equipCostPreview)}
                      </span>
                      {!ntiMode && ((tech.waterAndIce ?? 0) > 0 || (tech.additionalMaterials ?? []).some((m) => (m.value || 0) > 0)) && (
                        <span className="ml-1 text-muted-foreground/60">(+ extras dynamic)</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Expandable hours breakdown */}
                {showBreakdown && (
                  <div className="border-t border-border/40 px-4 py-2 space-y-0.5 bg-muted/10">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Hours Breakdown</p>
                    {[
                      { label: "BOM (matched + unmatched)", hours: bomHours, always: true },
                      { label: `+ Badging / Safety (${guys} techs × 4 hrs)`, hours: badgingAddedHours, always: false },
                      { label: "+ Material Handling", hours: materialHandlingHours, always: false },
                      { label: "+ Commissioning Support", hours: commissioningHours, always: false },
                      ...additionalLaborItemsData.map((i) => ({ label: `+ ${i.description || "Additional Labor"}`, hours: i.hours, always: false })),
                      { label: "──────", hours: -1, always: baseHours !== bomHours },
                      { label: "= Subtotal", hours: baseHours, always: baseHours !== bomHours },
                      { label: `+ Shuttle Services (${baseDays.toFixed(1)} days)`, hours: shuttleHours, always: false },
                      { label: `+ Stretch & Flex (${baseDays.toFixed(1)} days × 0.5)`, hours: stretchHours, always: false },
                      { label: `+ Composite Cleanup (${baseWeeks.toFixed(1)} wks × 8)`, hours: compositeHours, always: false },
                      { label: `+ Lift Spotters (65% × base ÷ ${guys})`, hours: liftHours, always: false },
                    ]
                      .filter((row) => row.always || row.hours > 0)
                      .map((row, i) =>
                        row.hours === -1 ? (
                          <div key={i} className="border-t border-border/30 my-1" />
                        ) : (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{row.label}</span>
                            <span className="font-mono tabular-nums">{row.hours.toFixed(1)}</span>
                          </div>
                        )
                      )}
                    <div className="flex justify-between text-xs font-semibold border-t border-border/40 pt-1 mt-1">
                      <span>= Total</span>
                      <span className="font-mono tabular-nums">{totalHours.toFixed(1)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Matched items */}
              {analysis.matched.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Matched ({analysis.matched.length})
                  </h3>
                  <div className="border border-border/60 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0">
                          <tr className="border-b border-border/60 bg-muted/60 backdrop-blur-sm">
                            <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">
                              Part #
                            </th>
                            <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">
                              Description
                            </th>
                            <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">
                              Qty
                            </th>
                            <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">
                              Unit $
                            </th>
                            <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">
                              Unit Hrs
                            </th>
                            <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">
                              Total $
                            </th>
                            <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">
                              Total Hrs
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.matched.map((item, i) => {
                            const needsPrice = false; // $0 in database is treated as $0
                            const needsLabor = item.unitLaborHours === 0 && !item.hasLaborCode;
                            const overridePrice = priceOverrides[item.partNumber] ?? 0;
                            const overrideLabor = laborOverrides[item.partNumber];
                            const effectivePrice = item.unitEquipmentPrice;
                            const effectiveLabor = needsLabor
                              ? (overrideLabor ?? 0)
                              : item.unitLaborHours;
                            const needsInput = needsPrice || needsLabor;
                            return (
                              <tr
                                key={i}
                                className={`border-b border-border/30 last:border-0 ${needsInput ? "bg-amber-500/5" : i % 2 ? "bg-muted/10" : ""}`}
                              >
                                <td className="px-3 py-1.5 font-mono text-primary/80">
                                  {item.partNumber}
                                </td>
                                <td className="px-3 py-1.5 text-muted-foreground max-w-[160px] truncate">
                                  {item.description || "—"}
                                </td>
                                <td className="px-3 py-1.5 text-right">{item.quantity}</td>
                                <td className="px-3 py-1.5 text-right font-mono">
                                  {needsPrice ? (
                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      placeholder="Enter price"
                                      value={overridePrice || ""}
                                      onChange={(e) =>
                                        setPriceOverrides((prev) => ({
                                          ...prev,
                                          [item.partNumber]: parseFloat(e.target.value) || 0,
                                        }))
                                      }
                                      className="h-6 w-28 text-xs text-right ml-auto border-amber-500/40 focus:border-amber-500/80"
                                    />
                                  ) : (
                                    `$${item.unitEquipmentPrice.toFixed(2)}`
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono">
                                  {needsLabor ? (
                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      placeholder="Enter hrs"
                                      value={overrideLabor ?? ""}
                                      onChange={(e) =>
                                        setLaborOverrides((prev) => ({
                                          ...prev,
                                          [item.partNumber]: parseFloat(e.target.value) || 0,
                                        }))
                                      }
                                      className="h-6 w-24 text-xs text-right ml-auto border-amber-500/40 focus:border-amber-500/80"
                                    />
                                  ) : (
                                    item.unitLaborHours
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono">
                                  {effectivePrice > 0
                                    ? formatCurrency(effectivePrice * item.quantity)
                                    : <span className="text-amber-400">—</span>}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono">
                                  {(effectiveLabor * item.quantity).toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Unmatched items */}
              {unmatched.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Unmatched — Fill in database values ({unmatched.length})
                  </h3>
                  <div className="border border-amber-500/30 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0">
                          <tr className="border-b border-amber-500/20 bg-amber-500/5">
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Part #</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Description</th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Unit Price ($)</th>
                            <th className="text-center px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Code 1</th>
                            <th className="text-center px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Code 2</th>
                            <th className="text-center px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Code 3</th>
                            <th className="text-center px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Code 4</th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Labor Hrs</th>
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {unmatched.map((item, i) => {
                            const codes = unmatchedCodes[i] ?? ["", "", "", ""];
                            return (
                              <tr
                                key={i}
                                className={`border-b border-amber-500/10 last:border-0 transition-opacity ${item.isResolved ? "opacity-50" : ""}`}
                              >
                                <td className="px-3 py-1.5 font-mono whitespace-nowrap">{item.partNumber}</td>
                                <td className="px-3 py-1.5">
                                  <Input
                                    type="text"
                                    value={item.description ?? ""}
                                    onChange={(e) => updateUnmatched(i, "description", e.target.value)}
                                    disabled={item.isResolved}
                                    placeholder="—"
                                    className="h-6 w-32 text-xs"
                                  />
                                </td>
                                <td className="px-3 py-1.5 text-right">{item.quantity}</td>
                                <td className="px-3 py-1.5">
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={item.unitEquipmentPrice || ""}
                                    onChange={(e) =>
                                      updateUnmatched(i, "unitEquipmentPrice", parseFloat(e.target.value) || 0)
                                    }
                                    disabled={item.isResolved}
                                    placeholder="0.00"
                                    className="h-6 w-24 text-xs text-right ml-auto"
                                  />
                                </td>
                                {[0, 1, 2, 3].map((ci) => (
                                  <td key={ci} className="px-2 py-1.5">
                                    <Input
                                      type="text"
                                      value={codes[ci] ?? ""}
                                      onChange={(e) => updateUnmatchedCode(i, ci, e.target.value)}
                                      disabled={item.isResolved}
                                      placeholder="—"
                                      className="h-6 w-16 text-xs text-center"
                                    />
                                  </td>
                                ))}
                                <td className="px-3 py-1.5 text-right font-mono">
                                  {item.unitLaborHours > 0 ? item.unitLaborHours.toFixed(2) : "—"}
                                </td>
                                <td className="px-3 py-1.5 text-center">
                                  {item.isResolved ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" />
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-[10px] px-2 border-amber-500/30 hover:border-amber-500/60"
                                      onClick={() => resolveUnmatched(i)}
                                    >
                                      Resolve
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* COLO Distribution — only shown once all unmatched are resolved */}
              {allResolved && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    COLO Distribution
                  </h3>
                  <div className="border border-border/60 rounded-lg px-4 py-3 space-y-2.5 bg-card/50">
                    {distribution.map((d) => {
                      const site = coloSites.find((c) => c.id === d.coloId);
                      const labHrs = totalHours * (d.percentage / 100);
                      const equip = equipCostPreview * (d.percentage / 100);
                      return (
                        <div key={d.coloId} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-32 shrink-0">
                            {site?.name}
                          </span>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="1"
                            value={d.percentage}
                            onChange={(e) =>
                              updateDistribution(d.coloId, parseFloat(e.target.value) || 0)
                            }
                            className="h-7 w-20 text-xs text-right"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                          <span className="text-xs text-muted-foreground ml-auto font-mono tabular-nums">
                            {formatCurrency(equip)} · {labHrs.toFixed(1)} hrs
                          </span>
                        </div>
                      );
                    })}
                    <div
                      className={`text-xs pt-1.5 border-t border-border/40 flex justify-between font-medium ${distValid ? "text-emerald-400" : "text-destructive"}`}
                    >
                      <span>Total</span>
                      <span className="font-mono">
                        {distSum.toFixed(1)}%{distValid ? " ✓" : " — must equal 100%"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={handleApply}
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  disabled={!canApply}
                >
                  {unresolvedPriceCount > 0
                    ? `Enter price for ${unresolvedPriceCount} item${unresolvedPriceCount > 1 ? "s" : ""} to continue`
                    : unresolvedLaborCount > 0
                    ? `Enter labor hrs for ${unresolvedLaborCount} item${unresolvedLaborCount > 1 ? "s" : ""} to continue`
                    : unresolvedCount > 0
                    ? `Resolve ${unresolvedCount} item${unresolvedCount > 1 ? "s" : ""} to continue`
                    : !distValid
                    ? `Distribution must equal 100% (${distSum.toFixed(0)}%)`
                    : "Apply to Project"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleDownload}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download Report
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={reset}
                >
                  Upload Different
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </div>
  );
}
