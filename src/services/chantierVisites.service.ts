import { supabase } from "../lib/supabaseClient";
import { validateVisiteSnapshot, type VisiteSnapshot } from "../lib/buildVisiteSnapshot";
import type { ChantierDocumentRow } from "./chantierDocuments.service";

const sb = supabase as any;

export type ChantierVisiteParticipantType = "CLIENT" | "INTERVENANT" | "MOA" | "MOE" | "AUTRE";
export type ChantierVisiteActionStatus = "A_FAIRE" | "EN_COURS" | "FAIT";
export type ChantierVisiteActionResponsableType = "CLIENT" | "INTERVENANT" | "CB_RENOVATION" | "AUTRE";

export type ChantierVisiteRow = {
  id: string;
  chantier_id: string;
  numero: number | null;
  titre: string;
  phase: string | null;
  objectif: string | null;
  resume: string | null;
  points_positifs: string | null;
  points_bloquants: string | null;
  visit_datetime: string;
  redactor_email: string | null;
  participants: string[];
  meteo: string | null;
  avancement_text: string | null;
  avancement_percent: number | null;
  observations: string | null;
  safety_points: string | null;
  decisions: string | null;
  notes_terrain: string | null;
  remarques_planning: string | null;
  synthese: string | null;
  synthese_points_cles: string[] | null;
  include_in_doe: boolean;
  photo_count: number;
  pdf_document_id: string | null;
  created_at: string;
  updated_at: string | null;
};

export type ChantierVisiteParticipantRow = {
  id: string;
  visite_id: string;
  type: ChantierVisiteParticipantType;
  nom: string;
  intervenant_id: string | null;
  email: string | null;
  present: boolean;
  created_at: string;
};

export type ChantierVisiteActionRow = {
  id: string;
  visite_id: string;
  description: string | null;
  responsable_type: ChantierVisiteActionResponsableType | null;
  responsable_nom: string | null;
  intervenant_id: string | null;
  echeance: string | null;
  statut: ChantierVisiteActionStatus;
  commentaire: string | null;
  ordre: number;
  action_text: string | null;
  responsable: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
};

export type ChantierVisiteSnapshotRow = {
  id: string;
  visite_id: string;
  data: VisiteSnapshot;
  created_at: string;
};

export type ChantierVisiteDocumentLinkRow = {
  id: string;
  visite_id: string;
  document_id: string;
  created_at: string;
};

export type ChantierVisiteFull = {
  visite: ChantierVisiteRow;
  participants: ChantierVisiteParticipantRow[];
  actions: ChantierVisiteActionRow[];
  snapshot: ChantierVisiteSnapshotRow | null;
  links: ChantierVisiteDocumentLinkRow[];
  documents: ChantierDocumentRow[];
};

const VISITE_SELECT = [
  "id",
  "chantier_id",
  "numero",
  "titre",
  "phase",
  "objectif",
  "resume",
  "points_positifs",
  "points_bloquants",
  "visit_datetime",
  "redactor_email",
  "participants",
  "meteo",
  "avancement_text",
  "avancement_percent",
  "observations",
  "safety_points",
  "decisions",
  "notes_terrain",
  "remarques_planning",
  "synthese",
  "synthese_points_cles",
  "include_in_doe",
  "photo_count",
  "pdf_document_id",
  "created_at",
  "updated_at",
].join(",");

const ACTION_SELECT = [
  "id",
  "visite_id",
  "description",
  "responsable_type",
  "responsable_nom",
  "intervenant_id",
  "echeance",
  "statut",
  "commentaire",
  "ordre",
  "action_text",
  "responsable",
  "due_date",
  "sort_order",
  "created_at",
].join(",");

const VISITE_SELECT_LEGACY = [
  "id",
  "chantier_id",
  "visit_datetime",
  "redactor_email",
  "participants",
  "meteo",
  "avancement_text",
  "avancement_percent",
  "observations",
  "safety_points",
  "decisions",
  "include_in_doe",
  "photo_count",
  "pdf_document_id",
  "created_at",
].join(",");

const ACTION_SELECT_LEGACY = [
  "id",
  "visite_id",
  "action_text",
  "responsable",
  "due_date",
  "sort_order",
  "created_at",
].join(",");

function isMissingTableError(error: { message?: string } | null, table: string): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    (msg.includes("relation") && msg.includes(table.toLowerCase())) ||
    (msg.includes("schema cache") && msg.includes(table.toLowerCase())) ||
    msg.includes("does not exist")
  );
}

function isSchemaColumnError(error: { message?: string } | null, table: string): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("could not find") &&
    msg.includes("column") &&
    (msg.includes(`'${table.toLowerCase()}'`) || msg.includes(table.toLowerCase()))
  );
}

function asActionStatus(value: unknown): ChantierVisiteActionStatus {
  const raw = String(value ?? "A_FAIRE").toUpperCase();
  if (raw === "FAIT") return "FAIT";
  if (raw === "EN_COURS") return "EN_COURS";
  return "A_FAIRE";
}

function asResponsableType(value: unknown): ChantierVisiteActionResponsableType {
  const raw = String(value ?? "AUTRE").toUpperCase();
  if (raw === "CLIENT") return "CLIENT";
  if (raw === "INTERVENANT") return "INTERVENANT";
  if (raw === "CB_RENOVATION") return "CB_RENOVATION";
  return "AUTRE";
}

function normalizeVisite(row: any): ChantierVisiteRow {
  return {
    id: row.id,
    chantier_id: row.chantier_id,
    numero: Number.isFinite(Number(row.numero)) ? Number(row.numero) : null,
    titre: String(row.titre ?? "Visite de chantier"),
    phase: row.phase ?? null,
    objectif: row.objectif ?? null,
    resume: row.resume ?? null,
    points_positifs: row.points_positifs ?? null,
    points_bloquants: row.points_bloquants ?? null,
    visit_datetime: row.visit_datetime,
    redactor_email: row.redactor_email ?? null,
    participants: Array.isArray(row.participants) ? row.participants : [],
    meteo: row.meteo ?? null,
    avancement_text: row.avancement_text ?? null,
    avancement_percent: row.avancement_percent != null ? Number(row.avancement_percent) : null,
    observations: row.observations ?? null,
    safety_points: row.safety_points ?? null,
    decisions: row.decisions ?? null,
    notes_terrain: row.notes_terrain ?? null,
    remarques_planning: row.remarques_planning ?? null,
    synthese: row.synthese ?? null,
    synthese_points_cles: Array.isArray(row.synthese_points_cles)
      ? row.synthese_points_cles.map((item: unknown) => String(item))
      : null,
    include_in_doe: Boolean(row.include_in_doe),
    photo_count: Number.isFinite(Number(row.photo_count)) ? Number(row.photo_count) : 0,
    pdf_document_id: row.pdf_document_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
  };
}

function normalizeAction(row: any): ChantierVisiteActionRow {
  const description = (row.description ?? row.action_text ?? null) as string | null;
  const responsableNom = (row.responsable_nom ?? row.responsable ?? null) as string | null;
  const echeance = (row.echeance ?? row.due_date ?? null) as string | null;
  const ordre = Number.isFinite(Number(row.ordre))
    ? Number(row.ordre)
    : Number.isFinite(Number(row.sort_order))
      ? Number(row.sort_order)
      : 0;

  return {
    id: row.id,
    visite_id: row.visite_id,
    description,
    responsable_type: asResponsableType(row.responsable_type),
    responsable_nom: responsableNom,
    intervenant_id: row.intervenant_id ?? null,
    echeance,
    statut: asActionStatus(row.statut),
    commentaire: row.commentaire ?? null,
    ordre,
    action_text: row.action_text ?? description,
    responsable: row.responsable ?? responsableNom,
    due_date: row.due_date ?? echeance,
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : ordre,
    created_at: row.created_at,
  };
}

export async function listVisites(chantierId: string): Promise<ChantierVisiteRow[]> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const { data, error } = await sb
    .from("chantier_visites")
    .select(VISITE_SELECT)
    .eq("chantier_id", chantierId)
    .order("visit_datetime", { ascending: false });

  if (error) {
    if (isSchemaColumnError(error, "chantier_visites")) {
      const legacy = await sb
        .from("chantier_visites")
        .select(VISITE_SELECT_LEGACY)
        .eq("chantier_id", chantierId)
        .order("visit_datetime", { ascending: false });
      if (legacy.error) throw new Error(legacy.error.message);
      return (legacy.data ?? []).map((row: any) => normalizeVisite(row));
    }
    if (isMissingTableError(error, "chantier_visites")) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map(normalizeVisite);
}

export async function getNextVisiteNumero(chantierId: string): Promise<number> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const { data, error } = await sb
    .from("chantier_visites")
    .select("numero")
    .eq("chantier_id", chantierId)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isSchemaColumnError(error, "chantier_visites")) {
      const { count, error: countError } = await sb
        .from("chantier_visites")
        .select("id", { count: "exact", head: true })
        .eq("chantier_id", chantierId);
      if (countError) throw new Error(countError.message);
      return (count ?? 0) + 1;
    }
    if (isMissingTableError(error, "chantier_visites")) return 1;
    throw new Error(error.message);
  }

  const current = Number.isFinite(Number(data?.numero)) ? Number(data?.numero) : 0;
  return current + 1;
}

export async function createVisite(payload: {
  chantier_id: string;
  numero?: number | null;
  titre?: string | null;
  phase?: string | null;
  objectif?: string | null;
  resume?: string | null;
  points_positifs?: string | null;
  points_bloquants?: string | null;
  visit_datetime?: string | null;
  redactor_email?: string | null;
  participants?: string[];
  meteo?: string | null;
  avancement_text?: string | null;
  avancement_percent?: number | null;
  observations?: string | null;
  safety_points?: string | null;
  decisions?: string | null;
  notes_terrain?: string | null;
  remarques_planning?: string | null;
  synthese?: string | null;
  synthese_points_cles?: string[] | null;
  include_in_doe?: boolean;
  photo_count?: number;
  pdf_document_id?: string | null;
}): Promise<ChantierVisiteRow> {
  if (!payload.chantier_id) throw new Error("chantier_id manquant.");

  const numero = payload.numero ?? (await getNextVisiteNumero(payload.chantier_id));
  const visitDateTime = payload.visit_datetime ? new Date(payload.visit_datetime).toISOString() : new Date().toISOString();
  const titre = (payload.titre ?? `Visite #${numero}`).trim() || `Visite #${numero}`;

  const insertPayload = {
    chantier_id: payload.chantier_id,
    numero,
    titre,
    phase: payload.phase ?? null,
    objectif: payload.objectif ?? null,
    resume: payload.resume ?? null,
    points_positifs: payload.points_positifs ?? null,
    points_bloquants: payload.points_bloquants ?? null,
    visit_datetime: visitDateTime,
    redactor_email: payload.redactor_email ?? null,
    participants: payload.participants ?? [],
    meteo: payload.meteo ?? null,
    avancement_text: payload.avancement_text ?? null,
    avancement_percent: payload.avancement_percent ?? null,
    observations: payload.observations ?? null,
    safety_points: payload.safety_points ?? null,
    decisions: payload.decisions ?? null,
    notes_terrain: payload.notes_terrain ?? null,
    remarques_planning: payload.remarques_planning ?? null,
    synthese: payload.synthese ?? null,
    synthese_points_cles: payload.synthese_points_cles ?? null,
    include_in_doe: Boolean(payload.include_in_doe),
    photo_count: payload.photo_count ?? 0,
    pdf_document_id: payload.pdf_document_id ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await sb
    .from("chantier_visites")
    .insert(insertPayload)
    .select(VISITE_SELECT)
    .single();

  if (error) {
    if (isSchemaColumnError(error, "chantier_visites")) {
      const legacyPayload = {
        chantier_id: payload.chantier_id,
        visit_datetime: visitDateTime,
        redactor_email: payload.redactor_email ?? null,
        participants: payload.participants ?? [],
        meteo: payload.meteo ?? null,
        avancement_text: payload.avancement_text ?? null,
        avancement_percent: payload.avancement_percent ?? null,
        observations: payload.observations ?? null,
        safety_points: payload.safety_points ?? null,
        decisions: payload.decisions ?? null,
        include_in_doe: Boolean(payload.include_in_doe),
        photo_count: payload.photo_count ?? 0,
        pdf_document_id: payload.pdf_document_id ?? null,
      };
      const legacy = await sb
        .from("chantier_visites")
        .insert(legacyPayload)
        .select(VISITE_SELECT_LEGACY)
        .single();
      if (legacy.error) throw new Error(legacy.error.message);
      return normalizeVisite({
        ...legacy.data,
        numero,
        titre,
        phase: payload.phase ?? null,
        objectif: payload.objectif ?? null,
        resume: payload.resume ?? null,
        points_positifs: payload.points_positifs ?? null,
        points_bloquants: payload.points_bloquants ?? null,
        notes_terrain: payload.notes_terrain ?? null,
        remarques_planning: payload.remarques_planning ?? null,
        synthese: payload.synthese ?? null,
        synthese_points_cles: payload.synthese_points_cles ?? null,
        updated_at: null,
      });
    }
    if (isMissingTableError(error, "chantier_visites")) {
      throw new Error("Module Visites non deploye en base. Applique la migration Supabase.");
    }
    throw new Error(error.message);
  }

  return normalizeVisite(data);
}

export async function updateVisite(
  visiteId: string,
  patch: Partial<{
    numero: number | null;
    titre: string | null;
    phase: string | null;
    objectif: string | null;
    resume: string | null;
    points_positifs: string | null;
    points_bloquants: string | null;
    visit_datetime: string | null;
    redactor_email: string | null;
    participants: string[];
    meteo: string | null;
    avancement_text: string | null;
    avancement_percent: number | null;
    observations: string | null;
    safety_points: string | null;
    decisions: string | null;
    notes_terrain: string | null;
    remarques_planning: string | null;
    synthese: string | null;
    synthese_points_cles: string[] | null;
    include_in_doe: boolean;
    photo_count: number;
    pdf_document_id: string | null;
  }>,
): Promise<ChantierVisiteRow> {
  if (!visiteId) throw new Error("visiteId manquant.");

  const payload: Record<string, any> = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

  if (typeof payload.titre === "string") {
    payload.titre = payload.titre.trim() || "Visite de chantier";
  }
  if (typeof payload.visit_datetime === "string" && payload.visit_datetime) {
    payload.visit_datetime = new Date(payload.visit_datetime).toISOString();
  }

  const { data, error } = await sb
    .from("chantier_visites")
    .update(payload)
    .eq("id", visiteId)
    .select(VISITE_SELECT)
    .single();

  if (error) {
    if (isSchemaColumnError(error, "chantier_visites")) {
      const legacyPatch: Record<string, any> = {};
      if (payload.visit_datetime !== undefined) legacyPatch.visit_datetime = payload.visit_datetime;
      if (payload.redactor_email !== undefined) legacyPatch.redactor_email = payload.redactor_email;
      if (payload.participants !== undefined) legacyPatch.participants = payload.participants;
      if (payload.meteo !== undefined) legacyPatch.meteo = payload.meteo;
      if (payload.avancement_text !== undefined) legacyPatch.avancement_text = payload.avancement_text;
      if (payload.avancement_percent !== undefined) legacyPatch.avancement_percent = payload.avancement_percent;
      if (payload.observations !== undefined) legacyPatch.observations = payload.observations;
      if (payload.safety_points !== undefined) legacyPatch.safety_points = payload.safety_points;
      if (payload.decisions !== undefined) legacyPatch.decisions = payload.decisions;
      if (payload.include_in_doe !== undefined) legacyPatch.include_in_doe = payload.include_in_doe;
      if (payload.photo_count !== undefined) legacyPatch.photo_count = payload.photo_count;
      if (payload.pdf_document_id !== undefined) legacyPatch.pdf_document_id = payload.pdf_document_id;

      const legacy = await sb
        .from("chantier_visites")
        .update(legacyPatch)
        .eq("id", visiteId)
        .select(VISITE_SELECT_LEGACY)
        .single();
      if (legacy.error) throw new Error(legacy.error.message);
      return normalizeVisite({
        ...legacy.data,
        numero: patch.numero ?? null,
        titre: patch.titre ?? "Visite de chantier",
        phase: patch.phase ?? null,
        objectif: patch.objectif ?? null,
        resume: patch.resume ?? null,
        points_positifs: patch.points_positifs ?? null,
        points_bloquants: patch.points_bloquants ?? null,
        notes_terrain: patch.notes_terrain ?? null,
        remarques_planning: patch.remarques_planning ?? null,
        synthese: patch.synthese ?? null,
        synthese_points_cles: patch.synthese_points_cles ?? null,
      });
    }
    throw new Error(error.message);
  }
  return normalizeVisite(data);
}

export async function upsertSnapshot(visiteId: string, data: unknown): Promise<ChantierVisiteSnapshotRow> {
  if (!visiteId) throw new Error("visiteId manquant.");

  const snapshot = validateVisiteSnapshot(data);
  const payload = {
    visite_id: visiteId,
    data: snapshot,
  };

  const { data: row, error } = await sb
    .from("chantier_visite_snapshot")
    .upsert(payload, { onConflict: "visite_id" })
    .select("id, visite_id, data, created_at")
    .single();

  if (error) {
    if (isMissingTableError(error, "chantier_visite_snapshot") || isSchemaColumnError(error, "chantier_visite_snapshot")) {
      return {
        id: `local-${visiteId}`,
        visite_id: visiteId,
        data: snapshot,
        created_at: new Date().toISOString(),
      };
    }
    throw new Error(error.message);
  }

  return {
    id: row.id,
    visite_id: row.visite_id,
    data: validateVisiteSnapshot(row.data),
    created_at: row.created_at,
  };
}

export async function setParticipants(
  visiteId: string,
  participants: Array<{
    type: ChantierVisiteParticipantType;
    nom: string;
    intervenant_id?: string | null;
    email?: string | null;
    present?: boolean;
  }>,
): Promise<ChantierVisiteParticipantRow[]> {
  if (!visiteId) throw new Error("visiteId manquant.");

  const { error: deleteError } = await sb
    .from("chantier_visite_participants")
    .delete()
    .eq("visite_id", visiteId);

  if (deleteError) {
    if (isMissingTableError(deleteError, "chantier_visite_participants") || isSchemaColumnError(deleteError, "chantier_visite_participants")) {
      return [];
    }
    throw new Error(deleteError.message);
  }

  const rows = (participants ?? [])
    .map((row) => ({
      visite_id: visiteId,
      type: row.type,
      nom: (row.nom ?? "").trim(),
      intervenant_id: row.intervenant_id ?? null,
      email: row.email ?? null,
      present: row.present !== false,
    }))
    .filter((row) => row.nom.length > 0);

  if (!rows.length) return [];

  const { data, error } = await sb
    .from("chantier_visite_participants")
    .insert(rows)
    .select("id, visite_id, type, nom, intervenant_id, email, present, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTableError(error, "chantier_visite_participants") || isSchemaColumnError(error, "chantier_visite_participants")) {
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as ChantierVisiteParticipantRow[];
}

export async function setActions(
  visiteId: string,
  actions: Array<{
    description: string;
    responsable_type?: ChantierVisiteActionResponsableType;
    responsable_nom?: string | null;
    intervenant_id?: string | null;
    echeance?: string | null;
    statut?: ChantierVisiteActionStatus;
    commentaire?: string | null;
    ordre?: number;
  }>,
): Promise<ChantierVisiteActionRow[]> {
  if (!visiteId) throw new Error("visiteId manquant.");

  const { error: deleteError } = await sb.from("chantier_visite_actions").delete().eq("visite_id", visiteId);
  if (deleteError) throw new Error(deleteError.message);

  const rows = (actions ?? [])
    .map((action, index) => {
      const description = (action.description ?? "").trim();
      const responsableNom = action.responsable_nom?.trim() || null;
      const ordre = action.ordre ?? index + 1;
      const echeance = action.echeance || null;
      return {
        visite_id: visiteId,
        description,
        action_text: description,
        responsable_type: action.responsable_type ?? (action.intervenant_id ? "INTERVENANT" : "AUTRE"),
        responsable_nom: responsableNom,
        responsable: responsableNom,
        intervenant_id: action.intervenant_id ?? null,
        echeance,
        due_date: echeance,
        statut: action.statut ?? "A_FAIRE",
        commentaire: action.commentaire ?? null,
        ordre,
        sort_order: ordre,
      };
    })
    .filter((row) => row.description.length > 0);

  if (!rows.length) return [];

  const { data, error } = await sb
    .from("chantier_visite_actions")
    .insert(rows)
    .select(ACTION_SELECT)
    .order("ordre", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    if (isSchemaColumnError(error, "chantier_visite_actions")) {
      const legacyRows = rows.map((row: any) => ({
        visite_id: row.visite_id,
        action_text: row.action_text,
        responsable: row.responsable,
        due_date: row.due_date,
        sort_order: row.sort_order,
      }));
      const legacy = await sb
        .from("chantier_visite_actions")
        .insert(legacyRows)
        .select(ACTION_SELECT_LEGACY)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (legacy.error) throw new Error(legacy.error.message);
      return (legacy.data ?? []).map((row: any) => normalizeAction(row));
    }
    throw new Error(error.message);
  }
  return (data ?? []).map(normalizeAction);
}

export async function attachDocument(visiteId: string, documentId: string): Promise<void> {
  if (!visiteId) throw new Error("visiteId manquant.");
  if (!documentId) throw new Error("documentId manquant.");

  const { error } = await sb.from("chantier_visite_documents").insert({
    visite_id: visiteId,
    document_id: documentId,
  });

  if (error && (isMissingTableError(error, "chantier_visite_documents") || isSchemaColumnError(error, "chantier_visite_documents"))) {
    return;
  }

  if (error && !String(error.message ?? "").toLowerCase().includes("duplicate key")) {
    throw new Error(error.message);
  }
}

export async function setVisiteDocuments(visiteId: string, documentIds: string[]): Promise<ChantierVisiteDocumentLinkRow[]> {
  if (!visiteId) throw new Error("visiteId manquant.");

  const uniqueIds = Array.from(new Set((documentIds ?? []).filter(Boolean)));
  const { error: deleteError } = await sb.from("chantier_visite_documents").delete().eq("visite_id", visiteId);
  if (deleteError) {
    if (isMissingTableError(deleteError, "chantier_visite_documents") || isSchemaColumnError(deleteError, "chantier_visite_documents")) {
      return [];
    }
    throw new Error(deleteError.message);
  }

  if (!uniqueIds.length) return [];

  const { data, error } = await sb
    .from("chantier_visite_documents")
    .insert(uniqueIds.map((document_id) => ({ visite_id: visiteId, document_id })))
    .select("id, visite_id, document_id, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTableError(error, "chantier_visite_documents") || isSchemaColumnError(error, "chantier_visite_documents")) {
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as ChantierVisiteDocumentLinkRow[];
}

export async function listVisiteFull(visiteId: string): Promise<ChantierVisiteFull> {
  if (!visiteId) throw new Error("visiteId manquant.");

  let visiteData: any = null;
  const visiteQuery = await sb
    .from("chantier_visites")
    .select(VISITE_SELECT)
    .eq("id", visiteId)
    .maybeSingle();
  if (visiteQuery.error) {
    if (isSchemaColumnError(visiteQuery.error, "chantier_visites")) {
      const legacyVisiteQuery = await sb
        .from("chantier_visites")
        .select(VISITE_SELECT_LEGACY)
        .eq("id", visiteId)
        .maybeSingle();
      if (legacyVisiteQuery.error) throw new Error(legacyVisiteQuery.error.message);
      visiteData = legacyVisiteQuery.data;
    } else {
      throw new Error(visiteQuery.error.message);
    }
  } else {
    visiteData = visiteQuery.data;
  }
  if (!visiteData) throw new Error("Visite introuvable.");

  const [participantsData, actionsData, snapshotData, linksData] = await Promise.all([
    sb
      .from("chantier_visite_participants")
      .select("id, visite_id, type, nom, intervenant_id, email, present, created_at")
      .eq("visite_id", visiteId)
      .order("created_at", { ascending: true }),
    sb
      .from("chantier_visite_actions")
      .select(ACTION_SELECT)
      .eq("visite_id", visiteId)
      .order("ordre", { ascending: true })
      .order("created_at", { ascending: true }),
    sb
      .from("chantier_visite_snapshot")
      .select("id, visite_id, data, created_at")
      .eq("visite_id", visiteId)
      .maybeSingle(),
    sb
      .from("chantier_visite_documents")
      .select("id, visite_id, document_id, created_at")
      .eq("visite_id", visiteId)
      .order("created_at", { ascending: true }),
  ]);

  if (participantsData.error && !isMissingTableError(participantsData.error, "chantier_visite_participants")) {
    throw new Error(participantsData.error.message);
  }
  let actionsRows = (actionsData.data ?? []) as any[];
  if (actionsData.error && !isMissingTableError(actionsData.error, "chantier_visite_actions")) {
    if (isSchemaColumnError(actionsData.error, "chantier_visite_actions")) {
      const legacyActionsData = await sb
        .from("chantier_visite_actions")
        .select(ACTION_SELECT_LEGACY)
        .eq("visite_id", visiteId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (legacyActionsData.error) throw new Error(legacyActionsData.error.message);
      actionsRows = (legacyActionsData.data ?? []) as any[];
    } else {
      throw new Error(actionsData.error.message);
    }
  }
  if (snapshotData.error && !isMissingTableError(snapshotData.error, "chantier_visite_snapshot")) {
    throw new Error(snapshotData.error.message);
  }
  if (linksData.error && !isMissingTableError(linksData.error, "chantier_visite_documents")) {
    throw new Error(linksData.error.message);
  }

  const links = (linksData.data ?? []) as ChantierVisiteDocumentLinkRow[];
  const documentIds = links.map((row) => row.document_id);

  let documents: ChantierDocumentRow[] = [];
  if (documentIds.length) {
    const { data: documentsData, error: documentsError } = await sb
      .from("chantier_documents")
      .select("*")
      .in("id", documentIds);

    if (documentsError) throw new Error(documentsError.message);
    documents = (documentsData ?? []) as ChantierDocumentRow[];
  }

  return {
    visite: normalizeVisite(visiteData),
    participants: ((participantsData.data ?? []) as ChantierVisiteParticipantRow[]),
    actions: actionsRows.map(normalizeAction),
    snapshot: snapshotData.data
      ? {
          id: snapshotData.data.id,
          visite_id: snapshotData.data.visite_id,
          data: validateVisiteSnapshot(snapshotData.data.data),
          created_at: snapshotData.data.created_at,
        }
      : null,
    links,
    documents,
  };
}

export async function setVisitePdfDocument(visiteId: string, documentId: string | null): Promise<void> {
  await updateVisite(visiteId, { pdf_document_id: documentId });
}

// Compatibility exports used by legacy components.
export async function listVisitesByChantierId(chantierId: string): Promise<ChantierVisiteRow[]> {
  return listVisites(chantierId);
}

export async function listVisiteActionsByVisiteIds(visiteIds: string[]): Promise<ChantierVisiteActionRow[]> {
  const ids = (visiteIds ?? []).filter(Boolean);
  if (!ids.length) return [];

  const { data, error } = await sb
    .from("chantier_visite_actions")
    .select(ACTION_SELECT)
    .in("visite_id", ids)
    .order("ordre", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTableError(error, "chantier_visite_actions")) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map(normalizeAction);
}

export async function createVisiteWithActions(input: {
  chantier_id: string;
  visit_datetime: string;
  redactor_email: string | null;
  participants: string[];
  meteo?: string | null;
  avancement_text?: string | null;
  avancement_percent?: number | null;
  observations?: string | null;
  safety_points?: string | null;
  decisions?: string | null;
  include_in_doe?: boolean;
  photo_count?: number;
  actions: Array<{ action_text: string; responsable?: string | null; due_date?: string | null }>;
}): Promise<{ visite: ChantierVisiteRow; actions: ChantierVisiteActionRow[] }> {
  const visite = await createVisite({
    chantier_id: input.chantier_id,
    visit_datetime: input.visit_datetime,
    redactor_email: input.redactor_email,
    participants: input.participants,
    meteo: input.meteo ?? null,
    avancement_text: input.avancement_text ?? null,
    avancement_percent: input.avancement_percent ?? null,
    observations: input.observations ?? null,
    safety_points: input.safety_points ?? null,
    decisions: input.decisions ?? null,
    include_in_doe: Boolean(input.include_in_doe),
    photo_count: input.photo_count ?? 0,
  });

  const actions = await setActions(
    visite.id,
    (input.actions ?? []).map((row, index) => ({
      description: row.action_text,
      responsable_nom: row.responsable ?? null,
      echeance: row.due_date ?? null,
      ordre: index + 1,
      statut: "A_FAIRE",
      responsable_type: "AUTRE",
    })),
  );

  return { visite, actions };
}
