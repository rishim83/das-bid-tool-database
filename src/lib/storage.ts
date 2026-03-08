import type { Project } from "@/types";

const STORAGE_KEY = "das-bid-projects";
const TEMPLATES_KEY = "das-bid-templates";

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  project: Omit<Project, "id" | "name" | "client" | "status" | "createdAt" | "updatedAt">;
}

export function loadProjects(): Project[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function loadProject(id: string): Project | null {
  const projects = loadProjects();
  return projects.find((p) => p.id === id) ?? null;
}

export function saveProject(project: Project): void {
  const projects = loadProjects();
  const index = projects.findIndex((p) => p.id === project.id);
  if (index >= 0) {
    projects[index] = { ...project, updatedAt: new Date().toISOString() };
  } else {
    projects.push(project);
  }
  saveProjects(projects);
}

export function deleteProject(id: string): void {
  const projects = loadProjects().filter((p) => p.id !== id);
  saveProjects(projects);
}

// ─── Templates ──────────────────────────────────────────────────

export function loadTemplates(): ProjectTemplate[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(TEMPLATES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ProjectTemplate[];
  } catch {
    return [];
  }
}

export function saveTemplates(templates: ProjectTemplate[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export function saveTemplate(template: ProjectTemplate): void {
  const templates = loadTemplates();
  const index = templates.findIndex((t) => t.id === template.id);
  if (index >= 0) {
    templates[index] = template;
  } else {
    templates.push(template);
  }
  saveTemplates(templates);
}

export function deleteTemplate(id: string): void {
  const templates = loadTemplates().filter((t) => t.id !== id);
  saveTemplates(templates);
}
