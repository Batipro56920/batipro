import { supabase } from "../lib/supabaseClient";

export type TaskDocumentLinkRow = {
  id: string;
  task_id: string;
  document_id: string;
  created_at: string;
};

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


