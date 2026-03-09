import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { Project } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const rows = await sql`
      SELECT id, name, client, status, data, created_at, updated_at
      FROM projects WHERE id = ${id}
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const r = rows[0];
    const project: Project = {
      ...(r.data as Omit<Project, "id" | "name" | "client" | "status" | "createdAt" | "updatedAt">),
      id: r.id as string,
      name: r.name as string,
      client: r.client as string,
      status: r.status as Project["status"],
      createdAt: (r.created_at as Date).toISOString(),
      updatedAt: (r.updated_at as Date).toISOString(),
    };
    return NextResponse.json(project);
  } catch (error) {
    console.error(`GET /api/projects/${id} error:`, error);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const project: Project = await req.json();
    const { name, client, status, createdAt, updatedAt, ...rest } = project;
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO projects (id, name, client, status, data, created_at, updated_at)
      VALUES (
        ${id},
        ${name},
        ${client ?? ""},
        ${status ?? "draft"},
        ${JSON.stringify(rest)},
        ${createdAt ?? now},
        ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        name       = EXCLUDED.name,
        client     = EXCLUDED.client,
        status     = EXCLUDED.status,
        data       = EXCLUDED.data,
        updated_at = EXCLUDED.updated_at
      RETURNING id, name, client, status, data, created_at, updated_at
    `;
    const r = rows[0];
    const saved: Project = {
      ...(r.data as Omit<Project, "id" | "name" | "client" | "status" | "createdAt" | "updatedAt">),
      id: r.id as string,
      name: r.name as string,
      client: r.client as string,
      status: r.status as Project["status"],
      createdAt: (r.created_at as Date).toISOString(),
      updatedAt: (r.updated_at as Date).toISOString(),
    };
    return NextResponse.json(saved);
  } catch (error) {
    console.error(`PUT /api/projects/${id} error:`, error);
    return NextResponse.json({ error: "Failed to save project" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await sql`DELETE FROM projects WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`DELETE /api/projects/${id} error:`, error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
