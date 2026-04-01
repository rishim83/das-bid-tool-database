"use client";

import type { TechnologyConfig, ColoSite } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { CopyCheck, ChevronDown } from "lucide-react";
import { TECHNOLOGY_LABELS, TECHNOLOGY_DOT } from "@/lib/constants";

interface Props {
  tech: TechnologyConfig;
  coloSites: ColoSite[];
  onChange: (tech: TechnologyConfig) => void;
}

function ValueInput({
  value,
  onChange,
  width = "w-28",
  step = "any",
}: {
  value: number;
  onChange: (val: number) => void;
  width?: string;
  step?: string;
}) {
  return (
    <Input
      type="number"
      step={step}
      value={value || ""}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      placeholder="-"
      className={`h-7 ${width} bg-input/30 border-border/40 text-right text-xs font-mono tabular-nums rounded-md hover:border-border/60 transition-colors`}
    />
  );
}

function CopyBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-foreground transition-colors"
          onClick={onClick}
        >
          <CopyCheck className="h-3 w-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function InputValuesTable({ tech, coloSites, onChange }: Props) {
  const label = TECHNOLOGY_LABELS[tech.type];
  const dotColor = TECHNOLOGY_DOT[tech.type];

  const copyFieldToAll = (field: "installLaborHours" | "equipmentCost") => {
    const firstColo = coloSites[0];
    if (!firstColo) return;
    const sourceValue = tech[field][firstColo.id] || 0;
    const newValues: Record<string, number> = {};
    coloSites.forEach((c) => { newValues[c.id] = sourceValue; });
    onChange({ ...tech, [field]: newValues });
  };

  const copyEntireColoFrom = (sourceColoId: string, targetColoId: string) => {
    onChange({
      ...tech,
      installLaborHours: { ...tech.installLaborHours, [targetColoId]: tech.installLaborHours[sourceColoId] || 0 },
      equipmentCost: { ...tech.equipmentCost, [targetColoId]: tech.equipmentCost[sourceColoId] || 0 },
      pmTrips: { ...tech.pmTrips, [targetColoId]: tech.pmTrips[sourceColoId] || 0 },
    });
  };

  const updateField = (field: "installLaborHours" | "equipmentCost", coloId: string, value: number) => {
    onChange({ ...tech, [field]: { ...tech[field], [coloId]: value } });
  };

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border/50 header-gradient-accent flex items-center gap-2.5">
        <div className={`h-2 w-2 rounded-full ${dotColor}`} />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label} &mdash; Input Values
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-card">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-10">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground min-w-[240px]">Description</th>
              {coloSites.map((colo) => (
                <th key={colo.id} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground min-w-[140px]">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                        {colo.name}
                        <ChevronDown className="h-2.5 w-2.5 opacity-40" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center">
                      <DropdownMenuLabel className="text-xs">Copy values from</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {coloSites.filter((c) => c.id !== colo.id).map((source) => (
                        <DropdownMenuItem key={source.id} onClick={() => copyEntireColoFrom(source.id, colo.id)}>
                          {source.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </th>
              ))}
              <th className="px-2 py-2 w-14"></th>
            </tr>
          </thead>
          <tbody>
            {/* Install */}
            <tr>
              <td colSpan={coloSites.length + 3} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 bg-secondary/40 border-y border-border/20">
                Install
              </td>
            </tr>
            <tr className="border-t border-border/25 group hover:bg-accent/30 transition-colors">
              <td className="px-3 py-1"></td>
              <td className="px-3 py-1 text-xs text-muted-foreground text-right pr-4">Install Hours</td>
              {coloSites.map((colo) => (
                <td key={colo.id} className="px-2 py-1 text-center">
                  <ValueInput value={tech.installLaborHours[colo.id] || 0} onChange={(val) => updateField("installLaborHours", colo.id, val)} />
                </td>
              ))}
              <td className="px-1 py-1">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <CopyBtn onClick={() => copyFieldToAll("installLaborHours")} label={`Copy ${coloSites[0]?.name || "first"} to all`} />
                </div>
              </td>
            </tr>

            {/* Equipment */}
            <tr>
              <td colSpan={coloSites.length + 3} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 bg-secondary/40 border-y border-border/20">
                Equipment
              </td>
            </tr>
            <tr className="border-t border-border/25 group hover:bg-accent/30 transition-colors">
              <td className="px-3 py-1"></td>
              <td className="px-3 py-1 text-xs text-muted-foreground text-right pr-4">$&apos;s</td>
              {coloSites.map((colo) => (
                <td key={colo.id} className="px-2 py-1 text-center">
                  <ValueInput value={tech.equipmentCost[colo.id] || 0} onChange={(val) => updateField("equipmentCost", colo.id, val)} />
                </td>
              ))}
              <td className="px-1 py-1">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <CopyBtn onClick={() => copyFieldToAll("equipmentCost")} label={`Copy ${coloSites[0]?.name || "first"} to all`} />
                </div>
              </td>
            </tr>

          </tbody>
        </table>
      </div>
    </div>
  );
}
