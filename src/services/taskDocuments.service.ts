import { supabase } from "../lib/supabaseClient";

export type TaskDocumentLinkRow = {
  id: string;
  task_id: string;
  document_id: string;
  created_at: string;
};

export type DocumentPermissionRow = {
  document_id: string;
  intervenant_id: string;
};

function isMissingTableError(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    (msg.includes("relation") && msg.includes("document_permissions"))
  );
}

export async function listTaskDocuments(taskId: string): Promise<string[]> {
  if (!taskId) throw new Error("taskId manquant.");
  const { data, error } = await supabase
    .from("task_documents")
    .select("document_id")
    .eq("task_id", taskId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => String(row.document_id));
}

export async function listTaskDocumentsByTaskIds(taskIds: string[]): Promise<TaskDocumentLinkRow[]> {
  const ids = (taskIds ?? []).filter((id) => Boolean(id));
  if (ids.length === 0) return [] as TaskDocumentLinkRow[];

  const { data, error } = await supabase
    .from("task_documents")
    .select("id, task_id, document_id, created_at")
    .in("task_id", ids);

  if (error) throw new Error(error.message);
  return (data ?? []) as TaskDocumentLinkRow[];
}

export async function setTaskDocuments(taskId: string, documentIds: string[]): Promise<void> {
  if (!taskId) throw new Error("taskId manquant.");

  const existing = await listTaskDocuments(taskId);
  const next = Array.from(new Set((documentIds ?? []).filter((id) => Boolean(id))));

  const toAdd = next.filter((id) => !existing.includes(id));
  const toRemove = existing.filter((id) => !next.includes(id));

  if (toAdd.length > 0) {
    const payload = toAdd.map((document_id) => ({ task_id: taskId, document_id }));
    const { error } = await supabase.from("task_documents").insert(payload);
    if (error) throw new Error(error.message);
  }

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("task_documents")
      .delete()
      .eq("task_id", taskId)
      .in("document_id", toRemove);
    if (error) throw new Error(error.message);
  }
}

export async function listDocumentPermissionsByDocumentIds(
  chantierId: string,
  documentIds: string[],
): Promise<DocumentPermissionRow[]> {
  const ids = Array.from(new Set((documentIds ?? []).filter(Boolean)));
  if (!chantierId || ids.length === 0) return [];

  const primary = await (supabase as any)
    .from("document_permissions")
    .select("document_id, intervenant_id")
    .eq("chantier_id", chantierId)
    .in("document_id", ids);

  if (!primary.error) {
    return (primary.data ?? []) as DocumentPermissionRow[];
  }

  if (!isMissingTableError(primary.error)) {
    throw new Error(primary.error.message);
  }

  const fallback = await supabase
    .from("document_access")
    .select("document_id, intervenant_id")
    .in("document_id", ids);

  if (fallback.error) throw new Error(fallback.error.message);
  return (fallback.data ?? []) as DocumentPermissionRow[];
}

export async function adminSetTaskDocumentPermissions(input: {
  taskId: string;
  documentIds: string[];
  intervenantIds: string[];
}): Promise<void> {
  const taskId = String(input.taskId ?? "").trim();
  if (!taskId) throw new Error("taskId manquant.");

  const documentIds = Array.from(new Set((input.documentIds ?? []).filter(Boolean)));
  const intervenantIds = Array.from(new Set((input.intervenantIds ?? []).filter(Boolean)));

  const { error } = await (supabase as any).rpc("admin_set_task_document_permissions", {
    p_task_id: taskId,
    p_document_ids: documentIds,
    p_intervenant_ids: intervenantIds,
  });

  if (error) throw new Error(error.message);
}


