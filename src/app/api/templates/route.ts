import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { ProjectTemplate } from "@/lib/storage";

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, name, description, data, created_at
      FROM templates
      ORDER BY created_at DESC
    `;
    const templates: ProjectTemplate[] = rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      description: r.description as string,
      createdAt: (r.created_at as Date).toISOString(),
      project: r.data as ProjectTemplate["project"],
    }));
    return NextResponse.json(templates);
  } catch (error) {
    console.error("GET /api/templates error:", error);
    return NextResponse.json({ error: "Failed to load templates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const template: ProjectTemplate = await req.json();
    const { id, name, description, createdAt, project } = template;
    await sql`
      INSERT INTO templates (id, name, description, data, created_at)
      VALUES (
        ${id},
        ${name},
        ${description ?? ""},
        ${JSON.stringify(project)},
        ${createdAt ?? new Date().toISOString()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/templates error:", error);
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 });
  }
}
