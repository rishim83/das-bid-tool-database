import * as XLSX from "xlsx";
import type { DatabaseEntry, LaborCode, PartsDatabase } from "@/types";

export async function loadDatabase(): Promise<PartsDatabase | null> {
  const res = await fetch("/api/database");
  if (!res.ok) return null;
  return res.json();
}

export async function saveDatabase(db: PartsDatabase): Promise<void> {
  const res = await fetch("/api/database", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(db),
  });
  if (!res.ok) throw new Error("Failed to save database");
}

export async function clearDatabase(): Promise<void> {
  const res = await fetch("/api/database", { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to clear database");
}

/**
 * Returns the hoursPerUnit for the "BADGE" labor code, or 0 if not found.
 * Used when badgingSafety is enabled to add badge hours to each COLO's labor hours.
 */
export function getBadgingHours(db: PartsDatabase | null): number {
  if (!db) return 0;
  const entry = db.laborCodes.find((lc) => lc.code.toUpperCase() === "BADGE");
  return entry?.hoursPerUnit ?? 0;
}

// ─── Helpers ──────────────────────────────────────────────────────

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

function getRawRows(ws: XLSX.WorkSheet): string[][] {
  return XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
    defval: "",
  }).map((row) => (row as unknown[]).map((cell) => String(cell ?? "").trim()));
}

// ─── Fixed column schema ──────────────────────────────────────────
//
// Sheet 1 (BOM sheet):
//   Row 1: Manufacturer | Item | Part Number | Install Code | Install Code 2 |
//          Install Code 3 | Install Code 4 | Install Code 5 | Description | Material Unit Price
//
// Sheet 2 (Labor sheet):
//   Row 1: CODE | Task | Unit | Hours

const INSTALL_CODE_COLS = [
  "install code",
  "install code 2",
  "install code 3",
  "install code 4",
  "install code 5",
];

// ─── Parser ───────────────────────────────────────────────────────

export async function parseDatabase(file: File): Promise<PartsDatabase> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: "binary" });

        // Find sheets: labor = sheet named "labor" or index 1; parts = "bom" or index 0
        const laborSheetName =
          workbook.SheetNames.find((n) => n.toLowerCase().includes("labor")) ??
          (workbook.SheetNames.length >= 2 ? workbook.SheetNames[1] : null);
        const partsSheetName =
          workbook.SheetNames.find((n) => n.toLowerCase().includes("bom")) ??
          workbook.SheetNames[0];

        // ── Sheet 2: Labor codes ──────────────────────────────────
        const laborCodes: LaborCode[] = [];
        const lcMap = new Map<string, number>();     // code → regular hours (col D)
        const liftLcMap = new Map<string, number>(); // code → lift hours (col E)

        if (laborSheetName && workbook.Sheets[laborSheetName]) {
          const rows = getRawRows(workbook.Sheets[laborSheetName]);
          const headerIdx = rows.findIndex((row) =>
            row.some((cell) => normalizeKey(cell) === "code")
          );

          if (headerIdx >= 0) {
            const headers = rows[headerIdx].map((h) => normalizeKey(h));
            const codeIdx = headers.indexOf("code");
            const taskIdx = headers.indexOf("task");
            const hoursIdx = headers.indexOf("hours");
            const liftHoursIdx = hoursIdx >= 0 ? hoursIdx + 1 : -1; // column E

            for (const row of rows.slice(headerIdx + 1)) {
              const code = (row[codeIdx] ?? "").trim();
              if (!code) continue;
              const hours = parseNum(row[hoursIdx] ?? "");
              const liftHours = liftHoursIdx >= 0 ? parseNum(row[liftHoursIdx] ?? "") : 0;
              const desc = taskIdx >= 0 ? (row[taskIdx] ?? "").trim() : "";
              laborCodes.push({ code, description: desc, hoursPerUnit: hours });
              lcMap.set(code.toLowerCase(), hours);
              liftLcMap.set(code.toLowerCase(), liftHours);
            }
          }
        }

        // ── Sheet 1: Parts ────────────────────────────────────────
        const partsWs = workbook.Sheets[partsSheetName];
        if (!partsWs) {
          reject(new Error(`Sheet "${partsSheetName}" not found in the file.`));
          return;
        }

        const rows = getRawRows(partsWs);

        // Find the header row by looking for "part number"
        const headerIdx = rows.findIndex((row) =>
          row.some((cell) => normalizeKey(cell) === "part number")
        );

        if (headerIdx < 0) {
          const preview = rows
            .slice(0, 3)
            .map((r, i) => `Row ${i + 1}: ${r.filter(Boolean).join(" | ")}`)
            .join("\n");
          reject(
            new Error(
              `Could not find "Part Number" column in the BOM sheet.\n` +
              `Make sure row 1 contains the exact header "Part Number".\n${preview}`
            )
          );
          return;
        }

        const headers = rows[headerIdx].map((h) => normalizeKey(h));
        const colIdx = (name: string): number => headers.indexOf(normalizeKey(name));

        const partNumberIdx = colIdx("Part Number");
        const descriptionIdx = colIdx("Description");
        const priceIdx = colIdx("Material Unit Price");
        const codeIdxs = INSTALL_CODE_COLS.map((c) => colIdx(c));

        const entries: DatabaseEntry[] = [];

        for (const row of rows.slice(headerIdx + 1)) {
          const partNumber = (row[partNumberIdx] ?? "").trim();
          if (!partNumber) continue;

          // Collect non-empty install codes from all 4 columns
          const allCodes = codeIdxs
            .map((i) => (i >= 0 ? (row[i] ?? "").trim() : ""))
            .filter(Boolean);

          // Sum regular labor hours (col D) and lift labor hours (col E)
          const laborHoursPerUnit = allCodes.reduce(
            (sum, code) => sum + (lcMap.get(code.toLowerCase()) ?? 0),
            0
          );
          const liftLaborHoursPerUnit = allCodes.reduce(
            (sum, code) => sum + (liftLcMap.get(code.toLowerCase()) ?? 0),
            0
          );

          entries.push({
            partNumber,
            description: descriptionIdx >= 0 ? (row[descriptionIdx] ?? "").trim() : "",
            uom: "",
            equipmentUnitPrice: priceIdx >= 0 ? parseNum(row[priceIdx] ?? "") : 0,
            laborCode: allCodes.join(", "),
            laborHoursPerUnit,
            liftLaborHoursPerUnit,
          });
        }

        if (entries.length === 0) {
          reject(
            new Error(
              `Header row found at row ${headerIdx + 1}, but no data rows were found below it.`
            )
          );
          return;
        }

        resolve({
          entries,
          laborCodes,
          uploadedAt: new Date().toISOString(),
          fileName: file.name,
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Failed to parse database file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsBinaryString(file);
  });
}
