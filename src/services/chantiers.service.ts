// src/services/chantiers.service.ts
import { supabase } from "../lib/supabaseClient";
import type { ChantierStatus } from "../types/chantier";
import { CHANTIER_EN_COURS_STATUSES } from "../lib/chantierRules";

/* =========================================================
   TYPES
   ========================================================= */

export type ChantierRow = {
  id: string;
  nom: string;
  client: string | null;
  adresse: string | null;
  status: ChantierStatus;
  avancement: number | null;
  date_debut: string | null;
  planning_start_date?: string | null;
  planning_end_date?: string | null;
  planning_skip_weekends?: boolean;
  planning_hours_per_day?: number | null;
  planning_day_capacity?: number | null;
  planning_working_days?: string[] | null;

  // Champs optionnels (si présents dans ta DB)
  date_fin_prevue?: string | null;
  heures_prevues: number | null;
  heures_passees: number | null;

  created_at?: string | null;
};

const CHANTIER_SELECT_V3 =
  "id, nom, client, adresse, status, avancement, date_debut, date_fin_prevue, planning_start_date, planning_end_date, planning_skip_weekends, planning_hours_per_day, planning_day_capacity, planning_working_days, heures_prevues, heures_passees, created_at" as const;
const CHANTIER_SELECT_V2 =
  "id, nom, client, adresse, status, avancement, date_debut, date_fin_prevue, planning_start_date, planning_end_date, planning_skip_weekends, heures_prevues, heures_passees, created_at" as const;
const CHANTIER_SELECT_V1 =
  "id, nom, client, adresse, status, avancement, date_debut, date_fin_prevue, start_date, end_date, heures_prevues, heures_passees, created_at" as const;
const CHANTIER_SELECT_LEGACY =
  "id, nom, client, adresse, status, avancement, date_debut, date_fin_prevue, heures_prevues, heures_passees, created_at" as const;

export const CHANTIER_SELECT = CHANTIER_SELECT_V3;

export type ChantierScope = "all" | "en_cours";

/* =========================================================
   HELPERS
   ========================================================= */

function normalizeChantier(row: any): ChantierRow {
  const workingDays = Array.isArray(row.planning_working_days)
    ? row.planning_working_days.filter((value: unknown): value is string => typeof value === "string")
    : null;
  return {
    id: row.id,
    nom: row.nom,
    client: row.client ?? null,
    adresse: row.adresse ?? null,
    status: (row.status ?? "PREPARATION") as ChantierStatus,
    avancement: row.avancement ?? 0,
    date_debut: row.date_debut ?? null,
    planning_start_date: row.planning_start_date ?? row.start_date ?? row.date_debut ?? null,
    planning_end_date: row.planning_end_date ?? row.end_date ?? row.date_fin_prevue ?? null,
    planning_skip_weekends: Boolean(row.planning_skip_weekends ?? false),
    planning_hours_per_day:
      row.planning_hours_per_day === null || row.planning_hours_per_day === undefined
        ? 7
        : Number(row.planning_hours_per_day),
    planning_day_capacity:
      row.planning_day_capacity === null || row.planning_day_capacity === undefined
        ? 3
        : Number(row.planning_day_capacity),
    planning_working_days: workingDays && workingDays.length ? workingDays : ["MON", "TUE", "WED", "THU", "FRI"],
    date_fin_prevue: row.date_fin_prevue ?? null,
    heures_prevues: row.heures_prevues ?? 0,
    heures_passees: row.heures_passees ?? 0,
    created_at: row.created_at ?? null,
  };
}

function applyChantiersScope(query: any, scope: ChantierScope) {
  if (scope === "en_cours") {
    return query.in("status", [...CHANTIER_EN_COURS_STATUSES]);
  }
  return query;
}

function isMissingChantiersPlanningV2ColumnsError(error: any): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  if (code === "42703") return true;
  if (!msg) return false;
  return (
    msg.includes("column") &&
    msg.includes("chantiers") &&
    (
      msg.includes("planning_start_date") ||
      msg.includes("planning_end_date") ||
      msg.includes("planning_skip_weekends") ||
      msg.includes("planning_hours_per_day") ||
      msg.includes("planning_day_capacity") ||
      msg.includes("planning_working_days")
    )
  );
}

function isMissingChantiersPlanningV1ColumnsError(error: any): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  if (code === "42703") return true;
  if (!msg) return false;
  return msg.includes("column") && msg.includes("chantiers") && (msg.includes("start_date") || msg.includes("end_date"));
}

/* =========================================================
   CRUD
   ========================================================= */

export async function listChantiers(params: { scope?: ChantierScope } = {}): Promise<ChantierRow[]> {
  const scope = params.scope ?? "all";

  const qV3 = supabase.from("chantiers").select(CHANTIER_SELECT_V3).order("created_at", { ascending: false });
  const first = await applyChantiersScope(qV3, scope);
  if (!first.error) return (first.data ?? []).map(normalizeChantier);
  if (!isMissingChantiersPlanningV2ColumnsError(first.error)) throw first.error;

  const qV2 = supabase.from("chantiers").select(CHANTIER_SELECT_V2).order("created_at", { ascending: false });
  const second = await applyChantiersScope(qV2, scope);
  if (!second.error) return (second.data ?? []).map(normalizeChantier);
  if (!isMissingChantiersPlanningV2ColumnsError(second.error)) throw second.error;

  const qV1 = supabase.from("chantiers").select(CHANTIER_SELECT_V1).order("created_at", { ascending: false });
  const third = await applyChantiersScope(qV1, scope);
  if (!third.error) return (third.data ?? []).map(normalizeChantier);
  if (!isMissingChantiersPlanningV1ColumnsError(third.error)) throw third.error;

  const qLegacy = supabase.from("chantiers").select(CHANTIER_SELECT_LEGACY).order("created_at", { ascending: false });
  const fourth = await applyChantiersScope(qLegacy, scope);
  if (fourth.error) throw fourth.error;
  return (fourth.data ?? []).map(normalizeChantier);
}

export async function countChantiers(params: { scope?: ChantierScope } = {}): Promise<number> {
  const scope = params.scope ?? "all";

  const query = supabase.from("chantiers").select("id", { count: "exact", head: true });
  const { count, error } = await applyChantiersScope(query, scope);

  if (error) throw error;
  return count ?? 0;
}

export async function getChantiers(): Promise<ChantierRow[]> {
  return listChantiers({ scope: "all" });
}

export async function getChantierById(id: string): Promise<ChantierRow> {
  if (!id) throw new Error("id manquant.");

  const first = await supabase.from("chantiers").select(CHANTIER_SELECT_V3).eq("id", id).maybeSingle();
  if (!first.error) {
    if (!first.data) throw new Error("Chantier introuvable.");
    return normalizeChantier(first.data);
  }
  if (!isMissingChantiersPlanningV2ColumnsError(first.error)) throw first.error;

  const second = await supabase.from("chantiers").select(CHANTIER_SELECT_V2).eq("id", id).maybeSingle();
  if (!second.error) {
    if (!second.data) throw new Error("Chantier introuvable.");
    return normalizeChantier(second.data);
  }
  if (!isMissingChantiersPlanningV2ColumnsError(second.error)) throw second.error;

  const third = await supabase.from("chantiers").select(CHANTIER_SELECT_V1).eq("id", id).maybeSingle();
  if (!third.error) {
    if (!third.data) throw new Error("Chantier introuvable.");
    return normalizeChantier(third.data);
  }
  if (!isMissingChantiersPlanningV1ColumnsError(third.error)) throw third.error;

  const fourth = await supabase.from("chantiers").select(CHANTIER_SELECT_LEGACY).eq("id", id).maybeSingle();
  if (fourth.error) throw fourth.error;
  if (!fourth.data) throw new Error("Chantier introuvable.");
  return normalizeChantier(fourth.data);
}

export async function createChantier(payload: {
  nom: string;
  client?: string | null;
  adresse?: string | null;
  status?: ChantierStatus;
  date_debut?: string | null;
  date_fin_prevue?: string | null;
  planning_start_date?: string | null;
  planning_end_date?: string | null;
  planning_skip_weekends?: boolean;
  planning_hours_per_day?: number | null;
  planning_day_capacity?: number | null;
  planning_working_days?: string[] | null;
  heures_prevues?: number | null;
}): Promise<ChantierRow> {
  const nom = (payload?.nom ?? "").trim();
  if (!nom) throw new Error("Le nom du chantier est obligatoire.");

  const insertRow: Record<string, any> = {
    nom,
    client: payload.client ?? null,
    adresse: payload.adresse ?? null,
    status: payload.status ?? "PREPARATION",
    date_debut: payload.date_debut ?? null,
    date_fin_prevue: payload.date_fin_prevue ?? null,
    planning_start_date: payload.planning_start_date ?? payload.date_debut ?? null,
    planning_end_date: payload.planning_end_date ?? payload.date_fin_prevue ?? null,
    planning_skip_weekends: Boolean(payload.planning_skip_weekends ?? false),
    planning_hours_per_day: payload.planning_hours_per_day ?? 7,
    planning_day_capacity: payload.planning_day_capacity ?? 3,
    planning_working_days: payload.planning_working_days ?? ["MON", "TUE", "WED", "THU", "FRI"],
    heures_prevues: payload.heures_prevues ?? 0,
    heures_passees: 0,
    avancement: 0,
  };

  const first = await supabase.from("chantiers").insert([insertRow]).select(CHANTIER_SELECT_V3).maybeSingle();
  if (!first.error) {
    if (!first.data) throw new Error("Creation chantier OK mais non retourne.");
    return normalizeChantier(first.data);
  }
  if (!isMissingChantiersPlanningV2ColumnsError(first.error)) throw first.error;

  const insertV1 = {
    ...insertRow,
    start_date: insertRow.planning_start_date,
    end_date: insertRow.planning_end_date,
  };
  delete (insertV1 as any).planning_start_date;
  delete (insertV1 as any).planning_end_date;
  delete (insertV1 as any).planning_skip_weekends;
  delete (insertV1 as any).planning_hours_per_day;
  delete (insertV1 as any).planning_day_capacity;
  delete (insertV1 as any).planning_working_days;

  const second = await supabase.from("chantiers").insert([insertV1]).select(CHANTIER_SELECT_V2).maybeSingle();
  if (!second.error) {
    if (!second.data) throw new Error("Creation chantier OK mais non retourne.");
    return normalizeChantier(second.data);
  }
  if (!isMissingChantiersPlanningV2ColumnsError(second.error)) throw second.error;

  delete (insertV1 as any).start_date;
  delete (insertV1 as any).end_date;

  const third = await supabase.from("chantiers").insert([insertV1]).select(CHANTIER_SELECT_V1).maybeSingle();
  if (!third.error) {
    if (!third.data) throw new Error("Creation chantier OK mais non retourne.");
    return normalizeChantier(third.data);
  }
  if (!isMissingChantiersPlanningV1ColumnsError(third.error)) throw third.error;

  const fourth = await supabase.from("chantiers").insert([insertV1]).select(CHANTIER_SELECT_LEGACY).maybeSingle();
  if (fourth.error) throw fourth.error;
  if (!fourth.data) throw new Error("Creation chantier OK mais non retourne.");
  return normalizeChantier(fourth.data);
}

export async function updateChantier(
  id: string,
  patch: Partial<Omit<ChantierRow, "id" | "created_at">>,
): Promise<ChantierRow> {
  if (!id) throw new Error("id manquant.");

  const first = await supabase.from("chantiers").update(patch as any).eq("id", id).select(CHANTIER_SELECT_V3).maybeSingle();
  if (!first.error) {
    if (!first.data) throw new Error("Mise a jour OK mais chantier non retourne.");
    return normalizeChantier(first.data);
  }
  if (!isMissingChantiersPlanningV2ColumnsError(first.error)) throw first.error;

  const patchV1: Record<string, unknown> = { ...patch };
  if (Object.prototype.hasOwnProperty.call(patchV1, "planning_start_date")) {
    patchV1.start_date = patchV1.planning_start_date;
  }
  if (Object.prototype.hasOwnProperty.call(patchV1, "planning_end_date")) {
    patchV1.end_date = patchV1.planning_end_date;
  }
  delete patchV1.planning_start_date;
  delete patchV1.planning_end_date;
  delete patchV1.planning_skip_weekends;
  delete patchV1.planning_hours_per_day;
  delete patchV1.planning_day_capacity;
  delete patchV1.planning_working_days;

  const second = await supabase.from("chantiers").update(patchV1 as any).eq("id", id).select(CHANTIER_SELECT_V2).maybeSingle();
  if (!second.error) {
    if (!second.data) throw new Error("Mise a jour OK mais chantier non retourne.");
    return normalizeChantier(second.data);
  }
  if (!isMissingChantiersPlanningV2ColumnsError(second.error)) throw second.error;

  delete patchV1.start_date;
  delete patchV1.end_date;
  const third = await supabase.from("chantiers").update(patchV1 as any).eq("id", id).select(CHANTIER_SELECT_V1).maybeSingle();
  if (!third.error) {
    if (!third.data) throw new Error("Mise a jour OK mais chantier non retourne.");
    return normalizeChantier(third.data);
  }
  if (!isMissingChantiersPlanningV1ColumnsError(third.error)) throw third.error;

  const fourth = await supabase.from("chantiers").update(patchV1 as any).eq("id", id).select(CHANTIER_SELECT_LEGACY).maybeSingle();
  if (fourth.error) throw fourth.error;
  if (!fourth.data) throw new Error("Mise a jour OK mais chantier non retourne.");
  return normalizeChantier(fourth.data);
}

export async function deleteChantier(id: string): Promise<void> {
  if (!id) throw new Error("id manquant.");

  const { error } = await supabase.from("chantiers").delete().eq("id", id);
  if (error) throw error;
}
