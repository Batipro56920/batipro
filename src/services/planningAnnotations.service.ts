import { supabase } from "../lib/supabaseClient";

export type PlanningAnnotationType = "flag" | "warning" | "info";

export type PlanningAnnotationRow = {
  id: string;
  chantier_id: string;
  lot_name: string | null;
  lot_id: string | null;
  task_id: string | null;
  intervenant_id: string | null;
  date_start: string;
  date_end: string | null;
  type: PlanningAnnotationType;
  message: string;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
};

export type PlanningAnnotationCreateInput = {
  chantier_id: string;
  lot_name?: string | null;
  lot_id?: string | null;
  task_id?: string | null;
  intervenant_id?: string | null;
  date_start: string;
  date_end?: string | null;
  type?: PlanningAnnotationType;
  message: string;
  is_resolved?: boolean;
};

export type PlanningAnnotationUpdateInput = Partial<
  Pick<
    PlanningAnnotationRow,
    "lot_name" | "lot_id" | "task_id" | "intervenant_id" | "date_start" | "date_end" | "type" | "message" | "is_resolved"
  >
>;

function cleanText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function cleanDate(value: string | null | undefined): string | null {
  const text = cleanText(value);
  return text || null;
}

function cleanType(value: string | null | undefined): PlanningAnnotationType {
  const type = cleanText(value).toLowerCase();
  if (type === "flag" || type === "warning" || type === "info") {
    return type;
  }
  return "info";
}

function mapRow(row: any): PlanningAnnotationRow {
  return {
    id: String(row.id),
    chantier_id: String(row.chantier_id),
    lot_name: row.lot_name ?? row.lot ?? null,
    lot_id: row.lot_id ?? null,
    task_id: row.task_id ?? null,
    intervenant_id: row.intervenant_id ?? null,
    date_start: String(row.date_start),
    date_end: row.date_end ?? null,
    type: cleanType(row.type),
    message: String(row.message ?? ""),
    is_resolved: Boolean(row.is_resolved),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function isMissingColumn(error: any, column: string): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  if (code === "42703") return true;
  return msg.includes("column") && msg.includes("planning_annotations") && msg.includes(column.toLowerCase());
}

async function insertWithLotVariants(basePayload: Record<string, unknown>): Promise<any> {
  const withLotName = { ...basePayload };
  const first = await supabase.from("planning_annotations").insert(withLotName as any).select("*").maybeSingle();
  if (!first.error) return first.data;

  if (!isMissingColumn(first.error, "lot_name")) {
    throw new Error(first.error.message);
  }

  const withLot = { ...basePayload } as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(withLot, "lot_name")) {
    withLot.lot = withLot.lot_name;
    delete withLot.lot_name;
  }
  const second = await supabase.from("planning_annotations").insert(withLot as any).select("*").maybeSingle();
  if (!second.error) return second.data;

  if (!isMissingColumn(second.error, "lot")) {
    throw new Error(second.error.message);
  }

  const withoutLot = { ...basePayload } as Record<string, unknown>;
  delete withoutLot.lot_name;
  const third = await supabase.from("planning_annotations").insert(withoutLot as any).select("*").maybeSingle();
  if (third.error) throw new Error(third.error.message);
  return third.data;
}

async function updateWithLotVariants(id: string, payload: Record<string, unknown>): Promise<any> {
  const first = await supabase
    .from("planning_annotations")
    .update(payload as any)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (!first.error) return first.data;
  if (!Object.prototype.hasOwnProperty.call(payload, "lot_name") || !isMissingColumn(first.error, "lot_name")) {
    throw new Error(first.error.message);
  }

  const withLot = { ...payload } as Record<string, unknown>;
  withLot.lot = withLot.lot_name;
  delete withLot.lot_name;

  const second = await supabase
    .from("planning_annotations")
    .update(withLot as any)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (!second.error) return second.data;
  if (!isMissingColumn(second.error, "lot")) throw new Error(second.error.message);

  const withoutLot = { ...payload } as Record<string, unknown>;
  delete withoutLot.lot_name;
  const third = await supabase
    .from("planning_annotations")
    .update(withoutLot as any)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (third.error) throw new Error(third.error.message);
  return third.data;
}

export async function listPlanningAnnotations(chantierId: string): Promise<PlanningAnnotationRow[]> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const { data, error } = await supabase
    .from("planning_annotations")
    .select("*")
    .eq("chantier_id", chantierId)
    .order("date_start", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function createPlanningAnnotation(
  input: PlanningAnnotationCreateInput,
): Promise<PlanningAnnotationRow> {
  const payload: Record<string, unknown> = {
    chantier_id: input.chantier_id,
    lot_name: cleanDate(input.lot_name),
    lot_id: input.lot_id ?? null,
    task_id: input.task_id ?? null,
    intervenant_id: input.intervenant_id ?? null,
    date_start: cleanText(input.date_start),
    date_end: cleanDate(input.date_end),
    type: cleanType(input.type),
    message: cleanText(input.message),
    is_resolved: Boolean(input.is_resolved),
  };

  if (!payload.chantier_id) throw new Error("chantier_id manquant.");
  if (!payload.date_start) throw new Error("date_start est obligatoire.");
  if (!payload.message) throw new Error("Le motif de l'annotation est obligatoire.");

  const data = await insertWithLotVariants(payload);
  if (!data) throw new Error("Annotation introuvable.");
  return mapRow(data);
}

export async function updatePlanningAnnotation(
  id: string,
  patch: PlanningAnnotationUpdateInput,
): Promise<PlanningAnnotationRow> {
  if (!id) throw new Error("ID annotation manquant.");

  const payload: Record<string, unknown> = {};
  if (patch.lot_name !== undefined) payload.lot_name = cleanDate(patch.lot_name);
  if (patch.lot_id !== undefined) payload.lot_id = patch.lot_id || null;
  if (patch.task_id !== undefined) payload.task_id = patch.task_id || null;
  if (patch.intervenant_id !== undefined) payload.intervenant_id = patch.intervenant_id || null;
  if (patch.date_start !== undefined) {
    const clean = cleanText(patch.date_start);
    if (!clean) throw new Error("date_start est obligatoire.");
    payload.date_start = clean;
  }
  if (patch.date_end !== undefined) payload.date_end = cleanDate(patch.date_end);
  if (patch.type !== undefined) payload.type = cleanType(patch.type);
  if (patch.message !== undefined) {
    const clean = cleanText(patch.message);
    if (!clean) throw new Error("Le motif de l'annotation est obligatoire.");
    payload.message = clean;
  }
  if (patch.is_resolved !== undefined) payload.is_resolved = Boolean(patch.is_resolved);

  const data = await updateWithLotVariants(id, payload);
  if (!data) throw new Error("Annotation introuvable.");
  return mapRow(data);
}

export async function deletePlanningAnnotation(id: string): Promise<void> {
  if (!id) throw new Error("ID annotation manquant.");
  const { error } = await supabase.from("planning_annotations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function togglePlanningAnnotationResolved(
  id: string,
  nextResolved: boolean,
): Promise<PlanningAnnotationRow> {
  return updatePlanningAnnotation(id, { is_resolved: nextResolved });
}
