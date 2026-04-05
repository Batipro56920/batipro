import { supabase } from "../lib/supabaseClient";

export type ChantierTaskZoneLinkRow = {
  task_id: string;
  zone_id: string;
  created_at: string | null;
};

function isMissingTaskZonesTableError(error: { message?: string } | null): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("chantier_task_zones") &&
    (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("relation"))
  );
}

function uniqueIds(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

export async function listTaskZoneIdsByTaskIds(taskIds: string[]): Promise<Record<string, string[]>> {
  const ids = uniqueIds(taskIds);
  if (!ids.length) return {};

  const { data, error } = await supabase
    .from("chantier_task_zones")
    .select("task_id, zone_id, created_at")
    .in("task_id", ids)
    .order("created_at", { ascending: true })
    .overrideTypes<ChantierTaskZoneLinkRow[]>();

  if (error) {
    if (isMissingTaskZonesTableError(error)) return {};
    throw error;
  }

  const grouped: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const taskId = String(row.task_id ?? "").trim();
    const zoneId = String(row.zone_id ?? "").trim();
    if (!taskId || !zoneId) continue;
    if (!grouped[taskId]) grouped[taskId] = [];
    if (!grouped[taskId].includes(zoneId)) grouped[taskId].push(zoneId);
  }

  return grouped;
}

export async function replaceTaskZoneIds(taskId: string, zoneIds: string[]): Promise<string[]> {
  const nextIds = uniqueIds(zoneIds);
  if (!taskId) throw new Error("taskId manquant.");

  const { data, error } = await supabase
    .from("chantier_task_zones")
    .select("zone_id")
    .eq("task_id", taskId)
    .overrideTypes<Array<Pick<ChantierTaskZoneLinkRow, "zone_id">>>();

  if (error) {
    if (!isMissingTaskZonesTableError(error)) throw error;
    return nextIds;
  }

  const currentIds = uniqueIds((data ?? []).map((row) => String(row.zone_id ?? "")));
  const toAdd = nextIds.filter((id) => !currentIds.includes(id));
  const toRemove = currentIds.filter((id) => !nextIds.includes(id));

  if (toRemove.length > 0) {
    const removeRes = await supabase
      .from("chantier_task_zones")
      .delete()
      .eq("task_id", taskId)
      .in("zone_id", toRemove);
    if (removeRes.error) throw removeRes.error;
  }

  if (toAdd.length > 0) {
    const insertRes = await (supabase as any)
      .from("chantier_task_zones")
      .insert(toAdd.map((zone_id) => ({ task_id: taskId, zone_id })));
    if (insertRes.error) throw insertRes.error;
  }

  return nextIds;
}
