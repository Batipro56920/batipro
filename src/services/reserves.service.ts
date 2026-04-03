import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/supabase";

export type ReserveStatus = "OUVERTE" | "LEVEE" | "EN_COURS" | string;
export type ReservePriority = "BASSE" | "NORMALE" | "URGENTE" | string;

export type ChantierReserveRow = Database["public"]["Tables"]["chantier_reserves"]["Row"] & {
  zone_id?: string | null;
  zone_nom?: string | null;
  intervenant_nom?: string | null;
};

type AssigneeRow = Database["public"]["Tables"]["chantier_task_assignees"]["Row"];

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

function isMissingReserveZoneColumnError(error: { message?: string; code?: string } | null): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  if (code === "42703" && msg.includes("zone_id")) return true;
  return (
    msg.includes("zone_id") &&
    msg.includes("chantier_reserves") &&
    (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find"))
  );
}

function isMissingZonesTableError(error: { message?: string } | null): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    (msg.includes("relation") && msg.includes("chantier_zones")) ||
    (msg.includes("schema cache") && msg.includes("chantier_zones")) ||
    (msg.includes("chantier_zones") && msg.includes("does not exist"))
  );
}

function asTextOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

async function enrichReserveRows(rows: ChantierReserveRow[]): Promise<ChantierReserveRow[]> {
  if (rows.length === 0) return rows;

  const zoneIds = Array.from(
    new Set(
      rows
        .map((row) => String((row as any).zone_id ?? "").trim())
        .filter(Boolean),
    ),
  );
  const intervenantIds = Array.from(
    new Set(
      rows
        .map((row) => String(row.intervenant_id ?? "").trim())
        .filter(Boolean),
    ),
  );

  const [zonesRes, intervenantsRes] = await Promise.all([
    zoneIds.length
      ? (supabase as any).from("chantier_zones").select("id, nom").in("id", zoneIds)
      : Promise.resolve({ data: [], error: null }),
    intervenantIds.length
      ? (supabase as any).from("intervenants").select("id, nom").in("id", intervenantIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (
    zonesRes.error &&
    !isMissingReserveZoneColumnError(zonesRes.error) &&
    !isMissingZonesTableError(zonesRes.error)
  ) {
    throw zonesRes.error;
  }
  if (intervenantsRes.error) {
    throw intervenantsRes.error;
  }

  const zoneNameById = new Map<string, string>();
  for (const row of ((zonesRes.data ?? []) as Array<Record<string, unknown>>)) {
    zoneNameById.set(String(row.id ?? ""), String(row.nom ?? ""));
  }

  const intervenantNameById = new Map<string, string>();
  for (const row of ((intervenantsRes.data ?? []) as Array<Record<string, unknown>>)) {
    intervenantNameById.set(String(row.id ?? ""), String(row.nom ?? ""));
  }

  return rows.map((row) => ({
    ...row,
    zone_nom: asTextOrNull((row as any).zone_nom) ?? ((row as any).zone_id ? zoneNameById.get(String((row as any).zone_id)) ?? null : null),
    intervenant_nom: asTextOrNull((row as any).intervenant_nom) ?? (row.intervenant_id ? intervenantNameById.get(String(row.intervenant_id)) ?? null : null),
  }));
}

export async function getTaskAssignee(taskId: string): Promise<string | null> {
  if (!taskId) return null;

  const { data, error } = await supabase
    .from("chantier_task_assignees")
    .select("intervenant_id")
    .eq("task_id", taskId)
    .limit(1)
    .maybeSingle()
    .overrideTypes<Pick<AssigneeRow, "intervenant_id">>();

  if (error) {
    if (isMissingAssigneesTableError(error)) return null;
    throw error;
  }

  return data?.intervenant_id ?? null;
}

export async function listReservesByChantierId(chantierId: string): Promise<ChantierReserveRow[]> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const { data, error } = await supabase
    .from("chantier_reserves")
    .select()
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false })
    .overrideTypes<ChantierReserveRow[]>();

  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }

  return enrichReserveRows((data ?? []) as ChantierReserveRow[]);
}

export async function createReserve(input: {
  chantier_id: string;
  task_id?: string | null;
  zone_id?: string | null;
  title: string;
  description?: string | null;
  status?: ReserveStatus;
  priority?: ReservePriority;
  intervenant_id?: string | null;
}): Promise<ChantierReserveRow> {
  if (!input.chantier_id) throw new Error("chantier_id manquant.");
  if (!input.title) throw new Error("title manquant.");

  const payload: Record<string, unknown> = {
    chantier_id: input.chantier_id,
    task_id: input.task_id ?? null,
    zone_id: input.zone_id ?? null,
    title: input.title.trim(),
    description: input.description ?? null,
    status: input.status ?? "OUVERTE",
    priority: input.priority ?? "NORMALE",
    intervenant_id: input.intervenant_id ?? null,
  };

  const first = await (supabase as any)
    .from("chantier_reserves")
    .insert(payload)
    .select()
    .maybeSingle();

  if (!first.error) {
    if (!first.data) throw new Error("No reserve returned");
    const [row] = await enrichReserveRows([first.data as ChantierReserveRow]);
    return row;
  }

  if (!isMissingReserveZoneColumnError(first.error)) throw first.error;

  const fallbackPayload = { ...payload };
  delete fallbackPayload.zone_id;
  const { data, error } = await (supabase as any)
    .from("chantier_reserves")
    .insert(fallbackPayload)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No reserve returned");
  const [row] = await enrichReserveRows([data as ChantierReserveRow]);
  return row;
}

export async function updateReserve(
  id: string,
  patch: Partial<{
    task_id: string | null;
    zone_id: string | null;
    title: string;
    description: string | null;
    status: ReserveStatus;
    priority: ReservePriority;
    intervenant_id: string | null;
    levee_at: string | null;
  }>,
): Promise<ChantierReserveRow> {
  if (!id) throw new Error("id manquant.");

  const payload: Record<string, unknown> & {
    task_id?: string | null;
    zone_id?: string | null;
    title?: string;
    description?: string | null;
    status?: ReserveStatus;
    priority?: ReservePriority;
    intervenant_id?: string | null;
    levee_at?: string | null;
    updated_at: string;
  } = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

  if (payload.title !== undefined) payload.title = String(payload.title).trim();

  const first = await (supabase as any)
    .from("chantier_reserves")
    .update(payload)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (!first.error) {
    if (!first.data) throw new Error("No reserve returned");
    const [row] = await enrichReserveRows([first.data as ChantierReserveRow]);
    return row;
  }

  if (!isMissingReserveZoneColumnError(first.error)) throw first.error;

  const fallbackPayload = { ...payload };
  delete fallbackPayload.zone_id;
  const { data, error } = await (supabase as any)
    .from("chantier_reserves")
    .update(fallbackPayload)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No reserve returned");
  const [row] = await enrichReserveRows([data as ChantierReserveRow]);
  return row;
}

export async function setReserveStatus(id: string, status: ReserveStatus): Promise<ChantierReserveRow> {
  const patch: { status: ReserveStatus; levee_at?: string } = { status };
  if (status === "LEVEE") patch.levee_at = new Date().toISOString();
  return updateReserve(id, patch);
}


