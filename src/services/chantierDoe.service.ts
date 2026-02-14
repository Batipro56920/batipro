import { supabase } from "../lib/supabaseClient";

export type ChantierDoeItemRow = {
  id: string;
  chantier_id: string;
  document_id: string;
  sort_order: number;
  created_at: string;
};

function isMissingTableError(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    (msg.includes("relation") && msg.includes("chantier_doe_items")) ||
    (msg.includes("schema cache") && msg.includes("chantier_doe_items")) ||
    msg.includes("does not exist")
  );
}

function migrationErrorMessage() {
  return "Module DOE non déployé en base. Appliquez la migration Supabase la plus récente.";
}

export async function listDoeItemsByChantierId(chantierId: string): Promise<ChantierDoeItemRow[]> {
  if (!chantierId) throw new Error("chantierId manquant.");
  const { data, error } = await supabase
    .from("chantier_doe_items")
    .select("id, chantier_id, document_id, sort_order, created_at")
    .eq("chantier_id", chantierId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as ChantierDoeItemRow[];
}

export async function upsertDoeItem(input: {
  chantier_id: string;
  document_id: string;
  sort_order: number;
}): Promise<ChantierDoeItemRow> {
  if (!input.chantier_id) throw new Error("chantier_id manquant.");
  if (!input.document_id) throw new Error("document_id manquant.");
  const payload = {
    chantier_id: input.chantier_id,
    document_id: input.document_id,
    sort_order: input.sort_order,
  };
  const { data, error } = await supabase
    .from("chantier_doe_items")
    .upsert(payload, { onConflict: "chantier_id,document_id" })
    .select("id, chantier_id, document_id, sort_order, created_at")
    .single();
  if (error) {
    if (isMissingTableError(error)) throw new Error(migrationErrorMessage());
    throw new Error(error.message);
  }
  return data as ChantierDoeItemRow;
}

export async function removeDoeItem(chantierId: string, documentId: string): Promise<void> {
  if (!chantierId) throw new Error("chantierId manquant.");
  if (!documentId) throw new Error("documentId manquant.");
  const { error } = await supabase
    .from("chantier_doe_items")
    .delete()
    .eq("chantier_id", chantierId)
    .eq("document_id", documentId);
  if (error) {
    if (isMissingTableError(error)) throw new Error(migrationErrorMessage());
    throw new Error(error.message);
  }
}

export async function reorderDoeItems(chantierId: string, orderedDocumentIds: string[]): Promise<void> {
  if (!chantierId) throw new Error("chantierId manquant.");
  for (let i = 0; i < orderedDocumentIds.length; i += 1) {
    const documentId = orderedDocumentIds[i];
    const { error } = await supabase
      .from("chantier_doe_items")
      .update({ sort_order: i + 1 })
      .eq("chantier_id", chantierId)
      .eq("document_id", documentId);
    if (error) {
      if (isMissingTableError(error)) throw new Error(migrationErrorMessage());
      throw new Error(error.message);
    }
  }
}
