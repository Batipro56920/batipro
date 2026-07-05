import type { ChantierStatus } from "../../../../types/chantier";
import type { ChantierRow } from "../../../../services/chantiers.service";
import type { ChantierDerived, ChantierListFilters } from "../types";

const ACTIVE_STATUSES: ChantierStatus[] = ["PREPARATION", "EN_COURS", "EN_PAUSE"];
const DONE_STATUSES: ChantierStatus[] = ["TERMINE", "ARCHIVE", "ANNULE"];

type TerrainFeedbackSummary = {
  open: number;
  priority: number;
};

function openTerrainFeedbackCount(row: ChantierDerived) {
  return row.terrainFeedbackOpenCount ?? 0;
}

function priorityTerrainFeedbackCount(row: ChantierDerived) {
  return row.terrainFeedbackPriorityCount ?? 0;
}

function hasOpenTerrainFeedback(row: ChantierDerived) {
  return openTerrainFeedbackCount(row) > 0;
}

function hasPriorityTerrainFeedback(row: ChantierDerived) {
  return priorityTerrainFeedbackCount(row) > 0;
}

function hasChantierAlert(row: ChantierDerived) {
  return row.isLate || (row.timeRatio !== null && row.timeRatio > 1.1) || hasOpenTerrainFeedback(row);
}

function terrainFeedbackSearchTerms(row: ChantierDerived) {
  const terms: string[] = [];
  if (openTerrainFeedbackCount(row) > 0) {
    terms.push("retours terrain alertes terrain observations terrain a traiter");
  }
  if (priorityTerrainFeedbackCount(row) > 0) {
    terms.push("urgent critique priorite blocage anomalie qualite reserve a traiter");
  }
  return terms.join(" ");
}

export function currency(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value));
}

export function budgetLabel(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value)) || Number(value) <= 0) return "Budget non renseigné";
  return currency(value);
}

export function timeLabel(planned: number | null | undefined, spent: number | null | undefined) {
  const plannedValue = Number(planned ?? 0);
  const spentValue = Number(spent ?? 0);
  if (plannedValue <= 0 && spentValue <= 0) return "Temps non planifié";
  return `${spentValue.toFixed(0)}h / ${plannedValue.toFixed(0)}h`;
}

export function shortDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function hasCommercialContext(row: ChantierRow) {
  return Boolean(
    row.crm_quote_id ||
      row.crm_opportunity_id ||
      row.crm_prospect_id ||
      row.crm_client_id ||
      row.signed_quote_amount_ht ||
      row.signed_quote_amount_ttc ||
      row.crm_client_phone ||
      row.crm_client_email,
  );
}

export function commercialSourceLabel(row: ChantierRow) {
  if (row.crm_quote_id && (row.signed_quote_amount_ht || row.signed_quote_amount_ttc)) return "Devis signé";
  if (row.crm_quote_id) return "Devis rattaché";
  if (row.crm_opportunity_id) return "Opportunité CRM";
  if (row.crm_prospect_id) return "Prospect CRM";
  if (row.crm_client_id) return "Client CRM";
  return "Chantier seul";
}

export function commercialAmountLabel(row: ChantierRow) {
  const amount = row.signed_quote_amount_ht ?? row.signed_quote_amount_ttc ?? null;
  return amount ? currency(amount) : "Montant non renseigné";
}

export function deriveChantier(
  row: ChantierRow,
  today = new Date().toISOString().slice(0, 10),
  terrainFeedbackSummary: TerrainFeedbackSummary = { open: 0, priority: 0 },
): ChantierDerived {
  const progress = Math.min(100, Math.max(0, Number(row.avancement ?? 0)));
  const endDate = row.date_fin_prevue ?? row.planning_end_date ?? null;
  const status = row.status ?? "PREPARATION";
  const isLate = Boolean(endDate && endDate.slice(0, 10) < today && !DONE_STATUSES.includes(status));
  const plannedCosts =
    Number(row.budget_labor_planned_ht ?? 0) +
    Number(row.budget_materials_planned_ht ?? 0) +
    Number(row.budget_subcontracting_planned_ht ?? 0);
  const budgetHt = row.signed_quote_amount_ht === null || row.signed_quote_amount_ht === undefined ? null : Number(row.signed_quote_amount_ht);
  const estimatedMargin = budgetHt === null || plannedCosts <= 0 ? null : budgetHt - plannedCosts;
  const plannedHours = Number(row.heures_prevues ?? 0);
  const timeRatio = plannedHours > 0 ? Number(row.heures_passees ?? 0) / plannedHours : null;

  return {
    ...row,
    progress,
    isLate,
    budgetHt,
    estimatedMargin,
    timeRatio,
    terrainFeedbackOpenCount: terrainFeedbackSummary.open,
    terrainFeedbackPriorityCount: terrainFeedbackSummary.priority,
  };
}

export function filterChantiers(rows: ChantierDerived[], filters: ChantierListFilters) {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.client && (row.client ?? "") !== filters.client) return false;
    if (filters.period === "late" && !row.isLate) return false;
    if (filters.period === "alerts" && !hasChantierAlert(row)) return false;
    if (filters.period === "terrain_feedback" && !hasOpenTerrainFeedback(row)) return false;
    if (filters.period === "terrain_feedback_priority" && !hasPriorityTerrainFeedback(row)) return false;
    if (filters.period === "this_month" && !isInCurrentMonthWindow(row)) return false;
    if (filters.period === "next_30" && !isInNextDaysWindow(row, 30)) return false;
    if (!query) return true;
    return [
      row.nom,
      row.client,
      row.adresse,
      row.crm_project_description,
      commercialSourceLabel(row),
      row.crm_client_email,
      row.crm_client_phone,
      terrainFeedbackSearchTerms(row),
    ].some((value) => String(value ?? "").toLowerCase().includes(query));
  });
}

export function computeChantierMetrics(rows: ChantierDerived[]) {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const active = rows.filter((row) => ACTIVE_STATUSES.includes(row.status)).length;
  const preparation = rows.filter((row) => row.status === "PREPARATION").length;
  const late = rows.filter((row) => row.isLate).length;
  const alerts = rows.filter(hasChantierAlert).length;
  const terrainFeedbackOpen = rows.reduce((total, row) => total + openTerrainFeedbackCount(row), 0);
  const terrainFeedbackPriority = rows.reduce((total, row) => total + priorityTerrainFeedbackCount(row), 0);
  const completedThisMonth = rows.filter((row) => row.status === "TERMINE" && (row.completed_at ?? row.lifecycle_updated_at ?? "").startsWith(thisMonth)).length;
  const marginValues = rows.map((row) => row.estimatedMargin).filter((value): value is number => value !== null);
  const estimatedMargin = marginValues.length ? marginValues.reduce((sum, value) => sum + value, 0) : null;

  return { active, preparation, late, alerts, completedThisMonth, estimatedMargin, terrainFeedbackOpen, terrainFeedbackPriority };
}

export function uniqueClients(rows: ChantierDerived[]) {
  return Array.from(new Set(rows.map((row) => row.client).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b));
}

export function statusLabel(status: ChantierStatus) {
  const labels: Record<ChantierStatus, string> = {
    BROUILLON: "Brouillon",
    PREPARATION: "Préparation",
    EN_COURS: "En cours",
    EN_PAUSE: "En pause",
    TERMINE: "Terminé",
    ARCHIVE: "Archivé",
    ANNULE: "Annulé",
  };
  return labels[status] ?? status;
}

export function exportChantiersCsv(rows: ChantierRow[], filename = "chantiers.csv") {
  const header = ["Nom", "Client", "Adresse", "Statut", "Avancement", "Budget HT", "Source commerciale", "Montant devis signé", "Date fin"];
  const lines = rows.map((row) => [
    row.nom,
    row.client ?? "",
    row.adresse ?? "",
    row.status ?? "",
    String(row.avancement ?? 0),
    String(row.signed_quote_amount_ht ?? ""),
    commercialSourceLabel(row),
    String(row.signed_quote_amount_ttc ?? row.signed_quote_amount_ht ?? ""),
    row.date_fin_prevue ?? row.planning_end_date ?? "",
  ]);
  const csv = [header, ...lines].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getChantierPlanningWindow(row: ChantierDerived) {
  const start = row.planning_start_date ?? row.date_debut ?? row.date_fin_prevue ?? row.planning_end_date ?? null;
  const end = row.date_fin_prevue ?? row.planning_end_date ?? row.date_debut ?? row.planning_start_date ?? null;
  return { start, end };
}

function normalizeDateValue(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function overlapsDateRange(row: ChantierDerived, rangeStart: Date, rangeEnd: Date) {
  const window = getChantierPlanningWindow(row);
  const start = normalizeDateValue(window.start);
  const end = normalizeDateValue(window.end);
  if (start === null && end === null) return false;
  const effectiveStart = start ?? end;
  const effectiveEnd = end ?? start;
  if (effectiveStart === null || effectiveEnd === null) return false;
  return effectiveStart <= rangeEnd.getTime() && effectiveEnd >= rangeStart.getTime();
}

function isInCurrentMonthWindow(row: ChantierDerived) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return overlapsDateRange(row, monthStart, monthEnd);
}

function isInNextDaysWindow(row: ChantierDerived, days: number) {
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rangeEnd = new Date(rangeStart.getTime() + days * 24 * 60 * 60 * 1000);
  rangeEnd.setHours(23, 59, 59, 999);
  return overlapsDateRange(row, rangeStart, rangeEnd);
}