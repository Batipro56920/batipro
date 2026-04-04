import type { ChantierRow } from "./chantiers.service";
import { listChantierChangeOrders } from "./chantierChangeOrders.service";
import { getChantierPreparationChecklist, type ChantierPreparationChecklistRow } from "./chantierPreparation.service";
import { loadChantierBudgetDashboard, type ChantierBudgetDashboard } from "./chantierBudget.service";
import { listChantierPurchaseRequests } from "./chantierPurchaseRequests.service";
import { getTasksByChantierId, type ChantierTaskRow, type TaskQualityStatus, type TaskStatus } from "./chantierTasks.service";
import { listChantierTimeEntriesByChantierId } from "./chantierTimeEntries.service";
import { listIntervenantsByChantierId } from "./intervenants.service";
import { listReservesByChantierId } from "./reserves.service";

export type ChantierReportKind = "client" | "interne";

export type ChantierReportTaskItem = {
  id: string;
  titre: string;
  lot: string;
  status: TaskStatus;
  quality_status: TaskQualityStatus;
  date_debut: string | null;
  date_fin: string | null;
  temps_prevu_h: number;
  temps_reel_h: number;
};

export type ChantierReportReserveItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  zone_nom: string | null;
  intervenant_nom: string | null;
  created_at: string | null;
};

export type ChantierReportTimeItem = {
  id: string;
  work_date: string;
  duration_hours: number;
  note: string | null;
  task_titre: string;
  intervenant_nom: string;
};

export type ChantierReportPurchaseItem = {
  id: string;
  titre: string;
  statut_commande: string;
  supplier_name: string | null;
  task_titre: string | null;
  cout_prevu_ht: number;
  cout_reel_ht: number;
};

export type ChantierReportChangeOrderItem = {
  id: string;
  titre: string;
  statut: string;
  impact_temps_h: number;
  impact_cout_ht: number;
  created_at: string | null;
};

export type ChantierReportSummary = {
  avancement_pct: number;
  taches_total: number;
  taches_terminees: number;
  taches_a_reprendre: number;
  heures_periode_h: number;
  reserves_ouvertes: number;
  reserves_urgentes: number;
  achats_non_livres: number;
  avenants_valides_ht: number;
  marge_reelle_pct: number;
  budget_depassement_ht: number;
};

export type ChantierReportDataset = {
  chantier: ChantierRow;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  preparation: ChantierPreparationChecklistRow;
  preparationSchemaReady: boolean;
  budget: ChantierBudgetDashboard;
  summary: ChantierReportSummary;
  tasks: ChantierReportTaskItem[];
  reserves: ChantierReportReserveItem[];
  timeEntries: ChantierReportTimeItem[];
  purchases: ChantierReportPurchaseItem[];
  changeOrders: ChantierReportChangeOrderItem[];
};

function normalizeNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateOnly(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function isWithinPeriod(value: string | null | undefined, periodStart: string, periodEnd: string): boolean {
  const dateValue = toDateOnly(value);
  if (!dateValue) return false;
  return dateValue >= periodStart && dateValue <= periodEnd;
}

function overlapsPeriod(
  startValue: string | null | undefined,
  endValue: string | null | undefined,
  fallbackValue: string | null | undefined,
  periodStart: string,
  periodEnd: string,
): boolean {
  const start = toDateOnly(startValue) ?? toDateOnly(fallbackValue);
  const end = toDateOnly(endValue) ?? start;
  if (!start && !end) return false;
  const effectiveStart = start ?? end ?? "";
  const effectiveEnd = end ?? start ?? "";
  return effectiveStart <= periodEnd && effectiveEnd >= periodStart;
}

function resolveTaskLot(task: ChantierTaskRow): string {
  return String(task.corps_etat ?? task.lot ?? "Sans lot").trim() || "Sans lot";
}

function computeAvancementPct(chantier: ChantierRow, tasks: ChantierTaskRow[]): number {
  const direct = Number(chantier.avancement ?? 0);
  if (Number.isFinite(direct) && direct > 0) return Math.max(0, Math.min(100, Math.round(direct)));
  if (tasks.length === 0) return 0;
  const done = tasks.filter((task) => task.status === "FAIT").length;
  return Math.round((done / tasks.length) * 100);
}

export async function loadChantierReportDataset(params: {
  chantier: ChantierRow;
  periodStart: string;
  periodEnd: string;
}): Promise<ChantierReportDataset> {
  const chantier = params.chantier;
  const periodStart = toDateOnly(params.periodStart) ?? new Date().toISOString().slice(0, 10);
  const periodEnd = toDateOnly(params.periodEnd) ?? periodStart;
  const chantierId = String(chantier.id ?? "").trim();

  if (!chantierId) throw new Error("Chantier manquant pour le rapport.");
  if (periodStart > periodEnd) throw new Error("La date de debut doit etre avant la date de fin.");

  const [tasks, reserves, timeEntries, purchaseResult, changeOrderResult, preparationResult, budget, intervenants] =
    await Promise.all([
      getTasksByChantierId(chantierId),
      listReservesByChantierId(chantierId),
      listChantierTimeEntriesByChantierId(chantierId),
      listChantierPurchaseRequests(chantierId),
      listChantierChangeOrders(chantierId),
      getChantierPreparationChecklist(chantierId),
      loadChantierBudgetDashboard(chantierId),
      listIntervenantsByChantierId(chantierId),
    ]);

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const intervenantNameById = new Map(
    intervenants.map((intervenant) => [intervenant.id, intervenant.nom || "Intervenant"]),
  );

  const filteredTasks = tasks.filter((task) =>
    overlapsPeriod(task.date_debut, task.date_fin, task.date, periodStart, periodEnd),
  );
  const filteredReserves = reserves.filter(
    (reserve) => isWithinPeriod(reserve.created_at, periodStart, periodEnd) || reserve.status !== "LEVEE",
  );
  const filteredTimeEntries = timeEntries.filter((entry) => isWithinPeriod(entry.work_date, periodStart, periodEnd));
  const filteredPurchases = purchaseResult.requests.filter(
    (request) =>
      isWithinPeriod(request.created_at, periodStart, periodEnd) ||
      isWithinPeriod(request.livraison_prevue_le, periodStart, periodEnd) ||
      request.statut_commande !== "livre",
  );
  const filteredChangeOrders = changeOrderResult.changeOrders.filter((row) =>
    isWithinPeriod(row.created_at, periodStart, periodEnd),
  );

  const reportTasks: ChantierReportTaskItem[] = filteredTasks
    .map((task) => ({
      id: task.id,
      titre: task.titre,
      lot: resolveTaskLot(task),
      status: task.status,
      quality_status: task.quality_status,
      date_debut: task.date_debut ?? task.date,
      date_fin: task.date_fin ?? task.date,
      temps_prevu_h: normalizeNumber(task.temps_prevu_h),
      temps_reel_h: normalizeNumber(task.temps_reel_h),
    }))
    .sort((a, b) => (a.date_debut ?? "").localeCompare(b.date_debut ?? "") || a.lot.localeCompare(b.lot, "fr"));

  const reportReserves: ChantierReportReserveItem[] = filteredReserves.map((reserve) => ({
    id: String(reserve.id ?? ""),
    title: String(reserve.title ?? "Reserve"),
    status: String(reserve.status ?? "OUVERTE"),
    priority: String(reserve.priority ?? "NORMALE"),
    zone_nom: reserve.zone_nom ?? null,
    intervenant_nom: reserve.intervenant_nom ?? null,
    created_at: reserve.created_at ?? null,
  }));

  const reportTimeEntries: ChantierReportTimeItem[] = filteredTimeEntries.map((entry) => {
    const task = entry.task_id ? taskById.get(entry.task_id) : undefined;
    return {
      id: entry.id,
      work_date: entry.work_date,
      duration_hours: normalizeNumber(entry.duration_hours),
      note: entry.note ?? null,
      task_titre: task?.titre ?? "Temps chantier",
      intervenant_nom: intervenantNameById.get(entry.intervenant_id) ?? "Intervenant",
    };
  });

  const reportPurchases: ChantierReportPurchaseItem[] = filteredPurchases.map((request) => ({
    id: request.id,
    titre: request.titre,
    statut_commande: request.statut_commande,
    supplier_name: request.supplier_name,
    task_titre: request.task_id ? taskById.get(request.task_id)?.titre ?? null : null,
    cout_prevu_ht: normalizeNumber(request.cout_prevu_ht),
    cout_reel_ht: normalizeNumber(request.cout_reel_ht),
  }));

  const reportChangeOrders: ChantierReportChangeOrderItem[] = filteredChangeOrders.map((row) => ({
    id: row.id,
    titre: row.titre,
    statut: row.statut,
    impact_temps_h: normalizeNumber(row.impact_temps_h),
    impact_cout_ht: normalizeNumber(row.impact_cout_ht),
    created_at: row.created_at,
  }));

  const summary: ChantierReportSummary = {
    avancement_pct: computeAvancementPct(chantier, tasks),
    taches_total: tasks.length,
    taches_terminees: tasks.filter((task) => task.status === "FAIT").length,
    taches_a_reprendre: tasks.filter((task) => task.quality_status === "a_reprendre").length,
    heures_periode_h: reportTimeEntries.reduce((sum, row) => sum + row.duration_hours, 0),
    reserves_ouvertes: reserves.filter((reserve) => reserve.status !== "LEVEE").length,
    reserves_urgentes: reserves.filter((reserve) => reserve.status !== "LEVEE" && reserve.priority === "URGENTE").length,
    achats_non_livres: purchaseResult.requests.filter(
      (request) => request.statut_commande !== "livre" && request.statut_commande !== "annule",
    ).length,
    avenants_valides_ht: reportChangeOrders
      .filter((row) => row.statut === "valide" || row.statut === "integre")
      .reduce((sum, row) => sum + row.impact_cout_ht, 0),
    marge_reelle_pct: budget.margeReellePct,
    budget_depassement_ht: budget.depassementBudgetHt,
  };

  return {
    chantier,
    periodStart,
    periodEnd,
    generatedAt: new Date().toISOString(),
    preparation: preparationResult.checklist,
    preparationSchemaReady: preparationResult.schemaReady,
    budget,
    summary,
    tasks: reportTasks,
    reserves: reportReserves,
    timeEntries: reportTimeEntries,
    purchases: reportPurchases,
    changeOrders: reportChangeOrders,
  };
}
