import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";

export interface ColumnMapping {
  headerRowIndex: number;
  partNumber: string | null;
  description: string | null;
  uom: string | null;
  price: string | null;
  /** All columns whose header contains the word "code" — every one contributes to labor hours. */
  codeCols: string[];
  laborHours: string | null;
}

export interface LaborSheetMapping {
  headerRowIndex: number;
  code: string | null;
  description: string | null;
  hours: string | null;
}

export interface ParseDatabaseResponse {
  partsSheet: ColumnMapping;
  laborSheet: LaborSheetMapping | null;
}

const PARTS_PROMPT = (rows: string[][]): string => `
You are analyzing raw rows from an Excel spreadsheet that is a parts/equipment pricing database.
Each row is an array of cell values. Identify the structure.

Return ONLY a JSON object (no markdown, no explanation):
{
  "headerRowIndex": <0-based index of the row that contains column headers>,
  "partNumber": "<exact header text for the part/item number column, or null>",
  "description": "<exact header text for description column, or null>",
  "uom": "<exact header text for unit of measure, or null>",
  "price": "<exact header text for equipment/material unit price column, or null>",
  "codeCols": ["<exact header text of EVERY column whose header contains the word 'code'>"],
  "laborHours": "<exact header text for a pre-calculated total labor hours column, or null>"
}

Notes:
- The header row is the row that defines column names. There may be blank rows or title rows above it.
- Use the EXACT text from the header row (preserving spaces and capitalization).
- "codeCols" must include ALL columns that contain the word "code" anywhere in their header
  (e.g. "Install Code", "Labor Code", "Additional Code 1", "Additional Code 2", etc.).
  Each code is looked up in a separate labor table to get hours — ALL of them matter.
  Return an empty array [] if no such columns exist.
- "laborHours" is a pre-calculated hours total column (often blank in data rows).
- If a field other than "codeCols" is not present, return null for it.

Rows (first ${rows.length}):
${rows.map((r, i) => `[${i}] ${JSON.stringify(r)}`).join("\n")}
`.trim();

const LABOR_PROMPT = (rows: string[][]): string => `
You are analyzing raw rows from a labor codes reference sheet in an Excel file.
Each row is an array of cell values. Identify the structure.

Return ONLY a JSON object (no markdown, no explanation):
{
  "headerRowIndex": <0-based index of the header row>,
  "code": "<exact header text for the labor/install code column, or null>",
  "description": "<exact header text for task/description column, or null>",
  "hours": "<exact header text for hours-per-unit column, or null>"
}

Rows (first ${rows.length}):
${rows.map((r, i) => `[${i}] ${JSON.stringify(r)}`).join("\n")}
`.trim();

function extractJSON(text: string): unknown {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```(?:json)?\n?/g, "").trim();
  return JSON.parse(cleaned);
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const { partsRows, laborRows } = await request.json() as {
      partsRows: string[][];
      laborRows?: string[][];
    };

    if (!partsRows || !Array.isArray(partsRows)) {
      return NextResponse.json({ error: "partsRows is required" }, { status: 400 });
    }

    const client = getAnthropicClient();

    // Run parts and labor sheet analysis in parallel
    const [partsMsg, laborMsg] = await Promise.all([
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: PARTS_PROMPT(partsRows.slice(0, 40)) }],
      }),
      laborRows && laborRows.length > 0
        ? client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 256,
            messages: [{ role: "user", content: LABOR_PROMPT(laborRows.slice(0, 30)) }],
          })
        : Promise.resolve(null),
    ]);

    const partsText = partsMsg.content.find((b) => b.type === "text");
    if (!partsText || partsText.type !== "text") {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    const partsSheet = extractJSON(partsText.text) as ColumnMapping;

    let laborSheet: LaborSheetMapping | null = null;
    if (laborMsg) {
      const laborText = laborMsg.content.find((b) => b.type === "text");
      if (laborText && laborText.type === "text") {
        laborSheet = extractJSON(laborText.text) as LaborSheetMapping;
      }
    }

    return NextResponse.json({ partsSheet, laborSheet } satisfies ParseDatabaseResponse);
  } catch (error) {
    console.error("parse-database error:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze file" },
      { status: 500 }
    );
  }
}
