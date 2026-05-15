import { createChantier, getChantiers, updateChantier, type ChantierRow } from "./chantiers.service";
import { supabase } from "../lib/supabaseClient";

const crmDb = supabase as any;

export type CrmProspectStatus =
  | "nouveau"
  | "a_qualifier"
  | "qualifie"
  | "devis_en_cours"
  | "negociation"
  | "gagne"
  | "perdu"
  | "archive";
export type CrmQuoteStatus =
  | "brouillon"
  | "en_preparation"
  | "envoye"
  | "relance_1"
  | "relance_2"
  | "negociation"
  | "accepte"
  | "refuse"
  | "expire";

export type CrmProspectRow = {
  id: string;
  type: string;
  civilite: string | null;
  prenom: string | null;
  nom: string | null;
  societe: string | null;
  telephone: string | null;
  mobile: string | null;
  email: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  source_acquisition: string | null;
  apporteur_affaire: string | null;
  tags: string[];
  notes: string | null;
  budget_estime: number | null;
  urgence: string | null;
  type_projet: string | null;
  description_besoin: string | null;
  owner_id: string | null;
  statut: CrmProspectStatus;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type CrmClientRow = {
  id: string;
  type: string;
  civilite: string | null;
  prenom: string | null;
  nom: string | null;
  societe: string | null;
  email: string | null;
  telephone: string | null;
  mobile: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  billing_address: Record<string, unknown>;
  addresses: Array<Record<string, unknown>>;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type CrmPipelineStageRow = {
  id: string;
  key: string;
  label: string;
  ordre: number;
  probability_default: number;
  is_won: boolean;
  is_lost: boolean;
  is_active: boolean;
};

export type CrmOpportunityRow = {
  id: string;
  prospect_id: string | null;
  client_id: string | null;
  stage_id: string | null;
  stage_key: string;
  nom_affaire: string;
  montant_estime: number;
  probabilite: number;
  echeance: string | null;
  responsable_id: string | null;
  prochaine_action: string | null;
  prochaine_action_date: string | null;
  notes: string | null;
  tags: string[];
  status: string;
  lost_reason: string | null;
  chantier_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type CrmQuoteRow = {
  id: string;
  quote_number: string;
  prospect_id: string | null;
  client_id: string | null;
  opportunity_id: string | null;
  statut: CrmQuoteStatus;
  date_emission: string | null;
  valid_until: string | null;
  montant_ht: number;
  tva: number;
  montant_ttc: number;
  marge_estimee: number | null;
  lot: string | null;
  description: string | null;
  signature_status: string;
  accepted_at: string | null;
  refused_at: string | null;
  chantier_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmTaskRow = {
  id: string;
  prospect_id: string | null;
  client_id: string | null;
  opportunity_id: string | null;
  quote_id: string | null;
  type: string;
  titre: string;
  description: string | null;
  due_at: string | null;
  priorite: string;
  statut: string;
  assigned_to: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmAppointmentRow = {
  id: string;
  prospect_id: string | null;
  client_id: string | null;
  opportunity_id: string | null;
  type: string;
  titre: string;
  starts_at: string;
  ends_at: string | null;
  rappel_at: string | null;
  statut: string;
  notes: string | null;
  compte_rendu: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmSavRow = {
  id: string;
  client_id: string | null;
  chantier_id: string | null;
  titre: string;
  description: string | null;
  urgence: string;
  statut: string;
  assigned_to: string | null;
  photos: unknown[];
  planned_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmDocumentRow = {
  id: string;
  prospect_id: string | null;
  client_id: string | null;
  opportunity_id: string | null;
  quote_id: string | null;
  chantier_id: string | null;
  type: string;
  nom: string;
  url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmCommunicationRow = {
  id: string;
  prospect_id: string | null;
  client_id: string | null;
  opportunity_id: string | null;
  quote_id: string | null;
  type: string;
  direction: string;
  subject: string | null;
  body: string | null;
  occurred_at: string;
  created_at: string;
};

export type CrmInvoiceRow = {
  id: string;
  client_id: string | null;
  quote_id: string | null;
  chantier_id: string | null;
  type: string;
  invoice_number: string | null;
  amount_ht: number;
  amount_ttc: number;
  due_date: string | null;
  statut: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmDataset = {
  prospects: CrmProspectRow[];
  clients: CrmClientRow[];
  opportunities: CrmOpportunityRow[];
  quotes: CrmQuoteRow[];
  tasks: CrmTaskRow[];
  appointments: CrmAppointmentRow[];
  sav: CrmSavRow[];
  stages: CrmPipelineStageRow[];
  documents: CrmDocumentRow[];
  communications: CrmCommunicationRow[];
  invoices: CrmInvoiceRow[];
  chantiers: ChantierRow[];
};

export type CrmChantierContext = {
  client: CrmClientRow | null;
  prospect: CrmProspectRow | null;
  opportunity: CrmOpportunityRow | null;
  quote: CrmQuoteRow | null;
  documents: CrmDocumentRow[];
  communications: CrmCommunicationRow[];
  sav: CrmSavRow[];
  invoices: CrmInvoiceRow[];
};

const DEFAULT_STAGES = [
  { key: "lead", label: "Lead", ordre: 10, probability_default: 10, is_won: false, is_lost: false },
  { key: "qualification", label: "Qualification", ordre: 20, probability_default: 25, is_won: false, is_lost: false },
  { key: "visite", label: "Visite", ordre: 30, probability_default: 40, is_won: false, is_lost: false },
  { key: "chiffrage", label: "Chiffrage", ordre: 40, probability_default: 55, is_won: false, is_lost: false },
  { key: "devis_envoye", label: "Devis envoyé", ordre: 50, probability_default: 65, is_won: false, is_lost: false },
  { key: "negociation", label: "Négociation", ordre: 60, probability_default: 75, is_won: false, is_lost: false },
  { key: "signature", label: "Signature", ordre: 70, probability_default: 90, is_won: false, is_lost: false },
  { key: "gagne", label: "Gagné", ordre: 80, probability_default: 100, is_won: true, is_lost: false },
  { key: "perdu", label: "Perdu", ordre: 90, probability_default: 0, is_won: false, is_lost: true },
];

const CRM_SELECTS = {
  prospects:
    "id,type,civilite,prenom,nom,societe,telephone,mobile,email,adresse,code_postal,ville,source_acquisition,apporteur_affaire,tags,notes,budget_estime,urgence,type_projet,description_besoin,owner_id,statut,client_id,created_at,updated_at,archived_at",
  clients:
    "id,type,civilite,prenom,nom,societe,email,telephone,mobile,adresse,code_postal,ville,billing_address,addresses,tags,notes,created_at,updated_at,archived_at",
  opportunities:
    "id,prospect_id,client_id,stage_id,stage_key,nom_affaire,montant_estime,probabilite,echeance,responsable_id,prochaine_action,prochaine_action_date,notes,tags,status,lost_reason,chantier_id,created_at,updated_at,archived_at",
  quotes:
    "id,quote_number,prospect_id,client_id,opportunity_id,statut,date_emission,valid_until,montant_ht,tva,montant_ttc,marge_estimee,lot,description,signature_status,accepted_at,refused_at,chantier_id,created_at,updated_at",
  tasks:
    "id,prospect_id,client_id,opportunity_id,quote_id,type,titre,description,due_at,priorite,statut,assigned_to,completed_at,created_at,updated_at",
  appointments:
    "id,prospect_id,client_id,opportunity_id,type,titre,starts_at,ends_at,rappel_at,statut,notes,compte_rendu,assigned_to,created_at,updated_at",
  sav: "id,client_id,chantier_id,titre,description,urgence,statut,assigned_to,photos,planned_at,closed_at,created_at,updated_at",
  documents: "id,prospect_id,client_id,opportunity_id,quote_id,chantier_id,type,nom,url,storage_path,mime_type,notes,created_at,updated_at",
  communications:
    "id,prospect_id,client_id,opportunity_id,quote_id,type,direction,subject,body,occurred_at,created_at",
  invoices:
    "id,client_id,quote_id,chantier_id,type,invoice_number,amount_ht,amount_ttc,due_date,statut,paid_at,created_at,updated_at",
  stages: "id,key,label,ordre,probability_default,is_won,is_lost,is_active",
} as const;

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

async function currentOrgId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  const id = data.user?.id;
  if (!id) throw new Error("Utilisateur non authentifié.");
  return id;
}

function isMissingCrmSchema(error: unknown): boolean {
  const msg = String((error as any)?.message ?? "").toLowerCase();
  const code = String((error as any)?.code ?? "");
  return code === "42P01" || msg.includes("does not exist") || msg.includes("schema cache");
}

async function selectTable<T>(table: string, select: string, order = "created_at"): Promise<T[]> {
  const { data, error } = await crmDb.from(table).select(select).order(order, { ascending: false });
  if (error) {
    if (isMissingCrmSchema(error)) return [];
    throw error;
  }
  return (data ?? []) as T[];
}

export async function ensureCrmDefaults() {
  const organization_id = await currentOrgId();
  const existing = await selectTable<CrmPipelineStageRow>("crm_pipeline_stages", CRM_SELECTS.stages, "ordre");
  if (existing.length > 0) return existing.sort((a, b) => a.ordre - b.ordre);

  const { data, error } = await crmDb
    .from("crm_pipeline_stages")
    .insert(DEFAULT_STAGES.map((stage) => ({ ...stage, organization_id })))
    .select(CRM_SELECTS.stages);
  if (error) {
    if (isMissingCrmSchema(error)) return [];
    throw error;
  }
  return ((data ?? []) as CrmPipelineStageRow[]).sort((a, b) => a.ordre - b.ordre);
}

export async function loadCrmDataset(): Promise<CrmDataset> {
  const stages = await ensureCrmDefaults();
  const [prospects, clients, opportunities, quotes, tasks, appointments, sav, documents, communications, invoices, chantiers] =
    await Promise.all([
      selectTable<CrmProspectRow>("crm_prospects", CRM_SELECTS.prospects),
      selectTable<CrmClientRow>("crm_clients", CRM_SELECTS.clients),
      selectTable<CrmOpportunityRow>("crm_opportunities", CRM_SELECTS.opportunities),
      selectTable<CrmQuoteRow>("crm_quotes", CRM_SELECTS.quotes),
      selectTable<CrmTaskRow>("crm_tasks", CRM_SELECTS.tasks),
      selectTable<CrmAppointmentRow>("crm_appointments", CRM_SELECTS.appointments, "starts_at"),
      selectTable<CrmSavRow>("crm_sav", CRM_SELECTS.sav),
      selectTable<CrmDocumentRow>("crm_documents", CRM_SELECTS.documents),
      selectTable<CrmCommunicationRow>("crm_communications", CRM_SELECTS.communications, "occurred_at"),
      selectTable<CrmInvoiceRow>("crm_invoices", CRM_SELECTS.invoices),
      getChantiers(),
    ]);
  return { prospects, clients, opportunities, quotes, tasks, appointments, sav, stages, documents, communications, invoices, chantiers };
}

async function maybeSingleById<T>(table: string, select: string, id: string | null | undefined): Promise<T | null> {
  if (!id) return null;
  const { data, error } = await crmDb.from(table).select(select).eq("id", id).maybeSingle();
  if (error) {
    if (isMissingCrmSchema(error)) return null;
    throw error;
  }
  return (data ?? null) as T | null;
}

export async function loadCrmChantierContext(chantier: {
  id: string;
  crm_client_id?: string | null;
  crm_prospect_id?: string | null;
  crm_opportunity_id?: string | null;
  crm_quote_id?: string | null;
}): Promise<CrmChantierContext> {
  const [client, prospect, opportunity, quote, documents, communications, sav, invoices] = await Promise.all([
    maybeSingleById<CrmClientRow>("crm_clients", CRM_SELECTS.clients, chantier.crm_client_id),
    maybeSingleById<CrmProspectRow>("crm_prospects", CRM_SELECTS.prospects, chantier.crm_prospect_id),
    maybeSingleById<CrmOpportunityRow>("crm_opportunities", CRM_SELECTS.opportunities, chantier.crm_opportunity_id),
    maybeSingleById<CrmQuoteRow>("crm_quotes", CRM_SELECTS.quotes, chantier.crm_quote_id),
    selectTable<CrmDocumentRow>("crm_documents", CRM_SELECTS.documents).then((rows) =>
      rows.filter(
        (row) =>
          row.chantier_id === chantier.id ||
          row.client_id === chantier.crm_client_id ||
          row.prospect_id === chantier.crm_prospect_id ||
          row.opportunity_id === chantier.crm_opportunity_id ||
          row.quote_id === chantier.crm_quote_id,
      ),
    ),
    selectTable<CrmCommunicationRow>("crm_communications", CRM_SELECTS.communications, "occurred_at").then((rows) =>
      rows.filter(
        (row) =>
          row.client_id === chantier.crm_client_id ||
          row.prospect_id === chantier.crm_prospect_id ||
          row.opportunity_id === chantier.crm_opportunity_id ||
          row.quote_id === chantier.crm_quote_id,
      ),
    ),
    selectTable<CrmSavRow>("crm_sav", CRM_SELECTS.sav).then((rows) =>
      rows.filter((row) => row.chantier_id === chantier.id || row.client_id === chantier.crm_client_id),
    ),
    selectTable<CrmInvoiceRow>("crm_invoices", CRM_SELECTS.invoices).then((rows) =>
      rows.filter((row) => row.chantier_id === chantier.id || row.client_id === chantier.crm_client_id || row.quote_id === chantier.crm_quote_id),
    ),
  ]);
  return { client, prospect, opportunity, quote, documents, communications, sav, invoices };
}

export async function createCrmProspect(input: Partial<CrmProspectRow>) {
  const organization_id = await currentOrgId();
  const row = {
    organization_id,
    type: text(input.type) ?? "particulier",
    civilite: text(input.civilite),
    prenom: text(input.prenom),
    nom: text(input.nom),
    societe: text(input.societe),
    telephone: text(input.telephone),
    mobile: text(input.mobile),
    email: text(input.email)?.toLowerCase() ?? null,
    adresse: text(input.adresse),
    code_postal: text(input.code_postal),
    ville: text(input.ville),
    source_acquisition: text(input.source_acquisition),
    apporteur_affaire: text(input.apporteur_affaire),
    tags: normalizeTags(input.tags),
    notes: text(input.notes),
    budget_estime: input.budget_estime === null || input.budget_estime === undefined ? null : numberOrZero(input.budget_estime),
    urgence: text(input.urgence),
    type_projet: text(input.type_projet),
    description_besoin: text(input.description_besoin),
    statut: (text(input.statut) ?? "nouveau") as CrmProspectStatus,
  };
  if (!row.nom && !row.societe) throw new Error("Nom ou société obligatoire.");
  const { data, error } = await crmDb.from("crm_prospects").insert([row]).select(CRM_SELECTS.prospects).single();
  if (error) throw error;
  await createCrmCommunication({ prospect_id: data.id, type: "note", subject: "Création prospect", body: row.description_besoin ?? row.notes });
  return data as CrmProspectRow;
}

export async function updateCrmProspect(id: string, patch: Partial<CrmProspectRow>) {
  const cleaned = {
    ...patch,
    tags: patch.tags === undefined ? undefined : normalizeTags(patch.tags),
    budget_estime: patch.budget_estime === undefined ? undefined : numberOrZero(patch.budget_estime),
  };
  const { data, error } = await crmDb.from("crm_prospects").update(cleaned).eq("id", id).select(CRM_SELECTS.prospects).single();
  if (error) throw error;
  return data as CrmProspectRow;
}

export async function convertProspectToClient(prospect: CrmProspectRow) {
  if (prospect.client_id) return prospect.client_id;
  const organization_id = await currentOrgId();
  const { data, error } = await crmDb
    .from("crm_clients")
    .insert([
      {
        organization_id,
        type: prospect.type,
        civilite: prospect.civilite,
        prenom: prospect.prenom,
        nom: prospect.nom,
        societe: prospect.societe,
        email: prospect.email,
        telephone: prospect.telephone,
        mobile: prospect.mobile,
        adresse: prospect.adresse,
        code_postal: prospect.code_postal,
        ville: prospect.ville,
        tags: prospect.tags,
        notes: prospect.notes,
      },
    ])
    .select(CRM_SELECTS.clients)
    .single();
  if (error) throw error;
  await updateCrmProspect(prospect.id, { client_id: data.id, statut: "qualifie" });
  return String(data.id);
}

export async function createCrmClient(input: Partial<CrmClientRow>) {
  const organization_id = await currentOrgId();
  const row = {
    organization_id,
    type: text(input.type) ?? "particulier",
    civilite: text(input.civilite),
    prenom: text(input.prenom),
    nom: text(input.nom),
    societe: text(input.societe),
    email: text(input.email)?.toLowerCase() ?? null,
    telephone: text(input.telephone),
    mobile: text(input.mobile),
    adresse: text(input.adresse),
    code_postal: text(input.code_postal),
    ville: text(input.ville),
    tags: normalizeTags(input.tags),
    notes: text(input.notes),
  };
  if (!row.nom && !row.societe) throw new Error("Nom ou société obligatoire.");
  const { data, error } = await crmDb.from("crm_clients").insert([row]).select(CRM_SELECTS.clients).single();
  if (error) throw error;
  return data as CrmClientRow;
}

export async function upsertCrmOpportunity(input: Partial<CrmOpportunityRow>) {
  const organization_id = await currentOrgId();
  const row = {
    organization_id,
    prospect_id: input.prospect_id ?? null,
    client_id: input.client_id ?? null,
    stage_id: input.stage_id ?? null,
    stage_key: text(input.stage_key) ?? "lead",
    nom_affaire: text(input.nom_affaire) ?? "Nouvelle opportunité",
    montant_estime: numberOrZero(input.montant_estime),
    probabilite: Math.max(0, Math.min(100, Math.round(numberOrZero(input.probabilite)))),
    echeance: input.echeance ?? null,
    prochaine_action: text(input.prochaine_action),
    prochaine_action_date: input.prochaine_action_date ?? null,
    notes: text(input.notes),
    tags: normalizeTags(input.tags),
    status: text(input.status) ?? "ouverte",
  };
  const query = input.id
    ? crmDb.from("crm_opportunities").update(row).eq("id", input.id)
    : crmDb.from("crm_opportunities").insert([row]);
  const { data, error } = await query.select(CRM_SELECTS.opportunities).single();
  if (error) throw error;
  return data as CrmOpportunityRow;
}

export async function moveCrmOpportunityStage(id: string, stage: CrmPipelineStageRow) {
  const { data, error } = await crmDb
    .from("crm_opportunities")
    .update({
      stage_id: stage.id,
      stage_key: stage.key,
      probabilite: stage.probability_default,
      status: stage.is_won ? "gagnee" : stage.is_lost ? "perdue" : "ouverte",
    })
    .eq("id", id)
    .select(CRM_SELECTS.opportunities)
    .single();
  if (error) throw error;
  return data as CrmOpportunityRow;
}

export async function createCrmQuote(input: Partial<CrmQuoteRow>) {
  const organization_id = await currentOrgId();
  const quote_number = text(input.quote_number) ?? `DEV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const montant_ht = numberOrZero(input.montant_ht);
  const tva = input.tva === undefined || input.tva === null ? 20 : numberOrZero(input.tva);
  const montant_ttc = input.montant_ttc === undefined ? Math.round(montant_ht * (1 + tva / 100) * 100) / 100 : numberOrZero(input.montant_ttc);
  const { data, error } = await crmDb
    .from("crm_quotes")
    .insert([
      {
        organization_id,
        quote_number,
        prospect_id: input.prospect_id ?? null,
        client_id: input.client_id ?? null,
        opportunity_id: input.opportunity_id ?? null,
        statut: input.statut ?? "brouillon",
        date_emission: input.date_emission ?? new Date().toISOString().slice(0, 10),
        valid_until: input.valid_until ?? null,
        montant_ht,
        tva,
        montant_ttc,
        marge_estimee: input.marge_estimee ?? null,
        lot: text(input.lot),
        description: text(input.description),
      },
    ])
    .select(CRM_SELECTS.quotes)
    .single();
  if (error) throw error;
  return data as CrmQuoteRow;
}

export async function updateCrmQuote(id: string, patch: Partial<CrmQuoteRow>) {
  const next = { ...patch };
  if (patch.montant_ht !== undefined || patch.tva !== undefined) {
    const montantHt = numberOrZero(patch.montant_ht);
    const tva = patch.tva === undefined || patch.tva === null ? 20 : numberOrZero(patch.tva);
    next.montant_ttc = Math.round(montantHt * (1 + tva / 100) * 100) / 100;
  }
  const { data, error } = await crmDb.from("crm_quotes").update(next).eq("id", id).select(CRM_SELECTS.quotes).single();
  if (error) throw error;
  return data as CrmQuoteRow;
}

export async function duplicateCrmQuote(quote: CrmQuoteRow) {
  return createCrmQuote({
    ...quote,
    id: undefined,
    quote_number: `${quote.quote_number}-COPIE`,
    statut: "brouillon",
    signature_status: "attente_signature",
    accepted_at: null,
    refused_at: null,
  });
}

export async function createCrmTask(input: Partial<CrmTaskRow>) {
  const organization_id = await currentOrgId();
  const row = {
    organization_id,
    prospect_id: input.prospect_id ?? null,
    client_id: input.client_id ?? null,
    opportunity_id: input.opportunity_id ?? null,
    quote_id: input.quote_id ?? null,
    type: text(input.type) ?? "relance",
    titre: text(input.titre) ?? "Nouvelle tâche",
    description: text(input.description),
    due_at: input.due_at ?? null,
    priorite: text(input.priorite) ?? "normale",
    statut: text(input.statut) ?? "a_faire",
  };
  const { data, error } = await crmDb.from("crm_tasks").insert([row]).select(CRM_SELECTS.tasks).single();
  if (error) throw error;
  return data as CrmTaskRow;
}

export async function updateCrmTask(id: string, patch: Partial<CrmTaskRow>) {
  const next = { ...patch };
  if (patch.statut === "terminee" && !patch.completed_at) next.completed_at = new Date().toISOString();
  const { data, error } = await crmDb.from("crm_tasks").update(next).eq("id", id).select(CRM_SELECTS.tasks).single();
  if (error) throw error;
  return data as CrmTaskRow;
}

export async function createCrmAppointment(input: Partial<CrmAppointmentRow>) {
  const organization_id = await currentOrgId();
  const row = {
    organization_id,
    prospect_id: input.prospect_id ?? null,
    client_id: input.client_id ?? null,
    opportunity_id: input.opportunity_id ?? null,
    type: text(input.type) ?? "rdv_commercial",
    titre: text(input.titre) ?? "Rendez-vous",
    starts_at: input.starts_at ?? new Date().toISOString(),
    ends_at: input.ends_at ?? null,
    rappel_at: input.rappel_at ?? null,
    statut: text(input.statut) ?? "planifie",
    notes: text(input.notes),
    compte_rendu: text(input.compte_rendu),
  };
  const { data, error } = await crmDb.from("crm_appointments").insert([row]).select(CRM_SELECTS.appointments).single();
  if (error) throw error;
  return data as CrmAppointmentRow;
}

export async function createCrmSav(input: Partial<CrmSavRow>) {
  const organization_id = await currentOrgId();
  const row = {
    organization_id,
    client_id: input.client_id ?? null,
    chantier_id: input.chantier_id ?? null,
    titre: text(input.titre) ?? "Ticket SAV",
    description: text(input.description),
    urgence: text(input.urgence) ?? "normale",
    statut: text(input.statut) ?? "ouvert",
    planned_at: input.planned_at ?? null,
  };
  const { data, error } = await crmDb.from("crm_sav").insert([row]).select(CRM_SELECTS.sav).single();
  if (error) throw error;
  return data as CrmSavRow;
}

export async function createCrmDocument(input: Partial<CrmDocumentRow>) {
  const organization_id = await currentOrgId();
  const row = {
    organization_id,
    prospect_id: input.prospect_id ?? null,
    client_id: input.client_id ?? null,
    opportunity_id: input.opportunity_id ?? null,
    quote_id: input.quote_id ?? null,
    chantier_id: input.chantier_id ?? null,
    type: text(input.type) ?? "autre",
    nom: text(input.nom) ?? "Document",
    url: text(input.url),
    storage_path: text(input.storage_path),
    mime_type: text(input.mime_type),
    notes: text(input.notes),
  };
  const { data, error } = await crmDb.from("crm_documents").insert([row]).select(CRM_SELECTS.documents).single();
  if (error) throw error;
  return data as CrmDocumentRow;
}

export async function createCrmCommunication(input: Partial<CrmCommunicationRow>) {
  const organization_id = await currentOrgId();
  const row = {
    organization_id,
    prospect_id: input.prospect_id ?? null,
    client_id: input.client_id ?? null,
    opportunity_id: input.opportunity_id ?? null,
    quote_id: input.quote_id ?? null,
    type: text(input.type) ?? "note",
    direction: text(input.direction) ?? "sortant",
    subject: text(input.subject),
    body: text(input.body),
    occurred_at: input.occurred_at ?? new Date().toISOString(),
  };
  const { data, error } = await crmDb.from("crm_communications").insert([row]).select(CRM_SELECTS.communications).single();
  if (error) throw error;
  return data as CrmCommunicationRow;
}

export async function createCrmInvoice(input: Partial<CrmInvoiceRow>) {
  const organization_id = await currentOrgId();
  const amount_ht = numberOrZero(input.amount_ht);
  const amount_ttc = input.amount_ttc === undefined ? amount_ht : numberOrZero(input.amount_ttc);
  const { data, error } = await crmDb
    .from("crm_invoices")
    .insert([
      {
        organization_id,
        client_id: input.client_id ?? null,
        quote_id: input.quote_id ?? null,
        chantier_id: input.chantier_id ?? null,
        type: text(input.type) ?? "acompte",
        invoice_number: text(input.invoice_number),
        amount_ht,
        amount_ttc,
        due_date: input.due_date ?? null,
        statut: text(input.statut) ?? "brouillon",
      },
    ])
    .select(CRM_SELECTS.invoices)
    .single();
  if (error) throw error;
  return data as CrmInvoiceRow;
}

export async function transformAcceptedQuoteToChantier(input: {
  quote: CrmQuoteRow;
  prospect?: CrmProspectRow | null;
  client?: CrmClientRow | null;
  opportunity?: CrmOpportunityRow | null;
}): Promise<ChantierRow> {
  const { quote, prospect, client, opportunity } = input;
  if (quote.statut !== "accepte") {
    await updateCrmQuote(quote.id, { statut: "accepte", signature_status: "signe", accepted_at: new Date().toISOString() });
  }
  const account = client ?? prospect ?? null;
  const clientName =
    [account?.prenom, account?.nom].filter(Boolean).join(" ") ||
    account?.societe ||
    quote.quote_number;
  const chantier = await createChantier({
    nom: opportunity?.nom_affaire ?? quote.description ?? `Chantier ${clientName}`,
    client: clientName,
    adresse: account?.adresse ?? null,
    status: "PREPARATION",
    date_debut: null,
    date_fin_prevue: quote.valid_until,
    heures_prevues: null,
  });
  await updateChantier(chantier.id, {
    heures_prevues: quote.montant_ht,
    crm_client_id: client?.id ?? quote.client_id ?? null,
    crm_prospect_id: prospect?.id ?? quote.prospect_id ?? null,
    crm_opportunity_id: opportunity?.id ?? quote.opportunity_id ?? null,
    crm_quote_id: quote.id,
    crm_client_phone: account?.mobile ?? account?.telephone ?? null,
    crm_client_email: account?.email ?? null,
    crm_project_description: quote.description ?? opportunity?.notes ?? prospect?.description_besoin ?? null,
    signed_quote_amount_ht: quote.montant_ht,
    signed_quote_tva: quote.tva,
    signed_quote_amount_ttc: quote.montant_ttc,
    budget_labor_planned_ht: Math.round(Number(quote.montant_ht ?? 0) * 0.35 * 100) / 100,
    budget_materials_planned_ht: Math.round(Number(quote.montant_ht ?? 0) * 0.35 * 100) / 100,
    budget_subcontracting_planned_ht: Math.round(Number(quote.montant_ht ?? 0) * 0.15 * 100) / 100,
  } as any).catch(() => undefined);
  await updateCrmQuote(quote.id, { chantier_id: chantier.id, statut: "accepte", signature_status: "signe", accepted_at: quote.accepted_at ?? new Date().toISOString() });
  if (opportunity) {
    const wonStage = (await ensureCrmDefaults()).find((stage) => stage.is_won);
    await crmDb
      .from("crm_opportunities")
      .update({
        chantier_id: chantier.id,
        stage_key: wonStage?.key ?? "gagne",
        stage_id: wonStage?.id ?? null,
        status: "gagnee",
        probabilite: 100,
      })
      .eq("id", opportunity.id);
  }
  return chantier;
}
