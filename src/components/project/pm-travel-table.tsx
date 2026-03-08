"use client";

import type { PMTravelEstimate, PMTravelCalculated } from "@/types";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/calculations";

interface Props {
  travel: PMTravelEstimate;
  calculated: PMTravelCalculated;
  onChange: (travel: PMTravelEstimate) => void;
}

export function PMTravelTable({ travel, calculated, onChange }: Props) {
  const update = (field: keyof PMTravelEstimate, value: number) => {
    onChange({ ...travel, [field]: value });
  };

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card">
      <div className="px-3 py-2 border-b border-border/50 header-gradient">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PM Travel Estimate</h3>
      </div>
      <div className="divide-y divide-border/30">
        <div className="flex items-center justify-between py-2 px-3">
          <span className="text-sm text-muted-foreground">Days/trip</span>
          <Input
            type="number"
            step="1"
            value={travel.daysPerTrip}
            onChange={(e) => update("daysPerTrip", parseFloat(e.target.value) || 0)}
            className="h-7 w-20 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
          />
        </div>
        <div className="flex items-center justify-between py-2 px-3">
          <span className="text-sm text-muted-foreground">Flight</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">$</span>
            <Input
              type="number"
              step="any"
              value={travel.flight}
              onChange={(e) => update("flight", parseFloat(e.target.value) || 0)}
              className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
            />
          </div>
        </div>
        <div className="flex items-center justify-between py-2 px-3">
          <span className="text-sm text-muted-foreground">Hotel</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">$</span>
            <Input
              type="number"
              step="any"
              value={travel.hotelPerDay}
              onChange={(e) => update("hotelPerDay", parseFloat(e.target.value) || 0)}
              className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
            />
            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              = {formatCurrency(calculated.hotel)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between py-2 px-3">
          <span className="text-sm text-muted-foreground">Car Rental</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">$</span>
            <Input
              type="number"
              step="any"
              value={travel.carRentalPerDay}
              onChange={(e) => update("carRentalPerDay", parseFloat(e.target.value) || 0)}
              className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
            />
            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              = {formatCurrency(calculated.carRental)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between py-2 px-3">
          <span className="text-sm text-muted-foreground">Per Diem</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">$</span>
            <Input
              type="number"
              step="any"
              value={travel.perDiemPerDay}
              onChange={(e) => update("perDiemPerDay", parseFloat(e.target.value) || 0)}
              className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
            />
            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              = {formatCurrency(calculated.perDiem)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between py-2.5 px-3 total-row-gradient">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-sm font-mono tabular-nums font-bold text-foreground">
            {formatCurrency(calculated.totalPerTrip)}
          </span>
        </div>
      </div>
    </div>
  );
}
