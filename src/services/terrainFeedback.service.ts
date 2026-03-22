import { supabase } from "../lib/supabaseClient";
import type { ChantierRow } from "./chantiers.service";
import type { IntervenantRow } from "./intervenants.service";

export type TerrainFeedbackCategory =
  | "observation_chantier"
  | "anomalie"
  | "blocage"
  | "suggestion"
  | "qualite"
  | "securite"
  | "client"
  | "organisation";

export type TerrainFeedbackUrgency = "faible" | "normale" | "urgente" | "critique";
export type TerrainFeedbackStatus = "nouveau" | "en_cours" | "traite" | "classe_sans_suite";

export type TerrainFeedbackAttachment = {
  id: string;
  feedback_id?: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string | null;
  public_url: string;
};

export type TerrainFeedbackHistoryRow = {
  id: string;
  feedback_id: string;
  changed_by: string | null;
  changed_by_name: string | null;
  action: string;
  changes: Record<string, unknown>;
  created_at: string | null;
};

export type TerrainFeedbackRow = {
  id: string;
  chantier_id: string;
  author_intervenant_id: string;
  category: TerrainFeedbackCategory;
  urgency: TerrainFeedbackUrgency;
  title: string;
  description: string;
  status: TerrainFeedbackStatus;
  assigned_to: string | null;
  assigned_to_name: string | null;
  treatment_comment: string | null;
  treated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  chantier: Pick<ChantierRow, "id" | "nom" | "client"> | null;
  author: Pick<IntervenantRow, "id" | "nom" | "email" | "telephone"> | null;
  attachments: TerrainFeedbackAttachment[];
  history: TerrainFeedbackHistoryRow[];
};

export type TerrainFeedbackFilters = {
  chantierId?: string;
  intervenantId?: string;
  status?: TerrainFeedbackStatus | "";
  category?: TerrainFeedbackCategory | "";
};

export type TerrainFeedbackResponsible = {
  id: string;
  display_name: string;
  role: string | null;
};

type TerrainFeedbackBaseRow = {
  id: string;
  chantier_id: string;
  author_intervenant_id: string;
  category: TerrainFeedbackCategory;
  urgency: TerrainFeedbackUrgency;
  title: string;
  description: string;
  status: TerrainFeedbackStatus;
  assigned_to: string | null;
  assigned_to_name: string | null;
  treatment_comment: string | null;
  treated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapAttachment(row: Record<string, unknown>): TerrainFeedbackAttachment {
  const storage_bucket = String(row.storage_bucket ?? "terrain-feedbacks");
  const storage_path = String(row.storage_path ?? "");
  return {
    id: String(row.id ?? ""),
    feedback_id: normalizeText(row.feedback_id) ?? undefined,
    storage_bucket,
    storage_path,
    file_name: String(row.file_name ?? "photo"),
    mime_type: normalizeText(row.mime_type),
    size_bytes: normalizeNumber(row.size_bytes),
    created_at: normalizeText(row.created_at),
    public_url: supabase.storage.from(storage_bucket).getPublicUrl(storage_path).data.publicUrl,
  };
}

function mapHistory(row: Record<string, unknown>): TerrainFeedbackHistoryRow {
  return {
    id: String(row.id ?? ""),
    feedback_id: String(row.feedback_id ?? ""),
    changed_by: normalizeText(row.changed_by),
    changed_by_name: normalizeText(row.changed_by_name),
    action: String(row.action ?? "updated"),
    changes:
      row.changes && typeof row.changes === "object" && !Array.isArray(row.changes)
        ? (row.changes as Record<string, unknown>)
        : {},
    created_at: normalizeText(row.created_at),
  };
}

function mapBaseRow(row: Record<string, unknown>): TerrainFeedbackBaseRow {
  return {
    id: String(row.id ?? ""),
    chantier_id: String(row.chantier_id ?? ""),
    author_intervenant_id: String(row.author_intervenant_id ?? ""),
    category: String(row.category ?? "observation_chantier") as TerrainFeedbackCategory,
    urgency: String(row.urgency ?? "normale") as TerrainFeedbackUrgency,
    title: String(row.title ?? "Retour terrain"),
    description: String(row.description ?? ""),
    status: String(row.status ?? "nouveau") as TerrainFeedbackStatus,
    assigned_to: normalizeText(row.assigned_to),
    assigned_to_name: normalizeText(row.assigned_to_name),
    treatment_comment: normalizeText(row.treatment_comment),
    treated_at: normalizeText(row.treated_at),
    created_at: normalizeText(row.created_at),
    updated_at: normalizeText(row.updated_at),
  };
}

export async function listTerrainFeedbacks(filters: TerrainFeedbackFilters = {}): Promise<TerrainFeedbackRow[]> {
  let query = (supabase as any)
    .from("terrain_feedbacks")
    .select(
      "id, chantier_id, author_intervenant_id, category, urgency, title, description, status, assigned_to, assigned_to_name, treatment_comment, treated_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (filters.chantierId) query = query.eq("chantier_id", filters.chantierId);
  if (filters.intervenantId) query = query.eq("author_intervenant_id", filters.intervenantId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category", filters.category);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const baseRows = ((data ?? []) as Array<Record<string, unknown>>).map(mapBaseRow);
  if (baseRows.length === 0) return [];

  const feedbackIds = baseRows.map((row) => row.id);
  const chantierIds = Array.from(new Set(baseRows.map((row) => row.chantier_id)));
  const authorIds = Array.from(new Set(baseRows.map((row) => row.author_intervenant_id)));

  const [attachmentsRes, historyRes, chantiersRes, intervenantsRes] = await Promise.all([
    (supabase as any)
      .from("terrain_feedback_attachments")
      .select("id, feedback_id, storage_bucket, storage_path, file_name, mime_type, size_bytes, created_at")
      .in("feedback_id", feedbackIds)
      .order("created_at", { ascending: true }),
    (supabase as any)
      .from("terrain_feedback_history")
      .select("id, feedback_id, changed_by, changed_by_name, action, changes, created_at")
      .in("feedback_id", feedbackIds)
      .order("created_at", { ascending: false }),
    (supabase as any).from("chantiers").select("id, nom, client").in("id", chantierIds),
    (supabase as any).from("intervenants").select("id, nom, email, telephone").in("id", authorIds),
  ]);

  if (attachmentsRes.error) throw new Error(attachmentsRes.error.message);
  if (historyRes.error) throw new Error(historyRes.error.message);
  if (chantiersRes.error) throw new Error(chantiersRes.error.message);
  if (intervenantsRes.error) throw new Error(intervenantsRes.error.message);

  const attachmentMap = new Map<string, TerrainFeedbackAttachment[]>();
  for (const row of (attachmentsRes.data ?? []) as Array<Record<string, unknown>>) {
    const attachment = mapAttachment(row);
    const key = attachment.feedback_id ?? "";
    if (!attachmentMap.has(key)) attachmentMap.set(key, []);
    attachmentMap.get(key)?.push(attachment);
  }

  const historyMap = new Map<string, TerrainFeedbackHistoryRow[]>();
  for (const row of (historyRes.data ?? []) as Array<Record<string, unknown>>) {
    const history = mapHistory(row);
    if (!historyMap.has(history.feedback_id)) historyMap.set(history.feedback_id, []);
    historyMap.get(history.feedback_id)?.push(history);
  }

  const chantierMap = new Map<string, Pick<ChantierRow, "id" | "nom" | "client">>();
  for (const row of (chantiersRes.data ?? []) as Array<Record<string, unknown>>) {
    chantierMap.set(String(row.id ?? ""), {
      id: String(row.id ?? ""),
      nom: String(row.nom ?? "Chantier"),
      client: normalizeText(row.client),
    });
  }

  const intervenantMap = new Map<string, Pick<IntervenantRow, "id" | "nom" | "email" | "telephone">>();
  for (const row of (intervenantsRes.data ?? []) as Array<Record<string, unknown>>) {
    intervenantMap.set(String(row.id ?? ""), {
      id: String(row.id ?? ""),
      nom: String(row.nom ?? "Intervenant"),
      email: normalizeText(row.email),
      telephone: normalizeText(row.telephone),
    });
  }

  return baseRows.map((row) => ({
    ...row,
    chantier: chantierMap.get(row.chantier_id) ?? null,
    author: intervenantMap.get(row.author_intervenant_id) ?? null,
    attachments: attachmentMap.get(row.id) ?? [],
    history: historyMap.get(row.id) ?? [],
  }));
}

export async function listTerrainFeedbackResponsibles(): Promise<TerrainFeedbackResponsible[]> {
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("id, display_name, role")
    .eq("role", "ADMIN")
    .order("display_name", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id ?? ""),
    display_name: normalizeText(row.display_name) ?? "Admin",
    role: normalizeText(row.role),
  }));
}

export async function updateTerrainFeedback(
  id: string,
  patch: Partial<{
    status: TerrainFeedbackStatus;
    assigned_to: string | null;
    assigned_to_name: string | null;
    treatment_comment: string | null;
    treated_at: string | null;
  }>,
): Promise<void> {
  const { error } = await (supabase as any).rpc("admin_terrain_feedback_update", {
    p_id: id,
    p_patch: patch,
  });
  if (error) throw new Error(error.message);
}
