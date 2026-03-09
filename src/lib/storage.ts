import type { Project } from "@/types";

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  project: Omit<Project, "id" | "name" | "client" | "status" | "createdAt" | "updatedAt">;
}

export async function loadProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) return [];
  return res.json();
}

export async function loadProject(id: string): Promise<Project | null> {
  const res = await fetch(`/api/projects/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json();
}

export async function saveProject(project: Project): Promise<Project> {
  const res = await fetch(`/api/projects/${project.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
  if (!res.ok) throw new Error("Failed to save project");
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete project");
}

// ─── Templates ──────────────────────────────────────────────────

export async function loadTemplates(): Promise<ProjectTemplate[]> {
  const res = await fetch("/api/templates");
  if (!res.ok) return [];
  return res.json();
}

export async function saveTemplate(template: ProjectTemplate): Promise<void> {
  const res = await fetch("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(template),
  });
  if (!res.ok) throw new Error("Failed to save template");
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete template");
}
