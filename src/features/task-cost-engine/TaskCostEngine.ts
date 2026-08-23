export type TaskCostEngineMaterialInput = {
  quantity?: number | null;
  unitCostHt?: number | null;
  unitSaleHt?: number | null;
  lossPercent?: number | null;
  marginRate?: number | null;
};

export type TaskCostEngineLaborInput = {
  durationHours?: number | null;
  hourlyCostHt?: number | null;
  hourlySaleHt?: number | null;
  marginRate?: number | null;
  teamSize?: number | null;
};

export type TaskCostEngineEquipmentInput = {
  quantity?: number | null;
  unitCostHt?: number | null;
  unitSaleHt?: number | null;
  marginRate?: number | null;
};

export type TaskCostEngineFeeInput = {
  amountCostHt?: number | null;
  amountSaleHt?: number | null;
  marginRate?: number | null;
};

export type TaskCostEngineInput = {
  materials?: TaskCostEngineMaterialInput[];
  labor?: TaskCostEngineLaborInput[];
  equipment?: TaskCostEngineEquipmentInput[];
  fees?: TaskCostEngineFeeInput[];
  quantity?: number | null;
  estimatedTimeHours?: number | null;
  teamSize?: number | null;
  dailyHours?: number | null;
};

export type TaskCostEngineTotals = {
  materialCost: number;
  materialSale: number;
  laborCost: number;
  laborSale: number;
  equipmentCost: number;
  equipmentSale: number;
  feeCost: number;
  feeSale: number;
  cost: number;
  sale: number;
  margin: number;
  marginRate: number;
  estimatedTimeHours: number;
  humanTimeHours: number;
  teamTimeHours: number;
  dailyCost: number;
  profitabilityRate: number;
  lines: string[];
};

function n(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function positive(value: unknown): number {
  return Math.max(0, n(value));
}

function money(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function saleFromCost(cost: number, explicitSale: number, marginRate: number): number {
  if (explicitSale > 0) return explicitSale;
  return cost * (1 + Math.max(0, marginRate) / 100);
}

export function calculateTaskCost(input: TaskCostEngineInput): TaskCostEngineTotals {
  const materialTotals = (input.materials ?? []).reduce(
    (sum, row) => {
      const quantity = positive(row.quantity);
      const lossMultiplier = 1 + positive(row.lossPercent) / 100;
      const cost = quantity * lossMultiplier * positive(row.unitCostHt);
      const sale = quantity * lossMultiplier * saleFromCost(positive(row.unitCostHt), positive(row.unitSaleHt), positive(row.marginRate));
      return { cost: sum.cost + cost, sale: sum.sale + sale };
    },
    { cost: 0, sale: 0 },
  );

  const laborTotals = (input.labor ?? []).reduce<{ cost: number; sale: number; hours: number; teamSize: number }>(
    (sum, row) => {
      const hours = positive(row.durationHours);
      const cost = hours * positive(row.hourlyCostHt);
      const sale = hours * saleFromCost(positive(row.hourlyCostHt), positive(row.hourlySaleHt), positive(row.marginRate));
      return {
        cost: sum.cost + cost,
        sale: sum.sale + sale,
        hours: sum.hours + hours,
        teamSize: Math.max(sum.teamSize, positive(row.teamSize)),
      };
    },
    { cost: 0, sale: 0, hours: 0, teamSize: 0 },
  );

  const equipmentTotals = (input.equipment ?? []).reduce(
    (sum, row) => {
      const quantity = positive(row.quantity || 1);
      const cost = quantity * positive(row.unitCostHt);
      const sale = quantity * saleFromCost(positive(row.unitCostHt), positive(row.unitSaleHt), positive(row.marginRate));
      return { cost: sum.cost + cost, sale: sum.sale + sale };
    },
    { cost: 0, sale: 0 },
  );

  const feeTotals = (input.fees ?? []).reduce(
    (sum, row) => {
      const cost = positive(row.amountCostHt);
      const sale = saleFromCost(cost, positive(row.amountSaleHt), positive(row.marginRate));
      return { cost: sum.cost + cost, sale: sum.sale + sale };
    },
    { cost: 0, sale: 0 },
  );

  const materialCost = money(materialTotals.cost);
  const materialSale = money(materialTotals.sale);
  const laborCost = money(laborTotals.cost);
  const laborSale = money(laborTotals.sale);
  const equipmentCost = money(equipmentTotals.cost);
  const equipmentSale = money(equipmentTotals.sale);
  const feeCost = money(feeTotals.cost);
  const feeSale = money(feeTotals.sale);
  const cost = money(materialCost + laborCost + equipmentCost + feeCost);
  const sale = money(materialSale + laborSale + equipmentSale + feeSale);
  const margin = money(sale - cost);
  const marginRate = sale > 0 ? money((margin / sale) * 100) : 0;
  const estimatedTimeHours = money(positive(input.estimatedTimeHours) || laborTotals.hours);
  const humanTimeHours = money(laborTotals.hours || estimatedTimeHours);
  const teamSize = positive(input.teamSize) || laborTotals.teamSize || 1;
  const teamTimeHours = money(humanTimeHours / teamSize);
  const dailyHours = positive(input.dailyHours) || 7;
  const dailyCost = teamTimeHours > 0 ? money((cost / teamTimeHours) * dailyHours) : 0;
  const profitabilityRate = cost > 0 ? money((margin / cost) * 100) : 0;

  return {
    materialCost,
    materialSale,
    laborCost,
    laborSale,
    equipmentCost,
    equipmentSale,
    feeCost,
    feeSale,
    cost,
    sale,
    margin,
    marginRate,
    estimatedTimeHours,
    humanTimeHours,
    teamTimeHours,
    dailyCost,
    profitabilityRate,
    lines: [
      `PR matériaux: ${materialCost.toFixed(2)} EUR HT`,
      `PV matériaux: ${materialSale.toFixed(2)} EUR HT`,
      `PR MO: ${laborCost.toFixed(2)} EUR HT`,
      `PV MO: ${laborSale.toFixed(2)} EUR HT`,
      `PR matériel: ${equipmentCost.toFixed(2)} EUR HT`,
      `PV matériel: ${equipmentSale.toFixed(2)} EUR HT`,
      `PR frais: ${feeCost.toFixed(2)} EUR HT`,
      `PV frais: ${feeSale.toFixed(2)} EUR HT`,
      `PR ouvrage: ${cost.toFixed(2)} EUR HT`,
      `PV ouvrage: ${sale.toFixed(2)} EUR HT`,
      `Marge: ${margin.toFixed(2)} EUR HT (${marginRate.toFixed(1)} %)`,
      `Temps estimé: ${estimatedTimeHours.toFixed(2)} h`,
      `Temps homme: ${humanTimeHours.toFixed(2)} h`,
      `Temps équipe: ${teamTimeHours.toFixed(2)} h`,
      `Coût journalier: ${dailyCost.toFixed(2)} EUR HT`,
      `Rentabilité: ${profitabilityRate.toFixed(1)} %`,
    ],
  };
}

export const TaskCostEngine = {
  calculate: calculateTaskCost,
};
