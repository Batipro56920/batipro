import { supabase } from "../lib/supabaseClient";

export type ChantierVisiteRow = {
  id: string;
  chantier_id: string;
  visit_datetime: string;
  redactor_email: string | null;
  participants: string[];
  meteo: string | null;
  avancement_text: string | null;
  avancement_percent: number | null;
  observations: string | null;
  safety_points: string | null;
  decisions: string | null;
  include_in_doe: boolean;
  photo_count: number;
  pdf_document_id: string | null;
  created_at: string;
};

export type ChantierVisiteActionRow = {
  id: string;
  visite_id: string;
  action_text: string;
  responsable: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
};

function isMissingVisitesTableError(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    (msg.includes("schema cache") && msg.includes("chantier_visites")) ||
    (msg.includes("relation") && msg.includes("chantier_visites")) ||
    msg.includes("does not exist")
  );
}

function isMissingVisiteActionsTableError(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    (msg.includes("schema cache") && msg.includes("chantier_visite_actions")) ||
    (msg.includes("relation") && msg.includes("chantier_visite_actions")) ||
    msg.includes("does not exist")
  );
}

function migrationErrorMessage() {
  return "Module Visite non déployé en base. Appliquez la migration Supabase la plus récente.";
}

export async function listVisitesByChantierId(chantierId: string): Promise<ChantierVisiteRow[]> {
  if (!chantierId) throw new Error("chantierId manquant.");
  const { data, error } = await supabase
    .from("chantier_visites")
    .select(
      "id, chantier_id, visit_datetime, redactor_email, participants, meteo, avancement_text, avancement_percent, observations, safety_points, decisions, include_in_doe, photo_count, pdf_document_id, created_at",
    )
    .eq("chantier_id", chantierId)
    .order("visit_datetime", { ascending: false });
  if (error) {
    if (isMissingVisitesTableError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as ChantierVisiteRow[];
}

export async function listVisiteActionsByVisiteIds(visiteIds: string[]): Promise<ChantierVisiteActionRow[]> {
  const ids = (visiteIds ?? []).filter(Boolean);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("chantier_visite_actions")
    .select("id, visite_id, action_text, responsable, due_date, sort_order, created_at")
    .in("visite_id", ids)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingVisiteActionsTableError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as ChantierVisiteActionRow[];
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
  if (!input.chantier_id) throw new Error("chantier_id manquant.");
  if (!input.visit_datetime) throw new Error("visit_datetime manquant.");
  const visitePayload = {
    chantier_id: input.chantier_id,
    visit_datetime: input.visit_datetime,
    redactor_email: input.redactor_email,
    participants: input.participants ?? [],
    meteo: input.meteo ?? null,
    avancement_text: input.avancement_text ?? null,
    avancement_percent: input.avancement_percent ?? null,
    observations: input.observations ?? null,
    safety_points: input.safety_points ?? null,
    decisions: input.decisions ?? null,
    include_in_doe: Boolean(input.include_in_doe),
    photo_count: input.photo_count ?? 0,
  };

  const { data: visiteData, error: visiteError } = await supabase
    .from("chantier_visites")
    .insert(visitePayload)
    .select(
      "id, chantier_id, visit_datetime, redactor_email, participants, meteo, avancement_text, avancement_percent, observations, safety_points, decisions, include_in_doe, photo_count, pdf_document_id, created_at",
    )
    .single();
  if (visiteError) {
    if (isMissingVisitesTableError(visiteError)) throw new Error(migrationErrorMessage());
    throw new Error(visiteError.message);
  }
  const visite = visiteData as ChantierVisiteRow;

  const actionRows = (input.actions ?? [])
    .map((action, index) => ({
      visite_id: visite.id,
      action_text: (action.action_text ?? "").trim(),
      responsable: action.responsable?.trim() || null,
      due_date: action.due_date || null,
      sort_order: index + 1,
    }))
    .filter((action) => action.action_text.length > 0);

  if (!actionRows.length) return { visite, actions: [] };

  const { data: actionsData, error: actionsError } = await supabase
    .from("chantier_visite_actions")
    .insert(actionRows)
    .select("id, visite_id, action_text, responsable, due_date, sort_order, created_at")
    .order("sort_order", { ascending: true });
  if (actionsError) {
    if (isMissingVisiteActionsTableError(actionsError)) throw new Error(migrationErrorMessage());
    throw new Error(actionsError.message);
  }

  return {
    visite,
    actions: (actionsData ?? []) as ChantierVisiteActionRow[],
  };
}

export async function setVisitePdfDocument(visiteId: string, documentId: string | null): Promise<void> {
  if (!visiteId) throw new Error("visiteId manquant.");
  const { error } = await supabase
    .from("chantier_visites")
    .update({ pdf_document_id: documentId })
    .eq("id", visiteId);
  if (error) {
    if (isMissingVisitesTableError(error)) throw new Error(migrationErrorMessage());
    throw new Error(error.message);
  }
}
