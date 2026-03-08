"use client";

import type { Schedule } from "@/types";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/calculations";

interface Props {
  schedule: Schedule;
  onChange: (schedule: Schedule) => void;
}

export function ScheduleTable({ schedule, onChange }: Props) {
  return (
    <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card">
      <div className="px-3 py-2 border-b border-border/50 header-gradient">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Schedule</h3>
      </div>
      <div className="divide-y divide-border/30">
        <div className="flex items-center justify-between py-2 px-3">
          <span className="text-sm text-muted-foreground"># of Guys</span>
          <Input
            type="number"
            step="1"
            value={schedule.numberOfGuys}
            onChange={(e) =>
              onChange({ ...schedule, numberOfGuys: parseFloat(e.target.value) || 0 })
            }
            className="h-7 w-20 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
          />
        </div>
        <div className="flex items-center justify-between py-2 px-3">
          <span className="text-sm text-muted-foreground">DAS Install Weeks</span>
          <span className="text-sm font-mono tabular-nums">{formatNumber(schedule.dasInstallWeeks)}</span>
        </div>
        <div className="flex items-center justify-between py-2 px-3">
          <span className="text-sm text-muted-foreground">PS Install Weeks</span>
          <span className="text-sm font-mono tabular-nums">{formatNumber(schedule.psInstallWeeks)}</span>
        </div>
        <div className="flex items-center justify-between py-2 px-3">
          <span className="text-sm text-muted-foreground">ROIP Install Weeks</span>
          <span className="text-sm font-mono tabular-nums">{formatNumber(schedule.roipInstallWeeks)}</span>
        </div>
      </div>
    </div>
  );
}
