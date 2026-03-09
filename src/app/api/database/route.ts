import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { PartsDatabase } from "@/types";

export async function GET() {
  try {
    const rows = await sql`
      SELECT file_name, uploaded_at, entries, labor_codes
      FROM parts_database
      ORDER BY id DESC
      LIMIT 1
    `;
    if (rows.length === 0) {
      return NextResponse.json(null);
    }
    const r = rows[0];
    const db: PartsDatabase = {
      fileName: r.file_name as string,
      uploadedAt: (r.uploaded_at as Date).toISOString(),
      entries: r.entries as PartsDatabase["entries"],
      laborCodes: r.labor_codes as PartsDatabase["laborCodes"],
    };
    return NextResponse.json(db);
  } catch (error) {
    console.error("GET /api/database error:", error);
    return NextResponse.json({ error: "Failed to load database" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const db: PartsDatabase = await req.json();
    await sql`DELETE FROM parts_database`;
    await sql`
      INSERT INTO parts_database (file_name, uploaded_at, entries, labor_codes)
      VALUES (
        ${db.fileName},
        ${db.uploadedAt ?? new Date().toISOString()},
        ${JSON.stringify(db.entries)},
        ${JSON.stringify(db.laborCodes)}
      )
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/database error:", error);
    return NextResponse.json({ error: "Failed to save database" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await sql`DELETE FROM parts_database`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/database error:", error);
    return NextResponse.json({ error: "Failed to clear database" }, { status: 500 });
  }
}
