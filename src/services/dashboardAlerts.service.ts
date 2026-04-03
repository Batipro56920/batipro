import { supabase } from "../lib/supabaseClient";
import type { ChantierRow } from "./chantiers.service";

export type DashboardAlertCategory = "reserve" | "task" | "purchase" | "preparation";
export type DashboardAlertTone = "danger" | "warning";

export type DashboardAlertRow = {
  id: string;
  chantier_id: string;
  chantier_nom: string;
  category: DashboardAlertCategory;
  tone: DashboardAlertTone;
  title: string;
  detail: string;
  href: string;
  sort_at: string;
};

type RawReserveRow = {
  id: string;
  chantier_id: string;
  title: string | null;
  priority: string | null;
  status: string | null;
  created_at: string | null;
};

type RawTaskRow = {
  id: string;
  chantier_id: string;
  titre: string | null;
  quality_status: string | null;
  status: string | null;
  reprise_reason: string | null;
  date: string | null;
  date_debut: string | null;
  date_fin: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type RawPurchaseRow = {
  id: string;
  chantier_id: string;
  titre: string | null;
  statut_commande: string | null;
  livraison_prevue_le: string | null;
  created_at: string | null;
};

type RawPreparationRow = {
  chantier_id: string;
  statut: string | null;
  commentaire: string | null;
  updated_at: string | null;
  created_at: string | null;
};

function isMissingDashboardSchemaError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "42703" || code === "PGRST205") return true;
  return msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find");
}

function asText(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function parseIsoDate(value: string | null): number {
  if (!value) return Number.NaN;
  const timestamp = Date.parse(`${value}T00:00:00`);
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

function normalizeReserveStatus(value: unknown): string {
  return String(value ?? "").trim().toUpperCase() || "OUVERTE";
}

function normalizeReservePriority(value: unknown): string {
  return String(value ?? "").trim().toUpperCase() || "NORMALE";
}

function normalizeTaskQualityStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase() || "a_faire";
}

function normalizeTaskStatus(value: unknown): string {
  return String(value ?? "").trim().toUpperCase() || "A_FAIRE";
}

function normalizePurchaseStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase() || "a_commander";
}

async function safeQuery<T>(query: PromiseLike<{ data: T | null; error: any }>, fallback: T): Promise<T> {
  const result = await query;
  if (!result.error) return result.data ?? fallback;
  if (isMissingDashboardSchemaError(result.error)) return fallback;
  throw result.error;
}

export async function listDashboardAlerts(chantiers: ChantierRow[]): Promise<DashboardAlertRow[]> {
  const chantierIds = chantiers.map((chantier) => chantier.id).filter(Boolean);
  if (chantierIds.length === 0) return [];

  const chantierNameById = new Map(chantiers.map((chantier) => [chantier.id, chantier.nom]));
  const todayTime = parseIsoDate(new Date().toISOString().slice(0, 10));

  const [reserves, tasks, purchases, preparation] = await Promise.all([
    safeQuery<RawReserveRow[]>(
      (supabase as any)
        .from("chantier_reserves")
        .select("id, chantier_id, title, priority, status, created_at")
        .in("chantier_id", chantierIds)
        .order("created_at", { ascending: false }),
      [],
    ),
    safeQuery<RawTaskRow[]>(
      (supabase as any)
        .from("chantier_tasks")
        .select("id, chantier_id, titre, quality_status, status, reprise_reason, date, date_debut, date_fin, updated_at, created_at")
        .in("chantier_id", chantierIds)
        .order("updated_at", { ascending: false }),
      [],
    ),
    safeQuery<RawPurchaseRow[]>(
      (supabase as any)
        .from("chantier_purchase_requests")
        .select("id, chantier_id, titre, statut_commande, livraison_prevue_le, created_at")
        .in("chantier_id", chantierIds)
        .order("created_at", { ascending: false }),
      [],
    ),
    safeQuery<RawPreparationRow[]>(
      (supabase as any)
        .from("chantier_preparation_checklists")
        .select("chantier_id, statut, commentaire, updated_at, created_at")
        .in("chantier_id", chantierIds),
      [],
    ),
  ]);

  const alerts: DashboardAlertRow[] = [];

  for (const row of reserves) {
    const status = normalizeReserveStatus(row.status);
    const priority = normalizeReservePriority(row.priority);
    if (status === "LEVEE") continue;
    if (priority !== "URGENTE" && status !== "OUVERTE") continue;

    alerts.push({
      id: `reserve:${row.id}`,
      chantier_id: row.chantier_id,
      chantier_nom: chantierNameById.get(row.chantier_id) ?? "Chantier",
      category: "reserve",
      tone: priority === "URGENTE" ? "danger" : "warning",
      title: `Reserve ${priority === "URGENTE" ? "urgente" : "ouverte"}`,
      detail: asText(row.title, "Reserve chantier"),
      href: `/chantiers/${row.chantier_id}`,
      sort_at: row.created_at ?? "1970-01-01T00:00:00.000Z",
    });
  }

  for (const row of tasks) {
    const qualityStatus = normalizeTaskQualityStatus(row.quality_status);
    const taskStatus = normalizeTaskStatus(row.status);
    const dueDate = row.date_fin ?? row.date ?? row.date_debut;
    const isLate =
      Boolean(dueDate) &&
      parseIsoDate(dueDate) < todayTime &&
      taskStatus !== "FAIT" &&
      !["valide_admin", "termine_intervenant"].includes(qualityStatus);

    if (qualityStatus === "a_reprendre") {
      alerts.push({
        id: `task-reprise:${row.id}`,
        chantier_id: row.chantier_id,
        chantier_nom: chantierNameById.get(row.chantier_id) ?? "Chantier",
        category: "task",
        tone: "danger",
        title: "Tache a reprendre",
        detail: row.reprise_reason
          ? `${asText(row.titre, "Tache chantier")} - ${asText(row.reprise_reason, "Motif non renseigne")}`
          : asText(row.titre, "Tache chantier"),
        href: `/chantiers/${row.chantier_id}`,
        sort_at: row.updated_at ?? row.created_at ?? "1970-01-01T00:00:00.000Z",
      });
      continue;
    }

    if (isLate) {
      alerts.push({
        id: `task-late:${row.id}`,
        chantier_id: row.chantier_id,
        chantier_nom: chantierNameById.get(row.chantier_id) ?? "Chantier",
        category: "task",
        tone: "warning",
        title: "Tache en retard",
        detail: `${asText(row.titre, "Tache chantier")} - echeance ${dueDate}`,
        href: `/chantiers/${row.chantier_id}`,
        sort_at: row.updated_at ?? row.created_at ?? "1970-01-01T00:00:00.000Z",
      });
    }
  }

  for (const row of purchases) {
    const status = normalizePurchaseStatus(row.statut_commande);
    if (status === "livre" || status === "annule") continue;
    const expectedAt = row.livraison_prevue_le;
    const isLate = Boolean(expectedAt) && parseIsoDate(expectedAt) < todayTime;

    alerts.push({
      id: `purchase:${row.id}`,
      chantier_id: row.chantier_id,
      chantier_nom: chantierNameById.get(row.chantier_id) ?? "Chantier",
      category: "purchase",
      tone: isLate || status === "a_commander" ? "warning" : "danger",
      title: isLate ? "Approvisionnement en retard" : status === "a_commander" ? "Approvisionnement a commander" : "Approvisionnement non livre",
      detail: expectedAt
        ? `${asText(row.titre, "Demande fournisseur")} - livraison prevue ${expectedAt}`
        : asText(row.titre, "Demande fournisseur"),
      href: `/chantiers/${row.chantier_id}`,
      sort_at: row.created_at ?? "1970-01-01T00:00:00.000Z",
    });
  }

  for (const row of preparation) {
    if (String(row.statut ?? "").trim().toLowerCase() !== "chantier_incomplet") continue;
    alerts.push({
      id: `preparation:${row.chantier_id}`,
      chantier_id: row.chantier_id,
      chantier_nom: chantierNameById.get(row.chantier_id) ?? "Chantier",
      category: "preparation",
      tone: "warning",
      title: "Preparation incomplete",
      detail: asText(row.commentaire, "Checklist preparation chantier a finaliser"),
      href: `/chantiers/${row.chantier_id}`,
      sort_at: row.updated_at ?? row.created_at ?? "1970-01-01T00:00:00.000Z",
    });
  }

  return alerts.sort((a, b) => {
    if (a.tone !== b.tone) return a.tone === "danger" ? -1 : 1;
    const timeDiff = Date.parse(b.sort_at) - Date.parse(a.sort_at);
    if (timeDiff !== 0) return timeDiff;
    return a.chantier_nom.localeCompare(b.chantier_nom, "fr");
  });
}
