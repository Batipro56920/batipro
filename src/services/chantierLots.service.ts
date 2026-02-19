import { supabase } from "../lib/supabaseClient";

export type ChantierPlanningDates = {
  id: string;
  planning_start_date: string | null;
  planning_end_date: string | null;
  planning_skip_weekends: boolean;
};

export type ChantierLotRow = {
  id: string;
  chantier_id: string;
  name: string;
  planning_start_date: string | null;
  planning_end_date: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type ChantierLotCreateInput = {
  chantier_id: string;
  name: string;
  planning_start_date?: string | null;
  planning_end_date?: string | null;
  order_index?: number;
};

export type ChantierLotUpdateInput = Partial<
  Pick<ChantierLotRow, "name" | "planning_start_date" | "planning_end_date" | "order_index">
>;

const CHANTIER_DATES_SELECT_V2 = "id, planning_start_date, planning_end_date, planning_skip_weekends, date_debut, date_fin_prevue";
const CHANTIER_DATES_SELECT_V1 = "id, start_date, end_date, date_debut, date_fin_prevue";
const CHANTIER_DATES_SELECT_LEGACY = "id, date_debut, date_fin_prevue";

const LOT_SELECT_V2 = "id, chantier_id, name, planning_start_date, planning_end_date, order_index, created_at, updated_at";
const LOT_SELECT_V1 = "id, chantier_id, name, start_date, end_date, order_index, created_at, updated_at";
const LOT_SELECT_LEGACY = "id, chantier_id, name, order_index, created_at, updated_at";

function cleanDate(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function cleanName(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new Error("Le nom du lot est obligatoire.");
  }
  return text;
}

function cleanOrder(value: number | null | undefined): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function isMissingChantiersPlanningColumnsError(error: any): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  if (code === "42703") return true;
  return (
    msg.includes("column") &&
    msg.includes("chantiers") &&
    (msg.includes("planning_start_date") || msg.includes("planning_end_date") || msg.includes("planning_skip_weekends"))
  );
}

function isMissingChantiersV1ColumnsError(error: any): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  if (code === "42703") return true;
  return msg.includes("column") && msg.includes("chantiers") && (msg.includes("start_date") || msg.includes("end_date"));
}

function isMissingLotsPlanningColumnsError(error: any): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  if (code === "42703") return true;
  return msg.includes("column") && msg.includes("chantier_lots") && (msg.includes("planning_start_date") || msg.includes("planning_end_date"));
}

function isMissingLotsV1ColumnsError(error: any): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  if (code === "42703") return true;
  return msg.includes("column") && msg.includes("chantier_lots") && (msg.includes("start_date") || msg.includes("end_date"));
}

function isMissingLotsTableError(error: any): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  if (code === "42p01") return true;
  return msg.includes("relation") && msg.includes("chantier_lots") && msg.includes("does not exist");
}

function mapLot(row: any): ChantierLotRow {
  return {
    id: String(row.id),
    chantier_id: String(row.chantier_id),
    name: String(row.name ?? ""),
    planning_start_date: row.planning_start_date ?? row.start_date ?? null,
    planning_end_date: row.planning_end_date ?? row.end_date ?? null,
    order_index: cleanOrder(row.order_index),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapChantierDates(row: any): ChantierPlanningDates {
  return {
    id: String(row.id),
    planning_start_date: row.planning_start_date ?? row.start_date ?? row.date_debut ?? null,
    planning_end_date: row.planning_end_date ?? row.end_date ?? row.date_fin_prevue ?? null,
    planning_skip_weekends: Boolean(row.planning_skip_weekends ?? false),
  };
}

export async function getChantierPlanningDates(chantierId: string): Promise<ChantierPlanningDates> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const first = await supabase.from("chantiers").select(CHANTIER_DATES_SELECT_V2).eq("id", chantierId).maybeSingle();
  if (!first.error) {
    if (!first.data) throw new Error("Chantier introuvable.");
    return mapChantierDates(first.data);
  }
  if (!isMissingChantiersPlanningColumnsError(first.error)) throw new Error(first.error.message);

  const second = await supabase.from("chantiers").select(CHANTIER_DATES_SELECT_V1).eq("id", chantierId).maybeSingle();
  if (!second.error) {
    if (!second.data) throw new Error("Chantier introuvable.");
    return mapChantierDates(second.data);
  }
  if (!isMissingChantiersV1ColumnsError(second.error)) throw new Error(second.error.message);

  const third = await supabase.from("chantiers").select(CHANTIER_DATES_SELECT_LEGACY).eq("id", chantierId).maybeSingle();
  if (third.error) throw new Error(third.error.message);
  if (!third.data) throw new Error("Chantier introuvable.");
  return mapChantierDates(third.data);
}

export async function updateChantierPlanningDates(
  chantierId: string,
  patch: {
    planning_start_date?: string | null;
    planning_end_date?: string | null;
    planning_skip_weekends?: boolean;
  },
): Promise<ChantierPlanningDates> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const payload: Record<string, unknown> = {};
  if (patch.planning_start_date !== undefined) payload.planning_start_date = cleanDate(patch.planning_start_date);
  if (patch.planning_end_date !== undefined) payload.planning_end_date = cleanDate(patch.planning_end_date);
  if (patch.planning_skip_weekends !== undefined) payload.planning_skip_weekends = Boolean(patch.planning_skip_weekends);

  const first = await supabase
    .from("chantiers")
    .update(payload as any)
    .eq("id", chantierId)
    .select(CHANTIER_DATES_SELECT_V2)
    .maybeSingle();

  if (!first.error) {
    if (!first.data) throw new Error("Mise a jour chantier impossible.");
    return mapChantierDates(first.data);
  }
  if (!isMissingChantiersPlanningColumnsError(first.error)) throw new Error(first.error.message);

  const patchV1: Record<string, unknown> = {};
  if (patch.planning_start_date !== undefined) patchV1.start_date = cleanDate(patch.planning_start_date);
  if (patch.planning_end_date !== undefined) patchV1.end_date = cleanDate(patch.planning_end_date);

  const second = await supabase
    .from("chantiers")
    .update(patchV1 as any)
    .eq("id", chantierId)
    .select(CHANTIER_DATES_SELECT_V1)
    .maybeSingle();

  if (!second.error) {
    if (!second.data) throw new Error("Mise a jour chantier impossible.");
    return mapChantierDates(second.data);
  }
  if (!isMissingChantiersV1ColumnsError(second.error)) throw new Error(second.error.message);

  const third = await supabase
    .from("chantiers")
    .update({} as any)
    .eq("id", chantierId)
    .select(CHANTIER_DATES_SELECT_LEGACY)
    .maybeSingle();

  if (third.error) throw new Error(third.error.message);
  if (!third.data) throw new Error("Mise a jour chantier impossible.");
  return mapChantierDates(third.data);
}

export async function listChantierLots(chantierId: string): Promise<ChantierLotRow[]> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const first = await supabase
    .from("chantier_lots")
    .select(LOT_SELECT_V2)
    .eq("chantier_id", chantierId)
    .order("order_index", { ascending: true })
    .order("name", { ascending: true });

  if (!first.error) return (first.data ?? []).map(mapLot);
  if (isMissingLotsTableError(first.error)) return [];
  if (!isMissingLotsPlanningColumnsError(first.error)) throw new Error(first.error.message);

  const second = await supabase
    .from("chantier_lots")
    .select(LOT_SELECT_V1)
    .eq("chantier_id", chantierId)
    .order("order_index", { ascending: true })
    .order("name", { ascending: true });

  if (!second.error) return (second.data ?? []).map(mapLot);
  if (!isMissingLotsV1ColumnsError(second.error)) throw new Error(second.error.message);

  const third = await supabase
    .from("chantier_lots")
    .select(LOT_SELECT_LEGACY)
    .eq("chantier_id", chantierId)
    .order("order_index", { ascending: true })
    .order("name", { ascending: true });

  if (third.error) throw new Error(third.error.message);
  return (third.data ?? []).map(mapLot);
}

export async function createChantierLot(input: ChantierLotCreateInput): Promise<ChantierLotRow> {
  const payload = {
    chantier_id: input.chantier_id,
    name: cleanName(input.name),
    planning_start_date: cleanDate(input.planning_start_date),
    planning_end_date: cleanDate(input.planning_end_date),
    order_index: cleanOrder(input.order_index),
  };

  if (!payload.chantier_id) throw new Error("chantier_id manquant.");

  const first = await supabase.from("chantier_lots").insert(payload as any).select(LOT_SELECT_V2).maybeSingle();
  if (!first.error) {
    if (!first.data) throw new Error("Lot introuvable.");
    return mapLot(first.data);
  }
  if (isMissingLotsTableError(first.error)) {
    throw new Error("Module lots non deploye. Lance les migrations Supabase.");
  }
  if (!isMissingLotsPlanningColumnsError(first.error)) throw new Error(first.error.message);

  const payloadV1 = {
    chantier_id: payload.chantier_id,
    name: payload.name,
    start_date: payload.planning_start_date,
    end_date: payload.planning_end_date,
    order_index: payload.order_index,
  };

  const second = await supabase.from("chantier_lots").insert(payloadV1 as any).select(LOT_SELECT_V1).maybeSingle();
  if (!second.error) {
    if (!second.data) throw new Error("Lot introuvable.");
    return mapLot(second.data);
  }
  if (!isMissingLotsV1ColumnsError(second.error)) throw new Error(second.error.message);

  const payloadLegacy = {
    chantier_id: payload.chantier_id,
    name: payload.name,
    order_index: payload.order_index,
  };
  const third = await supabase.from("chantier_lots").insert(payloadLegacy as any).select(LOT_SELECT_LEGACY).maybeSingle();
  if (third.error) throw new Error(third.error.message);
  if (!third.data) throw new Error("Lot introuvable.");
  return mapLot(third.data);
}

export async function updateChantierLot(id: string, patch: ChantierLotUpdateInput): Promise<ChantierLotRow> {
  if (!id) throw new Error("ID lot manquant.");

  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = cleanName(patch.name);
  if (patch.planning_start_date !== undefined) payload.planning_start_date = cleanDate(patch.planning_start_date);
  if (patch.planning_end_date !== undefined) payload.planning_end_date = cleanDate(patch.planning_end_date);
  if (patch.order_index !== undefined) payload.order_index = cleanOrder(patch.order_index);

  const first = await supabase.from("chantier_lots").update(payload as any).eq("id", id).select(LOT_SELECT_V2).maybeSingle();
  if (!first.error) {
    if (!first.data) throw new Error("Lot introuvable.");
    return mapLot(first.data);
  }
  if (!isMissingLotsPlanningColumnsError(first.error)) throw new Error(first.error.message);

  const payloadV1: Record<string, unknown> = { ...payload };
  if (Object.prototype.hasOwnProperty.call(payloadV1, "planning_start_date")) payloadV1.start_date = payloadV1.planning_start_date;
  if (Object.prototype.hasOwnProperty.call(payloadV1, "planning_end_date")) payloadV1.end_date = payloadV1.planning_end_date;
  delete payloadV1.planning_start_date;
  delete payloadV1.planning_end_date;

  const second = await supabase.from("chantier_lots").update(payloadV1 as any).eq("id", id).select(LOT_SELECT_V1).maybeSingle();
  if (!second.error) {
    if (!second.data) throw new Error("Lot introuvable.");
    return mapLot(second.data);
  }
  if (!isMissingLotsV1ColumnsError(second.error)) throw new Error(second.error.message);

  delete payloadV1.start_date;
  delete payloadV1.end_date;

  const third = await supabase.from("chantier_lots").update(payloadV1 as any).eq("id", id).select(LOT_SELECT_LEGACY).maybeSingle();
  if (third.error) throw new Error(third.error.message);
  if (!third.data) throw new Error("Lot introuvable.");
  return mapLot(third.data);
}

export async function upsertChantierLotByName(
  chantierId: string,
  name: string,
  patch: { planning_start_date?: string | null; planning_end_date?: string | null; order_index?: number },
): Promise<ChantierLotRow> {
  if (!chantierId) throw new Error("chantierId manquant.");
  const cleanLotName = cleanName(name);

  const payload = {
    chantier_id: chantierId,
    name: cleanLotName,
    planning_start_date: cleanDate(patch.planning_start_date),
    planning_end_date: cleanDate(patch.planning_end_date),
    order_index: cleanOrder(patch.order_index),
  };

  const first = await supabase
    .from("chantier_lots")
    .upsert(payload as any, { onConflict: "chantier_id,name" })
    .select(LOT_SELECT_V2)
    .maybeSingle();

  if (!first.error) {
    if (!first.data) throw new Error("Lot introuvable.");
    return mapLot(first.data);
  }
  if (!isMissingLotsPlanningColumnsError(first.error)) throw new Error(first.error.message);

  const payloadV1 = {
    chantier_id: payload.chantier_id,
    name: payload.name,
    start_date: payload.planning_start_date,
    end_date: payload.planning_end_date,
    order_index: payload.order_index,
  };

  const second = await supabase
    .from("chantier_lots")
    .upsert(payloadV1 as any, { onConflict: "chantier_id,name" })
    .select(LOT_SELECT_V1)
    .maybeSingle();

  if (!second.error) {
    if (!second.data) throw new Error("Lot introuvable.");
    return mapLot(second.data);
  }
  if (!isMissingLotsV1ColumnsError(second.error)) throw new Error(second.error.message);

  const payloadLegacy = {
    chantier_id: payload.chantier_id,
    name: payload.name,
    order_index: payload.order_index,
  };

  const third = await supabase
    .from("chantier_lots")
    .upsert(payloadLegacy as any, { onConflict: "chantier_id,name" })
    .select(LOT_SELECT_LEGACY)
    .maybeSingle();

  if (third.error) throw new Error(third.error.message);
  if (!third.data) throw new Error("Lot introuvable.");
  return mapLot(third.data);
}

export async function deleteChantierLot(id: string): Promise<void> {
  if (!id) throw new Error("ID lot manquant.");
  const { error } = await supabase.from("chantier_lots").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
