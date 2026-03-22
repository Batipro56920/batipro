import { supabase } from "../lib/supabaseClient";
import { getChantiers, type ChantierRow } from "./chantiers.service";
import type { IntervenantRow } from "./intervenants.service";
import type { MaterielDemandeRow, MaterielStatus } from "./materielDemandes.service";
import type { TaskStatus } from "./chantierTasks.service";

export type StatisticsTaskRow = {
  id: string;
  chantier_id: string;
  titre: string;
  corps_etat: string | null;
  lot: string | null;
  date: string | null;
  date_debut: string | null;
  date_fin: string | null;
  status: TaskStatus;
  intervenant_id: string | null;
  quantite: number | null;
  quantite_realisee: number | null;
  unite: string | null;
  temps_prevu_h: number | null;
  temps_reel_h: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type StatisticsTimeEntryRow = {
  id: string;
  chantier_id: string;
  task_id: string | null;
  intervenant_id: string;
  work_date: string;
  duration_hours: number;
  quantite_realisee: number | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type StatisticsTaskAssigneeRow = {
  task_id: string;
  intervenant_id: string;
};

export type StatisticsReserveRow = {
  id: string;
  chantier_id: string;
  task_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  intervenant_id: string | null;
  levee_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type StatisticsInfoRequestRow = {
  id: string;
  chantier_id: string;
  intervenant_id: string;
  request_date: string;
  subject: string;
  message: string;
  status: "envoyee" | "traitee";
  created_at: string | null;
  updated_at: string | null;
};

export type StatisticsChecklistRow = {
  id: string;
  intervenant_id: string;
  chantier_id: string | null;
  checklist_date: string;
  photos_taken: boolean | null;
  tasks_reported: boolean | null;
  time_logged: boolean | null;
  has_equipment: boolean | null;
  has_materials: boolean | null;
  has_information: boolean | null;
  validated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type StatisticsDatasetAvailability = {
  tasks: boolean;
  timeEntries: boolean;
  taskAssignees: boolean;
  reserves: boolean;
  materielDemandes: boolean;
  informationRequests: boolean;
  dailyChecklists: boolean;
};

export type StatisticsDataset = {
  chantiers: ChantierRow[];
  intervenants: IntervenantRow[];
  tasks: StatisticsTaskRow[];
  timeEntries: StatisticsTimeEntryRow[];
  taskAssignees: StatisticsTaskAssigneeRow[];
  reserves: StatisticsReserveRow[];
  materielDemandes: MaterielDemandeRow[];
  informationRequests: StatisticsInfoRequestRow[];
  dailyChecklists: StatisticsChecklistRow[];
  availability: StatisticsDatasetAvailability;
  notes: string[];
};

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "t" || normalized === "1") return true;
  if (normalized === "false" || normalized === "f" || normalized === "0") return false;
  return null;
}

function isMissingRelationError(error: unknown, relation: string): boolean {
  const message = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  const code = String((error as { code?: string } | null)?.code ?? "");
  return code === "42P01" || (message.includes("relation") && message.includes(relation.toLowerCase()));
}

function isMissingColumnError(error: unknown, relation: string, columns: string[]): boolean {
  const message = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  const code = String((error as { code?: string } | null)?.code ?? "");
  if (code !== "42703" && !message.includes("column")) return false;
  if (!message.includes(relation.toLowerCase())) return false;
  return columns.some((column) => message.includes(column.toLowerCase()));
}

async function fetchTasksWithFallback(notes: string[]): Promise<{ rows: StatisticsTaskRow[]; available: boolean }> {
  const selectV2 = [
    "id",
    "chantier_id",
    "titre",
    "corps_etat",
    "lot",
    "date",
    "date_debut",
    "date_fin",
    "status",
    "intervenant_id",
    "quantite",
    "quantite_realisee",
    "unite",
    "temps_prevu_h",
    "temps_reel_h",
    "created_at",
    "updated_at",
  ].join(",");
  const selectV1 = [
    "id",
    "chantier_id",
    "titre",
    "corps_etat",
    "lot",
    "date",
    "date_debut",
    "date_fin",
    "status",
    "intervenant_id",
    "quantite",
    "unite",
    "temps_prevu_h",
    "temps_reel_h",
    "created_at",
    "updated_at",
  ].join(",");

  const first = await supabase.from("chantier_tasks").select(selectV2);
  if (first.error) {
    if (isMissingRelationError(first.error, "chantier_tasks")) {
      notes.push("Table chantier_tasks indisponible : les KPI tâches sont partiellement désactivés.");
      return { rows: [], available: false };
    }
    if (!isMissingColumnError(first.error, "chantier_tasks", ["quantite_realisee"])) throw first.error;

    const second = await supabase.from("chantier_tasks").select(selectV1);
    if (second.error) throw second.error;
    return {
      rows: (second.data ?? []).map((row: any) => ({
        id: String(row.id ?? ""),
        chantier_id: String(row.chantier_id ?? ""),
        titre: String(row.titre ?? "Sans titre"),
        corps_etat: normalizeText(row.corps_etat),
        lot: normalizeText(row.lot),
        date: normalizeText(row.date),
        date_debut: normalizeText(row.date_debut),
        date_fin: normalizeText(row.date_fin),
        status: (row.status ?? "A_FAIRE") as TaskStatus,
        intervenant_id: normalizeText(row.intervenant_id),
        quantite: normalizeNumber(row.quantite),
        quantite_realisee: null,
        unite: normalizeText(row.unite),
        temps_prevu_h: normalizeNumber(row.temps_prevu_h),
        temps_reel_h: normalizeNumber(row.temps_reel_h),
        created_at: normalizeText(row.created_at),
        updated_at: normalizeText(row.updated_at),
      })),
      available: true,
    };
  }

  return {
    rows: (first.data ?? []).map((row: any) => ({
      id: String(row.id ?? ""),
      chantier_id: String(row.chantier_id ?? ""),
      titre: String(row.titre ?? "Sans titre"),
      corps_etat: normalizeText(row.corps_etat),
      lot: normalizeText(row.lot),
      date: normalizeText(row.date),
      date_debut: normalizeText(row.date_debut),
      date_fin: normalizeText(row.date_fin),
      status: (row.status ?? "A_FAIRE") as TaskStatus,
      intervenant_id: normalizeText(row.intervenant_id),
      quantite: normalizeNumber(row.quantite),
      quantite_realisee: normalizeNumber(row.quantite_realisee),
      unite: normalizeText(row.unite),
      temps_prevu_h: normalizeNumber(row.temps_prevu_h),
      temps_reel_h: normalizeNumber(row.temps_reel_h),
      created_at: normalizeText(row.created_at),
      updated_at: normalizeText(row.updated_at),
    })),
    available: true,
  };
}

async function fetchTimeEntriesWithFallback(notes: string[]): Promise<{ rows: StatisticsTimeEntryRow[]; available: boolean }> {
  const selectV2 = "id, chantier_id, task_id, intervenant_id, work_date, duration_hours, quantite_realisee, note, created_at, updated_at";
  const selectV1 = "id, chantier_id, task_id, intervenant_id, work_date, duration_hours, note, created_at, updated_at";
  const first = await supabase.from("chantier_time_entries").select(selectV2);
  if (first.error) {
    if (isMissingRelationError(first.error, "chantier_time_entries")) {
      notes.push("Table chantier_time_entries indisponible : certains KPI temps ne sont pas calculables.");
      return { rows: [], available: false };
    }
    if (!isMissingColumnError(first.error, "chantier_time_entries", ["quantite_realisee"])) throw first.error;
    const second = await supabase.from("chantier_time_entries").select(selectV1);
    if (second.error) throw second.error;
    return {
      rows: (second.data ?? []).map((row: any) => ({
        id: String(row.id ?? ""),
        chantier_id: String(row.chantier_id ?? ""),
        task_id: normalizeText(row.task_id),
        intervenant_id: String(row.intervenant_id ?? ""),
        work_date: String(row.work_date ?? ""),
        duration_hours: Number(row.duration_hours ?? 0) || 0,
        quantite_realisee: null,
        note: normalizeText(row.note),
        created_at: normalizeText(row.created_at),
        updated_at: normalizeText(row.updated_at),
      })),
      available: true,
    };
  }
  return {
    rows: (first.data ?? []).map((row: any) => ({
      id: String(row.id ?? ""),
      chantier_id: String(row.chantier_id ?? ""),
      task_id: normalizeText(row.task_id),
      intervenant_id: String(row.intervenant_id ?? ""),
      work_date: String(row.work_date ?? ""),
      duration_hours: Number(row.duration_hours ?? 0) || 0,
      quantite_realisee: normalizeNumber(row.quantite_realisee),
      note: normalizeText(row.note),
      created_at: normalizeText(row.created_at),
      updated_at: normalizeText(row.updated_at),
    })),
    available: true,
  };
}

async function fetchOptionalTable<T>(
  table: string,
  select: string,
  mapRow: (row: any) => T,
  notes: string[],
  unavailableNote: string,
): Promise<{ rows: T[]; available: boolean }> {
  const result = await supabase.from(table).select(select);
  if (result.error) {
    if (isMissingRelationError(result.error, table)) {
      notes.push(unavailableNote);
      return { rows: [], available: false };
    }
    throw result.error;
  }
  return { rows: (result.data ?? []).map((row: any) => mapRow(row)), available: true };
}

function normalizeMaterielStatus(value: unknown): MaterielStatus {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "validee") return "validee";
  if (normalized === "refusee") return "refusee";
  if (normalized === "livree") return "livree";
  return "en_attente";
}

export async function loadStatisticsDataset(): Promise<StatisticsDataset> {
  const notes: string[] = [];
  const [
    chantiers,
    intervenantsRes,
    tasksRes,
    timeEntriesRes,
    taskAssigneesRes,
    reservesRes,
    materielRes,
    infoRequestsRes,
    dailyChecklistsRes,
  ] = await Promise.all([
    getChantiers(),
    fetchOptionalTable<IntervenantRow>(
      "intervenants",
      "id, chantier_id, nom, email, telephone, created_at",
      (row) => ({
        id: String(row.id ?? ""),
        chantier_id: normalizeText(row.chantier_id),
        nom: String(row.nom ?? "Sans nom"),
        email: normalizeText(row.email),
        telephone: normalizeText(row.telephone),
        created_at: normalizeText(row.created_at),
      }),
      notes,
      "Table intervenants indisponible : certains regroupements par intervenant sont désactivés.",
    ),
    fetchTasksWithFallback(notes),
    fetchTimeEntriesWithFallback(notes),
    fetchOptionalTable<StatisticsTaskAssigneeRow>(
      "chantier_task_assignees",
      "task_id, intervenant_id",
      (row) => ({
        task_id: String(row.task_id ?? ""),
        intervenant_id: String(row.intervenant_id ?? ""),
      }),
      notes,
      "Table chantier_task_assignees indisponible : la multi-affectation des tâches n'est pas visible dans les statistiques.",
    ),
    fetchOptionalTable<StatisticsReserveRow>(
      "chantier_reserves",
      "id, chantier_id, task_id, title, description, status, priority, intervenant_id, levee_at, created_at, updated_at",
      (row) => ({
        id: String(row.id ?? ""),
        chantier_id: String(row.chantier_id ?? ""),
        task_id: normalizeText(row.task_id),
        title: String(row.title ?? "Réserve"),
        description: normalizeText(row.description),
        status: String(row.status ?? "OUVERTE"),
        priority: String(row.priority ?? "NORMALE"),
        intervenant_id: normalizeText(row.intervenant_id),
        levee_at: normalizeText(row.levee_at),
        created_at: normalizeText(row.created_at),
        updated_at: normalizeText(row.updated_at),
      }),
      notes,
      "Table chantier_reserves indisponible : les KPI de réserves ne sont pas calculables.",
    ),
    fetchOptionalTable<MaterielDemandeRow>(
      "materiel_demandes",
      "id, chantier_id, intervenant_id, task_id, titre, designation, quantite, unite, commentaire, remarques, date_souhaitee, date_livraison, statut, status, admin_commentaire, validated_at, validated_by, created_at, updated_at",
      (row) => {
        const titre = String(row.titre ?? row.designation ?? "Demande matériel").trim() || "Demande matériel";
        const commentaire = normalizeText(row.commentaire) ?? normalizeText(row.remarques);
        return {
          id: String(row.id ?? ""),
          chantier_id: String(row.chantier_id ?? ""),
          intervenant_id: String(row.intervenant_id ?? ""),
          task_id: normalizeText(row.task_id),
          task_titre: null,
          intervenant_nom: null,
          titre,
          designation: String(row.designation ?? titre),
          quantite: Number(row.quantite ?? 0) || 0,
          unite: normalizeText(row.unite),
          commentaire,
          remarques: commentaire,
          date_souhaitee: normalizeText(row.date_souhaitee) ?? normalizeText(row.date_livraison),
          date_livraison: normalizeText(row.date_livraison),
          statut: normalizeMaterielStatus(row.statut ?? row.status),
          status: normalizeText(row.status),
          admin_commentaire: normalizeText(row.admin_commentaire),
          validated_at: normalizeText(row.validated_at),
          validated_by: normalizeText(row.validated_by),
          created_at: String(row.created_at ?? ""),
          updated_at: String(row.updated_at ?? row.created_at ?? ""),
        };
      },
      notes,
      "Table materiel_demandes indisponible : les KPI de demandes matériel sont partiels.",
    ),
    fetchOptionalTable<StatisticsInfoRequestRow>(
      "intervenant_information_requests",
      "id, chantier_id, intervenant_id, request_date, subject, message, status, created_at, updated_at",
      (row) => ({
        id: String(row.id ?? ""),
        chantier_id: String(row.chantier_id ?? ""),
        intervenant_id: String(row.intervenant_id ?? ""),
        request_date: String(row.request_date ?? ""),
        subject: String(row.subject ?? ""),
        message: String(row.message ?? ""),
        status: String(row.status ?? "").trim().toLowerCase() === "traitee" ? "traitee" : "envoyee",
        created_at: normalizeText(row.created_at),
        updated_at: normalizeText(row.updated_at),
      }),
      notes,
      "Table intervenant_information_requests indisponible : les KPI de demandes d'information sont partiels.",
    ),
    fetchOptionalTable<StatisticsChecklistRow>(
      "intervenant_daily_checklists",
      "id, intervenant_id, chantier_id, checklist_date, photos_taken, tasks_reported, time_logged, has_equipment, has_materials, has_information, validated_at, created_at, updated_at",
      (row) => ({
        id: String(row.id ?? ""),
        intervenant_id: String(row.intervenant_id ?? ""),
        chantier_id: normalizeText(row.chantier_id),
        checklist_date: String(row.checklist_date ?? ""),
        photos_taken: normalizeBoolean(row.photos_taken),
        tasks_reported: normalizeBoolean(row.tasks_reported),
        time_logged: normalizeBoolean(row.time_logged),
        has_equipment: normalizeBoolean(row.has_equipment),
        has_materials: normalizeBoolean(row.has_materials),
        has_information: normalizeBoolean(row.has_information),
        validated_at: normalizeText(row.validated_at),
        created_at: normalizeText(row.created_at),
        updated_at: normalizeText(row.updated_at),
      }),
      notes,
      "Table intervenant_daily_checklists indisponible : les KPI de suivi terrain sont partiels.",
    ),
  ]);

  return {
    chantiers,
    intervenants: intervenantsRes.rows,
    tasks: tasksRes.rows,
    timeEntries: timeEntriesRes.rows,
    taskAssignees: taskAssigneesRes.rows,
    reserves: reservesRes.rows,
    materielDemandes: materielRes.rows,
    informationRequests: infoRequestsRes.rows,
    dailyChecklists: dailyChecklistsRes.rows,
    availability: {
      tasks: tasksRes.available,
      timeEntries: timeEntriesRes.available,
      taskAssignees: taskAssigneesRes.available,
      reserves: reservesRes.available,
      materielDemandes: materielRes.available,
      informationRequests: infoRequestsRes.available,
      dailyChecklists: dailyChecklistsRes.available,
    },
    notes,
  };
}
