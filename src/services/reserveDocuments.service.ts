import { supabase } from "../lib/supabaseClient";

export type ReserveDocumentRole = "PHOTO" | "PIECE_JOINTE" | string;

export type ReserveDocumentLinkRow = {
  id: string;
  reserve_id: string;
  document_id: string;
  role: ReserveDocumentRole;
  created_at: string;
};

function isMissingTableError(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    (msg.includes("relation") && msg.includes("reserve_documents")) ||
    (msg.includes("schema cache") && msg.includes("reserve_documents")) ||
    msg.includes("does not exist")
  );
}

export async function listReserveDocuments(
  reserveId: string,
  role?: ReserveDocumentRole,
): Promise<ReserveDocumentLinkRow[]> {
  if (!reserveId) throw new Error("reserveId manquant.");

  let query = supabase
    .from("reserve_documents")
    .select("id, reserve_id, document_id, role, created_at")
    .eq("reserve_id", reserveId);

  if (role) query = query.eq("role", role);

  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as ReserveDocumentLinkRow[];
}

export async function addReserveDocument(input: {
  reserve_id: string;
  document_id: string;
  role?: ReserveDocumentRole;
}): Promise<ReserveDocumentLinkRow> {
  if (!input.reserve_id) throw new Error("reserve_id manquant.");
  if (!input.document_id) throw new Error("document_id manquant.");

  const payload = {
    reserve_id: input.reserve_id,
    document_id: input.document_id,
    role: input.role ?? "PHOTO",
  };

  const { data, error } = await supabase
    .from("reserve_documents")
    .insert(payload)
    .select("id, reserve_id, document_id, role, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as ReserveDocumentLinkRow;
}

export async function removeReserveDocument(input: {
  reserve_id: string;
  document_id: string;
  role?: ReserveDocumentRole;
}): Promise<void> {
  if (!input.reserve_id) throw new Error("reserve_id manquant.");
  if (!input.document_id) throw new Error("document_id manquant.");

  let query = supabase
    .from("reserve_documents")
    .delete()
    .eq("reserve_id", input.reserve_id)
    .eq("document_id", input.document_id);

  if (input.role) query = query.eq("role", input.role);

  const { error } = await query;
  if (error) throw new Error(error.message);
}



