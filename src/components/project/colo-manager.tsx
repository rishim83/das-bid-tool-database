"use client";

import type { ColoSite } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { v4 as uuid } from "uuid";

interface Props {
  coloSites: ColoSite[];
  onChange: (sites: ColoSite[]) => void;
}

export function ColoManager({ coloSites, onChange }: Props) {
  const addSite = () => {
    const num = coloSites.length;
    onChange([...coloSites, { id: uuid(), name: `COLO ${num}` }]);
  };

  const removeSite = (id: string) => {
    if (coloSites.length <= 1) return;
    onChange(coloSites.filter((s) => s.id !== id));
  };

  const renameSite = (id: string, name: string) => {
    onChange(coloSites.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">COLO Sites</span>
      {coloSites.map((site) => (
        <div key={site.id} className="flex items-center gap-0.5 group">
          <Input
            value={site.name}
            onChange={(e) => renameSite(site.id, e.target.value)}
            className="h-7 w-36 text-xs bg-input/40 border-border/50 rounded-md"
          />
          {coloSites.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => removeSite(site.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground border border-dashed border-border/50 hover:border-primary/40 hover:text-primary transition-colors" onClick={addSite}>
        <Plus className="h-3 w-3 mr-1" /> Add COLO
      </Button>
    </div>
  );
}
