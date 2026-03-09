import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { Project } from "@/types";

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, name, client, status, data, created_at, updated_at
      FROM projects
      ORDER BY updated_at DESC
    `;
    const projects: Project[] = rows.map((r) => ({
      ...(r.data as Omit<Project, "id" | "name" | "client" | "status" | "createdAt" | "updatedAt">),
      id: r.id as string,
      name: r.name as string,
      client: r.client as string,
      status: r.status as Project["status"],
      createdAt: (r.created_at as Date).toISOString(),
      updatedAt: (r.updated_at as Date).toISOString(),
    }));
    return NextResponse.json(projects);
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}
