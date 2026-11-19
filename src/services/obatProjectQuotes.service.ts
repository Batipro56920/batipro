import { supabase } from "../lib/supabaseClient";
import { getCurrentOrganizationId } from "./currentUserProfile.service";
import { createCrmDocument, createCrmQuote, deleteCrmQuote, type CrmQuoteRow, type CrmQuoteStatus } from "./crm.service";
import type { ProjectRecord } from "../features/projects/types";

const BUCKET = "crm-quote-pdfs";
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;

/** An imported Obat quote is a reference, never an editable Batipro quote. */
export function isExternalObatQuote(quote: Pick<CrmQuoteRow, "display_options">): boolean {
  return quote.display_options?.external_source === "obat";
}

export function externalQuoteStoragePath(quote: Pick<CrmQuoteRow, "display_options">): string | null {
  if (!isExternalObatQuote(quote)) return null;
  const path = quote.display_options?.external_pdf_path;
  return typeof path === "string" && /^[0-9a-f-]{36}\/obat\//i.test(path) ? path : null;
}

export type ObatImportInput = {
  project: ProjectRecord;
  file: File;
  quoteNumber: string;
  description: string;
  dateIssued: string;
  amountHt: number;
  amountTtc: number;
  status: Extract<CrmQuoteStatus, "brouillon" | "envoye" | "accepte" | "refuse">;
};

export function validateObatImport(input: Omit<ObatImportInput, "project">): void {
  if (!input.quoteNumber.trim()) throw new Error("Indiquez le numéro du devis Obat.");
  if (!input.file || input.file.size === 0 || input.file.size > MAX_PDF_SIZE_BYTES) {
    throw new Error("Sélectionnez un PDF de 20 Mo maximum.");
  }
  if (!input.file.name.toLowerCase().endsWith(".pdf") && input.file.type !== "application/pdf") {
    throw new Error("Le fichier doit être un PDF.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateIssued)) throw new Error("La date du devis est invalide.");
  if (!Number.isFinite(input.amountHt) || input.amountHt < 0 ||
      !Number.isFinite(input.amountTtc) || input.amountTtc < input.amountHt) {
    throw new Error("Les montants HT/TTC sont invalides.");
  }
}

/**
 * Creates an ordinary CRM reference linked to the existing project, then a
 * private PDF attachment in the existing devis-pdf bucket.
 * No quote lines, invoices, chantier, tasks or fake Batipro PDF are generated.
 */
export async function importObatQuoteToProject(input: ObatImportInput): Promise<CrmQuoteRow> {
  validateObatImport(input);
  const { project, file, quoteNumber, description, dateIssued, amountHt, amountTtc, status } = input;
  // Check file content as well as its extension: never register an arbitrary upload as a PDF.
  const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (signature !== "%PDF-") throw new Error("Ce fichier ne semble pas être un PDF valide.");
  const organizationId = await getCurrentOrganizationId();
  const path = `${organizationId}/obat/${project.sourceType}/${project.sourceId}/${crypto.randomUUID()}.pdf`;
  let quoteId: string | null = null;
  let uploaded = false;
  try {
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploadError) throw uploadError;
    uploaded = true;

    const tva = amountHt > 0 ? Math.round(((amountTtc / amountHt) - 1) * 10000) / 100 : 0;
    const quote = await createCrmQuote({
      quote_number: quoteNumber.trim(),
      prospect_id: project.prospect?.id ?? null,
      client_id: project.client?.id ?? null,
      opportunity_id: project.opportunity?.id ?? null,
      description: description.trim() || `Devis Obat ${quoteNumber.trim()}`,
      montant_ht: amountHt,
      montant_ttc: amountTtc,
      tva,
      statut: status,
      date_emission: dateIssued,
      signature_status: status === "accepte" ? "signe" : "attente_signature",
      accepted_at: status === "accepte" ? new Date().toISOString() : null,
      display_options: {
        project_id: project.id,
        external_source: "obat",
        external_quote_number: quoteNumber.trim(),
        external_pdf_path: path,
      },
    });
    quoteId = quote.id;
    await createCrmDocument({
      quote_id: quote.id,
      opportunity_id: project.opportunity?.id ?? null,
      prospect_id: project.prospect?.id ?? null,
      client_id: project.client?.id ?? null,
      type: "devis",
      nom: `Devis Obat ${quoteNumber.trim()} (PDF)`,
      storage_path: path,
      mime_type: "application/pdf",
      notes: "Document original issu d'Obat. Consultation uniquement dans Batipro.",
    });
    return quote;
  } catch (error) {
    // Undo our own partial writes; do not leave a phantom quote in the CRM.
    const cleanupErrors: string[] = [];
    if (quoteId) {
      try { await deleteCrmQuote(quoteId); } catch (e) { cleanupErrors.push(String(e)); }
    }
    if (uploaded) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([path]);
      if (storageError) cleanupErrors.push(storageError.message);
    }
    if (cleanupErrors.length) {
      throw new Error(`Import interrompu : ${String(error)}. Nettoyage incomplet : ${cleanupErrors.join("; ")}`);
    }
    throw error;
  }
}

export async function openExternalQuotePdf(quote: Pick<CrmQuoteRow, "display_options">): Promise<string> {
  const path = externalQuoteStoragePath(quote);
  if (!path) throw new Error("Aucun PDF Obat n'est rattaché à ce devis.");
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Impossible de générer le lien sécurisé du PDF.");
  return data.signedUrl;
}
