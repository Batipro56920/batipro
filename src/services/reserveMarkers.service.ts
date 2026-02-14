import { supabase } from "../lib/supabaseClient";

export type ReservePlanMarkerRow = {
  id: string;
  reserve_id: string;
  plan_document_id: string;
  page: number | null;
  x: number;
  y: number;
  label: string | null;
  created_at: string;
};

function isMissingTableError(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    (msg.includes("relation") && msg.includes("reserve_plan_markers")) ||
    (msg.includes("schema cache") && msg.includes("reserve_plan_markers")) ||
    msg.includes("does not exist")
  );
}

export async function listReserveMarkers(reserveId: string): Promise<ReservePlanMarkerRow[]> {
  if (!reserveId) throw new Error("reserveId manquant.");

  const { data, error } = await supabase
    .from("reserve_plan_markers")
    .select("id, reserve_id, plan_document_id, page, x, y, label, created_at")
    .eq("reserve_id", reserveId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as ReservePlanMarkerRow[];
}

export async function listReserveMarkersByPlan(planDocumentId: string): Promise<ReservePlanMarkerRow[]> {
  if (!planDocumentId) throw new Error("planDocumentId manquant.");

  const { data, error } = await supabase
    .from("reserve_plan_markers")
    .select("id, reserve_id, plan_document_id, page, x, y, label, created_at")
    .eq("plan_document_id", planDocumentId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as ReservePlanMarkerRow[];
}

export async function addReserveMarker(input: {
  reserve_id: string;
  plan_document_id: string;
  x: number;
  y: number;
  page?: number | null;
  label?: string | null;
}): Promise<ReservePlanMarkerRow> {
  if (!input.reserve_id) throw new Error("reserve_id manquant.");
  if (!input.plan_document_id) throw new Error("plan_document_id manquant.");

  const payload = {
    reserve_id: input.reserve_id,
    plan_document_id: input.plan_document_id,
    x: input.x,
    y: input.y,
    page: input.page ?? null,
    label: input.label ?? null,
  };

  const { data, error } = await supabase
    .from("reserve_plan_markers")
    .insert(payload)
    .select("id, reserve_id, plan_document_id, page, x, y, label, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as ReservePlanMarkerRow;
}

export async function removeReserveMarker(markerId: string): Promise<void> {
  if (!markerId) throw new Error("markerId manquant.");

  const { error } = await supabase
    .from("reserve_plan_markers")
    .delete()
    .eq("id", markerId);

  if (error) throw new Error(error.message);
}



