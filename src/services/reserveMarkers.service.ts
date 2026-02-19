import { supabase } from "../lib/supabaseClient";

export type ReserveMarkerType = "POINT" | "LINE" | "CROSS" | "CHECK" | "TEXT";
const LEGEND_LABEL_PREFIX = "__LEGEND__:";

export type ReservePlanMarkerRow = {
  id: string;
  reserve_id: string;
  document_id: string | null;
  plan_document_id: string;
  page_number: number | null;
  page: number | null;
  type: ReserveMarkerType;
  color: string | null;
  stroke_width: number | null;
  x1: number | null;
  y1: number | null;
  x2: number | null;
  y2: number | null;
  text: string | null;
  legend_label: string | null;
  legend_key: string | null;
  x: number;
  y: number;
  label: string | null;
  created_at: string;
};

function isMissingTableError(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    (msg.includes("relation") && msg.includes("reserve_plan_markers") && msg.includes("does not exist")) ||
    (msg.includes("table") && msg.includes("reserve_plan_markers") && msg.includes("does not exist"))
  );
}

function isMissingColumnError(error: { message?: string } | null, column?: string): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  if (column) {
    return (
      (msg.includes("column") && msg.includes(column.toLowerCase()) && msg.includes("does not exist")) ||
      (msg.includes("schema cache") && msg.includes("column") && msg.includes(column.toLowerCase()))
    );
  }
  return (
    (msg.includes("column") && msg.includes("does not exist")) ||
    (msg.includes("schema cache") && msg.includes("column"))
  );
}

function migrationErrorMessage() {
  return "Module dessin plan non deploye en base. Appliquez la migration reserve_plan_markers V1.";
}

function normalizeMarker(row: any): ReservePlanMarkerRow {
  const x1 = typeof row?.x1 === "number" ? row.x1 : typeof row?.x === "number" ? row.x : 0;
  const y1 = typeof row?.y1 === "number" ? row.y1 : typeof row?.y === "number" ? row.y : 0;
  const x2 = typeof row?.x2 === "number" ? row.x2 : null;
  const y2 = typeof row?.y2 === "number" ? row.y2 : null;
  const pageNumber =
    typeof row?.page_number === "number"
      ? row.page_number
      : typeof row?.page === "number"
        ? row.page
        : null;
  const documentId =
    (typeof row?.document_id === "string" && row.document_id) ||
    (typeof row?.plan_document_id === "string" && row.plan_document_id) ||
    null;

  return {
    id: row.id,
    reserve_id: row.reserve_id,
    document_id: documentId,
    plan_document_id: row.plan_document_id ?? documentId ?? "",
    page_number: pageNumber,
    page: row.page ?? pageNumber,
    type: (row.type ?? "POINT") as ReserveMarkerType,
    color: row.color ?? "#ef4444",
    stroke_width: typeof row.stroke_width === "number" ? row.stroke_width : 2,
    x1,
    y1,
    x2,
    y2,
    text: row.text ?? row.label ?? null,
    legend_label: row.legend_label ?? null,
    legend_key: row.legend_key ?? null,
    x: typeof row?.x === "number" ? row.x : x1,
    y: typeof row?.y === "number" ? row.y : y1,
    label: row.label ?? row.text ?? null,
    created_at: row.created_at,
  };
}

export async function listReserveMarkers(reserveId: string): Promise<ReservePlanMarkerRow[]> {
  if (!reserveId) throw new Error("reserveId manquant.");

  const { data, error } = await supabase
    .from("reserve_plan_markers")
    .select(
      "id, reserve_id, document_id, plan_document_id, page_number, page, type, color, stroke_width, x1, y1, x2, y2, text, legend_label, legend_key, x, y, label, created_at",
    )
    .eq("reserve_id", reserveId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingColumnError(error)) {
      const { data: v1Data, error: v1Error } = await supabase
        .from("reserve_plan_markers")
        .select("id, reserve_id, document_id, plan_document_id, page_number, page, type, color, stroke_width, x1, y1, x2, y2, text, x, y, label, created_at")
        .eq("reserve_id", reserveId)
        .order("created_at", { ascending: true });
      if (!v1Error) return (v1Data ?? []).map(normalizeMarker);

      if (isMissingColumnError(v1Error)) {
        const { data: legacyData, error: legacyError } = await supabase
          .from("reserve_plan_markers")
          .select("id, reserve_id, plan_document_id, page, x, y, label, created_at")
          .eq("reserve_id", reserveId)
          .order("created_at", { ascending: true });
        if (legacyError) throw new Error(legacyError.message);
        return (legacyData ?? []).map(normalizeMarker);
      }
      throw new Error(v1Error.message);
    }
    if (isMissingTableError(error)) {
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []).map(normalizeMarker);
}

export async function listReserveMarkersByPlan(
  planDocumentId: string,
  options: { page_number?: number | null; reserve_id?: string | null } = {},
): Promise<ReservePlanMarkerRow[]> {
  if (!planDocumentId) throw new Error("planDocumentId manquant.");

  const { data, error } = await supabase
    .from("reserve_plan_markers")
    .select(
      "id, reserve_id, document_id, plan_document_id, page_number, page, type, color, stroke_width, x1, y1, x2, y2, text, legend_label, legend_key, x, y, label, created_at",
    )
    .or(`document_id.eq.${planDocumentId},plan_document_id.eq.${planDocumentId}`)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingColumnError(error)) {
      const { data: v1Data, error: v1Error } = await supabase
        .from("reserve_plan_markers")
        .select("id, reserve_id, document_id, plan_document_id, page_number, page, type, color, stroke_width, x1, y1, x2, y2, text, x, y, label, created_at")
        .or(`document_id.eq.${planDocumentId},plan_document_id.eq.${planDocumentId}`)
        .order("created_at", { ascending: true });
      if (!v1Error) {
        let rows = (v1Data ?? []).map(normalizeMarker);
        if (options.page_number !== undefined && options.page_number !== null) {
          rows = rows.filter((row) => Number(row.page_number ?? row.page ?? 1) === Number(options.page_number));
        }
        if (options.reserve_id) {
          rows = rows.filter((row) => row.reserve_id === options.reserve_id);
        }
        return rows;
      }

      if (isMissingColumnError(v1Error)) {
        const { data: legacyData, error: legacyError } = await supabase
          .from("reserve_plan_markers")
          .select("id, reserve_id, plan_document_id, page, x, y, label, created_at")
          .eq("plan_document_id", planDocumentId)
          .order("created_at", { ascending: true });
        if (legacyError) throw new Error(legacyError.message);
        let rows = (legacyData ?? []).map(normalizeMarker);
        if (options.page_number !== undefined && options.page_number !== null) {
          rows = rows.filter((row) => Number(row.page_number ?? row.page ?? 1) === Number(options.page_number));
        }
        if (options.reserve_id) {
          rows = rows.filter((row) => row.reserve_id === options.reserve_id);
        }
        return rows;
      }
      throw new Error(v1Error.message);
    }
    if (isMissingTableError(error)) {
      const { data: legacyData, error: legacyError } = await supabase
        .from("reserve_plan_markers")
        .select("id, reserve_id, plan_document_id, page, x, y, label, created_at")
        .eq("plan_document_id", planDocumentId)
        .order("created_at", { ascending: true });
      if (legacyError) {
        if (isMissingTableError(legacyError)) return [];
        throw new Error(legacyError.message);
      }
      let rows = (legacyData ?? []).map(normalizeMarker);
      if (options.page_number !== undefined && options.page_number !== null) {
        rows = rows.filter((row) => Number(row.page_number ?? row.page ?? 1) === Number(options.page_number));
      }
      if (options.reserve_id) {
        rows = rows.filter((row) => row.reserve_id === options.reserve_id);
      }
      return rows;
    }
    throw new Error(error.message);
  }
  let rows = (data ?? []).map(normalizeMarker);
  if (options.page_number !== undefined && options.page_number !== null) {
    rows = rows.filter((row) => Number(row.page_number ?? row.page ?? 1) === Number(options.page_number));
  }
  if (options.reserve_id) {
    rows = rows.filter((row) => row.reserve_id === options.reserve_id);
  }
  return rows;
}

export async function addReserveMarker(input: {
  reserve_id: string;
  document_id: string;
  plan_document_id?: string;
  type: ReserveMarkerType;
  color?: string | null;
  stroke_width?: number | null;
  page_number?: number | null;
  page?: number | null;
  x1: number;
  y1: number;
  x2?: number | null;
  y2?: number | null;
  text?: string | null;
  label?: string | null;
  legend_label?: string | null;
  legend_key?: string | null;
}): Promise<ReservePlanMarkerRow> {
  if (!input.reserve_id) throw new Error("reserve_id manquant.");
  if (!input.document_id && !input.plan_document_id) throw new Error("document_id manquant.");

  const documentId = input.document_id || input.plan_document_id || "";
  const pageNumber = input.page_number ?? input.page ?? null;

  const payload = {
    reserve_id: input.reserve_id,
    document_id: documentId,
    plan_document_id: input.plan_document_id ?? documentId,
    type: input.type ?? "POINT",
    color: (input.color ?? "#ef4444").toLowerCase(),
    stroke_width: input.stroke_width ?? 2,
    page_number: pageNumber,
    page: pageNumber,
    x1: input.x1,
    y1: input.y1,
    x2: input.x2 ?? null,
    y2: input.y2 ?? null,
    text: input.text ?? null,
    legend_label: input.legend_label ?? null,
    legend_key: input.legend_key ?? `${input.type ?? "POINT"}:${(input.color ?? "#ef4444").toLowerCase()}`,
    x: input.x1,
    y: input.y1,
    label: input.label ?? input.text ?? null,
  };

  const { data, error } = await supabase
    .from("reserve_plan_markers")
    .insert(payload)
    .select(
      "id, reserve_id, document_id, plan_document_id, page_number, page, type, color, stroke_width, x1, y1, x2, y2, text, legend_label, legend_key, x, y, label, created_at",
    )
    .single();

  if (!error) return normalizeMarker(data);

  if (isMissingColumnError(error)) {
    const v1Payload = {
      reserve_id: input.reserve_id,
      document_id: documentId,
      plan_document_id: input.plan_document_id ?? documentId,
      type: input.type ?? "POINT",
      color: (input.color ?? "#ef4444").toLowerCase(),
      stroke_width: input.stroke_width ?? 2,
      page_number: pageNumber,
      page: pageNumber,
      x1: input.x1,
      y1: input.y1,
      x2: input.x2 ?? null,
      y2: input.y2 ?? null,
      text: input.text ?? null,
      x: input.x1,
      y: input.y1,
      label: input.label ?? input.text ?? null,
    };
    const { data: v1Data, error: v1Error } = await supabase
      .from("reserve_plan_markers")
      .insert(v1Payload)
      .select("id, reserve_id, document_id, plan_document_id, page_number, page, type, color, stroke_width, x1, y1, x2, y2, text, x, y, label, created_at")
      .single();
    if (!v1Error) return normalizeMarker(v1Data);

    if (isMissingColumnError(v1Error)) {
      const legacyPayload = {
        reserve_id: input.reserve_id,
        plan_document_id: input.plan_document_id ?? documentId,
        page: pageNumber,
        x: input.x1,
        y: input.y1,
        label: input.label ?? input.text ?? null,
      };
      const { data: legacyData, error: legacyError } = await supabase
        .from("reserve_plan_markers")
        .insert(legacyPayload)
        .select("id, reserve_id, plan_document_id, page, x, y, label, created_at")
        .single();
      if (!legacyError) return normalizeMarker(legacyData);
      if (isMissingTableError(legacyError)) throw new Error(migrationErrorMessage());
      throw new Error(legacyError.message);
    }

    if (isMissingTableError(v1Error)) throw new Error(migrationErrorMessage());
    throw new Error(v1Error.message);
  }

  if (isMissingTableError(error)) throw new Error(migrationErrorMessage());
  throw new Error(error.message);
}

export async function removeReserveMarker(markerId: string): Promise<void> {
  if (!markerId) throw new Error("markerId manquant.");

  const { error } = await supabase
    .from("reserve_plan_markers")
    .delete()
    .eq("id", markerId);

  if (error) throw new Error(error.message);
}

export async function deleteMarker(markerId: string): Promise<void> {
  await removeReserveMarker(markerId);
}

function normalizeLegendLabel(value: string | null | undefined): string {
  return (value ?? "").trim();
}

async function findGroupMarkerIds(input: {
  document_id: string;
  page_number: number;
  type: ReserveMarkerType;
  color: string;
  stroke_width: number;
  label: string | null;
}): Promise<string[]> {
  const normalizedLabel = normalizeLegendLabel(input.label);
  const normalizedColor = (input.color ?? "").toLowerCase();
  const { data, error } = await supabase
    .from("reserve_plan_markers")
    .select("id, legend_label, color")
    .eq("document_id", input.document_id)
    .eq("page_number", input.page_number)
    .eq("type", input.type)
    .eq("stroke_width", input.stroke_width);

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return rows
    .filter((row) => {
      const rowColor = String(row.color ?? "").toLowerCase();
      return rowColor === normalizedColor && normalizeLegendLabel(row.legend_label) === normalizedLabel;
    })
    .map((row) => row.id as string);
}

export async function updateLegendLabelByGroup(input: {
  document_id: string;
  page_number: number | null;
  type: ReserveMarkerType;
  color: string;
  stroke_width: number;
  old_label: string | null;
  new_label: string | null;
}): Promise<number> {
  if (!input.document_id) throw new Error("document_id manquant.");
  if (input.page_number === null || input.page_number === undefined) {
    throw new Error("page_number manquant.");
  }
  const ids = await findGroupMarkerIds({
    document_id: input.document_id,
    page_number: input.page_number,
    type: input.type,
    color: input.color,
    stroke_width: input.stroke_width,
    label: input.old_label,
  });
  if (ids.length === 0) return 0;

  const nextLabel = normalizeLegendLabel(input.new_label);
  const { data, error } = await supabase
    .from("reserve_plan_markers")
    .update({ legend_label: nextLabel || null })
    .in("id", ids)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

export async function deleteMarkersByGroup(input: {
  document_id: string;
  page_number: number | null;
  type: ReserveMarkerType;
  color: string;
  stroke_width: number;
  label: string | null;
}): Promise<number> {
  if (!input.document_id) throw new Error("document_id manquant.");
  if (input.page_number === null || input.page_number === undefined) {
    throw new Error("page_number manquant.");
  }
  const ids = await findGroupMarkerIds({
    document_id: input.document_id,
    page_number: input.page_number,
    type: input.type,
    color: input.color,
    stroke_width: input.stroke_width,
    label: input.label,
  });
  if (ids.length === 0) return 0;

  const { data, error } = await supabase
    .from("reserve_plan_markers")
    .delete()
    .in("id", ids)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

export async function removeReserveMarkersGroup(input: {
  document_id: string;
  page_number: number | null;
  type: ReserveMarkerType;
  color: string;
  reserve_id?: string | null;
  scope: "ACTIVE_ONLY" | "ALL_RESERVES";
}): Promise<number> {
  if (!input.document_id) throw new Error("document_id manquant.");
  if (input.page_number === null || input.page_number === undefined) {
    throw new Error("page_number manquant.");
  }
  if (input.scope === "ACTIVE_ONLY" && !input.reserve_id) {
    throw new Error("reserve_id manquant en scope ACTIVE_ONLY.");
  }

  const normalizedColor = String(input.color ?? "").trim().toLowerCase();
  let query = supabase
    .from("reserve_plan_markers")
    .select("id, color")
    .or(`document_id.eq.${input.document_id},plan_document_id.eq.${input.document_id}`)
    .eq("page_number", input.page_number)
    .eq("type", input.type);

  if (input.scope === "ACTIVE_ONLY" && input.reserve_id) {
    query = query.eq("reserve_id", input.reserve_id);
  }

  const { data: rows, error: selectError } = await query;
  if (selectError) throw new Error(selectError.message);

  const ids = (rows ?? [])
    .filter((row) => String(row.color ?? "").toLowerCase() === normalizedColor)
    .map((row) => String(row.id))
    .filter(Boolean);

  if (!ids.length) return 0;

  const { data, error } = await supabase
    .from("reserve_plan_markers")
    .delete()
    .in("id", ids)
    .select("id");

  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

export async function renameReserveMarkersGroup(input: {
  document_id: string;
  page_number: number | null;
  type: ReserveMarkerType;
  color: string;
  new_label: string | null;
  reserve_id?: string | null;
  scope: "ACTIVE_ONLY" | "ALL_RESERVES";
}): Promise<number> {
  if (!input.document_id) throw new Error("document_id manquant.");
  if (input.page_number === null || input.page_number === undefined) {
    throw new Error("page_number manquant.");
  }
  if (input.scope === "ACTIVE_ONLY" && !input.reserve_id) {
    throw new Error("reserve_id manquant en scope ACTIVE_ONLY.");
  }

  const normalizedColor = String(input.color ?? "").trim().toLowerCase();
  const targetPage = Number(input.page_number ?? 1);
  const rows = await listReserveMarkersByPlan(input.document_id);

  const ids = rows
    .filter((row) => {
      const rowPage = Number(row.page_number ?? row.page ?? 1);
      if (rowPage !== targetPage) return false;
      if (row.type !== input.type) return false;
      if (input.scope === "ACTIVE_ONLY" && input.reserve_id && row.reserve_id !== input.reserve_id) return false;
      const rowColor = String(row.color ?? "#ef4444").trim().toLowerCase();
      return rowColor === normalizedColor;
    })
    .map((row) => String(row.id))
    .filter(Boolean);

  if (!ids.length) return 0;

  const nextLabel = (input.new_label ?? "").trim() || null;
  const { data, error } = await supabase
    .from("reserve_plan_markers")
    .update({ legend_label: nextLabel })
    .in("id", ids)
    .select("id");
  if (!error) return (data ?? []).length;

  if (isMissingColumnError(error, "legend_label")) {
    const legacyLabel = nextLabel ? `${LEGEND_LABEL_PREFIX}${nextLabel}` : `${LEGEND_LABEL_PREFIX}`;
    const { data: legacyData, error: legacyError } = await supabase
      .from("reserve_plan_markers")
      .update({ label: legacyLabel })
      .in("id", ids)
      .select("id");
    if (legacyError) throw new Error(legacyError.message);
    return (legacyData ?? []).length;
  }

  throw new Error(error.message);
}
