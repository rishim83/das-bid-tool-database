"use client";

import type { TechnologyConfig } from "@/types";
import { Input } from "@/components/ui/input";
import { TECHNOLOGY_LABELS, TECHNOLOGY_DOT } from "@/lib/constants";

interface Props {
  tech: TechnologyConfig;
  onChange: (tech: TechnologyConfig) => void;
}

export function InputValuesTable({ tech, onChange }: Props) {
  const label = TECHNOLOGY_LABELS[tech.type];
  const dotColor = TECHNOLOGY_DOT[tech.type];

  const updateField = (field: "installLaborHours" | "equipmentCost", value: number) => {
    onChange({ ...tech, [field]: { total: value } });
  };

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card">
      <div className="px-4 py-2.5 border-b border-border/50 header-gradient-accent flex items-center gap-2.5">
        <div className={`h-2 w-2 rounded-full ${dotColor}`} />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label} &mdash; Input Values
        </h3>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">Install Hours</span>
          <Input
            type="number"
            step="any"
            value={tech.installLaborHours["total"] || ""}
            onChange={(e) => updateField("installLaborHours", parseFloat(e.target.value) || 0)}
            placeholder="0"
            className="h-7 w-32 bg-input/30 border-border/40 text-right text-xs font-mono tabular-nums rounded-md"
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">Equipment ($)</span>
          <Input
            type="number"
            step="any"
            value={tech.equipmentCost["total"] || ""}
            onChange={(e) => updateField("equipmentCost", parseFloat(e.target.value) || 0)}
            placeholder="0"
            className="h-7 w-32 bg-input/30 border-border/40 text-right text-xs font-mono tabular-nums rounded-md"
          />
        </div>
      </div>
    </div>
  );
}
