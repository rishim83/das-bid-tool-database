"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/types";
import { loadProjects, deleteProject, saveProject } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Archive, ArrowLeft, Trash2, RotateCcw, Search, Radio } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ArchivesPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadProjects().then((projs) => {
      setProjects(projs);
      setLoading(false);
    });
  }, []);

  const handleUnarchive = async (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    await saveProject({ ...p, status: "draft", updatedAt: new Date().toISOString() });
    setProjects(await loadProjects());
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Permanently delete this project?")) return;
    await deleteProject(id);
    setProjects(await loadProjects());
  };

  const archived = projects
    .filter((p) => p.status === "archived")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .filter((p) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.client ?? "").toLowerCase().includes(q);
    });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                <Archive className="h-5 w-5 text-muted-foreground/60" />
                Archives
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Archived projects</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {loading ? (
          <div className="border border-border/40 rounded-lg py-12 flex items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : projects.filter((p) => p.status === "archived").length === 0 ? (
          <div className="border border-dashed border-border/50 rounded-lg py-16 flex flex-col items-center text-center">
            <Radio className="h-8 w-8 text-muted-foreground/20 mb-4" />
            <p className="text-sm text-muted-foreground">No archived projects</p>
            <Link href="/" className="mt-4">
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Projects
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search archives…"
                className="h-8 pl-8 text-xs bg-card border-border/50"
              />
            </div>
            {archived.length === 0 && search.trim() ? (
              <div className="border border-border/40 rounded-lg py-8 text-center text-sm text-muted-foreground">
                No archived projects match &ldquo;{search}&rdquo;
              </div>
            ) : (
              <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_160px_80px_100px_auto] gap-2 px-4 py-1.5 border-b border-border/40 bg-muted/30">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Project</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Client</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 text-center">Tech / COLOs</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 text-right">Archived</span>
                  <span className="w-20" />
                </div>
                {archived.map((p, i) => (
                  <div
                    key={p.id}
                    className={`group grid grid-cols-[1fr_160px_80px_100px_auto] gap-2 items-center px-4 py-2 cursor-pointer hover:bg-accent/40 transition-colors ${i > 0 ? "border-t border-border/30" : ""}`}
                    onClick={() => router.push(`/project/${p.id}`)}
                  >
                    <span className="text-sm font-medium truncate text-muted-foreground">{p.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{p.client || "—"}</span>
                    <span className="text-xs text-muted-foreground text-center tabular-nums">
                      {p.technologies.filter((t) => t.enabled).length}T / {p.coloSites.length}C
                    </span>
                    <span className="text-xs text-muted-foreground text-right tabular-nums">
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-0.5 w-20 justify-end shrink-0">
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-primary" onClick={(e) => handleUnarchive(p, e)} title="Restore">
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={(e) => handleDelete(p.id, e)} title="Delete permanently">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
