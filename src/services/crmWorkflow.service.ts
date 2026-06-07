import { supabase } from "../lib/supabaseClient";
import {
  createCrmProspect,
  upsertCrmOpportunity,
  type CrmAppointmentRow,
  type CrmOpportunityRow,
  type CrmPipelineStageRow,
  type CrmProspectRow,
} from "./crm.service";

const crmDb = supabase as any;

const OPPORTUNITY_SELECT =
  "id,prospect_id,client_id,stage_id,stage_key,nom_affaire,montant_estime,probabilite,echeance,responsable_id,prochaine_action,prochaine_action_date,notes,tags,status,lost_reason,chantier_id,created_at,updated_at,archived_at";
const APPOINTMENT_SELECT =
  "id,prospect_id,client_id,opportunity_id,type,titre,starts_at,ends_at,rappel_at,statut,notes,compte_rendu,assigned_to,created_at,updated_at";

function text(value: unknown): string | null {
  const clean = String(value ?? "").trim();
  return clean || null;
}

function numberOrZero(value: unknown): number {
  const n = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function prospectOpportunityLabel(prospect: CrmProspectRow) {
  const party = [prospect.prenom, prospect.nom].filter(Boolean).join(" ") || prospect.societe || prospect.email || "Prospect";
  return [prospect.type_projet, party].filter(Boolean).join(" - ");
}

async function findStage(stageKey: string): Promise<CrmPipelineStageRow | null> {
  const { data, error } = await crmDb.from("crm_pipeline_stages").select("id,key,label,ordre,probability_default,is_won,is_lost,is_active").eq("key", stageKey).maybeSingle();
  if (error) return null;
  return (data ?? null) as CrmPipelineStageRow | null;
}

export async function createOpportunityForProspect(prospect: CrmProspectRow, patch: Partial<CrmOpportunityRow> = {}) {
  const stageKey = text(patch.stage_key) ?? "qualification";
  const targetStage = await findStage(stageKey);
  return upsertCrmOpportunity({
    prospect_id: prospect.id,
    client_id: prospect.client_id,
    stage_id: targetStage?.id ?? patch.stage_id ?? null,
    stage_key: targetStage?.key ?? stageKey,
    nom_affaire: prospectOpportunityLabel(prospect),
    montant_estime: prospect.budget_estime ?? 0,
    probabilite: targetStage?.probability_default ?? 25,
    prochaine_action: "Planifier une visite terrain",
    notes: prospect.description_besoin ?? prospect.notes,
    status: "ouverte",
    ...patch,
  });
}

export async function createProspectWithInitialOpportunity(input: Partial<CrmProspectRow>) {
  const prospect = await createCrmProspect({
    ...input,
    statut: input.statut ?? "a_qualifier",
  });
  await createOpportunityForProspect(prospect);
  return prospect;
}

export async function updateCrmOpportunityStageByKey(id: string, stageKey: string, patch: Partial<CrmOpportunityRow> = {}) {
  const stage = await findStage(stageKey);
  const cleaned = {
    stage_id: stage?.id ?? patch.stage_id ?? null,
    stage_key: stage?.key ?? stageKey,
    probabilite: patch.probabilite ?? stage?.probability_default ?? undefined,
    status: stage?.is_won ? "gagnee" : stage?.is_lost ? "perdue" : patch.status ?? "ouverte",
    prospect_id: patch.prospect_id === undefined ? undefined : patch.prospect_id ?? null,
    client_id: patch.client_id === undefined ? undefined : patch.client_id ?? null,
    nom_affaire: patch.nom_affaire === undefined ? undefined : text(patch.nom_affaire),
    montant_estime: patch.montant_estime === undefined ? undefined : numberOrZero(patch.montant_estime),
    echeance: patch.echeance === undefined ? undefined : patch.echeance ?? null,
    prochaine_action: patch.prochaine_action === undefined ? undefined : text(patch.prochaine_action),
    prochaine_action_date: patch.prochaine_action_date === undefined ? undefined : patch.prochaine_action_date ?? null,
    notes: patch.notes === undefined ? undefined : text(patch.notes),
    tags: patch.tags === undefined ? undefined : normalizeTags(patch.tags),
  };
  const row = Object.fromEntries(Object.entries(cleaned).filter(([, value]) => value !== undefined));
  const { data, error } = await crmDb.from("crm_opportunities").update(row).eq("id", id).select(OPPORTUNITY_SELECT).single();
  if (error) throw error;
  return data as CrmOpportunityRow;
}

export async function updateCrmAppointment(id: string, patch: Partial<CrmAppointmentRow>) {
  const cleaned = {
    prospect_id: patch.prospect_id === undefined ? undefined : patch.prospect_id ?? null,
    client_id: patch.client_id === undefined ? undefined : patch.client_id ?? null,
    opportunity_id: patch.opportunity_id === undefined ? undefined : patch.opportunity_id ?? null,
    type: patch.type === undefined ? undefined : text(patch.type),
    titre: patch.titre === undefined ? undefined : text(patch.titre),
    starts_at: patch.starts_at === undefined ? undefined : patch.starts_at,
    ends_at: patch.ends_at === undefined ? undefined : patch.ends_at ?? null,
    rappel_at: patch.rappel_at === undefined ? undefined : patch.rappel_at ?? null,
    statut: patch.statut === undefined ? undefined : text(patch.statut),
    notes: patch.notes === undefined ? undefined : text(patch.notes),
    compte_rendu: patch.compte_rendu === undefined ? undefined : text(patch.compte_rendu),
    assigned_to: patch.assigned_to === undefined ? undefined : patch.assigned_to ?? null,
  };
  const row = Object.fromEntries(Object.entries(cleaned).filter(([, value]) => value !== undefined));
  const { data, error } = await crmDb.from("crm_appointments").update(row).eq("id", id).select(APPOINTMENT_SELECT).single();
  if (error) throw error;
  return data as CrmAppointmentRow;
}
