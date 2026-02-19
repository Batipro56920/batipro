import type { ChantierRow } from "../services/chantiers.service";
import { listByChantier as listDocumentsByChantier } from "../services/chantierDocuments.service";
import { getTasksByChantierId } from "../services/chantierTasks.service";
import { listIntervenantsByChantierId } from "../services/intervenants.service";
import { getPlanningEntries } from "../features/planning/planning.service";
import { listReservesByChantierId } from "../services/reserves.service";

export type VisiteSnapshotLot = {
  lot: string;
  tasks_total: number;
  tasks_faites?: number;
  tasks_retard: number;
  comment: string;
};

export type VisiteSnapshotTaskFocus = {
  id: string;
  titre: string;
  lot: string | null;
  statut: string;
  intervenant: string | null;
  date_prevue: string | null;
  retard: boolean;
};

export type VisiteSnapshotReserveFocus = {
  id: string;
  titre: string;
  description?: string | null;
  statut: string;
  priority?: string | null;
  lot: string | null;
  intervenant: string | null;
  plan_document_id: string | null;
  page: number | null;
  markers_count: number | null;
  photos_count: number | null;
};

export type VisiteSnapshotPlanning = {
  id: string;
  label: string;
  date_debut: string | null;
  date_fin: string | null;
  retard: boolean;
};

export type VisiteSnapshotDocument = {
  id: string;
  titre: string;
  categorie: string;
  created_at: string;
};

export type VisiteSnapshotIntervenant = {
  nom: string;
  tasks_total: number;
  tasks_retard: number;
  tasks_faites: number;
};

export type VisiteSnapshot = {
  generated_at: string;
  chantier: {
    id: string;
    nom: string | null;
    adresse: string | null;
  };
  stats: {
    avancement_pct: number;
    tasks_total: number;
    tasks_en_cours: number;
    tasks_retard: number;
    reserves_ouvertes: number;
    reserves_levees: number;
    docs_total: number;
  };
  lots: VisiteSnapshotLot[];
  intervenants: VisiteSnapshotIntervenant[];
  tasks_realisees: VisiteSnapshotTaskFocus[];
  tasks_a_faire: VisiteSnapshotTaskFocus[];
  tasks_focus: VisiteSnapshotTaskFocus[];
  reserves_focus: VisiteSnapshotReserveFocus[];
  planning: VisiteSnapshotPlanning[];
  documents: VisiteSnapshotDocument[];
};

function normalizeText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeDateOnly(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function isTaskLate(date: string | null, status: string): boolean {
  if (!date) return false;
  if (isTaskDoneStatus(status)) return false;
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const due = new Date(`${date}T00:00:00Z`);
  return due.getTime() < today.getTime();
}

function isTaskDoneStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return normalized === "FAIT" || normalized === "TERMINE" || normalized === "DONE";
}

function parseSnapshot(input: unknown): VisiteSnapshot {
  const fallback: VisiteSnapshot = {
    generated_at: new Date().toISOString(),
    chantier: { id: "", nom: null, adresse: null },
    stats: {
      avancement_pct: 0,
      tasks_total: 0,
      tasks_en_cours: 0,
      tasks_retard: 0,
      reserves_ouvertes: 0,
      reserves_levees: 0,
      docs_total: 0,
    },
    lots: [],
    intervenants: [],
    tasks_realisees: [],
    tasks_a_faire: [],
    tasks_focus: [],
    reserves_focus: [],
    planning: [],
    documents: [],
  };

  if (!input || typeof input !== "object") return fallback;
  const raw = input as Record<string, any>;
  const stats = raw.stats && typeof raw.stats === "object" ? raw.stats : {};
  return {
    generated_at: normalizeText(raw.generated_at, fallback.generated_at),
    chantier: {
      id: normalizeText(raw.chantier?.id, ""),
      nom: raw.chantier?.nom ? String(raw.chantier.nom) : null,
      adresse: raw.chantier?.adresse ? String(raw.chantier.adresse) : null,
    },
    stats: {
      avancement_pct: Number.isFinite(Number(stats.avancement_pct)) ? Number(stats.avancement_pct) : 0,
      tasks_total: Number.isFinite(Number(stats.tasks_total)) ? Number(stats.tasks_total) : 0,
      tasks_en_cours: Number.isFinite(Number(stats.tasks_en_cours)) ? Number(stats.tasks_en_cours) : 0,
      tasks_retard: Number.isFinite(Number(stats.tasks_retard)) ? Number(stats.tasks_retard) : 0,
      reserves_ouvertes: Number.isFinite(Number(stats.reserves_ouvertes)) ? Number(stats.reserves_ouvertes) : 0,
      reserves_levees: Number.isFinite(Number(stats.reserves_levees)) ? Number(stats.reserves_levees) : 0,
      docs_total: Number.isFinite(Number(stats.docs_total)) ? Number(stats.docs_total) : 0,
    },
    lots: Array.isArray(raw.lots) ? raw.lots : [],
    intervenants: Array.isArray(raw.intervenants) ? raw.intervenants : [],
    tasks_realisees: Array.isArray(raw.tasks_realisees) ? raw.tasks_realisees : [],
    tasks_a_faire: Array.isArray(raw.tasks_a_faire) ? raw.tasks_a_faire : [],
    tasks_focus: Array.isArray(raw.tasks_focus) ? raw.tasks_focus : [],
    reserves_focus: Array.isArray(raw.reserves_focus) ? raw.reserves_focus : [],
    planning: Array.isArray(raw.planning) ? raw.planning : [],
    documents: Array.isArray(raw.documents) ? raw.documents : [],
  };
}

export function validateVisiteSnapshot(input: unknown): VisiteSnapshot {
  return parseSnapshot(input);
}

export async function buildVisiteSnapshot(input: {
  chantierId: string;
  chantier?: Pick<ChantierRow, "id" | "nom" | "adresse"> | null;
}): Promise<VisiteSnapshot> {
  const chantierId = input.chantierId;
  if (!chantierId) throw new Error("chantierId manquant.");

  const [tasks, reserves, planningEntries, documents, intervenants] = await Promise.all([
    getTasksByChantierId(chantierId),
    listReservesByChantierId(chantierId),
    getPlanningEntries(chantierId).catch(() => []),
    listDocumentsByChantier(chantierId),
    listIntervenantsByChantierId(chantierId).catch(() => []),
  ]);

  const intervenantById = new Map(intervenants.map((it) => [it.id, it.nom]));
  const tasksTotal = tasks.length;
  const tasksEnCours = tasks.filter((t) => t.status === "EN_COURS").length;
  const tasksRetard = tasks.filter((t) => isTaskLate(normalizeDateOnly(t.date), t.status)).length;
  const tasksFaites = tasks.filter((t) => isTaskDoneStatus(t.status)).length;
  const avancement = tasksTotal ? Math.round((tasksFaites / tasksTotal) * 100) : 0;

  const reservesOuvertes = reserves.filter((r) => (r.status ?? "OUVERTE") !== "LEVEE").length;
  const reservesLevees = reserves.filter((r) => (r.status ?? "OUVERTE") === "LEVEE").length;

  const lotMap = new Map<string, { total: number; retard: number; faites: number }>();
  for (const task of tasks) {
    const lot = normalizeText(task.corps_etat, "Divers");
    const current = lotMap.get(lot) ?? { total: 0, retard: 0, faites: 0 };
    current.total += 1;
    if (isTaskDoneStatus(task.status)) current.faites += 1;
    if (isTaskLate(normalizeDateOnly(task.date), task.status)) current.retard += 1;
    lotMap.set(lot, current);
  }

  const lots: VisiteSnapshotLot[] = Array.from(lotMap.entries())
    .map(([lot, values]) => ({
      lot,
      tasks_total: values.total,
      tasks_faites: values.faites,
      tasks_retard: values.retard,
      comment: "",
    }))
    .sort((a, b) => a.lot.localeCompare(b.lot, "fr"));

  const intervenantMap = new Map<string, { total: number; retard: number; faites: number }>();
  for (const task of tasks) {
    const nomIntervenant = task.intervenant_id ? intervenantById.get(task.intervenant_id) ?? "Non assigne" : "Non assigne";
    const current = intervenantMap.get(nomIntervenant) ?? { total: 0, retard: 0, faites: 0 };
    current.total += 1;
    if (isTaskDoneStatus(task.status)) current.faites += 1;
    if (isTaskLate(normalizeDateOnly(task.date), task.status)) current.retard += 1;
    intervenantMap.set(nomIntervenant, current);
  }

  const intervenantsStats: VisiteSnapshotIntervenant[] = Array.from(intervenantMap.entries())
    .map(([nom, values]) => ({
      nom,
      tasks_total: values.total,
      tasks_retard: values.retard,
      tasks_faites: values.faites,
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  const normalizedTasks: VisiteSnapshotTaskFocus[] = tasks
    .map((task) => {
      const datePrevue = normalizeDateOnly(task.date);
      const retard = isTaskLate(datePrevue, task.status);
      return {
        id: task.id,
        titre: normalizeText(task.titre, "Tache"),
        lot: task.corps_etat ?? null,
        statut: task.status,
        intervenant: task.intervenant_id ? intervenantById.get(task.intervenant_id) ?? null : null,
        date_prevue: datePrevue,
        retard,
      };
    });

  const tasksDone: VisiteSnapshotTaskFocus[] = normalizedTasks
    .filter((task) => isTaskDoneStatus(task.statut))
    .slice(0, 220);

  const tasksTodo: VisiteSnapshotTaskFocus[] = normalizedTasks
    .filter((task) => !isTaskDoneStatus(task.statut))
    .slice(0, 220);

  const tasksFocus: VisiteSnapshotTaskFocus[] = tasksTodo.slice(0, 120);

  const reservesFocus: VisiteSnapshotReserveFocus[] = reserves
    .filter((reserve) => {
      const status = (reserve.status ?? "OUVERTE").toUpperCase();
      const priority = (reserve.priority ?? "NORMALE").toUpperCase();
      return status !== "LEVEE" || priority === "URGENTE";
    })
    .map((reserve) => ({
      id: reserve.id,
      titre: normalizeText(reserve.title, "Reserve"),
      description: reserve.description ?? null,
      statut: reserve.status ?? "OUVERTE",
      priority: reserve.priority ?? null,
      lot: null,
      intervenant: reserve.intervenant_id ? intervenantById.get(reserve.intervenant_id) ?? null : null,
      plan_document_id: null,
      page: null,
      markers_count: null,
      photos_count: null,
    }))
    .slice(0, 120);

  const now = new Date();
  const nowTs = now.getTime();
  const maxTs = nowTs + 14 * 24 * 60 * 60 * 1000;
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const planning: VisiteSnapshotPlanning[] = planningEntries
    .map((entry) => {
      const linkedTask = taskById.get(entry.task_id);
      const linkedIntervenantName =
        (Array.isArray(entry.assigned_intervenant_ids) ? entry.assigned_intervenant_ids : [])
          .map((id) => intervenantById.get(id))
          .filter((name): name is string => Boolean(name))
          .join(", ") ||
        (linkedTask?.intervenant_id ? intervenantById.get(linkedTask.intervenant_id) ?? "" : "");
      const taskLabel = linkedTask?.titre?.trim() || entry.task_id;
      const label = linkedIntervenantName ? `${taskLabel} (${linkedIntervenantName})` : taskLabel;

      const end = entry.end_date ? new Date(`${entry.end_date}T00:00:00`).getTime() : null;
      const retard = Boolean(end && end < nowTs);
      return {
        id: entry.id,
        label,
        date_debut: normalizeDateOnly(entry.start_date),
        date_fin: normalizeDateOnly(entry.end_date),
        retard,
      };
    })
    .filter((item) => {
      if (!item.date_debut && !item.date_fin) return false;
      const start = item.date_debut ? new Date(`${item.date_debut}T00:00:00`).getTime() : null;
      const end = item.date_fin ? new Date(`${item.date_fin}T00:00:00`).getTime() : null;
      if (item.retard) return true;
      if (start && start >= nowTs && start <= maxTs) return true;
      if (end && end >= nowTs && end <= maxTs) return true;
      return false;
    })
    .slice(0, 40);

  const docRows: VisiteSnapshotDocument[] = documents
    .map((doc) => ({
      id: doc.id,
      titre: normalizeText(doc.title, "Document"),
      categorie: normalizeText(doc.category, "Divers"),
      created_at: doc.created_at ?? new Date().toISOString(),
    }))
    .slice(0, 60);

  return {
    generated_at: new Date().toISOString(),
    chantier: {
      id: chantierId,
      nom: input.chantier?.nom ?? null,
      adresse: input.chantier?.adresse ?? null,
    },
    stats: {
      avancement_pct: avancement,
      tasks_total: tasksTotal,
      tasks_en_cours: tasksEnCours,
      tasks_retard: tasksRetard,
      reserves_ouvertes: reservesOuvertes,
      reserves_levees: reservesLevees,
      docs_total: documents.length,
    },
    lots,
    intervenants: intervenantsStats,
    tasks_realisees: tasksDone,
    tasks_a_faire: tasksTodo,
    tasks_focus: tasksFocus,
    reserves_focus: reservesFocus,
    planning,
    documents: docRows,
  };
}
