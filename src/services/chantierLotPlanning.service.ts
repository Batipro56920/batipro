import { supabase } from "../lib/supabaseClient";

export type ChantierLotPlanningRow = {
  id: string;
  chantier_id: string;
  lot_name: string;
  start_date: string | null;
  end_date: string | null;
  end_date_locked: boolean;
  order_index: number;
  created_at: string | null;
  updated_at: string | null;
};

export type ChantierLotPlanningFetchResult = {
  rows: ChantierLotPlanningRow[];
  tableMissing: boolean;
};

export type UpsertChantierLotPlanningInput = {
  chantier_id: string;
  lot_name: string;
  start_date?: string | null;
  end_date?: string | null;
  end_date_locked?: boolean;
  order_index?: number | null;
};

const SELECT_V2 = "id, chantier_id, lot_name, start_date, end_date, end_date_locked, order_index, created_at, updated_at";
const SELECT_V2_LEGACY = "id, chantier_id, lot_name, start_date, end_date, order_index, created_at, updated_at";
const SELECT_V1 = "id, chantier_id, lot, start_date, end_date, end_date_locked, order_index, created_at, updated_at";
const SELECT_V1_LEGACY = "id, chantier_id, lot, start_date, end_date, order_index, created_at, updated_at";

function cleanText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function cleanDate(value: string | null | undefined): string | null {
  const text = cleanText(value);
  return text || null;
}

function cleanOrder(value: number | null | undefined): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function isMissingTableError(error: any): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  if (code === "42p01") return true;
  return msg.includes("relation") && msg.includes("chantier_lot_planning") && msg.includes("does not exist");
}

function isMissingColumnError(error: any, column: string): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  if (code === "42703") return true;
  return msg.includes("column") && msg.includes("chantier_lot_planning") && msg.includes(column.toLowerCase());
}

function mapRow(row: any): ChantierLotPlanningRow {
  const lotName = cleanText(row.lot_name ?? row.lot);
  return {
    id: String(row.id),
    chantier_id: String(row.chantier_id),
    lot_name: lotName || "A classer",
    start_date: row.start_date ?? null,
    end_date: row.end_date ?? null,
    end_date_locked: Boolean(row.end_date_locked ?? false),
    order_index: cleanOrder(row.order_index),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function listChantierLotPlanningDetailed(
  chantierId: string,
): Promise<ChantierLotPlanningFetchResult> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const attempts = [
    { select: SELECT_V2, orderField: "lot_name" },
    { select: SELECT_V1, orderField: "lot" },
    { select: SELECT_V2_LEGACY, orderField: "lot_name" },
    { select: SELECT_V1_LEGACY, orderField: "lot" },
  ] as const;

  let lastError: any = null;

  for (const attempt of attempts) {
    const query = await supabase
      .from("chantier_lot_planning")
      .select(attempt.select)
      .eq("chantier_id", chantierId)
      .order("order_index", { ascending: true })
      .order(attempt.orderField, { ascending: true });

    if (!query.error) {
      return {
        rows: (query.data ?? []).map(mapRow),
        tableMissing: false,
      };
    }

    lastError = query.error;
    if (isMissingTableError(query.error)) {
      return {
        rows: [],
        tableMissing: true,
      };
    }

    const missingLotName = isMissingColumnError(query.error, "lot_name");
    const missingLot = isMissingColumnError(query.error, "lot");
    const missingEndLock = isMissingColumnError(query.error, "end_date_locked");
    if (missingLotName || missingLot || missingEndLock) {
      continue;
    }

    throw new Error(query.error?.message ?? "Erreur chargement lot planning.");
  }

  throw new Error(lastError?.message ?? "Erreur chargement lot planning.");
}

export async function listChantierLotPlanning(chantierId: string): Promise<ChantierLotPlanningRow[]> {
  const result = await listChantierLotPlanningDetailed(chantierId);
  return result.rows;
}

export async function upsertChantierLotPlanning(
  input: UpsertChantierLotPlanningInput,
): Promise<ChantierLotPlanningRow> {
  const chantierId = cleanText(input.chantier_id);
  const lotName = cleanText(input.lot_name);
  if (!chantierId) throw new Error("chantier_id manquant.");
  if (!lotName) throw new Error("Nom du lot manquant.");

  const base = {
    chantier_id: chantierId,
    start_date: cleanDate(input.start_date),
    end_date: cleanDate(input.end_date),
    end_date_locked: Boolean(input.end_date_locked),
    order_index: cleanOrder(input.order_index),
  };

  const attempts = [
    {
      payload: { ...base, lot_name: lotName },
      onConflict: "chantier_id,lot_name",
      select: SELECT_V2,
    },
    {
      payload: { ...base, lot: lotName },
      onConflict: "chantier_id,lot",
      select: SELECT_V1,
    },
    {
      payload: { ...base, lot_name: lotName, end_date_locked: undefined },
      onConflict: "chantier_id,lot_name",
      select: SELECT_V2_LEGACY,
    },
    {
      payload: { ...base, lot: lotName, end_date_locked: undefined },
      onConflict: "chantier_id,lot",
      select: SELECT_V1_LEGACY,
    },
  ] as const;

  let lastError: any = null;

  for (const attempt of attempts) {
    const payload = { ...attempt.payload } as Record<string, unknown>;
    if (payload.end_date_locked === undefined) {
      delete payload.end_date_locked;
    }

    const query = await supabase
      .from("chantier_lot_planning")
      .upsert(payload as any, { onConflict: attempt.onConflict })
      .select(attempt.select)
      .maybeSingle();

    if (!query.error) {
      if (!query.data) throw new Error("Lot planning introuvable apres enregistrement.");
      return mapRow(query.data);
    }

    lastError = query.error;
    if (isMissingTableError(query.error)) {
      throw new Error("Migration planning manquante sur Supabase. Table attendue: public.chantier_lot_planning.");
    }

    const missingLotName = isMissingColumnError(query.error, "lot_name");
    const missingLot = isMissingColumnError(query.error, "lot");
    const missingEndLock = isMissingColumnError(query.error, "end_date_locked");
    if (missingLotName || missingLot || missingEndLock) {
      continue;
    }

    throw new Error(query.error?.message ?? "Erreur enregistrement lot planning.");
  }

  throw new Error(lastError?.message ?? "Erreur enregistrement lot planning.");
}
