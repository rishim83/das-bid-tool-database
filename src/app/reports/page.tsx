"use client";

import { useEffect, useState, useMemo } from "react";
import type { Project } from "@/types";
import { loadProjects } from "@/lib/storage";
import { formatCurrency } from "@/lib/calculations";
import { TECHNOLOGY_DOT } from "@/lib/constants";
import {
  getCostBreakdownByCategory,
  getColoComparison,
  getTechnologyMix,
  getLaborMaterialRatio,
  getPMTravelBreakdown,
  getPortfolioOverview,
  getProjectQuotes,
  getFinancialPL,
  type CostBreakdown,
  type ColoBreakdown,
  type TechBreakdown,
  type LaborMaterialRatio,
  type PMTravelBreakdown,
  type ProjectOverview,
  type FinancialPL,
} from "@/lib/report-analytics";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, ArrowRight } from "lucide-react";
import Link from "next/link";

// ─── Horizontal Bar ─────────────────────────────────────────────

function HBar({
  value,
  max,
  color = "bg-primary",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-2 w-full rounded-full bg-secondary/60 overflow-hidden">
      <div
        className={`h-full rounded-full ${color} transition-all duration-500`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

// ─── Stacked Percentage Bar ─────────────────────────────────────

function StackedBar({
  segments,
}: {
  segments: { pct: number; color: string; label: string }[];
}) {
  return (
    <div className="h-3 w-full rounded-full bg-secondary/60 overflow-hidden flex">
      {segments
        .filter((s) => s.pct > 0)
        .map((s) => (
          <div
            key={s.label}
            className={`h-full ${s.color} transition-all duration-500`}
            style={{ width: `${s.pct}%` }}
            title={`${s.label}: ${s.pct.toFixed(1)}%`}
          />
        ))}
    </div>
  );
}

// ─── Report Card Shell ──────────────────────────────────────────

function ReportCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card">
      <div className="px-4 py-3 border-b border-border/50 header-gradient">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">{subtitle}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Report 1: Cost Breakdown by Category ───────────────────────

function CostBreakdownReport({ data }: { data: CostBreakdown[] }) {
  const max = Math.max(...data.map((d) => d.amount));
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-cyan-500",
    "bg-amber-500",
    "bg-violet-500",
    "bg-rose-500",
  ];

  return (
    <ReportCard
      title="Cost Breakdown by Category"
      subtitle="Where your money goes across all technologies"
    >
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={item.category}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{item.category}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground/60">
                  {item.percentage.toFixed(1)}%
                </span>
                <span className="text-xs font-mono tabular-nums font-medium">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            </div>
            <HBar value={item.amount} max={max} color={colors[i]} />
          </div>
        ))}
      </div>
    </ReportCard>
  );
}

// ─── Report 2: COLO Site Comparison ─────────────────────────────

function ColoComparisonReport({ data }: { data: ColoBreakdown[] }) {
  const max = Math.max(...data.map((d) => d.totalCost), 1);

  return (
    <ReportCard
      title="COLO Site Comparison"
      subtitle="Cost distribution across all colocation sites"
    >
      <div className="space-y-3">
        {data.map((colo) => (
          <div key={colo.id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">{colo.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground/60">
                  {colo.percentage.toFixed(1)}%
                </span>
                <span className="text-xs font-mono tabular-nums font-medium">
                  {formatCurrency(colo.totalCost)}
                </span>
              </div>
            </div>
            <StackedBar
              segments={colo.technologies.map((t) => ({
                pct: colo.totalCost > 0 ? (t.cost / max) * 100 : 0,
                color:
                  t.type === "DAS"
                    ? "bg-blue-500"
                    : t.type === "PUBLIC_SAFETY"
                    ? "bg-emerald-500"
                    : "bg-cyan-500",
                label: t.label,
              }))}
            />
            <div className="flex gap-3 mt-1">
              {colo.technologies
                .filter((t) => t.cost > 0)
                .map((t) => (
                  <span key={t.type} className="text-[10px] text-muted-foreground/50">
                    {t.label}: {formatCurrency(t.cost)}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>
    </ReportCard>
  );
}

// ─── Report 3: Technology Mix ───────────────────────────────────

function TechMixReport({ data }: { data: TechBreakdown[] }) {
  const total = data.reduce((s, d) => s + d.totalCost, 0);
  const colors: Record<string, string> = {
    DAS: "bg-blue-400 shadow-[0_0_6px_oklch(0.62_0.18_255/0.4)]",
    PUBLIC_SAFETY: "bg-emerald-400 shadow-[0_0_6px_oklch(0.62_0.17_162/0.4)]",
    ROIP: "bg-cyan-400 shadow-[0_0_6px_oklch(0.70_0.12_200/0.4)]",
  };

  return (
    <ReportCard
      title="Technology Mix"
      subtitle="DAS vs Public Safety vs ROIP cost share"
    >
      {/* Donut-style visual using stacked bar */}
      <div className="mb-4">
        <StackedBar
          segments={data.map((d) => ({
            pct: d.percentage,
            color:
              d.type === "DAS"
                ? "bg-blue-500"
                : d.type === "PUBLIC_SAFETY"
                ? "bg-emerald-500"
                : "bg-cyan-500",
            label: d.label,
          }))}
        />
      </div>

      <div className="space-y-2.5">
        {data.map((item) => (
          <div
            key={item.type}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${colors[item.type]}`} />
              <span className="text-sm">{item.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {item.percentage.toFixed(1)}%
              </span>
              <span className="font-mono text-sm tabular-nums font-medium">
                {formatCurrency(item.totalCost)}
              </span>
            </div>
          </div>
        ))}
        <div className="border-t border-border/30 pt-2 flex items-center justify-between">
          <span className="text-sm font-semibold">Total</span>
          <span className="font-mono text-sm tabular-nums font-bold">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </ReportCard>
  );
}

// ─── Report 4: Labor vs Materials ───────────────────────────────

function LaborMaterialReport({ data }: { data: LaborMaterialRatio }) {
  const total = data.laborCost + data.materialCost + data.travelCost;

  return (
    <ReportCard
      title="Labor vs Materials vs Travel"
      subtitle="Understanding your cost drivers"
    >
      <div className="mb-4">
        <StackedBar
          segments={[
            { pct: data.laborPct, color: "bg-blue-500", label: "Labor" },
            { pct: data.materialPct, color: "bg-amber-500", label: "Materials" },
            { pct: data.travelPct, color: "bg-violet-500", label: "Travel" },
          ]}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-[11px] text-muted-foreground">Labor</span>
          </div>
          <p className="font-mono text-sm tabular-nums font-medium">
            {formatCurrency(data.laborCost)}
          </p>
          <p className="text-[11px] text-muted-foreground/60">
            {data.laborPct.toFixed(1)}%
          </p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-[11px] text-muted-foreground">Materials</span>
          </div>
          <p className="font-mono text-sm tabular-nums font-medium">
            {formatCurrency(data.materialCost)}
          </p>
          <p className="text-[11px] text-muted-foreground/60">
            {data.materialPct.toFixed(1)}%
          </p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <div className="h-2 w-2 rounded-full bg-violet-500" />
            <span className="text-[11px] text-muted-foreground">Travel</span>
          </div>
          <p className="font-mono text-sm tabular-nums font-medium">
            {formatCurrency(data.travelCost)}
          </p>
          <p className="text-[11px] text-muted-foreground/60">
            {data.travelPct.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border/30 flex justify-between items-center">
        <span className="text-xs text-muted-foreground">Total project cost</span>
        <span className="font-mono text-sm tabular-nums font-bold">
          {formatCurrency(total)}
        </span>
      </div>
    </ReportCard>
  );
}

// ─── Report 5: PM & Travel Overhead ─────────────────────────────

function PMOverheadReport({
  data,
  grandTotal,
}: {
  data: PMTravelBreakdown;
  grandTotal: number;
}) {
  const max = Math.max(data.pmLabor, data.pmTravel, data.installTravel, 1);

  return (
    <ReportCard
      title="PM & Travel Overhead"
      subtitle="Project management and travel cost analysis"
    >
      <div className="space-y-3">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-muted-foreground">PM Labor</span>
            <span className="text-xs font-mono tabular-nums font-medium">
              {formatCurrency(data.pmLabor)}
            </span>
          </div>
          <HBar value={data.pmLabor} max={max} color="bg-blue-500" />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-muted-foreground">PM Travel</span>
            <span className="text-xs font-mono tabular-nums font-medium">
              {formatCurrency(data.pmTravel)}
            </span>
          </div>
          <HBar value={data.pmTravel} max={max} color="bg-violet-500" />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-muted-foreground">Install Travel</span>
            <span className="text-xs font-mono tabular-nums font-medium">
              {formatCurrency(data.installTravel)}
            </span>
          </div>
          <HBar value={data.installTravel} max={max} color="bg-rose-500" />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/30 space-y-1.5">
        <div className="flex justify-between">
          <span className="text-xs text-muted-foreground">Total overhead</span>
          <span className="font-mono text-sm tabular-nums font-semibold">
            {formatCurrency(data.totalOverhead)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-muted-foreground">% of project cost</span>
          <span className="font-mono text-sm tabular-nums text-primary font-semibold">
            {data.overheadPct.toFixed(1)}%
          </span>
        </div>
      </div>
    </ReportCard>
  );
}

// ─── Report 6: Portfolio Overview ───────────────────────────────

function PortfolioReport({ data }: { data: ProjectOverview[] }) {
  const totalValue = data.reduce((s, d) => s + d.totalCost, 0);
  const avgCost = data.length > 0 ? totalValue / data.length : 0;
  const max = Math.max(...data.map((d) => d.totalCost), 1);

  return (
    <ReportCard
      title="Portfolio Overview"
      subtitle="Cross-project comparison of all bids"
    >
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-border/30">
        <div className="text-center">
          <p className="text-[11px] text-muted-foreground mb-0.5">Total Projects</p>
          <p className="font-mono text-lg tabular-nums font-bold">{data.length}</p>
        </div>
        <div className="text-center">
          <p className="text-[11px] text-muted-foreground mb-0.5">Portfolio Value</p>
          <p className="font-mono text-sm tabular-nums font-bold">
            {formatCurrency(totalValue)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[11px] text-muted-foreground mb-0.5">Avg per Project</p>
          <p className="font-mono text-sm tabular-nums font-bold">
            {formatCurrency(avgCost)}
          </p>
        </div>
      </div>

      {/* Project List */}
      <div className="space-y-2.5">
        {data
          .sort((a, b) => b.totalCost - a.totalCost)
          .map((p) => (
            <div key={p.id}>
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0 flex-1 mr-3">
                  <Link
                    href={`/project/${p.id}`}
                    className="text-xs font-medium hover:text-primary transition-colors truncate block"
                  >
                    {p.name}
                  </Link>
                  <div className="flex gap-2 text-[10px] text-muted-foreground/50">
                    {p.client && <span>{p.client}</span>}
                    <span>{p.techCount} tech</span>
                    <span>{p.coloCount} COLOs</span>
                    <span>{p.dominantTech}</span>
                  </div>
                </div>
                <span className="text-xs font-mono tabular-nums font-medium shrink-0">
                  {formatCurrency(p.totalCost)}
                </span>
              </div>
              <HBar value={p.totalCost} max={max} color="bg-primary" />
            </div>
          ))}
      </div>
    </ReportCard>
  );
}

// ─── Report 7: Financial P&L / Margin Analysis ─────────────────

function FinancialPLReport({ data }: { data: FinancialPL }) {
  return (
    <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card lg:col-span-2">
      <div className="px-4 py-3 border-b border-border/50 header-gradient-accent">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Financial P&L / Margin Analysis
        </h2>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
          Revenue, direct costs, gross profit, and markup impact
        </p>
      </div>
      <div className="p-4">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-4 gap-4 mb-5 pb-5 border-b border-border/30">
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground mb-1">Revenue (Quote Price)</p>
            <p className="font-mono text-base tabular-nums font-bold">
              {formatCurrency(data.revenue)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground mb-1">Direct Costs</p>
            <p className="font-mono text-base tabular-nums font-bold text-rose-400">
              {formatCurrency(data.totalDirectCosts)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground mb-1">Gross Profit</p>
            <p className={`font-mono text-base tabular-nums font-bold ${data.grossProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {formatCurrency(data.grossProfit)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground mb-1">Gross Margin</p>
            <p className={`font-mono text-xl tabular-nums font-bold ${data.grossMarginPct >= 20 ? "text-emerald-400" : data.grossMarginPct >= 10 ? "text-amber-400" : "text-rose-400"}`}>
              {data.grossMarginPct.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* P&L Statement */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
              Profit & Loss Statement
            </h3>
            <div className="space-y-0">
              {/* Revenue */}
              <div className="flex justify-between py-1.5 border-b border-border/20">
                <span className="text-xs font-semibold">Revenue</span>
                <span className="text-xs font-mono tabular-nums font-bold">
                  {formatCurrency(data.revenue)}
                </span>
              </div>

              {/* COGS */}
              <div className="py-1 pl-3">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1 mt-1">Cost of Goods Sold</p>
              </div>
              <PLLine label="RF Engineering (direct)" amount={data.directRFCost} indent />
              <PLLine label="Install Labor (direct)" amount={data.directInstallLabor} indent />
              <PLLine label="Equipment & Materials (direct)" amount={data.directEquipment} indent />
              <PLLine label="PM Labor" amount={data.directPM} indent />
              <PLLine label="PM Travel" amount={data.directPMTravel} indent />
              <PLLine label="Install Travel" amount={data.directInstallTravel} indent />

              <div className="flex justify-between py-1.5 border-t border-border/40 bg-secondary/20 px-2 -mx-2 rounded">
                <span className="text-xs font-semibold">Total Direct Costs</span>
                <span className="text-xs font-mono tabular-nums font-semibold text-rose-400">
                  ({formatCurrency(data.totalDirectCosts)})
                </span>
              </div>

              {/* Gross Profit */}
              <div className="flex justify-between py-2 border-t-2 border-primary/20 mt-1">
                <span className="text-sm font-bold">Gross Profit</span>
                <span className={`text-sm font-mono tabular-nums font-bold ${data.grossProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {formatCurrency(data.grossProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* Margin & Markup Analysis */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
              Markup & Safety Impact
            </h3>

            {/* Markup metrics */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="border border-border/30 rounded-md p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Avg Markup Multiplier</p>
                <p className="font-mono text-lg tabular-nums font-bold text-primary">
                  {data.markupMultiplier.toFixed(2)}x
                </p>
              </div>
              <div className="border border-border/30 rounded-md p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Effective Markup %</p>
                <p className="font-mono text-lg tabular-nums font-bold text-primary">
                  {data.effectiveMarkupPct.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Safety/Markup breakdown */}
            <div className="space-y-2">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Markup added (RF + Equip)</span>
                  <span className="text-xs font-mono tabular-nums font-medium text-emerald-400">
                    +{formatCurrency(data.markupAdded)}
                  </span>
                </div>
                <HBar value={data.markupAdded} max={data.totalSafetyMarkupAdded || 1} color="bg-emerald-500" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Labor safety added</span>
                  <span className="text-xs font-mono tabular-nums font-medium text-blue-400">
                    +{formatCurrency(data.laborSafetyAdded)}
                  </span>
                </div>
                <HBar value={data.laborSafetyAdded} max={data.totalSafetyMarkupAdded || 1} color="bg-blue-500" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Material safety added</span>
                  <span className="text-xs font-mono tabular-nums font-medium text-amber-400">
                    +{formatCurrency(data.materialSafetyAdded)}
                  </span>
                </div>
                <HBar value={data.materialSafetyAdded} max={data.totalSafetyMarkupAdded || 1} color="bg-amber-500" />
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border/30 flex justify-between">
              <span className="text-xs text-muted-foreground">Total safety + markup</span>
              <span className="font-mono text-sm tabular-nums font-bold text-emerald-400">
                +{formatCurrency(data.totalSafetyMarkupAdded)}
              </span>
            </div>

            {/* Per-Technology Margins */}
            {data.techPL.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/30">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">
                  Margin by Technology
                </p>
                <div className="space-y-1.5">
                  {data.techPL.map((t) => (
                    <div key={t.type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${TECHNOLOGY_DOT[t.type]}`} />
                        <span className="text-xs">{t.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-muted-foreground">
                          {formatCurrency(t.grossProfit)} profit
                        </span>
                        <span className={`text-xs font-mono tabular-nums font-semibold ${t.marginPct >= 20 ? "text-emerald-400" : t.marginPct >= 10 ? "text-amber-400" : "text-rose-400"}`}>
                          {t.marginPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PLLine({ label, amount, indent }: { label: string; amount: number; indent?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${indent ? "pl-3" : ""}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono tabular-nums">
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

// ─── Project Selector ───────────────────────────────────────────

function ProjectSelector({
  projects,
  selectedId,
  onSelect,
}: {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => onSelect(null)}
        className={`h-7 px-3 rounded-md text-xs transition-all ${
          selectedId === null
            ? "bg-primary text-primary-foreground font-medium"
            : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        All Projects
      </button>
      {projects.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={`h-7 px-3 rounded-md text-xs transition-all truncate max-w-[200px] ${
            selectedId === p.id
              ? "bg-primary text-primary-foreground font-medium"
              : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

// ─── Main Reports Page ──────────────────────────────────────────

export default function ReportsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const all = loadProjects();
    setProjects(all);
    setLoading(false);
  }, []);

  // Determine which project(s) to analyze
  const targetProjects = useMemo(() => {
    if (selectedProjectId) {
      const found = projects.find((p) => p.id === selectedProjectId);
      return found ? [found] : [];
    }
    return projects;
  }, [projects, selectedProjectId]);

  // Aggregate quotes across all target projects
  const allQuotes = useMemo(
    () => targetProjects.flatMap((p) => getProjectQuotes(p)),
    [targetProjects]
  );

  // Aggregate colo sites (from selected project, or first project, or empty)
  const coloSites = useMemo(() => {
    if (selectedProjectId) {
      const p = projects.find((pr) => pr.id === selectedProjectId);
      return p?.coloSites || [];
    }
    // For "all projects" — show per-project data in portfolio, skip colo comparison
    return projects.length === 1 ? projects[0].coloSites : [];
  }, [projects, selectedProjectId]);

  // Compute all reports
  const costBreakdown = useMemo(() => getCostBreakdownByCategory(allQuotes), [allQuotes]);
  const coloComparison = useMemo(() => getColoComparison(allQuotes, coloSites), [allQuotes, coloSites]);
  const techMix = useMemo(() => getTechnologyMix(allQuotes), [allQuotes]);
  const laborMaterial = useMemo(() => getLaborMaterialRatio(allQuotes), [allQuotes]);
  const pmOverhead = useMemo(() => getPMTravelBreakdown(allQuotes), [allQuotes]);
  const portfolio = useMemo(() => getPortfolioOverview(projects), [projects]);
  const financialPL = useMemo(() => getFinancialPL(targetProjects), [targetProjects]);

  const grandTotal = allQuotes.reduce((s, q) => s + q.totalCost, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading reports...</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                <ArrowLeft className="h-3 w-3 mr-1" /> Home
              </Button>
            </Link>
          </div>
          <div className="border border-dashed border-border/50 rounded-lg py-16 flex flex-col items-center text-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground/20 mb-4" />
            <p className="text-sm text-muted-foreground mb-1">No projects to analyze</p>
            <p className="text-xs text-muted-foreground/60 mb-4">
              Create a project first to see reports and insights.
            </p>
            <Link href="/">
              <Button size="sm" className="h-8 text-xs">
                Go to Projects <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/60 bg-background/85 backdrop-blur-xl backdrop-saturate-150 sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                <ArrowLeft className="h-3 w-3 mr-1" /> Home
              </Button>
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h1 className="text-sm font-semibold">Reports & Insights</h1>
            </div>
          </div>
          <div className="font-mono text-sm tabular-nums font-semibold">
            {formatCurrency(grandTotal)}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-5 space-y-5">
        {/* Project Selector */}
        <div className="border border-border/60 rounded-lg px-4 py-3 bg-card/50">
          <p className="text-[11px] text-muted-foreground/60 mb-2 uppercase tracking-wider font-medium">
            Analyze
          </p>
          <ProjectSelector
            projects={projects}
            selectedId={selectedProjectId}
            onSelect={setSelectedProjectId}
          />
        </div>

        {/* Financial P&L — full-width */}
        <FinancialPLReport data={financialPL} />

        {/* Report Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Report 1: Cost Breakdown */}
          <CostBreakdownReport data={costBreakdown} />

          {/* Report 3: Technology Mix */}
          {techMix.length > 0 && <TechMixReport data={techMix} />}

          {/* Report 4: Labor vs Materials */}
          <LaborMaterialReport data={laborMaterial} />

          {/* Report 5: PM Overhead */}
          <PMOverheadReport data={pmOverhead} grandTotal={grandTotal} />

          {/* Report 2: COLO Comparison (only when single project selected or 1 project) */}
          {coloSites.length > 0 && coloComparison.length > 0 && (
            <ColoComparisonReport data={coloComparison} />
          )}

          {/* Report 6: Portfolio (always visible) */}
          <PortfolioReport data={portfolio} />
        </div>
      </div>
    </div>
  );
}
