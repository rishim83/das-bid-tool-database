import * as XLSX from "xlsx";
import type {
  BOMLineItem,
  BOMAnalysisResult,
  ColoDistribution,
  MatchedBOMItem,
  UnmatchedBOMItem,
  PartsDatabase,
} from "@/types";
import type { BOMColumnMapping } from "@/app/api/ai/parse-bom/route";

// ─── Parsing helpers ─────────────────────────────────────────────

function normalizeKey(k: string): string {
  return k
    .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000\ufeff]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseNum(val: string): number {
  const n = parseFloat(val.replace(/[$,]/g, ""));
  return isNaN(n) ? 0 : n;
}

// ─── AI-powered path ─────────────────────────────────────────────

/**
 * Step 1: Read raw rows from the BOM file (first sheet).
 * Call client-side, then send a sample to /api/ai/parse-bom.
 */
export async function extractBOMRows(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils
          .sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" })
          .map((row) => (row as unknown[]).map((cell) => String(cell ?? "").trim()));
        resolve(rows as string[][]);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Failed to read BOM file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read BOM file"));
    reader.readAsBinaryString(file);
  });
}

/**
 * Step 2: Apply AI-detected column mapping to full raw rows.
 * Returns an array of BOMLineItem ready for analyzeBOM().
 */
export function applyBOMMapping(rows: string[][], mapping: BOMColumnMapping): BOMLineItem[] {
  const { headerRowIndex } = mapping;
  const headerRow = rows[headerRowIndex] ?? [];

  // Map normalized header → column index
  const colIndex = new Map<string, number>();
  headerRow.forEach((h, i) => colIndex.set(normalizeKey(h), i));

  const get = (row: string[], colHeader: string | null): string => {
    if (!colHeader) return "";
    const idx = colIndex.get(normalizeKey(colHeader));
    return idx !== undefined ? (row[idx] ?? "").trim() : "";
  };

  const items: BOMLineItem[] = [];
  for (const row of rows.slice(headerRowIndex + 1)) {
    const partNumber = get(row, mapping.partNumber);
    if (!partNumber) continue;

    const qtyStr = get(row, mapping.quantity);
    const quantity = parseNum(qtyStr) || 1;

    items.push({
      partNumber,
      quantity,
      description: get(row, mapping.description) || undefined,
      uom: get(row, mapping.uom) || undefined,
      manufacturer: get(row, mapping.manufacturer) || undefined,
    });
  }

  return items;
}

// ─── BOM analysis ────────────────────────────────────────────────

export function analyzeBOM(
  bom: BOMLineItem[],
  db: PartsDatabase,
  includeLiftAdder = false,
  includeJHooks = true
): BOMAnalysisResult {
  // Case-insensitive lookup map keyed by part number
  const dbMap = new Map<string, (typeof db.entries)[0]>();
  db.entries.forEach((entry) => {
    dbMap.set(entry.partNumber.toLowerCase().trim(), entry);
  });

  // Build a map of laborCode → hoursPerUnit for PJHOOK subtraction
  const lcHoursMap = new Map<string, number>();
  db.laborCodes.forEach((lc) => {
    lcHoursMap.set(lc.code.toLowerCase().trim(), lc.hoursPerUnit);
  });

  const matched: MatchedBOMItem[] = [];
  const unmatched: UnmatchedBOMItem[] = [];

  for (const item of bom) {
    const dbEntry = dbMap.get(item.partNumber.toLowerCase().trim());
    if (dbEntry) {
      let unitLaborHours = includeLiftAdder
        ? (dbEntry.liftLaborHoursPerUnit ?? dbEntry.laborHoursPerUnit)
        : dbEntry.laborHoursPerUnit;
      // J Hooks: subtract PJHOOK labor contribution when disabled
      if (!includeJHooks) {
        const codes = dbEntry.laborCode.split(",").map((c) => c.trim().toLowerCase());
        if (codes.includes("pjhook")) {
          const pjhookHours = lcHoursMap.get("pjhook") ?? 0;
          unitLaborHours = Math.max(0, unitLaborHours - pjhookHours);
        }
      }
      matched.push({
        partNumber: item.partNumber,
        manufacturer: item.manufacturer,
        description: item.description || dbEntry.description,
        quantity: item.quantity,
        uom: item.uom || dbEntry.uom,
        unitEquipmentPrice: dbEntry.equipmentUnitPrice,
        unitLaborHours,
        totalEquipmentCost: dbEntry.equipmentUnitPrice * item.quantity,
        totalLaborHours: unitLaborHours * item.quantity,
        hasLaborCode: !!dbEntry.laborCode,
      });
    } else {
      unmatched.push({
        partNumber: item.partNumber,
        manufacturer: item.manufacturer,
        description: item.description,
        quantity: item.quantity,
        uom: item.uom,
        unitEquipmentPrice: 0,
        unitLaborHours: 0,
        isResolved: false,
      });
    }
  }

  const totalEquipmentCost = matched.reduce((s, m) => s + m.totalEquipmentCost, 0);
  const totalLaborHours = matched.reduce((s, m) => s + m.totalLaborHours, 0);

  return { matched, unmatched, totalEquipmentCost, totalLaborHours };
}

// ─── COLO distribution ───────────────────────────────────────────

export function applyDistribution(
  result: BOMAnalysisResult,
  resolvedUnmatched: UnmatchedBOMItem[],
  distribution: ColoDistribution[]
): Record<string, { laborHours: number; equipmentCost: number }> {
  let totalLaborHours = result.totalLaborHours;
  let totalEquipmentCost = result.totalEquipmentCost;

  for (const u of resolvedUnmatched) {
    totalLaborHours += u.unitLaborHours * u.quantity;
    totalEquipmentCost += u.unitEquipmentPrice * u.quantity;
  }

  const out: Record<string, { laborHours: number; equipmentCost: number }> = {};
  for (const d of distribution) {
    const pct = d.percentage / 100;
    out[d.coloId] = {
      laborHours: Math.round(totalLaborHours * pct * 100) / 100,
      equipmentCost: Math.round(totalEquipmentCost * pct * 100) / 100,
    };
  }
  return out;
}
