import { supabase } from "../lib/supabaseClient";
import { edgeFunctionErrorMessage } from "../lib/edgeFunctionError";
import { AUTH_SESSION_PORTAL_TOKEN } from "../utils/intervenantSession";

/**
 * Portail sous-traitant : documents obligatoires, devis, factures et situations.
 *
 * Côté sous-traitant, tout passe par la fonction subcontractor-portal, qui
 * vérifie son identité comme le portail terrain. Côté bureau, les tables sont
 * lues directement (réservées au bureau par la base).
 */

export type SubcontractorDocumentKind = "urssaf_vigilance" | "kbis" | "decennale" | "rc_pro" | "autre";
export type SubcontractorDocumentStatus = "soumis" | "valide" | "refuse";
export type SubcontractorInvoiceKind = "devis" | "facture" | "situation";
export type SubcontractorInvoiceStatus = "soumis" | "accepte" | "refuse" | "paye";

export type SubcontractorDocument = {
  id: string;
  kind: SubcontractorDocumentKind;
  label: string | null;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  valid_until: string | null;
  status: SubcontractorDocumentStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  url: string | null;
};

export type SubcontractorInvoice = {
  id: string;
  chantier_id: string | null;
  kind: SubcontractorInvoiceKind;
  reference: string | null;
  amount_ht: number | null;
  issued_on: string | null;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: SubcontractorInvoiceStatus;
  review_note: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  url: string | null;
};

export type SubcontractorPortalData = {
  identity: { intervenant_id: string; nom: string | null; company: string | null; email: string | null };
  chantiers: Array<{ id: string; nom: string }>;
  documents: SubcontractorDocument[];
  invoices: SubcontractorInvoice[];
};

export const DOCUMENT_KINDS: Array<{ kind: SubcontractorDocumentKind; label: string; hint: string; required: boolean }> = [
  {
    kind: "urssaf_vigilance",
    label: "Attestation de vigilance URSSAF",
    hint: "À renouveler tous les 6 mois.",
    required: true,
  },
  { kind: "kbis", label: "Extrait Kbis", hint: "De moins de 3 mois (ou carte d'artisan).", required: true },
  { kind: "decennale", label: "Assurance décennale", hint: "Attestation de l'année en cours.", required: true },
  { kind: "rc_pro", label: "Responsabilité civile professionnelle", hint: "Attestation de l'année en cours.", required: true },
  { kind: "autre", label: "Autre document", hint: "Qualification, certification, habilitation…", required: false },
];

export const INVOICE_KIND_LABELS: Record<SubcontractorInvoiceKind, string> = {
  devis: "Devis",
  facture: "Facture",
  situation: "Situation de travaux",
};

export const INVOICE_STATUS_LABELS: Record<SubcontractorInvoiceStatus, string> = {
  soumis: "En attente",
  accepte: "Acceptée",
  refuse: "Refusée",
  paye: "Payée",
};

/** L'attestation URSSAF ne vaut que six mois : c'est l'échéance légale de renouvellement. */
const URSSAF_VALIDITY_MONTHS = 6;
/** Seuil à partir duquel on prévient avant l'échéance. */
const EXPIRY_WARNING_DAYS = 30;

export type DocumentState = "manquant" | "a_valider" | "valide" | "expire_bientot" | "expire" | "refuse";

export type DocumentStatusSummary = {
  kind: SubcontractorDocumentKind;
  label: string;
  hint: string;
  required: boolean;
  state: DocumentState;
  /** Date retenue pour l'échéance : celle saisie, sinon celle déduite. */
  expiresOn: string | null;
  latest: SubcontractorDocument | null;
};

function addMonths(isoDate: string, months: number): string {
  const date = new Date(isoDate);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function daysUntil(isoDate: string): number {
  const target = new Date(`${isoDate}T23:59:59`);
  return Math.floor((target.getTime() - Date.now()) / 86_400_000);
}

/** Échéance d'un document : la date saisie, sinon six mois pour l'URSSAF. */
export function documentExpiry(document: SubcontractorDocument): string | null {
  if (document.valid_until) return document.valid_until;
  if (document.kind === "urssaf_vigilance") return addMonths(document.created_at, URSSAF_VALIDITY_MONTHS);
  return null;
}

/**
 * État de chaque document attendu, à partir du plus récent déposé. Un document
 * refusé ne couvre rien ; un document expiré non plus, même validé.
 */
export function summarizeDocuments(documents: SubcontractorDocument[]): DocumentStatusSummary[] {
  return DOCUMENT_KINDS.filter((entry) => entry.kind !== "autre").map((entry) => {
    const latest = documents
      .filter((document) => document.kind === entry.kind)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
    const expiresOn = latest ? documentExpiry(latest) : null;
    let state: DocumentState = "manquant";
    if (latest) {
      if (latest.status === "refuse") state = "refuse";
      else if (expiresOn && daysUntil(expiresOn) < 0) state = "expire";
      else if (latest.status === "soumis") state = "a_valider";
      else if (expiresOn && daysUntil(expiresOn) <= EXPIRY_WARNING_DAYS) state = "expire_bientot";
      else state = "valide";
    }
    return { ...entry, state, expiresOn, latest };
  });
}

/** Documents qui demandent une action : manquants, refusés, expirés ou bientôt. */
export function documentsNeedingAttention(summary: DocumentStatusSummary[]): DocumentStatusSummary[] {
  return summary.filter((entry) => entry.required && ["manquant", "refuse", "expire", "expire_bientot"].includes(entry.state));
}

// --------------------------------------------------------------- portail

function portalToken(token: string | null | undefined): string {
  const trimmed = String(token ?? "").trim();
  return !trimmed || trimmed === AUTH_SESSION_PORTAL_TOKEN ? "" : trimmed;
}

function asPortalData(data: unknown): SubcontractorPortalData {
  const raw = (data ?? {}) as Partial<SubcontractorPortalData> & { error?: string };
  if (raw.error) throw new Error(raw.error);
  return {
    identity: raw.identity ?? { intervenant_id: "", nom: null, company: null, email: null },
    chantiers: Array.isArray(raw.chantiers) ? raw.chantiers : [],
    documents: Array.isArray(raw.documents) ? raw.documents : [],
    invoices: Array.isArray(raw.invoices) ? raw.invoices.map((row) => ({ ...row, amount_ht: row.amount_ht === null ? null : Number(row.amount_ht) })) : [],
  };
}

async function invokePortal(body: FormData | Record<string, unknown>, fallback: string): Promise<SubcontractorPortalData> {
  const { data, error } = await supabase.functions.invoke("subcontractor-portal", { body });
  if (error) throw new Error(await edgeFunctionErrorMessage(error, fallback));
  return asPortalData(data);
}

export function subcontractorPortalLoad(token: string): Promise<SubcontractorPortalData> {
  return invokePortal({ action: "list", token: portalToken(token) }, "Espace sous-traitant indisponible.");
}

export function subcontractorUploadDocument(
  token: string,
  payload: { kind: SubcontractorDocumentKind; file: File; validUntil?: string | null; label?: string | null },
): Promise<SubcontractorPortalData> {
  const form = new FormData();
  form.set("action", "upload_document");
  form.set("token", portalToken(token));
  form.set("kind", payload.kind);
  if (payload.validUntil) form.set("valid_until", payload.validUntil);
  if (payload.label) form.set("label", payload.label);
  form.set("file", payload.file);
  return invokePortal(form, "Dépôt du document impossible.");
}

export function subcontractorUploadInvoice(
  token: string,
  payload: {
    kind: SubcontractorInvoiceKind;
    file: File;
    chantierId?: string | null;
    reference?: string | null;
    amountHt?: string | null;
    issuedOn?: string | null;
  },
): Promise<SubcontractorPortalData> {
  const form = new FormData();
  form.set("action", "upload_invoice");
  form.set("token", portalToken(token));
  form.set("kind", payload.kind);
  if (payload.chantierId) form.set("chantier_id", payload.chantierId);
  if (payload.reference) form.set("reference", payload.reference);
  if (payload.amountHt) form.set("amount_ht", payload.amountHt);
  if (payload.issuedOn) form.set("issued_on", payload.issuedOn);
  form.set("file", payload.file);
  return invokePortal(form, "Dépôt de la pièce impossible.");
}

export function subcontractorDeletePiece(
  token: string,
  target: "document" | "invoice",
  id: string,
): Promise<SubcontractorPortalData> {
  return invokePortal({ action: "delete", token: portalToken(token), target, id }, "Suppression impossible.");
}

// --------------------------------------------------------------- bureau

const BUCKET = "subcontractor-files";

async function withSignedUrls<T extends { storage_path: string }>(rows: T[]): Promise<Array<Omit<T, "storage_path"> & { url: string | null }>> {
  return Promise.all(
    rows.map(async ({ storage_path, ...rest }) => {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(storage_path, 60 * 60);
      return { ...rest, url: data?.signedUrl ?? null };
    }),
  );
}

export async function listSubcontractorCompliance(intervenantId: string): Promise<{
  documents: SubcontractorDocument[];
  invoices: SubcontractorInvoice[];
}> {
  const db = supabase as any;
  const [documents, invoices] = await Promise.all([
    db
      .from("subcontractor_documents")
      .select("id, kind, label, file_name, mime_type, size_bytes, storage_path, valid_until, status, review_note, reviewed_at, created_at")
      .eq("intervenant_id", intervenantId)
      .order("created_at", { ascending: false }),
    db
      .from("subcontractor_invoices")
      .select("id, chantier_id, kind, reference, amount_ht, issued_on, file_name, mime_type, size_bytes, storage_path, status, review_note, reviewed_at, paid_at, created_at")
      .eq("intervenant_id", intervenantId)
      .order("created_at", { ascending: false }),
  ]);
  if (documents.error) throw new Error(documents.error.message);
  if (invoices.error) throw new Error(invoices.error.message);
  return {
    documents: (await withSignedUrls(documents.data ?? [])) as SubcontractorDocument[],
    invoices: ((await withSignedUrls(invoices.data ?? [])) as SubcontractorInvoice[]).map((row) => ({
      ...row,
      amount_ht: row.amount_ht === null ? null : Number(row.amount_ht),
    })),
  };
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function reviewSubcontractorDocument(
  id: string,
  patch: { status: SubcontractorDocumentStatus; reviewNote?: string | null; validUntil?: string | null },
): Promise<void> {
  const update: Record<string, unknown> = {
    status: patch.status,
    review_note: patch.reviewNote?.trim() || null,
    reviewed_at: new Date().toISOString(),
    reviewed_by: await currentUserId(),
    updated_at: new Date().toISOString(),
  };
  if (patch.validUntil !== undefined) update.valid_until = patch.validUntil || null;
  const { error } = await (supabase as any).from("subcontractor_documents").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reviewSubcontractorInvoice(
  id: string,
  patch: { status: SubcontractorInvoiceStatus; reviewNote?: string | null },
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await (supabase as any)
    .from("subcontractor_invoices")
    .update({
      status: patch.status,
      review_note: patch.reviewNote?.trim() || null,
      reviewed_at: now,
      reviewed_by: await currentUserId(),
      paid_at: patch.status === "paye" ? now : null,
      updated_at: now,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Le profil connecté au portail est-il un sous-traitant ? Sert à afficher
 * l'onglet Pro. Silencieux en cas d'échec : un ouvrier ne doit jamais voir
 * d'erreur pour un espace qui ne le concerne pas.
 */
export async function subcontractorPortalIsSubcontractor(token: string): Promise<boolean> {
  try {
    const { data, error } = await (supabase as any).rpc("subcontractor_portal_identity", { p_token: portalToken(token) || null });
    if (error) return false;
    const row = Array.isArray(data) ? data[0] : data;
    return String(row?.status ?? "") === "subcontractor";
  } catch {
    return false;
  }
}
