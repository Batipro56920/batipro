import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/supabase";

type TaskAssigneeRow = Database["public"]["Tables"]["chantier_task_assignees"]["Row"];

function isMissingAssigneesTableError(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    (msg.includes("relation") && msg.includes("chantier_task_assignees")) ||
    (msg.includes("schema cache") && msg.includes("chantier_task_assignees")) ||
    msg.includes("does not exist")
  );
}

function uniqueIds(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

export async function listTaskAssigneeIdsByTaskIds(taskIds: string[]): Promise<Record<string, string[]>> {
  const ids = uniqueIds(taskIds);
  if (!ids.length) return {};

  const { data, error } = await supabase
    .from("chantier_task_assignees")
    .select("task_id, intervenant_id, created_at")
    .in("task_id", ids)
    .order("created_at", { ascending: true })
    .overrideTypes<Array<Pick<TaskAssigneeRow, "task_id" | "intervenant_id" | "created_at">>>();

  if (error) {
    if (isMissingAssigneesTableError(error)) return {};
    throw error;
  }

  const grouped: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const taskId = String(row.task_id ?? "");
    const intervenantId = String(row.intervenant_id ?? "");
    if (!taskId || !intervenantId) continue;
    if (!grouped[taskId]) grouped[taskId] = [];
    if (!grouped[taskId].includes(intervenantId)) grouped[taskId].push(intervenantId);
  }

  return grouped;
}

export async function replaceTaskAssignees(taskId: string, intervenantIds: string[]): Promise<string[]> {
  const nextIds = uniqueIds(intervenantIds);
  if (!taskId) throw new Error("taskId manquant.");

  const { data, error } = await supabase
    .from("chantier_task_assignees")
    .select("intervenant_id")
    .eq("task_id", taskId)
    .overrideTypes<Array<Pick<TaskAssigneeRow, "intervenant_id">>>();

  if (error) {
    if (!isMissingAssigneesTableError(error)) throw error;
    return nextIds;
  }

  const currentIds = uniqueIds((data ?? []).map((row) => String(row.intervenant_id ?? "")));
  const toAdd = nextIds.filter((id) => !currentIds.includes(id));
  const toRemove = currentIds.filter((id) => !nextIds.includes(id));

  if (toRemove.length > 0) {
    const removeRes = await supabase
      .from("chantier_task_assignees")
      .delete()
      .eq("task_id", taskId)
      .in("intervenant_id", toRemove);
    if (removeRes.error) throw removeRes.error;
  }

  if (toAdd.length > 0) {
    const insertRes = await supabase
      .from("chantier_task_assignees")
      .insert(toAdd.map((intervenant_id) => ({ task_id: taskId, intervenant_id })));
    if (insertRes.error) throw insertRes.error;
  }

  return nextIds;
}
