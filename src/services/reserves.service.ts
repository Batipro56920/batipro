import { supabase } from "../lib/supabaseClient";

export type ReserveStatus = "OUVERTE" | "LEVEE" | "EN_COURS" | string;
export type ReservePriority = "BASSE" | "NORMALE" | "URGENTE" | string;

export type ChantierReserveRow = {
  id: string;
  chantier_id: string;
  task_id: string | null;
  title: string;
  description: string | null;
  status: ReserveStatus;
  priority: ReservePriority;
  intervenant_id: string | null;
  levee_at: string | null;
  created_at: string;
  updated_at: string;
};

function isMissingTableError(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    (msg.includes("relation") && msg.includes("chantier_reserves")) ||
    (msg.includes("schema cache") && msg.includes("chantier_reserves")) ||
    msg.includes("does not exist")
  );
}

function isMissingAssigneesTableError(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    (msg.includes("relation") && msg.includes("chantier_task_assignees")) ||
    (msg.includes("schema cache") && msg.includes("chantier_task_assignees")) ||
    msg.includes("does not exist")
  );
}

export async function getTaskAssignee(taskId: string): Promise<string | null> {
  if (!taskId) return null;
  const { data, error } = await supabase
    .from("chantier_task_assignees")
    .select("intervenant_id")
    .eq("task_id", taskId)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingAssigneesTableError(error)) return null;
    throw new Error(error.message);
  }

  return data?.intervenant_id ?? null;
}

export async function listReservesByChantierId(chantierId: string): Promise<ChantierReserveRow[]> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const { data, error } = await supabase
    .from("chantier_reserves")
    .select(
      [
        "id",
        "chantier_id",
        "task_id",
        "title",
        "description",
        "status",
        "priority",
        "intervenant_id",
        "levee_at",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? []) as ChantierReserveRow[];
}

export async function createReserve(input: {
  chantier_id: string;
  task_id?: string | null;
  title: string;
  description?: string | null;
  status?: ReserveStatus;
  priority?: ReservePriority;
  intervenant_id?: string | null;
}): Promise<ChantierReserveRow> {
  if (!input.chantier_id) throw new Error("chantier_id manquant.");
  if (!input.title) throw new Error("title manquant.");

  const payload = {
    chantier_id: input.chantier_id,
    task_id: input.task_id ?? null,
    title: input.title.trim(),
    description: input.description ?? null,
    status: input.status ?? "OUVERTE",
    priority: input.priority ?? "NORMALE",
    intervenant_id: input.intervenant_id ?? null,
  };

  const { data, error } = await supabase
    .from("chantier_reserves")
    .insert(payload)
    .select(
      [
        "id",
        "chantier_id",
        "task_id",
        "title",
        "description",
        "status",
        "priority",
        "intervenant_id",
        "levee_at",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .single();

  if (error) throw new Error(error.message);
  return data as ChantierReserveRow;
}

export async function updateReserve(
  id: string,
  patch: Partial<{
    task_id: string | null;
    title: string;
    description: string | null;
    status: ReserveStatus;
    priority: ReservePriority;
    intervenant_id: string | null;
    levee_at: string | null;
  }>,
): Promise<ChantierReserveRow> {
  if (!id) throw new Error("id manquant.");

  const payload: any = { ...patch, updated_at: new Date().toISOString() };
  if (payload.title !== undefined) payload.title = String(payload.title).trim();

  const { data, error } = await supabase
    .from("chantier_reserves")
    .update(payload)
    .eq("id", id)
    .select(
      [
        "id",
        "chantier_id",
        "task_id",
        "title",
        "description",
        "status",
        "priority",
        "intervenant_id",
        "levee_at",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .single();

  if (error) throw new Error(error.message);
  return data as ChantierReserveRow;
}

export async function setReserveStatus(id: string, status: ReserveStatus): Promise<ChantierReserveRow> {
  const patch: any = { status };
  if (status === "LEVEE") patch.levee_at = new Date().toISOString();
  return updateReserve(id, patch);
}
