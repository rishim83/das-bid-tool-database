import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await sql`DELETE FROM templates WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`DELETE /api/templates/${id} error:`, error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
