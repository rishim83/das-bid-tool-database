import type { Project, TechnologyType, TechnologyQuote, ColoSite } from "@/types";
import { calculatePMTravel, calculateTechnologyQuote } from "./calculations";
import { TECHNOLOGY_LABELS } from "./constants";

// ─── Types ──────────────────────────────────────────────────────

export interface CostBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

export interface TechBreakdown {
  type: TechnologyType;
  label: string;
  totalCost: number;
  percentage: number;
}

export interface ColoBreakdown {
  id: string;
  name: string;
  totalCost: number;
  percentage: number;
  technologies: { type: TechnologyType; label: string; cost: number }[];
}

export interface LaborMaterialRatio {
  laborCost: number;
  materialCost: number;
  laborPct: number;
  materialPct: number;
  travelCost: number;
  travelPct: number;
}

export interface PMTravelBreakdown {
  pmLabor: number;
  pmTravel: number;
  installTravel: number;
  totalOverhead: number;
  overheadPct: number;
}

export interface ProjectOverview {
  id: string;
  name: string;
  client: string;
  totalCost: number;
  techCount: number;
  coloCount: number;
  updatedAt: string;
  costPerColo: number;
  dominantTech: string;
}

export interface FinancialPL {
  // Revenue (quote price = what client pays)
  revenue: number;

  // Direct Costs (cost before markup/safety)
  directRFCost: number;
  directInstallLabor: number;
  directEquipment: number;
  directPM: number;
  directPMTravel: number;
  directInstallTravel: number;
  totalDirectCosts: number;

  // Gross Profit
  grossProfit: number;
  grossMarginPct: number;

  // Markup Analysis
  markupMultiplier: number;
  effectiveMarkupPct: number;

  // Safety Margin Impact
  laborSafetyAdded: number;
  materialSafetyAdded: number;
  markupAdded: number;
  totalSafetyMarkupAdded: number;

  // Per-technology P&L
  techPL: {
    type: TechnologyType;
    label: string;
    revenue: number;
    directCost: number;
    grossProfit: number;
    marginPct: number;
  }[];
}

// ─── Helper: compute quotes for a project ───────────────────────

export function getProjectQuotes(project: Project): TechnologyQuote[] {
  const pmTravel = calculatePMTravel(project.pmTravel);
  return project.technologies
    .filter((t) => t.enabled)
    .map((tech) =>
      calculateTechnologyQuote(
        tech,
        project.coloSites,
        project.inputParameters,
        pmTravel.totalPerTrip,
        project.schedule.numberOfGuys
      )
    );
}

// ─── Report 1: Cost Breakdown by Category ───────────────────────

export function getCostBreakdownByCategory(
  quotes: TechnologyQuote[]
): CostBreakdown[] {
  const categories = [
    "RF Engineering Services",
    "Install",
    "Equipment and Materials",
    "PM",
    "PM Travel",
    "Install Travel",
  ];

  const totals = categories.map((cat, idx) => {
    const amount = quotes.reduce((sum, q) => {
      const line = q.lines.find((l) => l.item === idx + 1);
      return sum + (line?.totalPrice || 0);
    }, 0);
    return { category: cat, amount };
  });

  const grandTotal = totals.reduce((s, t) => s + t.amount, 0);

  return totals.map((t) => ({
    ...t,
    percentage: grandTotal > 0 ? (t.amount / grandTotal) * 100 : 0,
  }));
}

// ─── Report 2: COLO Site Comparison ─────────────────────────────

export function getColoComparison(
  quotes: TechnologyQuote[],
  coloSites: ColoSite[]
): ColoBreakdown[] {
  const colos = coloSites.map((colo) => {
    const technologies = quotes.map((q) => {
      const cost = q.lines.reduce(
        (sum, line) => sum + (line.values[colo.id] || 0),
        0
      );
      return { type: q.type, label: TECHNOLOGY_LABELS[q.type], cost };
    });
    const totalCost = technologies.reduce((s, t) => s + t.cost, 0);
    return { id: colo.id, name: colo.name, totalCost, percentage: 0, technologies };
  });

  const grandTotal = colos.reduce((s, c) => s + c.totalCost, 0);
  return colos.map((c) => ({
    ...c,
    percentage: grandTotal > 0 ? (c.totalCost / grandTotal) * 100 : 0,
  }));
}

// ─── Report 3: Technology Mix ───────────────────────────────────

export function getTechnologyMix(quotes: TechnologyQuote[]): TechBreakdown[] {
  const grandTotal = quotes.reduce((s, q) => s + q.totalCost, 0);
  return quotes.map((q) => ({
    type: q.type,
    label: TECHNOLOGY_LABELS[q.type],
    totalCost: q.totalCost,
    percentage: grandTotal > 0 ? (q.totalCost / grandTotal) * 100 : 0,
  }));
}

// ─── Report 4: Labor vs Materials Ratio ─────────────────────────

export function getLaborMaterialRatio(
  quotes: TechnologyQuote[]
): LaborMaterialRatio {
  // Labor = Install (line 2) + PM (line 4)
  const laborCost = quotes.reduce((sum, q) => {
    const install = q.lines.find((l) => l.item === 2)?.totalPrice || 0;
    const pm = q.lines.find((l) => l.item === 4)?.totalPrice || 0;
    return sum + install + pm;
  }, 0);

  // Material = RF Engineering (line 1) + Equipment (line 3)
  const materialCost = quotes.reduce((sum, q) => {
    const rf = q.lines.find((l) => l.item === 1)?.totalPrice || 0;
    const equip = q.lines.find((l) => l.item === 3)?.totalPrice || 0;
    return sum + rf + equip;
  }, 0);

  // Travel = PM Travel (line 5) + Install Travel (line 6)
  const travelCost = quotes.reduce((sum, q) => {
    const pmTravel = q.lines.find((l) => l.item === 5)?.totalPrice || 0;
    const installTravel = q.lines.find((l) => l.item === 6)?.totalPrice || 0;
    return sum + pmTravel + installTravel;
  }, 0);

  const total = laborCost + materialCost + travelCost;

  return {
    laborCost,
    materialCost,
    travelCost,
    laborPct: total > 0 ? (laborCost / total) * 100 : 0,
    materialPct: total > 0 ? (materialCost / total) * 100 : 0,
    travelPct: total > 0 ? (travelCost / total) * 100 : 0,
  };
}

// ─── Report 5: PM & Travel Cost Analysis ────────────────────────

export function getPMTravelBreakdown(
  quotes: TechnologyQuote[]
): PMTravelBreakdown {
  const pmLabor = quotes.reduce(
    (sum, q) => sum + (q.lines.find((l) => l.item === 4)?.totalPrice || 0),
    0
  );
  const pmTravel = quotes.reduce(
    (sum, q) => sum + (q.lines.find((l) => l.item === 5)?.totalPrice || 0),
    0
  );
  const installTravel = quotes.reduce(
    (sum, q) => sum + (q.lines.find((l) => l.item === 6)?.totalPrice || 0),
    0
  );
  const totalOverhead = pmLabor + pmTravel + installTravel;
  const grandTotal = quotes.reduce((s, q) => s + q.totalCost, 0);

  return {
    pmLabor,
    pmTravel,
    installTravel,
    totalOverhead,
    overheadPct: grandTotal > 0 ? (totalOverhead / grandTotal) * 100 : 0,
  };
}

// ─── Report 7: Financial P&L / Margin Analysis ─────────────────

export function getFinancialPL(projects: Project[]): FinancialPL {
  let revenue = 0;
  let directRFCost = 0;
  let directInstallLabor = 0;
  let directEquipment = 0;
  let directPM = 0;
  let directPMTravel = 0;
  let directInstallTravel = 0;
  let laborSafetyAdded = 0;
  let materialSafetyAdded = 0;
  let markupAdded = 0;

  const techPLMap: Record<string, { revenue: number; directCost: number }> = {};

  for (const project of projects) {
    const params = project.inputParameters;
    const pmTravel = calculatePMTravel(project.pmTravel);

    for (const tech of project.technologies) {
      if (!tech.enabled) continue;

      const key = tech.type;
      if (!techPLMap[key]) techPLMap[key] = { revenue: 0, directCost: 0 };

      for (const colo of project.coloSites) {
        const coloId = colo.id;

        // RF Engineering: quoted = sum(RF items) × markup. Direct = sum(RF items)
        const rfRaw = tech.rfLineItems.reduce(
          (sum, item) => sum + (item.values[coloId] || 0),
          0
        );
        const rfQuoted = rfRaw * params.markUp;
        directRFCost += rfRaw;
        markupAdded += rfRaw * (params.markUp - 1);
        revenue += rfQuoted;
        techPLMap[key].revenue += rfQuoted;
        techPLMap[key].directCost += rfRaw;

        // Install: quoted = hours × rate × laborSafety. Direct = hours × rate
        const hours = tech.installLaborHours[coloId] || 0;
        const installRaw = hours * params.hourlyRate;
        const installQuoted = installRaw * params.laborSafety;
        directInstallLabor += installRaw;
        laborSafetyAdded += installRaw * (params.laborSafety - 1);
        revenue += installQuoted;
        techPLMap[key].revenue += installQuoted;
        techPLMap[key].directCost += installRaw;

        // Equipment: quoted = cost × materialSafety × markup. Direct = cost
        const equipRaw = tech.equipmentCost[coloId] || 0;
        const equipQuoted = equipRaw * params.materialSafety * params.markUp;
        directEquipment += equipRaw;
        materialSafetyAdded += equipRaw * (params.materialSafety - 1);
        markupAdded += equipRaw * params.materialSafety * (params.markUp - 1);
        revenue += equipQuoted;
        techPLMap[key].revenue += equipQuoted;
        techPLMap[key].directCost += equipRaw;

        // PM: quoted = hours × pmOnJob × pmRate. This IS direct cost (no markup)
        const pmCost = hours * params.pmOnJob * params.pmHourlyRate;
        directPM += pmCost;
        revenue += pmCost;
        techPLMap[key].revenue += pmCost;
        techPLMap[key].directCost += pmCost;

        // PM Travel: quoted = trips × travelPerTrip. Direct cost (no markup)
        const trips = tech.pmTrips[coloId] || 0;
        const pmTravelCost = trips * pmTravel.totalPerTrip;
        directPMTravel += pmTravelCost;
        revenue += pmTravelCost;
        techPLMap[key].revenue += pmTravelCost;
        techPLMap[key].directCost += pmTravelCost;

        // Install Travel: quoted = hours × travelPerDay. Direct cost (no markup)
        const installTravelCost = hours * params.travelPerDay;
        directInstallTravel += installTravelCost;
        revenue += installTravelCost;
        techPLMap[key].revenue += installTravelCost;
        techPLMap[key].directCost += installTravelCost;
      }
    }
  }

  const totalDirectCosts =
    directRFCost +
    directInstallLabor +
    directEquipment +
    directPM +
    directPMTravel +
    directInstallTravel;

  const grossProfit = revenue - totalDirectCosts;
  const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  // Effective markup = revenue / directCosts
  const effectiveMarkupPct =
    totalDirectCosts > 0 ? ((revenue - totalDirectCosts) / totalDirectCosts) * 100 : 0;

  // Average markup multiplier from projects
  const markupMultiplier =
    projects.length > 0
      ? projects.reduce((s, p) => s + p.inputParameters.markUp, 0) / projects.length
      : 1;

  const totalSafetyMarkupAdded = laborSafetyAdded + materialSafetyAdded + markupAdded;

  const techPL = (["DAS", "PUBLIC_SAFETY", "ROIP"] as TechnologyType[])
    .filter((type) => techPLMap[type])
    .map((type) => {
      const d = techPLMap[type];
      const gp = d.revenue - d.directCost;
      return {
        type,
        label: TECHNOLOGY_LABELS[type],
        revenue: d.revenue,
        directCost: d.directCost,
        grossProfit: gp,
        marginPct: d.revenue > 0 ? (gp / d.revenue) * 100 : 0,
      };
    });

  return {
    revenue,
    directRFCost,
    directInstallLabor,
    directEquipment,
    directPM,
    directPMTravel,
    directInstallTravel,
    totalDirectCosts,
    grossProfit,
    grossMarginPct,
    markupMultiplier,
    effectiveMarkupPct,
    laborSafetyAdded,
    materialSafetyAdded,
    markupAdded,
    totalSafetyMarkupAdded,
    techPL,
  };
}

// ─── Report 6: Portfolio Overview (cross-project) ───────────────

export function getPortfolioOverview(projects: Project[]): ProjectOverview[] {
  return projects.map((p) => {
    const quotes = getProjectQuotes(p);
    const totalCost = quotes.reduce((s, q) => s + q.totalCost, 0);
    const techCount = p.technologies.filter((t) => t.enabled).length;
    const coloCount = p.coloSites.length;

    // Find dominant technology
    let dominantTech = "-";
    if (quotes.length > 0) {
      const maxQuote = quotes.reduce((prev, curr) =>
        curr.totalCost > prev.totalCost ? curr : prev
      );
      dominantTech = TECHNOLOGY_LABELS[maxQuote.type];
    }

    return {
      id: p.id,
      name: p.name,
      client: p.client,
      totalCost,
      techCount,
      coloCount,
      updatedAt: p.updatedAt,
      costPerColo: coloCount > 0 ? totalCost / coloCount : 0,
      dominantTech,
    };
  });
}
