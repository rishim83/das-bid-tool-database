"use client";

import { v4 as uuid } from "uuid";
import type {
  TechnologyConfig,
  SubContractor,
  RentalEquipmentItem,
  AdditionalMaterialItem,
} from "@/types";
import { DEFAULT_RENTAL_EQUIPMENT } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { TECHNOLOGY_LABELS, TECHNOLOGY_DOT } from "@/lib/constants";
import { formatCurrency } from "@/lib/calculations";

interface Props {
  technologies: TechnologyConfig[]; // only enabled techs
  onChange: (updatedTech: TechnologyConfig) => void;
}

// ─── Column component ─────────────────────────────────────────────

function TechColumn({ tech, onChange }: { tech: TechnologyConfig; onChange: (t: TechnologyConfig) => void }) {
  const rental = tech.rentalEquipment ?? DEFAULT_RENTAL_EQUIPMENT;
  const subs = tech.subContractors ?? [];
  const additionalLabor = tech.additionalLaborItems ?? [];
  const additionalMaterials = tech.additionalMaterials ?? [];

  // Helpers
  const update = (patch: Partial<TechnologyConfig>) => onChange({ ...tech, ...patch });

  // Additional Labor
  const addLaborItem = () =>
    update({ additionalLaborItems: [...additionalLabor, { id: uuid(), description: "", hours: 0 }] });
  const updateLaborItem = (id: string, field: "description" | "hours", value: string | number) =>
    update({
      additionalLaborItems: additionalLabor.map((i) =>
        i.id === id ? { ...i, [field]: value } : i
      ),
    });
  const removeLaborItem = (id: string) =>
    update({ additionalLaborItems: additionalLabor.filter((i) => i.id !== id) });

  // SubContractors
  const addSub = () =>
    update({ subContractors: [...subs, { id: uuid(), task: "", value: 0 }] });
  const updateSub = (id: string, field: keyof SubContractor, value: string | number) =>
    update({
      subContractors: subs.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    });
  const removeSub = (id: string) =>
    update({ subContractors: subs.filter((s) => s.id !== id) });

  // Additional Materials
  const addMaterialItem = () =>
    update({ additionalMaterials: [...additionalMaterials, { id: uuid(), name: "", value: 0 }] });
  const updateMaterialItem = (id: string, field: keyof AdditionalMaterialItem, value: string | number) =>
    update({
      additionalMaterials: additionalMaterials.map((m) =>
        m.id === id ? { ...m, [field]: value } : m
      ),
    });
  const removeMaterialItem = (id: string) =>
    update({ additionalMaterials: additionalMaterials.filter((m) => m.id !== id) });

  // Rental Equipment - Lift
  const updateLift = (field: "numberOfLifts" | "months" | "costPerMonth" | "includeLiftAdder", value: number | boolean) =>
    update({ rentalEquipment: { ...rental, lift: { ...rental.lift, [field]: value } } });

  // Rental Equipment - Additional Items
  const addRentalItem = () =>
    update({
      rentalEquipment: {
        ...rental,
        additionalItems: [
          ...(rental.additionalItems ?? []),
          { id: uuid(), name: "", months: 0, costPerMonth: 0 },
        ],
      },
    });
  const updateRentalItem = (id: string, field: keyof RentalEquipmentItem, value: string | number) =>
    update({
      rentalEquipment: {
        ...rental,
        additionalItems: (rental.additionalItems ?? []).map((item) =>
          item.id === id ? { ...item, [field]: value } : item
        ),
      },
    });
  const removeRentalItem = (id: string) =>
    update({
      rentalEquipment: {
        ...rental,
        additionalItems: (rental.additionalItems ?? []).filter((item) => item.id !== id),
      },
    });

  const liftTotal = (rental.lift.numberOfLifts ?? 1) * rental.lift.months * rental.lift.costPerMonth;
  const addlTotal = (rental.additionalItems ?? []).reduce(
    (s, i) => s + i.months * i.costPerMonth,
    0
  );
  const rentalTotal = liftTotal + addlTotal;

  return (
    <div className="flex flex-col gap-4 min-w-0">
      {/* ── Tech header ─────────────────────── */}
      <div className="flex items-center gap-1.5 pb-1 border-b border-border/40">
        <div className={`h-2 w-2 rounded-full ${TECHNOLOGY_DOT[tech.type]}`} />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {TECHNOLOGY_LABELS[tech.type]}
        </span>
      </div>

      {/* ── Material Handling ───────────────── */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground/70 shrink-0">Material Handling</p>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            step="any"
            min={0}
            value={tech.materialHandlingHours}
            onChange={(e) => update({ materialHandlingHours: parseFloat(e.target.value) || 0 })}
            className="h-7 w-20 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
          />
          <span className="text-xs text-muted-foreground shrink-0">hrs</span>
        </div>
      </div>

      {/* ── Commissioning Support ───────────── */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground/70 shrink-0">Commissioning Support</p>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            step="any"
            min={0}
            value={tech.commissioningSupport}
            onChange={(e) => update({ commissioningSupport: parseFloat(e.target.value) || 0 })}
            className="h-7 w-20 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
          />
          <span className="text-xs text-muted-foreground shrink-0">hrs</span>
        </div>
      </div>

      {/* ── Water & Ice ─────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground/70 shrink-0">Water &amp; Ice</p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground shrink-0">$</span>
          <Input
            type="number"
            step="any"
            min={0}
            value={tech.waterAndIce ?? 0}
            onChange={(e) => update({ waterAndIce: parseFloat(e.target.value) || 0 })}
            className="h-7 w-20 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
          />
        </div>
      </div>

      {/* ── Additional Labor ────────────────── */}
      <div>
        <p className="text-xs text-muted-foreground/70 mb-1 px-0.5">Additional Labor</p>
        <div className="flex flex-col gap-1">
          {additionalLabor.map((item) => (
            <div key={item.id} className="flex items-center gap-1.5">
              <Input
                value={item.description}
                onChange={(e) => updateLaborItem(item.id, "description", e.target.value)}
                placeholder="Description"
                className="h-7 flex-1 bg-input/40 border-border/50 text-sm rounded-md"
              />
              <Input
                type="number"
                step="any"
                min={0}
                value={item.hours}
                onChange={(e) => updateLaborItem(item.id, "hours", parseFloat(e.target.value) || 0)}
                className="h-7 w-16 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
              />
              <span className="text-xs text-muted-foreground shrink-0">hrs</span>
              <button
                onClick={() => removeLaborItem(item.id)}
                className="h-5 w-5 flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground border border-dashed border-border/50 hover:border-primary/40 hover:text-primary transition-colors w-full mt-0.5"
            onClick={addLaborItem}
          >
            <Plus className="h-3 w-3 mr-1" /> Add Labor
          </Button>
        </div>
      </div>

      {/* ── Additional Materials ─────────────── */}
      <div>
        <p className="text-xs text-muted-foreground/70 mb-1 px-0.5">Additional Materials</p>
        <div className="flex flex-col gap-1">
          {additionalMaterials.map((item) => (
            <div key={item.id} className="flex items-center gap-1.5">
              <Input
                value={item.name}
                onChange={(e) => updateMaterialItem(item.id, "name", e.target.value)}
                placeholder="Material name"
                className="h-7 flex-1 bg-input/40 border-border/50 text-sm rounded-md"
              />
              <span className="text-xs text-muted-foreground shrink-0">$</span>
              <Input
                type="number"
                step="any"
                min={0}
                value={item.value}
                onChange={(e) => updateMaterialItem(item.id, "value", parseFloat(e.target.value) || 0)}
                className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
              />
              <button
                onClick={() => removeMaterialItem(item.id)}
                className="h-5 w-5 flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground border border-dashed border-border/50 hover:border-primary/40 hover:text-primary transition-colors w-full mt-0.5"
            onClick={addMaterialItem}
          >
            <Plus className="h-3 w-3 mr-1" /> Add Additional Materials
          </Button>
        </div>
      </div>

      {/* ── Subcontractors ──────────────────── */}
      <div>
        <p className="text-xs text-muted-foreground/70 mb-1 px-0.5">Subcontractors</p>
        <div className="flex flex-col gap-1">
          {subs.map((sub) => (
            <div key={sub.id} className="flex items-center gap-1.5">
              <Input
                value={sub.task}
                onChange={(e) => updateSub(sub.id, "task", e.target.value)}
                placeholder="Task"
                className="h-7 flex-1 bg-input/40 border-border/50 text-sm rounded-md"
              />
              <span className="text-xs text-muted-foreground shrink-0">$</span>
              <Input
                type="number"
                step="any"
                min={0}
                value={sub.value}
                onChange={(e) => updateSub(sub.id, "value", parseFloat(e.target.value) || 0)}
                className="h-7 w-24 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
              />
              <button
                onClick={() => removeSub(sub.id)}
                className="h-5 w-5 flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground border border-dashed border-border/50 hover:border-primary/40 hover:text-primary transition-colors w-full mt-0.5"
            onClick={addSub}
          >
            <Plus className="h-3 w-3 mr-1" /> Add Subcontractor
          </Button>
        </div>
      </div>

      {/* ── Rental Equipment ────────────────── */}
      <div>
        <p className="text-xs text-muted-foreground/70 mb-1 px-0.5">
          Rental Equipment
          {rentalTotal > 0 && (
            <span className="ml-1 font-mono text-muted-foreground/50">({formatCurrency(rentalTotal)})</span>
          )}
        </p>
        <div className="flex flex-col gap-1">
          {/* Lift row */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0 w-6">Lift</span>
            <Input
              type="number"
              step="1"
              min={0}
              value={rental.lift.numberOfLifts ?? 1}
              onChange={(e) => updateLift("numberOfLifts", parseFloat(e.target.value) || 0)}
              className="h-7 w-12 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
            />
            <span className="text-xs text-muted-foreground shrink-0">×</span>
            <Input
              type="number"
              step="any"
              min={0}
              value={rental.lift.months}
              onChange={(e) => updateLift("months", parseFloat(e.target.value) || 0)}
              className="h-7 w-12 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
            />
            <span className="text-xs text-muted-foreground shrink-0">mo @</span>
            <span className="text-xs text-muted-foreground shrink-0">$</span>
            <Input
              type="number"
              step="any"
              min={0}
              value={rental.lift.costPerMonth}
              onChange={(e) => updateLift("costPerMonth", parseFloat(e.target.value) || 0)}
              className="h-7 w-20 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
            />
          </div>
          {/* Include lift adder checkbox */}
          <label className="flex items-center gap-1.5 px-0.5 cursor-pointer">
            <input
              type="checkbox"
              checked={!!rental.lift.includeLiftAdder}
              onChange={(e) => updateLift("includeLiftAdder", e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border/50 accent-primary cursor-pointer shrink-0"
            />
            <span className="text-xs text-muted-foreground">Include Lift Adder</span>
          </label>
          {/* Additional rental items */}
          {(rental.additionalItems ?? []).map((item) => (
            <div key={item.id} className="flex items-center gap-1.5">
              <Input
                value={item.name}
                onChange={(e) => updateRentalItem(item.id, "name", e.target.value)}
                placeholder="Item"
                className="h-7 flex-1 bg-input/40 border-border/50 text-sm rounded-md"
              />
              <Input
                type="number"
                step="any"
                min={0}
                value={item.months}
                onChange={(e) => updateRentalItem(item.id, "months", parseFloat(e.target.value) || 0)}
                className="h-7 w-14 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
              />
              <span className="text-xs text-muted-foreground shrink-0">mo @</span>
              <span className="text-xs text-muted-foreground shrink-0">$</span>
              <Input
                type="number"
                step="any"
                min={0}
                value={item.costPerMonth}
                onChange={(e) => updateRentalItem(item.id, "costPerMonth", parseFloat(e.target.value) || 0)}
                className="h-7 w-20 bg-input/40 border-border/50 text-right text-sm font-mono tabular-nums rounded-md"
              />
              <button
                onClick={() => removeRentalItem(item.id)}
                className="h-5 w-5 flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground border border-dashed border-border/50 hover:border-primary/40 hover:text-primary transition-colors w-full mt-0.5"
            onClick={addRentalItem}
          >
            <Plus className="h-3 w-3 mr-1" /> Add Equipment
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────

export function PerTechDetailsCard({ technologies, onChange }: Props) {
  if (technologies.length === 0) return null;

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card">
      <div className="px-3 py-2 border-b border-border/50 header-gradient">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Per-Technology Details
        </h3>
      </div>
      <div
        className="p-4 grid gap-6"
        style={{ gridTemplateColumns: `repeat(${technologies.length}, minmax(0, 1fr))` }}
      >
        {technologies.map((tech) => (
          <TechColumn key={tech.type} tech={tech} onChange={onChange} />
        ))}
      </div>
    </div>
  );
}
