import { supabase } from "../lib/supabaseClient";

export type IntervenantChantier = {
  id: string;
  nom: string;
  client: string | null;
  adresse: string | null;
  status: string | null;
  avancement: number | null;
  date_debut: string | null;
  date_fin_prevue: string | null;
  planning_start_date: string | null;
  planning_end_date: string | null;
  created_at: string | null;
};

export type IntervenantSessionInfo = {
  token: string | null;
  chantier_id: string | null;
  default_chantier_id: string | null;
  intervenant_id: string | null;
  email: string | null;
  role: string | null;
  scope: string | null;
  expires_at: string | null;
  intervenant: {
    id: string | null;
    nom: string | null;
    email: string | null;
    telephone: string | null;
  };
  chantiers: IntervenantChantier[];
};

export type IntervenantTask = {
  id: string;
  chantier_id: string;
  titre: string;
  status: string | null;
  lot: string | null;
  corps_etat: string | null;
  date: string | null;
  date_debut: string | null;
  date_fin: string | null;
  quantite: number | null;
  quantite_realisee: number | null;
  unite: string | null;
  temps_prevu_h: number | null;
  temps_reel_h: number | null;
  duration_days: number;
  order_index: number;
  intervenant_id: string | null;
  updated_at: string | null;
};

export type IntervenantDocument = {
  id: string;
  chantier_id: string;
  title: string | null;
  file_name: string | null;
  category: string | null;
  document_type: string | null;
  visibility_mode: string | null;
  visibility: string | null;
  created_at: string | null;
};

export type IntervenantPlanningLot = {
  lot: string;
  start_date: string | null;
  end_date: string | null;
  order_index: number;
  total_duration_days: number;
  total_tasks: number;
  done_tasks: number;
  progress_pct: number;
};

export type IntervenantPlanning = {
  chantier_id: string | null;
  lots: IntervenantPlanningLot[];
};

export type IntervenantTimeEntry = {
  id: string;
  chantier_id: string;
  task_id: string | null;
  task_titre: string | null;
  task_unite: string | null;
  intervenant_id: string;
  work_date: string;
  duration_hours: number | null;
  quantite_realisee: number | null;
  progress_percent: number | null;
  note: string | null;
  created_at: string | null;
};

export type IntervenantMateriel = {
  id: string;
  chantier_id: string;
  intervenant_id: string;
  task_id: string | null;
  task_titre: string | null;
  titre: string;
  quantite: number | null;
  unite: string | null;
  commentaire: string | null;
  date_souhaitee: string | null;
  statut: "en_attente" | "validee" | "refusee" | "livree";
  admin_commentaire: string | null;
  validated_at: string | null;
  validated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type IntervenantDailyChecklist = {
  id: string | null;
  intervenant_id: string | null;
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

export type IntervenantInformationRequest = {
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

export type IntervenantTerrainFeedbackAttachment = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string | null;
  public_url: string;
};

export type IntervenantTerrainFeedback = {
  id: string;
  chantier_id: string;
  chantier_nom: string | null;
  author_intervenant_id: string;
  category: string;
  urgency: string;
  title: string;
  description: string;
  status: "nouveau" | "en_cours" | "traite" | "classe_sans_suite";
  assigned_to: string | null;
  assigned_to_name: string | null;
  treatment_comment: string | null;
  treated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  attachments: IntervenantTerrainFeedbackAttachment[];
};

export type IntervenantConsigne = {
  id: string;
  chantier_id: string;
  chantier_nom: string | null;
  title: string;
  description: string;
  priority: "normale" | "importante" | "urgente";
  date_debut: string;
  date_fin: string | null;
  task_id: string | null;
  task_titre: string | null;
  zone_id: string | null;
  zone_nom: string | null;
  applies_to_all: boolean;
  is_read: boolean;
  read_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type IntervenantReserve = {
  id: string;
  chantier_id: string;
  chantier_nom: string | null;
  task_id: string | null;
  task_titre: string | null;
  zone_id: string | null;
  zone_nom: string | null;
  title: string;
  description: string | null;
  status: "OUVERTE" | "EN_COURS" | "LEVEE";
  priority: "BASSE" | "NORMALE" | "URGENTE";
  intervenant_id: string | null;
  intervenant_nom: string | null;
  levee_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function rpcMessage(error: unknown, fallback: string): string {
  return String((error as { message?: string } | null)?.message ?? fallback).trim() || fallback;
}

function asNullableString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function asNullableNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstDefined(...values: unknown[]): unknown {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

function asInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function asNullableBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "t" || normalized === "1") return true;
  if (normalized === "false" || normalized === "f" || normalized === "0") return false;
  return null;
}

function normalizeMaterielStatus(value: unknown): IntervenantMateriel["statut"] {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "validee") return "validee";
  if (v === "refusee") return "refusee";
  if (v === "livree") return "livree";
  return "en_attente";
}

function normalizeInformationRequestStatus(value: unknown): IntervenantInformationRequest["status"] {
  return String(value ?? "").trim().toLowerCase() === "traitee" ? "traitee" : "envoyee";
}

function normalizeTerrainFeedbackStatus(value: unknown): IntervenantTerrainFeedback["status"] {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "en_cours") return "en_cours";
  if (v === "traite") return "traite";
  if (v === "classe_sans_suite") return "classe_sans_suite";
  return "nouveau";
}

function normalizeConsignePriority(value: unknown): IntervenantConsigne["priority"] {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "urgente") return "urgente";
  if (v === "importante") return "importante";
  return "normale";
}

function normalizeReserveStatus(value: unknown): IntervenantReserve["status"] {
  const v = String(value ?? "").trim().toUpperCase();
  if (v === "LEVEE") return "LEVEE";
  if (v === "EN_COURS") return "EN_COURS";
  return "OUVERTE";
}

function normalizeReservePriority(value: unknown): IntervenantReserve["priority"] {
  const v = String(value ?? "").trim().toUpperCase();
  if (v === "BASSE") return "BASSE";
  if (v === "URGENTE") return "URGENTE";
  return "NORMALE";
}

function mapConsigne(row: Record<string, unknown>): IntervenantConsigne {
  return {
    id: String(row.id ?? ""),
    chantier_id: String(row.chantier_id ?? ""),
    chantier_nom: asNullableString(row.chantier_nom),
    title: String(row.title ?? "Consigne"),
    description: String(row.description ?? ""),
    priority: normalizeConsignePriority(row.priority),
    date_debut: String(row.date_debut ?? ""),
    date_fin: asNullableString(row.date_fin),
    task_id: asNullableString(row.task_id),
    task_titre: asNullableString(row.task_titre),
    zone_id: asNullableString(row.zone_id),
    zone_nom: asNullableString(row.zone_nom),
    applies_to_all: Boolean(row.applies_to_all),
    is_read: Boolean(row.is_read),
    read_at: asNullableString(row.read_at),
    created_at: asNullableString(row.created_at),
    updated_at: asNullableString(row.updated_at),
  };
}

function mapReserve(row: Record<string, unknown>): IntervenantReserve {
  return {
    id: String(row.id ?? ""),
    chantier_id: String(row.chantier_id ?? ""),
    chantier_nom: asNullableString(row.chantier_nom),
    task_id: asNullableString(row.task_id),
    task_titre: asNullableString(row.task_titre),
    zone_id: asNullableString(row.zone_id),
    zone_nom: asNullableString(row.zone_nom),
    title: String(row.title ?? "Reserve"),
    description: asNullableString(row.description),
    status: normalizeReserveStatus(row.status),
    priority: normalizeReservePriority(row.priority),
    intervenant_id: asNullableString(row.intervenant_id),
    intervenant_nom: asNullableString(row.intervenant_nom),
    levee_at: asNullableString(row.levee_at),
    created_at: asNullableString(row.created_at),
    updated_at: asNullableString(row.updated_at),
  };
}

function mapTerrainFeedbackAttachment(
  row: Record<string, unknown>,
): IntervenantTerrainFeedbackAttachment {
  const storageBucket = String(row.storage_bucket ?? "terrain-feedbacks");
  const storagePath = String(row.storage_path ?? "");
  return {
    id: String(row.id ?? ""),
    storage_bucket: storageBucket,
    storage_path: storagePath,
    file_name: String(row.file_name ?? "photo"),
    mime_type: asNullableString(row.mime_type),
    size_bytes: asNullableNumber(row.size_bytes),
    created_at: asNullableString(row.created_at),
    public_url: supabase.storage.from(storageBucket).getPublicUrl(storagePath).data.publicUrl,
  };
}

function mapTerrainFeedback(row: Record<string, unknown>): IntervenantTerrainFeedback {
  const attachmentsRaw = Array.isArray(row.attachments) ? row.attachments : [];
  return {
    id: String(row.id ?? ""),
    chantier_id: String(row.chantier_id ?? ""),
    chantier_nom: asNullableString(row.chantier_nom),
    author_intervenant_id: String(row.author_intervenant_id ?? ""),
    category: String(row.category ?? "observation_chantier"),
    urgency: String(row.urgency ?? "normale"),
    title: String(row.title ?? "Retour terrain"),
    description: String(row.description ?? ""),
    status: normalizeTerrainFeedbackStatus(row.status),
    assigned_to: asNullableString(row.assigned_to),
    assigned_to_name: asNullableString(row.assigned_to_name),
    treatment_comment: asNullableString(row.treatment_comment),
    treated_at: asNullableString(row.treated_at),
    created_at: asNullableString(row.created_at),
    updated_at: asNullableString(row.updated_at),
    attachments: attachmentsRaw.map((entry) => mapTerrainFeedbackAttachment((entry ?? {}) as Record<string, unknown>)),
  };
}

function parseChantier(row: Record<string, unknown>): IntervenantChantier {
  return {
    id: String(row.id ?? ""),
    nom: String(row.nom ?? "Sans nom"),
    client: asNullableString(row.client),
    adresse: asNullableString(row.adresse),
    status: asNullableString(row.status),
    avancement: asNullableNumber(row.avancement),
    date_debut: asNullableString(row.date_debut),
    date_fin_prevue: asNullableString(row.date_fin_prevue),
    planning_start_date: asNullableString(row.planning_start_date),
    planning_end_date: asNullableString(row.planning_end_date),
    created_at: asNullableString(row.created_at),
  };
}

export async function intervenantSession(token: string): Promise<IntervenantSessionInfo> {
  const { data, error } = await (supabase as any).rpc("intervenant_session", { p_token: token });
  if (error) throw new Error(rpcMessage(error, "Session intervenant indisponible."));

  const row = (data ?? {}) as Record<string, unknown>;
  const intervenantRaw = (row.intervenant ?? {}) as Record<string, unknown>;
  const chantiersRaw = Array.isArray(row.chantiers) ? row.chantiers : [];

  return {
    token: asNullableString(row.token),
    chantier_id: asNullableString(row.chantier_id),
    default_chantier_id: asNullableString(row.default_chantier_id),
    intervenant_id: asNullableString(row.intervenant_id),
    email: asNullableString(row.email),
    role: asNullableString(row.role),
    scope: asNullableString(row.scope),
    expires_at: asNullableString(row.expires_at),
    intervenant: {
      id: asNullableString(intervenantRaw.id),
      nom: asNullableString(intervenantRaw.nom),
      email: asNullableString(intervenantRaw.email),
      telephone: asNullableString(intervenantRaw.telephone),
    },
    chantiers: chantiersRaw.map((entry) => parseChantier((entry ?? {}) as Record<string, unknown>)),
  };
}

export async function intervenantGetChantiers(token: string): Promise<IntervenantChantier[]> {
  const { data, error } = await (supabase as any).rpc("intervenant_get_chantiers", { p_token: token });
  if (error) throw new Error(rpcMessage(error, "Chargement chantiers impossible."));

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => parseChantier((row ?? {}) as Record<string, unknown>));
}

export async function intervenantGetTasks(token: string, chantierId: string): Promise<IntervenantTask[]> {
  const { data, error } = await (supabase as any).rpc("intervenant_get_tasks", {
    p_token: token,
    p_chantier_id: chantierId,
  });
  if (error) throw new Error(rpcMessage(error, "Chargement taches impossible."));

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({
    id: String(row.id ?? ""),
    chantier_id: String(row.chantier_id ?? chantierId),
    titre: String(row.titre ?? "Sans titre"),
    status: asNullableString(row.status),
    lot: asNullableString(row.lot),
    corps_etat: asNullableString(row.corps_etat),
    date: asNullableString(row.date),
    date_debut: asNullableString(row.date_debut),
    date_fin: asNullableString(row.date_fin),
    quantite: asNullableNumber(row.quantite),
    quantite_realisee: asNullableNumber(row.quantite_realisee),
    unite: asNullableString(row.unite),
    temps_prevu_h: asNullableNumber(row.temps_prevu_h),
    temps_reel_h: asNullableNumber(row.temps_reel_h),
    duration_days: Math.max(1, asInt(row.duration_days, 1)),
    order_index: Math.max(0, asInt(row.order_index, 0)),
    intervenant_id: asNullableString(row.intervenant_id),
    updated_at: asNullableString(row.updated_at),
  }));
}

export async function intervenantUpdateTaskStatus(
  token: string,
  taskId: string,
  status: string,
): Promise<void> {
  const { error } = await (supabase as any).rpc("intervenant_update_task_status", {
    p_token: token,
    p_task_id: taskId,
    p_status: status,
  });
  if (error) throw new Error(rpcMessage(error, "Mise a jour statut impossible."));
}

export async function intervenantAddTaskComment(
  token: string,
  taskId: string,
  message: string,
  photos: unknown[] = [],
): Promise<void> {
  const { error } = await (supabase as any).rpc("intervenant_add_task_comment", {
    p_token: token,
    p_task_id: taskId,
    p_message: message,
    p_photos: photos,
  });
  if (error) throw new Error(rpcMessage(error, "Ajout commentaire impossible."));
}

export async function intervenantGetDocuments(
  token: string,
  chantierId: string,
): Promise<IntervenantDocument[]> {
  const { data, error } = await (supabase as any).rpc("intervenant_get_documents", {
    p_token: token,
    p_chantier_id: chantierId,
  });
  if (error) throw new Error(rpcMessage(error, "Chargement documents impossible."));

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({
    id: String(row.id ?? ""),
    chantier_id: String(row.chantier_id ?? chantierId),
    title: asNullableString(row.title),
    file_name: asNullableString(row.file_name),
    category: asNullableString(row.category),
    document_type: asNullableString(row.document_type),
    visibility_mode: asNullableString(row.visibility_mode),
    visibility: asNullableString(row.visibility),
    created_at: asNullableString(row.created_at),
  }));
}

export async function intervenantGetPlanning(token: string, chantierId: string): Promise<IntervenantPlanning> {
  const { data, error } = await (supabase as any).rpc("intervenant_get_planning", {
    p_token: token,
    p_chantier_id: chantierId,
  });
  if (error) throw new Error(rpcMessage(error, "Chargement planning impossible."));

  const payload = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const rawLots = Array.isArray(payload.lots) ? payload.lots : [];
  const lots = rawLots.map((lot) => {
    const row = (lot ?? {}) as Record<string, unknown>;
    return {
      lot: String(row.lot ?? "A classer").trim() || "A classer",
      start_date: asNullableString(row.start_date),
      end_date: asNullableString(row.end_date),
      order_index: Math.max(0, asInt(row.order_index, 0)),
      total_duration_days: Math.max(0, asInt(row.total_duration_days, 0)),
      total_tasks: Math.max(0, asInt(row.total_tasks, 0)),
      done_tasks: Math.max(0, asInt(row.done_tasks, 0)),
      progress_pct: Math.max(0, Math.min(100, asNullableNumber(row.progress_pct) ?? 0)),
    };
  });

  return {
    chantier_id: asNullableString(payload.chantier_id ?? chantierId),
    lots: lots.sort((a, b) => a.order_index - b.order_index || a.lot.localeCompare(b.lot, "fr")),
  };
}

export async function intervenantTimeCreate(
  token: string,
  payload: {
    chantier_id: string;
    task_id: string;
    work_date?: string | null;
    duration_hours: number;
    quantite_realisee?: number | null;
    progress_percent?: number | null;
    note?: string | null;
  },
): Promise<void> {
  const { error } = await (supabase as any).rpc("intervenant_time_create", {
    p_token: token,
    p_payload: payload,
  });
  if (error) throw new Error(rpcMessage(error, "Creation temps impossible."));
}

export async function intervenantTimeDelete(token: string, timeEntryId: string): Promise<void> {
  const { error } = await (supabase as any).rpc("intervenant_time_delete", {
    p_token: token,
    p_time_entry_id: timeEntryId,
  });
  if (error) throw new Error(rpcMessage(error, "Suppression temps impossible."));
}

export async function intervenantTimeList(token: string, chantierId: string): Promise<IntervenantTimeEntry[]> {
  const { data, error } = await (supabase as any).rpc("intervenant_time_list", {
    p_token: token,
    p_chantier_id: chantierId,
  });
  if (error) throw new Error(rpcMessage(error, "Chargement temps impossible."));

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({
    id: String(row.id ?? ""),
    chantier_id: String(row.chantier_id ?? chantierId),
    task_id: asNullableString(row.task_id),
    task_titre: asNullableString(row.task_titre),
    task_unite: asNullableString(row.task_unite),
    intervenant_id: String(row.intervenant_id ?? ""),
    work_date: String(row.work_date ?? ""),
    duration_hours: asNullableNumber(
      firstDefined(row.duration_hours, row.hours, row.duration, row.duree_h, row.duree),
    ),
    quantite_realisee: asNullableNumber(row.quantite_realisee),
    progress_percent: asNullableNumber(firstDefined(row.progress_percent, row.progress_pct)),
    note: asNullableString(row.note),
    created_at: asNullableString(row.created_at),
  }));
}

export async function intervenantMaterielCreate(
  token: string,
  payload: {
    chantier_id: string;
    task_id?: string | null;
    titre: string;
    quantite?: number | null;
    unite?: string | null;
    commentaire?: string | null;
    date_souhaitee?: string | null;
  },
): Promise<void> {
  const { error } = await (supabase as any).rpc("intervenant_materiel_create", {
    p_token: token,
    p_payload: payload,
  });
  if (error) throw new Error(rpcMessage(error, "Creation demande materiel impossible."));
}

export async function intervenantMaterielList(
  token: string,
  chantierId: string,
): Promise<IntervenantMateriel[]> {
  const { data, error } = await (supabase as any).rpc("intervenant_materiel_list", {
    p_token: token,
    p_chantier_id: chantierId,
  });
  if (error) throw new Error(rpcMessage(error, "Chargement materiel impossible."));

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({
    id: String(row.id ?? ""),
    chantier_id: String(row.chantier_id ?? chantierId),
    intervenant_id: String(row.intervenant_id ?? ""),
    task_id: asNullableString(row.task_id),
    task_titre: asNullableString(row.task_titre),
    titre: String(row.titre ?? "Demande materiel"),
    quantite: asNullableNumber(row.quantite),
    unite: asNullableString(row.unite),
    commentaire: asNullableString(row.commentaire),
    date_souhaitee: asNullableString(row.date_souhaitee),
    statut: normalizeMaterielStatus(row.statut),
    admin_commentaire: asNullableString(row.admin_commentaire),
    validated_at: asNullableString(row.validated_at),
    validated_by: asNullableString(row.validated_by),
    created_at: asNullableString(row.created_at),
    updated_at: asNullableString(row.updated_at),
  }));
}

export async function intervenantDailyChecklistGet(
  token: string,
  checklistDate: string,
): Promise<IntervenantDailyChecklist> {
  const { data, error } = await (supabase as any).rpc("intervenant_daily_checklist_get", {
    p_token: token,
    p_checklist_date: checklistDate,
  });
  if (error) throw new Error(rpcMessage(error, "Chargement checklist impossible."));

  const row = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  return {
    id: asNullableString(row.id),
    intervenant_id: asNullableString(row.intervenant_id),
    chantier_id: asNullableString(row.chantier_id),
    checklist_date: String(row.checklist_date ?? checklistDate),
    photos_taken: asNullableBoolean(row.photos_taken),
    tasks_reported: asNullableBoolean(row.tasks_reported),
    time_logged: asNullableBoolean(row.time_logged),
    has_equipment: asNullableBoolean(row.has_equipment),
    has_materials: asNullableBoolean(row.has_materials),
    has_information: asNullableBoolean(row.has_information),
    validated_at: asNullableString(row.validated_at),
    created_at: asNullableString(row.created_at),
    updated_at: asNullableString(row.updated_at),
  };
}

export async function intervenantDailyChecklistUpsert(
  token: string,
  payload: {
    chantier_id?: string | null;
    checklist_date: string;
    photos_taken?: boolean | null;
    tasks_reported?: boolean | null;
    time_logged?: boolean | null;
    has_equipment?: boolean | null;
    has_materials?: boolean | null;
    has_information?: boolean | null;
    validate?: boolean;
  },
): Promise<IntervenantDailyChecklist> {
  const { data, error } = await (supabase as any).rpc("intervenant_daily_checklist_upsert", {
    p_token: token,
    p_payload: payload,
  });
  if (error) throw new Error(rpcMessage(error, "Enregistrement checklist impossible."));

  const row = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  return {
    id: asNullableString(row.id),
    intervenant_id: asNullableString(row.intervenant_id),
    chantier_id: asNullableString(row.chantier_id),
    checklist_date: String(row.checklist_date ?? payload.checklist_date),
    photos_taken: asNullableBoolean(row.photos_taken),
    tasks_reported: asNullableBoolean(row.tasks_reported),
    time_logged: asNullableBoolean(row.time_logged),
    has_equipment: asNullableBoolean(row.has_equipment),
    has_materials: asNullableBoolean(row.has_materials),
    has_information: asNullableBoolean(row.has_information),
    validated_at: asNullableString(row.validated_at),
    created_at: asNullableString(row.created_at),
    updated_at: asNullableString(row.updated_at),
  };
}

export async function intervenantInformationRequestCreate(
  token: string,
  payload: {
    chantier_id: string;
    request_date?: string | null;
    subject: string;
    message: string;
  },
): Promise<IntervenantInformationRequest> {
  const { data, error } = await (supabase as any).rpc("intervenant_information_request_create", {
    p_token: token,
    p_payload: payload,
  });
  if (error) throw new Error(rpcMessage(error, "Envoi demande d'information impossible."));

  const row = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    chantier_id: String(row.chantier_id ?? payload.chantier_id),
    intervenant_id: String(row.intervenant_id ?? ""),
    request_date: String(row.request_date ?? payload.request_date ?? ""),
    subject: String(row.subject ?? payload.subject),
    message: String(row.message ?? payload.message),
    status: normalizeInformationRequestStatus(row.status),
    created_at: asNullableString(row.created_at),
    updated_at: asNullableString(row.updated_at),
  };
}

export async function intervenantInformationRequestList(
  token: string,
  chantierId: string,
): Promise<IntervenantInformationRequest[]> {
  const { data, error } = await (supabase as any).rpc("intervenant_information_request_list", {
    p_token: token,
    p_chantier_id: chantierId,
  });
  if (error) throw new Error(rpcMessage(error, "Chargement demandes d'information impossible."));

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({
    id: String(row.id ?? ""),
    chantier_id: String(row.chantier_id ?? chantierId),
    intervenant_id: String(row.intervenant_id ?? ""),
    request_date: String(row.request_date ?? ""),
    subject: String(row.subject ?? "Demande d'information"),
    message: String(row.message ?? ""),
    status: normalizeInformationRequestStatus(row.status),
    created_at: asNullableString(row.created_at),
    updated_at: asNullableString(row.updated_at),
  }));
}

export async function intervenantTerrainFeedbackCreate(
  token: string,
  payload: {
    chantier_id: string;
    category: string;
    urgency: string;
    title: string;
    description: string;
  },
): Promise<IntervenantTerrainFeedback> {
  const { data, error } = await (supabase as any).rpc("intervenant_terrain_feedback_create", {
    p_token: token,
    p_payload: payload,
  });
  if (error) throw new Error(rpcMessage(error, "Creation retour terrain impossible."));

  return mapTerrainFeedback((data && typeof data === "object" ? data : {}) as Record<string, unknown>);
}

export async function intervenantTerrainFeedbackList(
  token: string,
  chantierId?: string | null,
): Promise<IntervenantTerrainFeedback[]> {
  const { data, error } = await (supabase as any).rpc("intervenant_terrain_feedback_list", {
    p_token: token,
    p_chantier_id: chantierId ?? null,
  });
  if (error) throw new Error(rpcMessage(error, "Chargement retours terrain impossible."));

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => mapTerrainFeedback((row ?? {}) as Record<string, unknown>));
}

export async function intervenantTerrainFeedbackUploadPhoto(
  token: string,
  payload: {
    chantier_id: string;
    feedback_id: string;
    file: File;
  },
): Promise<IntervenantTerrainFeedbackAttachment> {
  const formData = new FormData();
  formData.set("token", token);
  formData.set("chantier_id", payload.chantier_id);
  formData.set("feedback_id", payload.feedback_id);
  formData.set("file", payload.file);

  const { data, error } = await supabase.functions.invoke("intervenant-terrain-feedback-upload", {
    body: formData,
  });
  if (error) throw new Error(rpcMessage(error, "Upload photo impossible."));

  const row = (data && typeof data === "object" ? (data as Record<string, unknown>).attachment : null) as
    | Record<string, unknown>
    | null;
  if (!row) throw new Error("Piece jointe introuvable dans la reponse.");

  const attachment = mapTerrainFeedbackAttachment(row);
  return {
    ...attachment,
    public_url: asNullableString(row.public_url) ?? attachment.public_url,
  };
}

export async function intervenantConsigneList(
  token: string,
  chantierId?: string | null,
): Promise<IntervenantConsigne[]> {
  const { data, error } = await (supabase as any).rpc("intervenant_consigne_list", {
    p_token: token,
    p_chantier_id: chantierId ?? null,
  });
  if (error) throw new Error(rpcMessage(error, "Chargement consignes impossible."));

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => mapConsigne((row ?? {}) as Record<string, unknown>));
}

export async function intervenantConsigneMarkRead(
  token: string,
  consigneId: string,
): Promise<{ id: string; read_at: string | null }> {
  const { data, error } = await (supabase as any).rpc("intervenant_consigne_mark_read", {
    p_token: token,
    p_consigne_id: consigneId,
  });
  if (error) throw new Error(rpcMessage(error, "Mise a jour lecture consigne impossible."));

  const row = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  return {
    id: String(row.id ?? consigneId),
    read_at: asNullableString(row.read_at),
  };
}

export async function intervenantReserveList(
  token: string,
  chantierId?: string | null,
): Promise<IntervenantReserve[]> {
  const { data, error } = await (supabase as any).rpc("intervenant_reserve_list", {
    p_token: token,
    p_chantier_id: chantierId ?? null,
  });
  if (error) throw new Error(rpcMessage(error, "Chargement reserves impossible."));

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => mapReserve((row ?? {}) as Record<string, unknown>));
}

export async function intervenantReserveMarkLifted(
  token: string,
  reserveId: string,
): Promise<IntervenantReserve> {
  const { data, error } = await (supabase as any).rpc("intervenant_reserve_mark_lifted", {
    p_token: token,
    p_reserve_id: reserveId,
  });
  if (error) throw new Error(rpcMessage(error, "Mise a jour reserve impossible."));

  return mapReserve((data && typeof data === "object" ? data : {}) as Record<string, unknown>);
}
