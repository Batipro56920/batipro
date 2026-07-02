import { createPortalClient } from "./portalSupabaseClient";
import { supabase } from "../lib/supabaseClient";

export type ApporteurType =
  | "agent_immobilier"
  | "artisan"
  | "architecte"
  | "client"
  | "partenaire"
  | "reseau"
  | "autre";

export type ApporteurCalculationMode = "sur_estime" | "sur_signe" | "fixe";
export type ApporteurLeadStatus =
  | "nouveau"
  | "contacte"
  | "devis_envoye"
  | "signe"
  | "perdu"
  | "commission_a_payer"
  | "paye";

export type ApporteurAffaireRow = {
  id: string;
  organization_id: string;
  nom: string;
  entreprise: string | null;
  type: ApporteurType;
  telephone: string | null;
  email: string | null;
  commission_percent: number;
  calculation_mode: ApporteurCalculationMode;
  iban: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ApporteurLeadRow = {
  id: string;
  organization_id: string;
  apporteur_id: string | null;
  crm_prospect_id?: string | null;
  crm_opportunity_id?: string | null;
  client_name: string;
  telephone: string | null;
  project_address: string | null;
  project_type: string | null;
  estimated_amount: number;
  comment: string | null;
  date: string;
  status: ApporteurLeadStatus;
  commission_paid: boolean;
  created_at: string;
  updated_at: string;
};

export type ApporteurDocumentRow = {
  id: string;
  organization_id: string;
  apporteur_id: string;
  label: string;
  file_path: string;
  created_at: string;
};

export type ApporteurAccessTokenRow = {
  id: string;
  organization_id: string;
  apporteur_id: string;
  token: string;
  expires_at: string | null;
  revoked_at: string | null;
  used_at: string | null;
  created_at: string;
};

export type ApporteurPortalTokenResult = {
  ok: boolean;
  jwt: string;
  apporteur_id: string;
  organization_id: string;
};

type LeadCrmLinkInput = Partial<Pick<ApporteurLeadRow, "crm_prospect_id" | "crm_opportunity_id">>;

type SupabaseColumnError = { code?: string | null; message?: string | null };

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user?.id) throw new Error("Utilisateur non authentifié.");
  return data.user.id;
}

async function getOrganizationId(): Promise<string> {
  return await getCurrentUserId();
}

function normalizePositiveOrZeroNumber(value: number, fieldLabel: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldLabel} invalide.`);
  }
  return value;
}

function normalizeOptionalText(value: string | null | undefined) {
  if (value === undefined) return undefined;
  return value?.trim() || null;
}

function appendCrmReferenceToComment(comment: string | null | undefined, input: LeadCrmLinkInput) {
  const crmProspectId = normalizeOptionalText(input.crm_prospect_id) ?? null;
  const crmOpportunityId = normalizeOptionalText(input.crm_opportunity_id) ?? null;
  if (!crmProspectId && !crmOpportunityId) return comment;

  const currentComment = normalizeOptionalText(comment) ?? "";
  const crmReference = [
    crmProspectId ? `prospect ${crmProspectId}` : null,
    crmOpportunityId ? `projet ${crmOpportunityId}` : null,
  ].filter(Boolean).join(" / ");
  const referenceLine = `Référence CRM : ${crmReference}`;
  const withoutPreviousReference = currentComment
    .split("\n")
    .filter((line) => !line.trim().startsWith("Référence CRM :"))
    .join("\n")
    .trim();

  return [withoutPreviousReference, referenceLine].filter(Boolean).join("\n");
}

function normalizeDuplicateKey(value: string | null | undefined) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeDuplicatePhone(value: string | null | undefined) {
  const compact = normalizeDuplicateKey(value).replace(/[^\d+]/g, "");
  if (compact.startsWith("+33")) return `0${compact.slice(3)}`;
  if (compact.startsWith("0033")) return `0${compact.slice(4)}`;
  return compact;
}

async function assertCrmProjectNotAlreadyAttached(
  organization_id: string,
  input: LeadCrmLinkInput,
  currentLeadId?: string,
): Promise<void> {
  const crmProspectId = normalizeOptionalText(input.crm_prospect_id) ?? null;
  const crmOpportunityId = normalizeOptionalText(input.crm_opportunity_id) ?? null;
  if (!crmProspectId && !crmOpportunityId) return;

  const filters = [
    crmOpportunityId ? `crm_opportunity_id.eq.${crmOpportunityId}` : null,
    crmProspectId ? `crm_prospect_id.eq.${crmProspectId}` : null,
  ].filter(Boolean) as string[];
  const crmLinkPayload: LeadCrmLinkInput = {
    crm_prospect_id: crmProspectId,
    crm_opportunity_id: crmOpportunityId,
  };

  const response = await supabase
    .from("apporteur_leads")
    .select("id")
    .eq("organization_id", organization_id)
    .or(filters.join(","))
    .limit(5);

  if (response.error) {
    if (hasMissingApporteurLeadColumn(response.error, crmLinkPayload)) return;
    throw new Error(response.error.message);
  }

  const duplicate = ((response.data ?? []) as Array<{ id: string }>).find((lead) => lead.id !== currentLeadId);
  if (duplicate) {
    throw new Error("Ce projet CRM est déjà rattaché à un apporteur.");
  }
}

async function assertActiveApporteurPortal(portalClient: ReturnType<typeof createPortalClient>, apporteurId: string, organizationId: string): Promise<void> {
  const { data, error } = await portalClient
    .from("apporteurs_affaires")
    .select("id, active")
    .eq("id", apporteurId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!(data as Pick<ApporteurAffaireRow, "active"> | null)?.active) {
    throw new Error("Ce portail apporteur est désactivé.");
  }
}

export async function getApporteursAffaires(): Promise<ApporteurAffaireRow[]> {
  const organization_id = await getOrganizationId();
  const response = await supabase
    .from("apporteurs_affaires")
    .select("*")
    .eq("organization_id", organization_id)
    .order("nom", { ascending: true });

  if (response.error) throw new Error(response.error.message);
  return (response.data as ApporteurAffaireRow[]) ?? [];
}

export async function getApporteurLeads(): Promise<ApporteurLeadRow[]> {
  const organization_id = await getOrganizationId();
  const response = await supabase
    .from("apporteur_leads")
    .select("*")
    .eq("organization_id", organization_id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (response.error) throw new Error(response.error.message);
  return (response.data as ApporteurLeadRow[]) ?? [];
}

export async function getApporteurDocuments(): Promise<ApporteurDocumentRow[]> {
  const organization_id = await getOrganizationId();
  const response = await supabase
    .from("apporteur_documents")
    .select("*")
    .eq("organization_id", organization_id)
    .order("created_at", { ascending: false });

  if (response.error) throw new Error(response.error.message);
  return (response.data as ApporteurDocumentRow[]) ?? [];
}

export async function getApporteurAccessTokens(): Promise<ApporteurAccessTokenRow[]> {
  const organization_id = await getOrganizationId();
  const response = await supabase
    .from("apporteur_access")
    .select("*")
    .eq("organization_id", organization_id)
    .order("created_at", { ascending: false });

  if (response.error) throw new Error(response.error.message);
  return (response.data as ApporteurAccessTokenRow[]) ?? [];
}

export async function createApporteurAffaire(input: {
  nom: string;
  entreprise?: string | null;
  type: ApporteurType;
  telephone?: string | null;
  email?: string | null;
  commission_percent: number;
  calculation_mode: ApporteurCalculationMode;
  iban?: string | null;
  active: boolean;
  notes?: string | null;
}): Promise<ApporteurAffaireRow> {
  const organization_id = await getOrganizationId();
  const payload = {
    organization_id,
    nom: input.nom.trim(),
    entreprise: input.entreprise?.trim() || null,
    type: input.type,
    telephone: input.telephone?.trim() || null,
    email: input.email?.trim() || null,
    commission_percent: normalizePositiveOrZeroNumber(input.commission_percent, "Commission apporteur"),
    calculation_mode: input.calculation_mode,
    iban: input.iban?.trim() || null,
    active: input.active,
    notes: input.notes?.trim() || null,
  };

  const response = await supabase
    .from("apporteurs_affaires")
    .insert(payload)
    .select("*")
    .single();

  if (response.error) throw new Error(response.error.message);
  return response.data as ApporteurAffaireRow;
}

export async function updateApporteurAffaire(
  id: string,
  input: Partial<{
    nom: string;
    entreprise: string | null;
    type: ApporteurType;
    telephone: string | null;
    email: string | null;
    commission_percent: number;
    calculation_mode: ApporteurCalculationMode;
    iban: string | null;
    active: boolean;
    notes: string | null;
  }>,
): Promise<ApporteurAffaireRow> {
  const organization_id = await getOrganizationId();
  const payload = {
    ...input,
    nom: input.nom?.trim(),
    entreprise: normalizeOptionalText(input.entreprise),
    telephone: normalizeOptionalText(input.telephone),
    email: normalizeOptionalText(input.email),
    iban: normalizeOptionalText(input.iban),
    notes: normalizeOptionalText(input.notes),
    commission_percent:
      input.commission_percent === undefined
        ? undefined
        : normalizePositiveOrZeroNumber(input.commission_percent, "Commission apporteur"),
  };

  const response = await supabase
    .from("apporteurs_affaires")
    .update(payload)
    .eq("id", id)
    .eq("organization_id", organization_id)
    .select("*")
    .single();

  if (response.error) throw new Error(response.error.message);
  return response.data as ApporteurAffaireRow;
}

export async function deleteApporteurAffaire(id: string): Promise<void> {
  const organization_id = await getOrganizationId();
  const { error } = await supabase
    .from("apporteurs_affaires")
    .delete()
    .eq("id", id)
    .eq("organization_id", organization_id);
  if (error) throw new Error(error.message);
}

export async function createApporteurLead(input: {
  apporteur_id: string;
  client_name: string;
  telephone?: string | null;
  project_address?: string | null;
  project_type?: string | null;
  estimated_amount: number;
  comment?: string | null;
  date: string;
  status: ApporteurLeadStatus;
  crm_prospect_id?: string | null;
  crm_opportunity_id?: string | null;
}): Promise<ApporteurLeadRow> {
  const organization_id = await getOrganizationId();
  const payload = {
    organization_id,
    apporteur_id: input.apporteur_id,
    client_name: input.client_name.trim(),
    telephone: input.telephone?.trim() || null,
    project_address: input.project_address?.trim() || null,
    project_type: input.project_type?.trim() || null,
    estimated_amount: normalizePositiveOrZeroNumber(input.estimated_amount, "Montant estimé"),
    comment: input.comment?.trim() || null,
    date: input.date,
    status: input.status,
    commission_paid: input.status === "paye",
    crm_prospect_id: input.crm_prospect_id ?? null,
    crm_opportunity_id: input.crm_opportunity_id ?? null,
  };

  await assertCrmProjectNotAlreadyAttached(organization_id, payload);

  const response = await supabase
    .from("apporteur_leads")
    .insert(payload as any)
    .select("*")
    .single();

  if (response.error && hasMissingApporteurLeadColumn(response.error, payload)) {
    const fallbackPayload = stripCrmLinkColumns(payload);
    const fallback = await supabase
      .from("apporteur_leads")
      .insert(fallbackPayload as any)
      .select("*")
      .single();
    if (fallback.error) throw new Error(fallback.error.message);
    return fallback.data as ApporteurLeadRow;
  }

  if (response.error) throw new Error(response.error.message);
  return response.data as ApporteurLeadRow;
}

export async function updateApporteurLead(
  id: string,
  input: Partial<{
    client_name: string;
    telephone: string | null;
    project_address: string | null;
    project_type: string | null;
    estimated_amount: number;
    comment: string | null;
    date: string;
    status: ApporteurLeadStatus;
    commission_paid: boolean;
    apporteur_id: string;
    crm_prospect_id: string | null;
    crm_opportunity_id: string | null;
  }>,
): Promise<ApporteurLeadRow> {
  const organization_id = await getOrganizationId();
  const payload = {
    ...input,
    client_name: input.client_name?.trim(),
    telephone: normalizeOptionalText(input.telephone),
    project_address: normalizeOptionalText(input.project_address),
    project_type: normalizeOptionalText(input.project_type),
    comment: normalizeOptionalText(input.comment),
    estimated_amount:
      input.estimated_amount === undefined
        ? undefined
        : normalizePositiveOrZeroNumber(input.estimated_amount, "Montant estimé"),
    commission_paid: input.status === undefined ? input.commission_paid : input.status === "paye",
  };

  await assertCrmProjectNotAlreadyAttached(organization_id, payload, id);

  const response = await supabase
    .from("apporteur_leads")
    .update(payload as any)
    .eq("id", id)
    .eq("organization_id", organization_id)
    .select("*")
    .single();

  if (response.error && hasMissingApporteurLeadColumn(response.error, payload)) {
    const fallbackPayload = stripCrmLinkColumns(payload);
    const fallback = await supabase
      .from("apporteur_leads")
      .update(fallbackPayload as any)
      .eq("id", id)
      .eq("organization_id", organization_id)
      .select("*")
      .single();
    if (fallback.error) throw new Error(fallback.error.message);
    return fallback.data as ApporteurLeadRow;
  }

  if (response.error) throw new Error(response.error.message);
  return response.data as ApporteurLeadRow;
}

function hasMissingApporteurLeadColumn(error: SupabaseColumnError | null | undefined, payload: LeadCrmLinkInput) {
  return (["crm_prospect_id", "crm_opportunity_id"] as const).some(
    (column) => payload[column] !== undefined && isMissingColumn(error, column),
  );
}

function stripCrmLinkColumns<T extends LeadCrmLinkInput & { comment?: string | null }>(payload: T) {
  const fallbackPayload = {
    ...payload,
    comment: appendCrmReferenceToComment(payload.comment, payload),
  };
  delete fallbackPayload.crm_prospect_id;
  delete fallbackPayload.crm_opportunity_id;
  return fallbackPayload;
}

function isMissingColumn(error: SupabaseColumnError | null | undefined, column: string) {
  const code = String(error?.code ?? "");
  const msg = String(error?.message ?? "").toLowerCase();
  return code === "42703" || (msg.includes(column.toLowerCase()) && (msg.includes("schema cache") || msg.includes("could not find") || msg.includes("column")));
}

export async function deleteApporteurLead(id: string): Promise<void> {
  const organization_id = await getOrganizationId();
  const { error } = await supabase
    .from("apporteur_leads")
    .delete()
    .eq("id", id)
    .eq("organization_id", organization_id);
  if (error) throw new Error(error.message);
}

export async function createApporteurAccessToken(apporteur_id: string): Promise<ApporteurAccessTokenRow> {
  const organization_id = await getOrganizationId();
  const token = crypto.randomUUID().replace(/-/g, "");
  const response = await supabase
    .from("apporteur_access")
    .insert({
      organization_id,
      apporteur_id,
      token,
      expires_at: null,
      revoked_at: null,
      used_at: null,
    })
    .select("*")
    .single();
  if (response.error) throw new Error(response.error.message);
  return response.data as ApporteurAccessTokenRow;
}

export async function checkApporteurToken(token: string): Promise<ApporteurPortalTokenResult> {
  const { data, error } = await supabase.functions.invoke("apporteur-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, mark_used: false }),
  });

  if (error) throw new Error(error.message || "Erreur Edge Function.");
  if (!(data as any)?.ok) {
    throw new Error((data as any)?.error || "Accès refusé.");
  }

  return data as ApporteurPortalTokenResult;
}

export async function getApporteurPortalData(jwt: string, apporteurId: string) {
  const portalClient = createPortalClient(jwt);
  const [{ data: apporteur, error: apporteurError }, { data: leads, error: leadsError }, { data: documents, error: documentsError }] =
    await Promise.all([
      portalClient.from("apporteurs_affaires").select("*").eq("id", apporteurId).single(),
      portalClient
        .from("apporteur_leads")
        .select("*")
        .eq("apporteur_id", apporteurId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      portalClient.from("apporteur_documents").select("*").eq("apporteur_id", apporteurId).order("created_at", { ascending: false }),
    ]);

  if (apporteurError) throw new Error(apporteurError.message);
  if (leadsError) throw new Error(leadsError.message);
  if (documentsError) throw new Error(documentsError.message);
  if (!(apporteur as ApporteurAffaireRow | null)?.active) throw new Error("Ce portail apporteur est désactivé.");

  return {
    apporteur: (apporteur as ApporteurAffaireRow) ?? null,
    leads: (leads as ApporteurLeadRow[]) ?? [],
    documents: (documents as ApporteurDocumentRow[]) ?? [],
  };
}

export async function createApporteurLeadPortal(jwt: string, input: {
  apporteur_id: string;
  organization_id: string;
  client_name: string;
  telephone?: string | null;
  project_address?: string | null;
  project_type?: string | null;
  estimated_amount: number;
  comment?: string | null;
  date: string;
  status?: ApporteurLeadStatus;
}): Promise<ApporteurLeadRow> {
  const portalClient = createPortalClient(jwt);
  await assertActiveApporteurPortal(portalClient, input.apporteur_id, input.organization_id);

  const payload = {
    organization_id: input.organization_id,
    apporteur_id: input.apporteur_id,
    client_name: input.client_name.trim(),
    telephone: input.telephone?.trim() || null,
    project_address: input.project_address?.trim() || null,
    project_type: input.project_type?.trim() || null,
    estimated_amount: normalizePositiveOrZeroNumber(input.estimated_amount, "Montant estimé"),
    comment: input.comment?.trim() || null,
    date: input.date,
    status: "nouveau" as ApporteurLeadStatus,
    commission_paid: false,
  };

  const duplicateClientName = normalizeDuplicateKey(payload.client_name);
  const duplicatePhone = normalizeDuplicatePhone(payload.telephone);
  const { data: candidateLeads, error: duplicateError } = await portalClient
    .from("apporteur_leads")
    .select("id,telephone")
    .eq("apporteur_id", payload.apporteur_id)
    .ilike("client_name", duplicateClientName)
    .limit(20);

  if (duplicateError) throw new Error(duplicateError.message);

  const existingLead = ((candidateLeads ?? []) as Array<{ id: string; telephone: string | null }>).find(
    (lead) => normalizeDuplicatePhone(lead.telephone) === duplicatePhone,
  );
  if (existingLead) throw new Error("Ce client a déjà été transmis par ce portail apporteur.");

  const response = await portalClient
    .from("apporteur_leads")
    .insert(payload)
    .select("*")
    .single();

  if (response.error) throw new Error(response.error.message);
  return response.data as ApporteurLeadRow;
}
