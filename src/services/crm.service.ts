import jsPDF from "jspdf";
import { createChantier, getChantiers, updateChantier, type ChantierRow } from "./chantiers.service";
import { createDevis, createDevisLigne } from "./devis.service";
import { createTask } from "./chantierTasks.service";
import { list as listTaskTemplates, type TaskTemplateRow } from "./taskLibrary.service";
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
  | "vu"
  | "negociation"
  | "accepte"
  | "refuse"
  | "expire"
  | "annule";

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
  conditions?: string | null;
  acompte_percent?: number | null;
  viewed_at?: string | null;
  revision?: number | null;
  archived_at?: string | null;
  display_options?: Record<string, unknown> | null;
  payment_terms_text?: string | null;
  legal_mentions?: Record<string, unknown> | null;
  waste_management?: Record<string, unknown> | null;
  sent_at?: string | null;
  last_reminder_at?: string | null;
  signatory_name?: string | null;
  client_comment?: string | null;
  chantier_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmQuoteSectionRow = {
  id: string;
  quote_id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  section_type: "section" | "subsection";
  ordre: number;
  numbering: string | null;
  show_total: boolean;
  page_break_before: boolean;
  created_at: string;
  updated_at: string;
};

export type CrmQuoteLotRow = {
  id: string;
  quote_id: string;
  title: string;
  ordre: number;
  created_at: string;
  updated_at: string;
};

export type CrmQuoteItemRow = {
  id: string;
  quote_id: string;
  lot_id: string | null;
  section_id: string | null;
  parent_item_id: string | null;
  lot: string | null;
  designation: string;
  description: string | null;
  quantite: number;
  unite: string | null;
  prix_unitaire_ht: number;
  total_ht: number;
  ordre: number;
  task_template_id: string | null;
  supplier_id: string | null;
  line_type: string;
  family: string | null;
  supplier_reference: string | null;
  price_status: string;
  show_to_client: boolean;
  page_break_before: boolean;
  numbering: string | null;
  cost_materials_ht: number;
  cost_labor_ht: number;
  cost_subcontracting_ht: number;
  cost_fees_ht: number;
  labor_hours: number;
  labor_rate_ht: number;
  margin_rate: number;
  coefficient: number;
  tva_rate: number;
  sale_unit_price_ht: number;
  sale_total_ht: number;
  technical_description: string | null;
  generate_task: boolean;
  created_at: string;
  updated_at: string;
};

export type CrmQuoteComponentRow = {
  id: string;
  quote_id: string;
  quote_item_id: string;
  component_type: "material" | "labor" | "subcontracting" | "equipment" | "fee" | "text";
  family: string | null;
  designation: string;
  unit: string | null;
  quantity: number;
  purchase_unit_price_ht: number;
  sale_unit_price_ht: number;
  total_cost_ht: number;
  total_sale_ht: number;
  gross_margin_ht: number;
  margin_rate: number;
  tva_rate: number;
  supplier_id: string | null;
  supplier_reference: string | null;
  price_status: string;
  lead_time_days: number | null;
  last_price_update_at: string | null;
  ordre: number;
  created_at: string;
  updated_at: string;
};

export type CrmPaymentTermRow = {
  id: string;
  quote_id: string | null;
  label: string;
  percent: number | null;
  amount_ht: number | null;
  amount_ttc: number | null;
  due_trigger: string | null;
  due_date: string | null;
  payment_methods: string[];
  notes: string | null;
  ordre: number;
  created_at: string;
  updated_at: string;
};

export type CrmPurchaseRow = {
  id: string;
  chantier_id: string | null;
  quote_id: string | null;
  quote_item_id: string | null;
  supplier_id: string | null;
  lot: string | null;
  category: string;
  label: string;
  purchase_date: string | null;
  amount_ht: number;
  tva_rate: number;
  amount_ttc: number;
  status: string;
  invoice_document_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmQuoteResourceRow = {
  id: string;
  quote_id: string;
  quote_item_id: string | null;
  kind: "material" | "labor" | "subcontracting" | "fee";
  label: string;
  supplier_id: string | null;
  quantity: number;
  unit: string | null;
  unit_cost_ht: number;
  tva_rate: number;
  margin_rate: number;
  total_cost_ht: number;
  sale_total_ht: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmQuoteEngineData = {
  quote: CrmQuoteRow;
  sections: CrmQuoteSectionRow[];
  lots: CrmQuoteLotRow[];
  items: CrmQuoteItemRow[];
  components: CrmQuoteComponentRow[];
  resources: CrmQuoteResourceRow[];
  paymentTerms: CrmPaymentTermRow[];
  taskTemplates: TaskTemplateRow[];
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
  purchases: CrmPurchaseRow[];
  chantiers: ChantierRow[];
  taskTemplates: TaskTemplateRow[];
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
    "id,quote_number,prospect_id,client_id,opportunity_id,statut,date_emission,valid_until,montant_ht,tva,montant_ttc,marge_estimee,lot,description,signature_status,accepted_at,refused_at,conditions,acompte_percent,viewed_at,revision,archived_at,display_options,payment_terms_text,legal_mentions,waste_management,sent_at,last_reminder_at,signatory_name,client_comment,chantier_id,created_at,updated_at",
  quotesLegacy:
    "id,quote_number,prospect_id,client_id,opportunity_id,statut,date_emission,valid_until,montant_ht,tva,montant_ttc,marge_estimee,lot,description,signature_status,accepted_at,refused_at,chantier_id,created_at,updated_at",
  quoteSections:
    "id,quote_id,parent_id,title,description,section_type,ordre,numbering,show_total,page_break_before,created_at,updated_at",
  quoteLots: "id,quote_id,title,ordre,created_at,updated_at",
  quoteItems:
    "id,quote_id,lot_id,section_id,parent_item_id,lot,designation,description,quantite,unite,prix_unitaire_ht,total_ht,ordre,task_template_id,supplier_id,line_type,family,supplier_reference,price_status,show_to_client,page_break_before,numbering,cost_materials_ht,cost_labor_ht,cost_subcontracting_ht,cost_fees_ht,labor_hours,labor_rate_ht,margin_rate,coefficient,tva_rate,sale_unit_price_ht,sale_total_ht,technical_description,generate_task,created_at,updated_at",
  quoteItemsLegacy:
    "id,quote_id,lot,designation,description,quantite,unite,prix_unitaire_ht,total_ht,ordre,created_at,updated_at",
  quoteComponents:
    "id,quote_id,quote_item_id,component_type,family,designation,unit,quantity,purchase_unit_price_ht,sale_unit_price_ht,total_cost_ht,total_sale_ht,gross_margin_ht,margin_rate,tva_rate,supplier_id,supplier_reference,price_status,lead_time_days,last_price_update_at,ordre,created_at,updated_at",
  quoteResources:
    "id,quote_id,quote_item_id,kind,label,supplier_id,quantity,unit,unit_cost_ht,tva_rate,margin_rate,total_cost_ht,sale_total_ht,notes,created_at,updated_at",
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
  paymentTerms:
    "id,quote_id,label,percent,amount_ht,amount_ttc,due_trigger,due_date,payment_methods,notes,ordre,created_at,updated_at",
  purchases:
    "id,chantier_id,quote_id,quote_item_id,supplier_id,lot,category,label,purchase_date,amount_ht,tva_rate,amount_ttc,status,invoice_document_id,notes,created_at,updated_at",
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

async function selectTableWithFallback<T>(table: string, select: string, fallbackSelect: string, order = "created_at"): Promise<T[]> {
  const { data, error } = await crmDb.from(table).select(select).order(order, { ascending: false });
  if (!error) return (data ?? []) as T[];
  const fallback = await crmDb.from(table).select(fallbackSelect).order(order, { ascending: false });
  if (fallback.error) {
    if (isMissingCrmSchema(fallback.error)) return [];
    throw fallback.error;
  }
  return (fallback.data ?? []) as T[];
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
  const [prospects, clients, opportunities, quotes, tasks, appointments, sav, documents, communications, invoices, purchases, chantiers, taskTemplates] =
    await Promise.all([
      selectTable<CrmProspectRow>("crm_prospects", CRM_SELECTS.prospects),
      selectTable<CrmClientRow>("crm_clients", CRM_SELECTS.clients),
      selectTable<CrmOpportunityRow>("crm_opportunities", CRM_SELECTS.opportunities),
      selectTableWithFallback<CrmQuoteRow>("crm_quotes", CRM_SELECTS.quotes, CRM_SELECTS.quotesLegacy),
      selectTable<CrmTaskRow>("crm_tasks", CRM_SELECTS.tasks),
      selectTable<CrmAppointmentRow>("crm_appointments", CRM_SELECTS.appointments, "starts_at"),
      selectTable<CrmSavRow>("crm_sav", CRM_SELECTS.sav),
      selectTable<CrmDocumentRow>("crm_documents", CRM_SELECTS.documents),
      selectTable<CrmCommunicationRow>("crm_communications", CRM_SELECTS.communications, "occurred_at"),
      selectTable<CrmInvoiceRow>("crm_invoices", CRM_SELECTS.invoices),
      selectTable<CrmPurchaseRow>("crm_purchases", CRM_SELECTS.purchases),
      getChantiers(),
      listTaskTemplates().catch(() => []),
    ]);
  return { prospects, clients, opportunities, quotes, tasks, appointments, sav, stages, documents, communications, invoices, purchases, chantiers, taskTemplates };
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

async function maybeSingleByIdWithFallback<T>(table: string, select: string, fallbackSelect: string, id: string | null | undefined): Promise<T | null> {
  if (!id) return null;
  const { data, error } = await crmDb.from(table).select(select).eq("id", id).maybeSingle();
  if (!error) return (data ?? null) as T | null;
  const fallback = await crmDb.from(table).select(fallbackSelect).eq("id", id).maybeSingle();
  if (fallback.error) {
    if (isMissingCrmSchema(fallback.error)) return null;
    throw fallback.error;
  }
  return (fallback.data ?? null) as T | null;
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
    maybeSingleByIdWithFallback<CrmQuoteRow>("crm_quotes", CRM_SELECTS.quotes, CRM_SELECTS.quotesLegacy, chantier.crm_quote_id),
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
  const query = await crmDb
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
        conditions: text(input.conditions),
        acompte_percent: input.acompte_percent ?? null,
        payment_terms_text: input.payment_terms_text ?? null,
        legal_mentions: input.legal_mentions ?? null,
        waste_management: input.waste_management ?? null,
        display_options: input.display_options ?? null,
      },
    ])
    .select(CRM_SELECTS.quotes)
    .single();
  if (!query.error) return query.data as CrmQuoteRow;
  if (!isMissingCrmSchema(query.error)) throw query.error;

  const legacy = await crmDb.from("crm_quotes").select(CRM_SELECTS.quotesLegacy).eq("quote_number", quote_number).single();
  if (legacy.error) throw legacy.error;
  return legacy.data as CrmQuoteRow;
}

export async function updateCrmQuote(id: string, patch: Partial<CrmQuoteRow>) {
  const next = { ...patch };
  if (patch.montant_ht !== undefined || patch.tva !== undefined) {
    const montantHt = numberOrZero(patch.montant_ht);
    const tva = patch.tva === undefined || patch.tva === null ? 20 : numberOrZero(patch.tva);
    next.montant_ttc = Math.round(montantHt * (1 + tva / 100) * 100) / 100;
  }
  const { data, error } = await crmDb.from("crm_quotes").update(next).eq("id", id).select(CRM_SELECTS.quotes).single();
  if (!error) return data as CrmQuoteRow;
  if (!isMissingCrmSchema(error)) throw error;
  const legacyPatch = { ...(next as Record<string, unknown>) };
  delete legacyPatch.conditions;
  delete legacyPatch.acompte_percent;
  delete legacyPatch.viewed_at;
  delete legacyPatch.revision;
  delete legacyPatch.archived_at;
  delete legacyPatch.display_options;
  delete legacyPatch.payment_terms_text;
  delete legacyPatch.legal_mentions;
  delete legacyPatch.waste_management;
  delete legacyPatch.sent_at;
  delete legacyPatch.last_reminder_at;
  delete legacyPatch.signatory_name;
  delete legacyPatch.client_comment;
  const legacy = await crmDb.from("crm_quotes").update(legacyPatch).eq("id", id).select(CRM_SELECTS.quotesLegacy).single();
  if (legacy.error) throw legacy.error;
  return legacy.data as CrmQuoteRow;
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

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function calculateCrmQuoteItemTotals(input: {
  quantity?: unknown;
  materials?: unknown;
  laborHours?: unknown;
  laborRate?: unknown;
  subcontracting?: unknown;
  fees?: unknown;
  marginRate?: unknown;
  coefficient?: unknown;
}) {
  const quantity = Math.max(0, numberOrZero(input.quantity ?? 1));
  const materials = numberOrZero(input.materials);
  const laborHours = numberOrZero(input.laborHours);
  const laborRate = numberOrZero(input.laborRate ?? 45);
  const subcontracting = numberOrZero(input.subcontracting);
  const fees = numberOrZero(input.fees);
  const marginRate = numberOrZero(input.marginRate ?? 25);
  const coefficient = numberOrZero(input.coefficient ?? 1) || 1;
  const labor = roundMoney(laborHours * laborRate);
  const costUnit = roundMoney(materials + labor + subcontracting + fees);
  const saleUnit = roundMoney(costUnit * coefficient * (1 + marginRate / 100));
  return {
    quantity,
    cost_materials_ht: roundMoney(materials),
    cost_labor_ht: labor,
    cost_subcontracting_ht: roundMoney(subcontracting),
    cost_fees_ht: roundMoney(fees),
    labor_hours: laborHours,
    labor_rate_ht: laborRate,
    margin_rate: marginRate,
    coefficient,
    prix_unitaire_ht: saleUnit,
    sale_unit_price_ht: saleUnit,
    total_ht: roundMoney(saleUnit * quantity),
    sale_total_ht: roundMoney(saleUnit * quantity),
    debourse_sec_unit_ht: costUnit,
    debourse_sec_total_ht: roundMoney(costUnit * quantity),
  };
}

function normalizeQuoteItem(row: any): CrmQuoteItemRow {
  const quantity = numberOrZero(row?.quantite ?? 1);
  const unitPrice = numberOrZero(row?.sale_unit_price_ht ?? row?.prix_unitaire_ht);
  const total = numberOrZero(row?.sale_total_ht ?? row?.total_ht ?? unitPrice * quantity);
  return {
    ...row,
    lot_id: row?.lot_id ?? null,
    section_id: row?.section_id ?? null,
    parent_item_id: row?.parent_item_id ?? null,
    task_template_id: row?.task_template_id ?? null,
    supplier_id: row?.supplier_id ?? null,
    line_type: row?.line_type ?? "simple",
    family: row?.family ?? null,
    supplier_reference: row?.supplier_reference ?? null,
    price_status: row?.price_status ?? "estimated",
    show_to_client: row?.show_to_client ?? true,
    page_break_before: row?.page_break_before ?? false,
    numbering: row?.numbering ?? null,
    cost_materials_ht: numberOrZero(row?.cost_materials_ht),
    cost_labor_ht: numberOrZero(row?.cost_labor_ht),
    cost_subcontracting_ht: numberOrZero(row?.cost_subcontracting_ht),
    cost_fees_ht: numberOrZero(row?.cost_fees_ht),
    labor_hours: numberOrZero(row?.labor_hours),
    labor_rate_ht: numberOrZero(row?.labor_rate_ht ?? 45),
    margin_rate: numberOrZero(row?.margin_rate ?? 25),
    coefficient: numberOrZero(row?.coefficient ?? 1) || 1,
    tva_rate: numberOrZero(row?.tva_rate ?? 20),
    sale_unit_price_ht: unitPrice,
    sale_total_ht: total,
    prix_unitaire_ht: numberOrZero(row?.prix_unitaire_ht ?? unitPrice),
    total_ht: numberOrZero(row?.total_ht ?? total),
    technical_description: row?.technical_description ?? row?.description ?? null,
    generate_task: row?.generate_task ?? true,
  } as CrmQuoteItemRow;
}

export async function loadCrmQuoteEngineData(quoteId: string): Promise<CrmQuoteEngineData> {
  const quote = await maybeSingleByIdWithFallback<CrmQuoteRow>("crm_quotes", CRM_SELECTS.quotes, CRM_SELECTS.quotesLegacy, quoteId);
  if (!quote) throw new Error("Devis CRM introuvable.");
  const [sections, lots, items, components, resources, paymentTerms, taskTemplates] = await Promise.all([
    selectTable<CrmQuoteSectionRow>("crm_quote_sections", CRM_SELECTS.quoteSections, "ordre"),
    selectTable<CrmQuoteLotRow>("crm_quote_lots", CRM_SELECTS.quoteLots, "ordre"),
    selectTableWithFallback<CrmQuoteItemRow>("crm_quote_items", CRM_SELECTS.quoteItems, CRM_SELECTS.quoteItemsLegacy, "ordre"),
    selectTable<CrmQuoteComponentRow>("crm_quote_components", CRM_SELECTS.quoteComponents, "ordre"),
    selectTable<CrmQuoteResourceRow>("crm_quote_resources", CRM_SELECTS.quoteResources),
    selectTable<CrmPaymentTermRow>("crm_payment_terms", CRM_SELECTS.paymentTerms, "ordre"),
    listTaskTemplates().catch(() => []),
  ]);
  return {
    quote,
    sections: sections.filter((row) => row.quote_id === quoteId).sort((a, b) => a.ordre - b.ordre),
    lots: lots.filter((row) => row.quote_id === quoteId).sort((a, b) => a.ordre - b.ordre),
    items: items.filter((row) => row.quote_id === quoteId).map(normalizeQuoteItem).sort((a, b) => a.ordre - b.ordre),
    components: components.filter((row) => row.quote_id === quoteId).sort((a, b) => a.ordre - b.ordre),
    resources: resources.filter((row) => row.quote_id === quoteId),
    paymentTerms: paymentTerms.filter((row) => row.quote_id === quoteId).sort((a, b) => a.ordre - b.ordre),
    taskTemplates,
  };
}

export async function createCrmQuoteSection(input: {
  quote_id: string;
  parent_id?: string | null;
  title: string;
  description?: string | null;
  section_type?: "section" | "subsection";
  ordre?: number | null;
}) {
  const organization_id = await currentOrgId();
  const title = text(input.title);
  if (!title) throw new Error("Titre de section obligatoire.");
  const { data, error } = await crmDb
    .from("crm_quote_sections")
    .insert([
      {
        organization_id,
        quote_id: input.quote_id,
        parent_id: input.parent_id ?? null,
        title,
        description: text(input.description),
        section_type: input.section_type ?? "section",
        ordre: input.ordre ?? 0,
      },
    ])
    .select(CRM_SELECTS.quoteSections)
    .single();
  if (error) throw error;
  return data as CrmQuoteSectionRow;
}

export async function createCrmQuoteLot(input: { quote_id: string; title: string; ordre?: number | null }) {
  const organization_id = await currentOrgId();
  const title = text(input.title);
  if (!title) throw new Error("Nom du lot obligatoire.");
  const { data, error } = await crmDb
    .from("crm_quote_lots")
    .insert([{ organization_id, quote_id: input.quote_id, title, ordre: input.ordre ?? 0 }])
    .select(CRM_SELECTS.quoteLots)
    .single();
  if (error) throw error;
  return data as CrmQuoteLotRow;
}

export async function createCrmQuoteItemFromTemplate(input: {
  quote_id: string;
  lot_id?: string | null;
  section_id?: string | null;
  lineType?: string | null;
  lot?: string | null;
  template?: TaskTemplateRow | null;
  designation?: string | null;
  description?: string | null;
  unit?: string | null;
  quantity?: unknown;
  unitPriceHt?: unknown;
  tvaRate?: unknown;
  marginRate?: unknown;
  coefficient?: unknown;
  materialsCost?: unknown;
  subcontractingCost?: unknown;
  feesCost?: unknown;
  laborRate?: unknown;
  ordre?: number | null;
}) {
  const organization_id = await currentOrgId();
  const template = input.template ?? null;
  const quantity = input.quantity ?? template?.quantite_defaut ?? 1;
  const laborHours = Number(template?.temps_prevu_par_unite_h ?? 0);
  const totals = calculateCrmQuoteItemTotals({
    quantity,
    materials: input.materialsCost ?? template?.cout_reference_unitaire_ht ?? 0,
    laborHours,
    laborRate: input.laborRate ?? 45,
    subcontracting: input.subcontractingCost ?? 0,
    fees: input.feesCost ?? 0,
    marginRate: input.marginRate ?? 25,
    coefficient: input.coefficient ?? 1,
  });
  const row = {
    organization_id,
    quote_id: input.quote_id,
    lot_id: input.lot_id ?? null,
    section_id: input.section_id ?? null,
    lot: text(input.lot) ?? template?.lot ?? null,
    designation: text(input.designation) ?? template?.titre ?? "Ouvrage",
    description: text(input.description) ?? template?.remarques ?? null,
    quantite: totals.quantity,
    unite: text(input.unit) ?? template?.unite ?? null,
    prix_unitaire_ht: input.unitPriceHt === undefined ? totals.prix_unitaire_ht : numberOrZero(input.unitPriceHt),
    total_ht: input.unitPriceHt === undefined ? totals.total_ht : roundMoney(numberOrZero(input.unitPriceHt) * totals.quantity),
    ordre: input.ordre ?? 0,
    task_template_id: template?.id ?? null,
    line_type: text(input.lineType) ?? (template ? "composite" : "simple"),
    family: template?.lot ?? null,
    price_status: "estimated",
    show_to_client: true,
    cost_materials_ht: totals.cost_materials_ht,
    cost_labor_ht: totals.cost_labor_ht,
    cost_subcontracting_ht: totals.cost_subcontracting_ht,
    cost_fees_ht: totals.cost_fees_ht,
    labor_hours: totals.labor_hours,
    labor_rate_ht: totals.labor_rate_ht,
    margin_rate: totals.margin_rate,
    coefficient: totals.coefficient,
    tva_rate: numberOrZero(input.tvaRate ?? 20),
    sale_unit_price_ht: input.unitPriceHt === undefined ? totals.sale_unit_price_ht : numberOrZero(input.unitPriceHt),
    sale_total_ht: input.unitPriceHt === undefined ? totals.sale_total_ht : roundMoney(numberOrZero(input.unitPriceHt) * totals.quantity),
    technical_description: template?.description_technique ?? null,
    generate_task: true,
  };
  const { data, error } = await crmDb.from("crm_quote_items").insert([row]).select(CRM_SELECTS.quoteItems).single();
  if (error) throw error;
  await recalculateCrmQuoteTotals(input.quote_id);
  return normalizeQuoteItem(data);
}

export async function createCrmQuoteComponent(input: Partial<CrmQuoteComponentRow> & { quote_id: string; quote_item_id: string }) {
  const organization_id = await currentOrgId();
  const quantity = numberOrZero(input.quantity ?? 1);
  const purchaseUnit = numberOrZero(input.purchase_unit_price_ht);
  const saleUnit = input.sale_unit_price_ht === undefined ? purchaseUnit * (1 + numberOrZero(input.margin_rate ?? 0) / 100) : numberOrZero(input.sale_unit_price_ht);
  const totalCost = roundMoney(quantity * purchaseUnit);
  const totalSale = roundMoney(quantity * saleUnit);
  const grossMargin = roundMoney(totalSale - totalCost);
  const marginRate = totalSale ? roundMoney((grossMargin / totalSale) * 100) : 0;
  const row = {
    organization_id,
    quote_id: input.quote_id,
    quote_item_id: input.quote_item_id,
    component_type: input.component_type ?? "material",
    family: text(input.family),
    designation: text(input.designation) ?? "Composant",
    unit: text(input.unit),
    quantity,
    purchase_unit_price_ht: purchaseUnit,
    sale_unit_price_ht: roundMoney(saleUnit),
    total_cost_ht: totalCost,
    total_sale_ht: totalSale,
    gross_margin_ht: grossMargin,
    margin_rate: marginRate,
    tva_rate: numberOrZero(input.tva_rate ?? 20),
    supplier_id: input.supplier_id ?? null,
    supplier_reference: text(input.supplier_reference),
    price_status: text(input.price_status) ?? "estimated",
    lead_time_days: input.lead_time_days ?? null,
    last_price_update_at: input.last_price_update_at ?? null,
    ordre: input.ordre ?? 0,
  };
  const { data, error } = await crmDb.from("crm_quote_components").insert([row]).select(CRM_SELECTS.quoteComponents).single();
  if (error) throw error;
  await recalculateCrmQuoteTotals(input.quote_id);
  return data as CrmQuoteComponentRow;
}

export async function updateCrmQuoteItem(id: string, patch: Partial<CrmQuoteItemRow>) {
  const { data, error } = await crmDb.from("crm_quote_items").update(patch).eq("id", id).select(CRM_SELECTS.quoteItems).single();
  if (error) throw error;
  const row = normalizeQuoteItem(data);
  await recalculateCrmQuoteTotals(row.quote_id);
  return row;
}

export async function deleteCrmQuoteItem(id: string, quoteId: string) {
  const { error } = await crmDb.from("crm_quote_items").delete().eq("id", id);
  if (error) throw error;
  await recalculateCrmQuoteTotals(quoteId);
}

export async function createCrmQuoteResource(input: Partial<CrmQuoteResourceRow> & { quote_id: string }) {
  const organization_id = await currentOrgId();
  const quantity = numberOrZero(input.quantity ?? 1);
  const unitCost = numberOrZero(input.unit_cost_ht);
  const marginRate = numberOrZero(input.margin_rate);
  const totalCost = roundMoney(quantity * unitCost);
  const saleTotal = roundMoney(totalCost * (1 + marginRate / 100));
  const row = {
    organization_id,
    quote_id: input.quote_id,
    quote_item_id: input.quote_item_id ?? null,
    kind: input.kind ?? "material",
    label: text(input.label) ?? "Ressource",
    supplier_id: input.supplier_id ?? null,
    quantity,
    unit: text(input.unit),
    unit_cost_ht: unitCost,
    tva_rate: numberOrZero(input.tva_rate ?? 20),
    margin_rate: marginRate,
    total_cost_ht: totalCost,
    sale_total_ht: saleTotal,
    notes: text(input.notes),
  };
  const { data, error } = await crmDb.from("crm_quote_resources").insert([row]).select(CRM_SELECTS.quoteResources).single();
  if (error) throw error;
  return data as CrmQuoteResourceRow;
}

export async function createCrmPaymentTerm(input: Partial<CrmPaymentTermRow> & { quote_id: string }) {
  const organization_id = await currentOrgId();
  const row = {
    organization_id,
    quote_id: input.quote_id,
    label: text(input.label) ?? "Echeance",
    percent: input.percent === undefined || input.percent === null ? null : numberOrZero(input.percent),
    amount_ht: input.amount_ht === undefined || input.amount_ht === null ? null : numberOrZero(input.amount_ht),
    amount_ttc: input.amount_ttc === undefined || input.amount_ttc === null ? null : numberOrZero(input.amount_ttc),
    due_trigger: text(input.due_trigger),
    due_date: input.due_date ?? null,
    payment_methods: Array.isArray(input.payment_methods) ? input.payment_methods : [],
    notes: text(input.notes),
    ordre: input.ordre ?? 0,
  };
  const { data, error } = await crmDb.from("crm_payment_terms").insert([row]).select(CRM_SELECTS.paymentTerms).single();
  if (error) throw error;
  return data as CrmPaymentTermRow;
}

export async function createCrmPurchase(input: Partial<CrmPurchaseRow>) {
  const organization_id = await currentOrgId();
  const amountHt = numberOrZero(input.amount_ht);
  const tvaRate = numberOrZero(input.tva_rate ?? 20);
  const { data, error } = await crmDb
    .from("crm_purchases")
    .insert([
      {
        organization_id,
        chantier_id: input.chantier_id ?? null,
        quote_id: input.quote_id ?? null,
        quote_item_id: input.quote_item_id ?? null,
        supplier_id: input.supplier_id ?? null,
        lot: text(input.lot),
        category: text(input.category) ?? "materials",
        label: text(input.label) ?? "Achat",
        purchase_date: input.purchase_date ?? new Date().toISOString().slice(0, 10),
        amount_ht: amountHt,
        tva_rate: tvaRate,
        amount_ttc: input.amount_ttc === undefined ? roundMoney(amountHt * (1 + tvaRate / 100)) : numberOrZero(input.amount_ttc),
        status: text(input.status) ?? "planned",
        invoice_document_id: input.invoice_document_id ?? null,
        notes: text(input.notes),
      },
    ])
    .select(CRM_SELECTS.purchases)
    .single();
  if (error) throw error;
  return data as CrmPurchaseRow;
}

export async function recalculateCrmQuoteTotals(quoteId: string) {
  const engine = await loadCrmQuoteEngineData(quoteId);
  const componentsByItem = new Map<string, CrmQuoteComponentRow[]>();
  for (const component of engine.components) {
    componentsByItem.set(component.quote_item_id, [...(componentsByItem.get(component.quote_item_id) ?? []), component]);
  }
  const itemSaleTotal = (row: CrmQuoteItemRow) => {
    const components = componentsByItem.get(row.id) ?? [];
    return components.length
      ? components.reduce((sum, component) => sum + Number(component.total_sale_ht ?? 0), 0)
      : Number(row.sale_total_ht ?? row.total_ht ?? 0);
  };
  const itemCostTotal = (row: CrmQuoteItemRow) => {
    const components = componentsByItem.get(row.id) ?? [];
    return components.length
      ? components.reduce((sum, component) => sum + Number(component.total_cost_ht ?? 0), 0)
      : (Number(row.cost_materials_ht ?? 0) + Number(row.cost_labor_ht ?? 0) + Number(row.cost_subcontracting_ht ?? 0) + Number(row.cost_fees_ht ?? 0)) *
          Number(row.quantite ?? 1);
  };
  const amountHt = roundMoney(engine.items.reduce((sum, row) => sum + itemSaleTotal(row), 0));
  const tvaAmount = roundMoney(
    engine.items.reduce((sum, row) => sum + itemSaleTotal(row) * (Number(row.tva_rate ?? 20) / 100), 0),
  );
  const costTotal = engine.items.reduce((sum, row) => sum + itemCostTotal(row), 0);
  return updateCrmQuote(quoteId, {
    montant_ht: amountHt,
    tva: amountHt ? roundMoney((tvaAmount / amountHt) * 100) : 20,
    montant_ttc: roundMoney(amountHt + tvaAmount),
    marge_estimee: roundMoney(amountHt - costTotal),
  });
}

export function downloadCrmQuotePdf(input: {
  quote: CrmQuoteRow;
  client?: CrmClientRow | null;
  prospect?: CrmProspectRow | null;
  lots: CrmQuoteLotRow[];
  items: CrmQuoteItemRow[];
}) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const account = input.client ?? input.prospect ?? null;
  const customer = entityName(account) || "Client a definir";
  let y = 18;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("Batipro", 14, y);
  pdf.setFontSize(16);
  pdf.text(`Devis ${input.quote.quote_number}`, 120, y);
  y += 10;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Client : ${customer}`, 14, y);
  y += 6;
  pdf.text(`Adresse : ${account?.adresse ?? ""} ${account?.code_postal ?? ""} ${account?.ville ?? ""}`.trim(), 14, y);
  y += 6;
  pdf.text(`Emission : ${input.quote.date_emission ?? "-"}  Validite : ${input.quote.valid_until ?? "-"}`, 14, y);
  y += 10;
  pdf.setFont("helvetica", "bold");
  pdf.text("Designation", 14, y);
  pdf.text("Qté", 112, y);
  pdf.text("PU HT", 132, y);
  pdf.text("TVA", 157, y);
  pdf.text("Total HT", 174, y);
  y += 4;
  pdf.line(14, y, 196, y);
  y += 6;

  const lots = input.lots.length ? input.lots : [{ id: "", quote_id: input.quote.id, title: input.quote.lot ?? "Ouvrages", ordre: 0, created_at: "", updated_at: "" }];
  for (const lot of lots) {
    const lotItems = input.items.filter((item) => (lot.id ? item.lot_id === lot.id : true));
    if (!lotItems.length) continue;
    pdf.setFont("helvetica", "bold");
    pdf.text(lot.title, 14, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    for (const item of lotItems) {
      if (y > 270) {
        pdf.addPage();
        y = 18;
      }
      const lines = pdf.splitTextToSize(item.designation, 88);
      pdf.text(lines, 14, y);
      pdf.text(String(item.quantite ?? 1), 112, y);
      pdf.text(roundMoney(item.sale_unit_price_ht ?? item.prix_unitaire_ht).toLocaleString("fr-FR"), 132, y);
      pdf.text(`${item.tva_rate ?? 20}%`, 157, y);
      pdf.text(roundMoney(item.sale_total_ht ?? item.total_ht).toLocaleString("fr-FR"), 174, y);
      y += Math.max(6, lines.length * 5);
    }
    y += 2;
  }
  y = Math.max(y + 8, 235);
  pdf.line(126, y - 5, 196, y - 5);
  pdf.setFont("helvetica", "bold");
  pdf.text(`Total HT : ${roundMoney(input.quote.montant_ht).toLocaleString("fr-FR")} EUR`, 132, y);
  y += 7;
  pdf.text(`TVA : ${roundMoney(input.quote.montant_ttc - input.quote.montant_ht).toLocaleString("fr-FR")} EUR`, 132, y);
  y += 7;
  pdf.text(`Total TTC : ${roundMoney(input.quote.montant_ttc).toLocaleString("fr-FR")} EUR`, 132, y);
  y += 12;
  pdf.setFont("helvetica", "normal");
  pdf.text(`Acompte demande : ${input.quote.acompte_percent ?? 30}%`, 14, y);
  y += 6;
  pdf.text("Bon pour accord, date et signature :", 14, y);
  pdf.save(`${input.quote.quote_number}.pdf`);
}

function entityName(row: Pick<CrmProspectRow | CrmClientRow, "prenom" | "nom" | "societe" | "email" | "adresse" | "code_postal" | "ville"> | null | undefined) {
  if (!row) return "";
  return [row.prenom, row.nom].filter(Boolean).join(" ") || row.societe || row.email || "";
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
  const engine = await loadCrmQuoteEngineData(quote.id).catch(() => ({
    quote,
    sections: [],
    lots: [],
    items: [],
    components: [],
    resources: [],
    paymentTerms: [],
    taskTemplates: [],
  } as CrmQuoteEngineData));
  const laborBudget = roundMoney(
    engine.items.reduce((sum, row) => sum + Number(row.cost_labor_ht ?? 0) * Number(row.quantite ?? 1), 0),
  );
  const materialsBudget = roundMoney(
    engine.items.reduce((sum, row) => sum + Number(row.cost_materials_ht ?? 0) * Number(row.quantite ?? 1), 0),
  );
  const subcontractingBudget = roundMoney(
    engine.items.reduce((sum, row) => sum + Number(row.cost_subcontracting_ht ?? 0) * Number(row.quantite ?? 1), 0),
  );
  await updateChantier(chantier.id, {
    heures_prevues: engine.items.reduce((sum, row) => sum + Number(row.labor_hours ?? 0) * Number(row.quantite ?? 1), 0) || null,
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
    budget_labor_planned_ht: laborBudget || Math.round(Number(quote.montant_ht ?? 0) * 0.35 * 100) / 100,
    budget_materials_planned_ht: materialsBudget || Math.round(Number(quote.montant_ht ?? 0) * 0.35 * 100) / 100,
    budget_subcontracting_planned_ht: subcontractingBudget || Math.round(Number(quote.montant_ht ?? 0) * 0.15 * 100) / 100,
  } as any).catch(() => undefined);
  if (engine.items.length) {
    const chantierDevis = await createDevis({
      chantier_id: chantier.id,
      nom: quote.description ?? quote.quote_number,
      numero: quote.quote_number,
      titre: quote.description ?? quote.quote_number,
    }).catch(() => null);
    for (const item of engine.items) {
      const lot = engine.lots.find((row) => row.id === item.lot_id)?.title ?? item.lot ?? quote.lot ?? null;
      const devisLigne = chantierDevis
        ? await createDevisLigne({
            devis_id: chantierDevis.id,
            ordre: item.ordre,
            corps_etat: lot,
            designation: item.designation,
            unite: item.unite,
            quantite: item.quantite,
            prix_unitaire_ht: item.sale_unit_price_ht ?? item.prix_unitaire_ht,
            tva_rate: item.tva_rate,
            generer_tache: item.generate_task,
            titre_tache: item.designation,
          }).catch(() => null)
        : null;
      if (item.generate_task) {
        await createTask({
          chantier_id: chantier.id,
          titre: item.designation,
          titre_terrain: item.designation,
          libelle_devis_original: item.description ?? item.designation,
          devis_ligne_id: devisLigne?.id ?? null,
          task_template_id: item.task_template_id,
          task_template_label: item.designation,
          corps_etat: lot,
          lot,
          description_technique: item.technical_description,
          prix_unitaire_devis_ht: item.sale_unit_price_ht ?? item.prix_unitaire_ht,
          montant_total_devis_ht: item.sale_total_ht ?? item.total_ht,
          tva_taux_devis: item.tva_rate,
          cout_estime_ht:
            (Number(item.cost_materials_ht ?? 0) + Number(item.cost_labor_ht ?? 0) + Number(item.cost_subcontracting_ht ?? 0) + Number(item.cost_fees_ht ?? 0)) *
            Number(item.quantite ?? 1),
          cout_matiere_estime_ht: Number(item.cost_materials_ht ?? 0) * Number(item.quantite ?? 1),
          cout_mo_estime_ht: Number(item.cost_labor_ht ?? 0) * Number(item.quantite ?? 1),
          quantite: item.quantite,
          unite: item.unite,
          temps_prevu_h: Number(item.labor_hours ?? 0) * Number(item.quantite ?? 1),
        }).catch(() => undefined);
      }
    }
  }
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
