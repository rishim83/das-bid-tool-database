"use client";

import type { InputParameters } from "@/types";
import { Input } from "@/components/ui/input";

interface Props {
  params: InputParameters;
  onChange: (params: InputParameters) => void;
}

function ParamRow({
  label,
  value,
  prefix,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
        <Input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

export function InputParametersTable({ params, onChange }: Props) {
  const update = (field: keyof InputParameters, value: number) => {
    onChange({ ...params, [field]: value });
  };

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card">
      <div className="px-3 py-2 border-b border-border/50 header-gradient">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Input Parameters</h3>
      </div>
      <div className="divide-y divide-border/30">
        <ParamRow label="Mark Up" value={params.markUp} onChange={(v) => update("markUp", v)} />
        <ParamRow label="Hourly Rate" value={params.hourlyRate} prefix="$" suffix="Union" onChange={(v) => update("hourlyRate", v)} />
        <ParamRow label="Travel/day" value={params.travelPerDay} prefix="$" onChange={(v) => update("travelPerDay", v)} />
        <ParamRow label="Material Safety" value={params.materialSafety} onChange={(v) => update("materialSafety", v)} />
        <ParamRow label="Labor Safety" value={params.laborSafety} onChange={(v) => update("laborSafety", v)} />
        <ParamRow label="PM on Job" value={params.pmOnJob * 100} suffix="%" onChange={(v) => update("pmOnJob", v / 100)} />
        <ParamRow label="PM Hourly Rate" value={params.pmHourlyRate} prefix="$" onChange={(v) => update("pmHourlyRate", v)} />
      </div>
    </div>
  );
}
