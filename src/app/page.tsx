"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuid } from "uuid";
import type { Project } from "@/types";
import {
  loadProjects,
  deleteProject,
  saveProject,
  loadTemplates,
  saveTemplate,
  deleteTemplate,
  type ProjectTemplate,
} from "@/lib/storage";
import { createNewProject } from "@/lib/project-defaults";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Radio,
  Trash2,
  Copy,
  BookmarkPlus,
  LayoutTemplate,
  ArrowRight,
  BarChart3,
  Database,
} from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [saveTemplateProject, setSaveTemplateProject] = useState<Project | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadProjects(), loadTemplates()]).then(([projs, tmpls]) => {
      setProjects(projs);
      setTemplates(tmpls);
      setLoading(false);
    });
  }, []);

  const handleCreate = async () => {
    const project = createNewProject(newName || "New Project", newClient);
    await saveProject(project);
    setDialogOpen(false);
    setNewName("");
    setNewClient("");
    router.push(`/project/${project.id}`);
  };

  const handleCreateFromTemplate = async (template: ProjectTemplate) => {
    const project = createNewProject(newName || "New Project", newClient);
    project.inputParameters = { ...template.project.inputParameters };
    project.schedule = { ...template.project.schedule };
    project.pmTravel = { ...template.project.pmTravel };
    project.coloSites = template.project.coloSites.map((s) => ({ ...s }));
    project.technologies = JSON.parse(JSON.stringify(template.project.technologies));
    await saveProject(project);
    setTemplateDialogOpen(false);
    setNewName("");
    setNewClient("");
    router.push(`/project/${project.id}`);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this project?")) return;
    await deleteProject(id);
    setProjects(await loadProjects());
  };

  const handleDuplicate = async (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    const dup = createNewProject(`${p.name} (Copy)`, p.client);
    dup.inputParameters = { ...p.inputParameters };
    dup.schedule = { ...p.schedule };
    dup.pmTravel = { ...p.pmTravel };
    dup.coloSites = p.coloSites.map((s) => ({ ...s }));
    dup.technologies = JSON.parse(JSON.stringify(p.technologies));
    await saveProject(dup);
    setProjects(await loadProjects());
  };

  const handleSaveAsTemplate = (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setSaveTemplateProject(p);
    setTemplateName(`${p.name} Template`);
    setTemplateDesc("");
  };

  const confirmSaveTemplate = async () => {
    if (!saveTemplateProject) return;
    const template: ProjectTemplate = {
      id: uuid(),
      name: templateName || "Untitled Template",
      description: templateDesc,
      createdAt: new Date().toISOString(),
      project: {
        inputParameters: { ...saveTemplateProject.inputParameters },
        schedule: { ...saveTemplateProject.schedule },
        pmTravel: { ...saveTemplateProject.pmTravel },
        coloSites: saveTemplateProject.coloSites.map((s) => ({ ...s })),
        technologies: JSON.parse(JSON.stringify(saveTemplateProject.technologies)),
      },
    };
    await saveTemplate(template);
    setTemplates(await loadTemplates());
    setSaveTemplateProject(null);
    setTemplateName("");
    setTemplateDesc("");
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await deleteTemplate(id);
    setTemplates(await loadTemplates());
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">DAS Bid Tool</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Bid estimation for DAS, Public Safety & ROIP
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/database">
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Database className="h-3.5 w-3.5 mr-1.5" /> Database
              </Button>
            </Link>
            <Link href="/reports">
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Reports
              </Button>
            </Link>
            <ThemeToggle />
            <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={templates.length === 0} className="h-8 text-xs">
                  <LayoutTemplate className="h-3.5 w-3.5 mr-1.5" /> Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-base">New from Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Project Name</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Project name..." autoFocus className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Client</Label>
                    <Input value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="Client name..." className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Template</Label>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {templates.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between border rounded-md px-3 py-2 hover:bg-muted/50 cursor-pointer group transition-colors"
                          onClick={() => handleCreateFromTemplate(t)}
                        >
                          <div>
                            <p className="text-sm font-medium">{t.name}</p>
                            {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                          </div>
                          <Button
                            variant="ghost" size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-base">New Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Project Name</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Downtown Hospital DAS" autoFocus onKeyDown={(e) => e.key === "Enter" && handleCreate()} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Client</Label>
                    <Input value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="e.g., Acme Healthcare" onKeyDown={(e) => e.key === "Enter" && handleCreate()} className="h-8 text-sm" />
                  </div>
                  <Button onClick={handleCreate} size="sm" className="w-full h-8 text-xs">
                    Create
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Save as Template Dialog */}
        <Dialog open={saveTemplateProject !== null} onOpenChange={(open) => { if (!open) setSaveTemplateProject(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">Save as Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Template Name</Label>
                <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g., Standard Hospital DAS" autoFocus onKeyDown={(e) => e.key === "Enter" && confirmSaveTemplate()} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Input value={templateDesc} onChange={(e) => setTemplateDesc(e.target.value)} placeholder="Optional description..." onKeyDown={(e) => e.key === "Enter" && confirmSaveTemplate()} className="h-8 text-sm" />
              </div>
              <Button onClick={confirmSaveTemplate} size="sm" className="w-full h-8 text-xs">Save</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Projects */}
        {loading ? (
          <div className="border border-border/40 rounded-lg py-12 flex items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : projects.length === 0 ? (
          <div className="border border-dashed border-border/50 rounded-lg py-16 flex flex-col items-center text-center">
            <Radio className="h-8 w-8 text-muted-foreground/20 mb-4" />
            <p className="text-sm text-muted-foreground mb-4">No projects yet</p>
            <Button size="sm" onClick={() => setDialogOpen(true)} className="h-8 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> New Project
            </Button>
          </div>
        ) : (
          <div className="space-y-px border border-border/60 rounded-lg overflow-hidden card-elevated bg-card">
            {projects
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .map((p, i) => (
                <div
                  key={p.id}
                  className={`group flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-accent/50 transition-all duration-150 ${i > 0 ? "border-t border-border/40" : ""}`}
                  onClick={() => router.push(`/project/${p.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-secondary/80 text-muted-foreground">
                        {p.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      {p.client && <span>{p.client}</span>}
                      <span>{p.technologies.filter((t) => t.enabled).length} tech &middot; {p.coloSites.length} COLOs</span>
                      <span>{new Date(p.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={(e) => handleSaveAsTemplate(p, e)} title="Save as template">
                        <BookmarkPlus className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={(e) => handleDuplicate(p, e)} title="Duplicate">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={(e) => handleDelete(p.id, e)} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary/70 transition-colors ml-1" />
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
