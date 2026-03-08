import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";

export interface BOMColumnMapping {
  headerRowIndex: number;
  partNumber: string | null;
  quantity: string | null;
  description: string | null;
  uom: string | null;
  manufacturer: string | null;
}

const BOM_PROMPT = (rows: string[][]): string => `
You are analyzing raw rows from an Excel/CSV spreadsheet that is a project Bill of Materials (BOM).
Each row is an array of cell values. Identify the column structure.

Return ONLY a JSON object (no markdown, no explanation):
{
  "headerRowIndex": <0-based index of the row that contains column headers>,
  "partNumber": "<exact header text for the part/item number column, or null>",
  "quantity": "<exact header text for the quantity column, or null>",
  "description": "<exact header text for description column, or null>",
  "uom": "<exact header text for unit of measure column, or null>",
  "manufacturer": "<exact header text for manufacturer/vendor column, or null>"
}

Notes:
- The header row is the row that defines column names. There may be blank rows or title rows above it.
- Use the EXACT text from the header row (preserving spaces and capitalization).
- "partNumber" is the most critical column — look for "Part Number", "Part#", "Item Number", "Part No", "Item", "SKU", etc.
- "quantity" is the second most critical — look for "Qty", "Quantity", "Count", "Amount", "Q'ty", "QTY", etc.
- If a field is not present in this file, return null for it.

Rows (first ${rows.length}):
${rows.map((r, i) => `[${i}] ${JSON.stringify(r)}`).join("\n")}
`.trim();

function extractJSON(text: string): unknown {
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

    const { rows } = await request.json() as { rows: string[][] };

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "rows is required" }, { status: 400 });
    }

    const client = getAnthropicClient();
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: BOM_PROMPT(rows.slice(0, 40)) }],
    });

    const textBlock = msg.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    const mapping = extractJSON(textBlock.text) as BOMColumnMapping;
    return NextResponse.json(mapping);
  } catch (error) {
    console.error("parse-bom error:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze BOM" },
      { status: 500 }
    );
  }
}
