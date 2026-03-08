"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { loadProject } from "@/lib/storage";
import { useProject } from "@/hooks/use-project";
import type { Project, TechnologyConfig, TechnologyType } from "@/types";
import { DEFAULT_PROJECT_SPECIFIC_DETAILS, DEFAULT_PROJECT_EXTRAS, DEFAULT_RENTAL_EQUIPMENT, DEFAULT_INPUT_PARAMETERS, DEFAULT_INSTALL_TRAVEL } from "@/types";
import { ParametersPanel } from "@/components/project/parameters-panel";
import { ColoManager } from "@/components/project/colo-manager";
import { InputValuesTable } from "@/components/project/input-values-table";
import { QuoteTable } from "@/components/project/quote-table";
import { ProjectSummary } from "@/components/project/project-summary";
import { FinancialReview, type FinancialItem } from "@/components/project/financial-review";
import { LaborSummary } from "@/components/project/labor-summary";
import { MaterialsSummary } from "@/components/project/materials-summary";
import { PerTechDetailsCard } from "@/components/project/per-tech-details-card";
import { AIEstimateDialog } from "@/components/project/ai-estimate-dialog";
import { BomImportDialog } from "@/components/project/bom-import-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TECHNOLOGY_LABELS, TECHNOLOGY_DOT } from "@/lib/constants";
import { formatCurrency } from "@/lib/calculations";
import { ArrowLeft, Check, FileDown } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

// ─── Migration: move project-level fields to per-tech ────────────────────────
function migrateProject(p: Project): Project {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacyPsd = p.projectSpecificDetails as any;
  // Fill in any inputParameters fields added after initial release
  const inputParameters = { ...DEFAULT_INPUT_PARAMETERS, ...p.inputParameters };
  // Migrate waterAndIce from legacy psd.extras to first tech (it was project-level before)
  const legacyWaterAndIce: number = legacyPsd?.extras?.waterAndIce ?? 0;
  const technologies = p.technologies.map((tech: TechnologyConfig, idx: number) => ({
    ...tech,
    materialHandlingHours: tech.materialHandlingHours ?? (legacyPsd?.materialHandlingHours ?? 0),
    commissioningSupport: tech.commissioningSupport ?? (legacyPsd?.commissioningSupport ?? 0),
    additionalLaborItems: tech.additionalLaborItems ?? (legacyPsd?.additionalLaborItems ?? []),
    subContractors: tech.subContractors ?? (idx === 0 ? (p.subContractors ?? []) : []),
    rentalEquipment: tech.rentalEquipment ?? (idx === 0 ? (p.rentalEquipment ?? DEFAULT_RENTAL_EQUIPMENT) : DEFAULT_RENTAL_EQUIPMENT),
    waterAndIce: tech.waterAndIce ?? (idx === 0 ? legacyWaterAndIce : 0),
    additionalMaterials: tech.additionalMaterials ?? [],
  }));
  return { ...p, inputParameters, technologies };
}

function ProjectWorksheet({ initialProject }: { initialProject: Project }) {
  const {
    project,
    fullSchedule,
    pmTravelCalculated,
    installTravelCalc,
    quotes,
    updateInputParameters,
    updateSchedule,
    updatePMTravel,
    updateInstallTravel,
    updateColoSites,
    updateTechnology,
    updateProjectMeta,
    updateProjectSpecificDetails,
    applyBulkUpdate,
  } = useProject(initialProject);

  const rawPsd = project.projectSpecificDetails ?? DEFAULT_PROJECT_SPECIFIC_DETAILS;
  // Guard: if an older saved project has psd but no extras field, merge in the defaults
  const psd = rawPsd.extras ? rawPsd : { ...rawPsd, extras: { ...DEFAULT_PROJECT_EXTRAS } };

  const [activeTab, setActiveTab] = useState<TechnologyType>("DAS");

  // Per-tech rental/sub helpers
  const travelMarkupMultiplier = project.inputParameters.travelIndirectMarkup ?? 1.23;
  const subMarkupMultiplier = project.inputParameters.subMarkUp ?? 1.10;

  const getTechRentalRaw = (tech: TechnologyConfig) => {
    const r = tech.rentalEquipment ?? DEFAULT_RENTAL_EQUIPMENT;
    return r.lift.months * r.lift.costPerMonth +
      (r.additionalItems ?? []).reduce((s, i) => s + i.months * i.costPerMonth, 0);
  };
  const getTechRentalMarkup = (tech: TechnologyConfig) => {
    const raw = getTechRentalRaw(tech);
    return raw > 0 ? raw * travelMarkupMultiplier : 0;
  };
  const getTechSubRaw = (tech: TechnologyConfig) =>
    (tech.subContractors ?? []).reduce((s, sub) => s + sub.value, 0);
  const getTechSubMarkup = (tech: TechnologyConfig) => {
    const raw = getTechSubRaw(tech);
    return raw > 0 ? raw * subMarkupMultiplier : 0;
  };

  // Aggregated totals across all enabled techs (for FinancialReview / ProjectSummary / grand total)
  const enabledTechs = project.technologies.filter((t) => t.enabled);
  const rentalRawTotal = enabledTechs.reduce((s, t) => s + getTechRentalRaw(t), 0);
  const rentalMarkupTotal = enabledTechs.reduce((s, t) => s + getTechRentalMarkup(t), 0);
  const subRawTotal = enabledTechs.reduce((s, t) => s + getTechSubRaw(t), 0);
  const subMarkupTotal = enabledTechs.reduce((s, t) => s + getTechSubMarkup(t), 0);
  const techSubMarkups: Record<string, number> = Object.fromEntries(
    enabledTechs.map((t) => [t.type, getTechSubMarkup(t)])
  );

  const adminPercent = psd.extras?.adminHours ?? 15;
  const totalAdminValue = quotes.reduce((sum, q) => {
    const pmLine = q.lines.find((l) => l.item === 4);
    return sum + (pmLine ? pmLine.totalPrice * (adminPercent / 100) : 0);
  }, 0);

  // Tax on equipment — per-tech, based on each quote's equipment line (item 3)
  const taxPercent = project.inputParameters.taxPercent ?? 0;
  const totalTaxValue = quotes.reduce((sum, q) => {
    const equipLine = q.lines.find((l) => l.item === 3);
    return sum + (equipLine ? equipLine.totalPrice * (taxPercent / 100) : 0);
  }, 0);

  const grandTotal = quotes.reduce((sum, q) => sum + q.totalCost, 0) + totalAdminValue + rentalMarkupTotal + subMarkupTotal + totalTaxValue;

  // ── Financial review ──────────────────────────────────────────────
  const finP = project.inputParameters;
  const travelMarkup     = finP.travelIndirectMarkup ?? 1.23;
  const buyRate          = finP.buyHourlyRate ?? 55;
  const sellRate         = finP.hourlyRate ?? 0;
  const buyPMRate        = finP.buyPMHourlyRate ?? 95;
  const sellPMRate       = finP.pmHourlyRate ?? 0;

  // Per-line sell totals across all active technologies
  const rfSell           = quotes.reduce((s, q) => s + (q.lines.find((l) => l.item === 1)?.totalPrice || 0), 0);
  const installLaborSell = quotes.reduce((s, q) => s + (q.lines.find((l) => l.item === 2)?.totalPrice || 0), 0);
  const equipSell        = quotes.reduce((s, q) => s + (q.lines.find((l) => l.item === 3)?.totalPrice || 0), 0);
  const pmBaseSell       = quotes.reduce((s, q) => s + (q.lines.find((l) => l.item === 4)?.totalPrice || 0), 0);
  const pmTravelSell     = quotes.reduce((s, q) => s + (q.lines.find((l) => l.item === 5)?.totalPrice || 0), 0);
  const installTravelSell= quotes.reduce((s, q) => s + (q.lines.find((l) => l.item === 6)?.totalPrice || 0), 0);

  // Back-calculate costs (including contingency, excluding markup)
  const rfCost           = finP.subMarkUp > 1 ? rfSell / finP.subMarkUp : rfSell;
  const installLaborCost = sellRate > 0 ? installLaborSell * buyRate / sellRate : installLaborSell;
  const equipCost        = finP.markUp > 0 ? equipSell / finP.markUp : equipSell;
  const pmBaseCost       = sellPMRate > 0 ? pmBaseSell * buyPMRate / sellPMRate : pmBaseSell;
  const adminCost        = sellPMRate > 0 ? totalAdminValue * buyPMRate / sellPMRate : totalAdminValue;
  const installTravelCost= travelMarkup > 0 ? installTravelSell / travelMarkup : installTravelSell;
  const pmTravelCost     = travelMarkup > 0 ? pmTravelSell / travelMarkup : pmTravelSell;

  // Sub-item arrays for expandable rows
  const installChildren: FinancialItem[] = [
    ...(installLaborSell > 0  ? [{ label: "Labor Hours",      cost: installLaborCost,  sell: installLaborSell }]  : []),
    ...(installTravelSell > 0 ? [{ label: "Travel",           cost: installTravelCost, sell: installTravelSell }] : []),
    ...(rentalMarkupTotal > 0 ? [{ label: "Rental Equipment", cost: rentalRawTotal,    sell: rentalMarkupTotal }]  : []),
  ];
  const pmChildren: FinancialItem[] = [
    ...(pmBaseSell > 0      ? [{ label: "PM Hours",  cost: pmBaseCost,  sell: pmBaseSell }]      : []),
    ...(pmTravelSell > 0    ? [{ label: "PM Travel", cost: pmTravelCost,sell: pmTravelSell }]    : []),
    ...(totalAdminValue > 0 ? [{ label: "Admin",     cost: adminCost,   sell: totalAdminValue }] : []),
  ];
  const equipChildren: FinancialItem[] = [
    ...(equipSell > 0 ? [{ label: "Equipment", cost: equipCost, sell: equipSell }] : []),
  ];

  const financialItems: FinancialItem[] = [
    { label: "RF Engineering", cost: rfCost, sell: rfSell },
    {
      label: "Installation",
      cost: installLaborCost + installTravelCost + rentalRawTotal,
      sell: installLaborSell + installTravelSell + rentalMarkupTotal,
      children: installChildren.length > 1 ? installChildren : undefined,
    },
    {
      label: "Materials & Equipment",
      cost: equipCost,
      sell: equipSell,
      children: equipChildren.length > 1 ? equipChildren : undefined,
    },
    {
      label: "Project Management",
      cost: pmBaseCost + pmTravelCost + adminCost,
      sell: pmBaseSell + pmTravelSell + totalAdminValue,
      children: pmChildren.length > 1 ? pmChildren : undefined,
    },
    ...(subMarkupTotal > 0 ? [{ label: "Subcontractors", cost: subRawTotal,   sell: subMarkupTotal }] : []),
    ...(totalTaxValue > 0  ? [{ label: "Tax",             cost: totalTaxValue, sell: totalTaxValue }]  : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/60 bg-background/85 backdrop-blur-xl backdrop-saturate-150 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                <ArrowLeft className="h-3 w-3 mr-1" /> Back
              </Button>
            </Link>
            <div className="h-4 w-px bg-border" />
            <Input
              value={project.name}
              onChange={(e) => updateProjectMeta({ name: e.target.value })}
              className="h-7 w-56 text-sm font-medium border-transparent hover:border-border/60 bg-transparent"
            />
            <Input
              value={project.client}
              onChange={(e) => updateProjectMeta({ client: e.target.value })}
              placeholder="Client..."
              className="h-7 w-40 text-xs text-muted-foreground border-transparent hover:border-border/60 bg-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mr-1">
              <Check className="h-3 w-3 text-emerald-500" />
              Saved
            </div>
            <AIEstimateDialog project={project} onApply={applyBulkUpdate} />
            <Link href={`/project/${project.id}/quote`}>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                <FileDown className="h-3 w-3 mr-1" /> Export
              </Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-5 py-5 space-y-4">
        {/* Parameters Panel */}
        <ParametersPanel
          params={project.inputParameters}
          onParamsChange={updateInputParameters}
          pmTravel={project.pmTravel}
          pmTravelCalculated={pmTravelCalculated}
          onPMTravelChange={updatePMTravel}
          installTravel={project.installTravel ?? DEFAULT_INSTALL_TRAVEL}
          installTravelCalc={installTravelCalc}
          onInstallTravelChange={updateInstallTravel}
          numberOfGuys={fullSchedule.numberOfGuys}
          onNumberOfGuysChange={(n) => updateSchedule({ ...fullSchedule, numberOfGuys: n })}
          projectSpecificDetails={psd}
          onProjectSpecificDetailsChange={updateProjectSpecificDetails}
        />
        <PerTechDetailsCard
          technologies={project.technologies.filter((t) => t.enabled)}
          onChange={updateTechnology}
        />
        <LaborSummary
          technologies={project.technologies}
          hoursPerDay={project.inputParameters.hoursPerDay ?? 8}
          daysPerWeek={project.inputParameters.daysPerWeek ?? 5}
          numberOfGuys={project.schedule.numberOfGuys}
        />
        <MaterialsSummary technologies={project.technologies} />

        {/* COLO Sites */}
        <div className="border border-border/60 rounded-lg px-4 py-2.5 bg-card/50">
          <ColoManager coloSites={project.coloSites} onChange={updateColoSites} />
        </div>

        {/* Technology Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TechnologyType)}>
          <TabsList className="h-8 p-0.5 bg-muted/60 rounded-lg w-auto inline-flex gap-0.5 border border-border/30">
            {(["DAS", "PUBLIC_SAFETY", "ROIP"] as TechnologyType[]).map((type) => (
              <TabsTrigger key={type} value={type} className="h-7 px-4 rounded-md text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                {TECHNOLOGY_LABELS[type]}
              </TabsTrigger>
            ))}
          </TabsList>

          {(["DAS", "PUBLIC_SAFETY", "ROIP"] as TechnologyType[]).map((type) => {
            const tech = project.technologies.find((t) => t.type === type);
            const quote = quotes.find((q) => q.type === type);
            if (!tech) return null;
            const techRentalMarkup = tech.enabled ? getTechRentalMarkup(tech) : 0;
            const techSubMarkup = tech.enabled ? getTechSubMarkup(tech) : 0;
            return (
              <TabsContent key={type} value={type} className="space-y-4 mt-3">
                <div className="flex justify-end">
                  <BomImportDialog
                    tech={tech}
                    coloSites={project.coloSites}
                    onApply={updateTechnology}
                    projectSpecificDetails={psd}
                    numberOfGuys={project.schedule.numberOfGuys}
                    hoursPerDay={project.inputParameters.hoursPerDay ?? 8}
                    daysPerWeek={project.inputParameters.daysPerWeek ?? 5}
                  />
                </div>
                <InputValuesTable tech={tech} coloSites={project.coloSites} onChange={updateTechnology} />
                {quote && <QuoteTable
                  quote={quote}
                  coloSites={project.coloSites}
                  rentalMarkupCost={techRentalMarkup}
                  adminPercent={adminPercent}
                  subContractorTotal={techSubMarkup}
                  taxPercent={taxPercent}
                  installTravelActive={installTravelCalc !== null}
                />}
              </TabsContent>
            );
          })}
        </Tabs>

        {quotes.length > 0 && <ProjectSummary quotes={quotes} projectSpecificDetails={psd} rentalMarkupTotal={rentalMarkupTotal} totalAdminValue={totalAdminValue} subMarkupTotal={subMarkupTotal} techSubMarkups={techSubMarkups} totalTaxValue={totalTaxValue} />}
        {quotes.length > 0 && <FinancialReview items={financialItems} />}
        <div className="h-14" />
      </div>

      {/* Sticky total bar */}
      {quotes.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 sticky-bar-blur">
          <div className="max-w-[1600px] mx-auto px-5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-5">
              {quotes.map((q) => (
                <div key={q.type} className="flex items-center gap-2 text-sm">
                  <div className={`h-2 w-2 rounded-full ${TECHNOLOGY_DOT[q.type]}`} />
                  <span className="text-muted-foreground text-xs">{TECHNOLOGY_LABELS[q.type]}</span>
                  <span className="font-mono tabular-nums text-xs">{formatCurrency(q.totalCost)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Grand Total</span>
              <span className="text-base font-semibold font-mono tabular-nums">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id as string;
    const p = loadProject(id);
    if (!p) {
      router.push("/");
      return;
    }
    setProject(migrateProject(p));
    setLoading(false);
  }, [params.id, router]);

  if (loading || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return <ProjectWorksheet initialProject={project} />;
}
