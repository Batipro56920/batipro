import type { ChantierStatus } from "../../../../types/chantier";
import type { ChantierRow } from "../../../../services/chantiers.service";
import type { ChantierDerived, ChantierListFilters } from "../types";

const ACTIVE_STATUSES: ChantierStatus[] = ["PREPARATION", "EN_COURS", "EN_PAUSE"];
const DONE_STATUSES: ChantierStatus[] = ["TERMINE", "ARCHIVE", "ANNULE"];

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

export function deriveChantier(row: ChantierRow, today = new Date().toISOString().slice(0, 10)): ChantierDerived {
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

  return { ...row, progress, isLate, budgetHt, estimatedMargin, timeRatio };
}

export function filterChantiers(rows: ChantierDerived[], filters: ChantierListFilters) {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.client && (row.client ?? "") !== filters.client) return false;
    if (filters.period === "late" && !row.isLate) return false;
    if (filters.period === "this_month" && !isInCurrentMonth(row.date_fin_prevue ?? row.planning_end_date)) return false;
    if (filters.period === "next_30" && !isInNextDays(row.date_fin_prevue ?? row.planning_end_date, 30)) return false;
    if (!query) return true;
    return [row.nom, row.client, row.adresse, row.crm_project_description].some((value) => String(value ?? "").toLowerCase().includes(query));
  });
}

export function computeChantierMetrics(rows: ChantierDerived[]) {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const active = rows.filter((row) => ACTIVE_STATUSES.includes(row.status)).length;
  const preparation = rows.filter((row) => row.status === "PREPARATION").length;
  const late = rows.filter((row) => row.isLate).length;
  const alerts = rows.filter((row) => row.isLate || (row.timeRatio !== null && row.timeRatio > 1.1)).length;
  const completedThisMonth = rows.filter((row) => row.status === "TERMINE" && (row.completed_at ?? row.lifecycle_updated_at ?? "").startsWith(thisMonth)).length;
  const marginValues = rows.map((row) => row.estimatedMargin).filter((value): value is number => value !== null);
  const estimatedMargin = marginValues.length ? marginValues.reduce((sum, value) => sum + value, 0) : null;

  return { active, preparation, late, alerts, completedThisMonth, estimatedMargin };
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
  const header = ["Nom", "Client", "Adresse", "Statut", "Avancement", "Budget HT", "Date fin"];
  const lines = rows.map((row) => [
    row.nom,
    row.client ?? "",
    row.adresse ?? "",
    row.status ?? "",
    String(row.avancement ?? 0),
    String(row.signed_quote_amount_ht ?? ""),
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

function isInCurrentMonth(value: string | null | undefined) {
  if (!value) return false;
  return value.slice(0, 7) === new Date().toISOString().slice(0, 7);
}

function isInNextDays(value: string | null | undefined, days: number) {
  if (!value) return false;
  const date = new Date(value).getTime();
  const now = Date.now();
  return date >= now && date <= now + days * 24 * 60 * 60 * 1000;
}
