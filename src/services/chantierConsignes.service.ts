import { supabase } from "../lib/supabaseClient";

export type ChantierConsignePriority = "normale" | "importante" | "urgente";

export type ChantierConsigneAssignee = {
  id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
};

export type ChantierConsigneRow = {
  id: string;
  chantier_id: string;
  author_id: string | null;
  title: string;
  description: string;
  priority: ChantierConsignePriority;
  date_debut: string;
  date_fin: string | null;
  task_id: string | null;
  task_titre: string | null;
  zone_id: string | null;
  zone_nom: string | null;
  applies_to_all: boolean;
  assignee_ids: string[];
  assignees: ChantierConsigneAssignee[];
  read_intervenant_ids: string[];
  created_at: string | null;
  updated_at: string | null;
};

type BaseRow = Omit<ChantierConsigneRow, "assignee_ids" | "assignees" | "read_intervenant_ids">;

function assertRequired(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizePriority(value: unknown): ChantierConsignePriority {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "urgente") return "urgente";
  if (normalized === "importante") return "importante";
  return "normale";
}

function deriveTitleFromDescription(value: unknown): string {
  const description = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!description) return "Consigne chantier";
  if (description.length <= 72) return description;
  return `${description.slice(0, 69).trimEnd()}...`;
}

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function mapBaseRow(row: Record<string, unknown>): BaseRow {
  return {
    id: String(row.id ?? ""),
    chantier_id: String(row.chantier_id ?? ""),
    author_id: normalizeText(row.author_id),
    title: String(row.title ?? "Consigne"),
    description: String(row.description ?? ""),
    priority: normalizePriority(row.priority),
    date_debut: String(row.date_debut ?? ""),
    date_fin: normalizeText(row.date_fin),
    task_id: normalizeText(row.task_id),
    task_titre: normalizeText(row.task_titre),
    zone_id: normalizeText(row.zone_id),
    zone_nom: normalizeText(row.zone_nom),
    applies_to_all: Boolean(row.applies_to_all),
    created_at: normalizeText(row.created_at),
    updated_at: normalizeText(row.updated_at),
  };
}

async function getConsigneBaseRows(
  chantierId: string,
  options: { ids?: string[] } = {},
): Promise<BaseRow[]> {
  let query = (supabase as any)
    .from("chantier_consignes")
    .select("id, chantier_id, author_id, title, description, priority, date_debut, date_fin, task_id, zone_id, applies_to_all, created_at, updated_at")
    .eq("chantier_id", chantierId)
    .order("date_debut", { ascending: false })
    .order("created_at", { ascending: false });

  if (options.ids && options.ids.length > 0) {
    query = query.in("id", options.ids);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<Record<string, unknown>>).map(mapBaseRow);
}

async function enrichRows(baseRows: BaseRow[]): Promise<ChantierConsigneRow[]> {
  if (baseRows.length === 0) return [];

  const consigneIds = baseRows.map((row) => row.id);
  const taskIds = uniqueIds(baseRows.map((row) => row.task_id));
  const zoneIds = uniqueIds(baseRows.map((row) => row.zone_id));

  const [assignmentsRes, readsRes, tasksRes, zonesRes] = await Promise.all([
    (supabase as any)
      .from("chantier_consigne_intervenants")
      .select("consigne_id, intervenant_id")
      .in("consigne_id", consigneIds),
    (supabase as any)
      .from("chantier_consigne_reads")
      .select("consigne_id, intervenant_id, read_at")
      .in("consigne_id", consigneIds),
    taskIds.length
      ? (supabase as any).from("chantier_tasks").select("id, titre").in("id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    zoneIds.length
      ? (supabase as any).from("chantier_zones").select("id, nom").in("id", zoneIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (assignmentsRes.error) throw new Error(assignmentsRes.error.message);
  if (readsRes.error) throw new Error(readsRes.error.message);
  if (tasksRes.error) throw new Error(tasksRes.error.message);
  if (zonesRes.error) throw new Error(zonesRes.error.message);

  const assignmentRows = (assignmentsRes.data ?? []) as Array<Record<string, unknown>>;
  const assigneeIds = uniqueIds(assignmentRows.map((row) => normalizeText(row.intervenant_id)));

  let intervenantsData: Array<Record<string, unknown>> = [];
  if (assigneeIds.length > 0) {
    const intervenantsFetch = await (supabase as any)
      .from("intervenants")
      .select("id, nom, email, telephone")
      .in("id", assigneeIds);
    if (intervenantsFetch.error) throw new Error(intervenantsFetch.error.message);
    intervenantsData = (intervenantsFetch.data ?? []) as Array<Record<string, unknown>>;
  }

  const taskTitleById = new Map<string, string>();
  for (const row of ((tasksRes.data ?? []) as Array<Record<string, unknown>>)) {
    taskTitleById.set(String(row.id ?? ""), String(row.titre ?? ""));
  }

  const zoneNameById = new Map<string, string>();
  for (const row of ((zonesRes.data ?? []) as Array<Record<string, unknown>>)) {
    zoneNameById.set(String(row.id ?? ""), String(row.nom ?? ""));
  }

  const intervenantById = new Map<string, ChantierConsigneAssignee>();
  for (const row of intervenantsData) {
    intervenantById.set(String(row.id ?? ""), {
      id: String(row.id ?? ""),
      nom: String(row.nom ?? "Intervenant"),
      email: normalizeText(row.email),
      telephone: normalizeText(row.telephone),
    });
  }

  const assigneeIdsByConsigne = new Map<string, string[]>();
  for (const row of assignmentRows) {
    const consigneId = String(row.consigne_id ?? "");
    const intervenantId = String(row.intervenant_id ?? "");
    if (!assigneeIdsByConsigne.has(consigneId)) assigneeIdsByConsigne.set(consigneId, []);
    assigneeIdsByConsigne.get(consigneId)?.push(intervenantId);
  }

  const readIdsByConsigne = new Map<string, string[]>();
  for (const row of ((readsRes.data ?? []) as Array<Record<string, unknown>>)) {
    const consigneId = String(row.consigne_id ?? "");
    const intervenantId = String(row.intervenant_id ?? "");
    if (!readIdsByConsigne.has(consigneId)) readIdsByConsigne.set(consigneId, []);
    readIdsByConsigne.get(consigneId)?.push(intervenantId);
  }

  return baseRows.map((row) => {
    const assignee_ids = uniqueIds(assigneeIdsByConsigne.get(row.id) ?? []);
    return {
      ...row,
      task_titre: row.task_titre ?? (row.task_id ? taskTitleById.get(row.task_id) ?? null : null),
      zone_nom: row.zone_nom ?? (row.zone_id ? zoneNameById.get(row.zone_id) ?? null : null),
      assignee_ids,
      assignees: assignee_ids.map((intervenantId) => intervenantById.get(intervenantId)).filter(Boolean) as ChantierConsigneAssignee[],
      read_intervenant_ids: uniqueIds(readIdsByConsigne.get(row.id) ?? []),
    };
  });
}

async function getConsigneById(chantierId: string, consigneId: string): Promise<ChantierConsigneRow> {
  const rows = await getConsigneBaseRows(chantierId, { ids: [consigneId] });
  const enriched = await enrichRows(rows);
  const row = enriched.find((item) => item.id === consigneId);
  if (!row) throw new Error("Consigne introuvable.");
  return row;
}

export async function listChantierConsignesByChantierId(chantierId: string): Promise<ChantierConsigneRow[]> {
  assertRequired(Boolean(chantierId), "chantierId manquant.");
  const rows = await getConsigneBaseRows(chantierId);
  return enrichRows(rows);
}

export async function createChantierConsigne(input: {
  chantier_id: string;
  description: string;
  priority?: ChantierConsignePriority;
  title?: string;
  date_debut?: string;
  date_fin?: string | null;
  task_id?: string | null;
  zone_id?: string | null;
  applies_to_all: boolean;
  intervenant_ids?: string[];
}): Promise<ChantierConsigneRow> {
  const chantier_id = String(input.chantier_id ?? "").trim();
  const description = String(input.description ?? "").trim();
  const title = String(input.title ?? "").trim() || deriveTitleFromDescription(description);
  const date_debut = String(input.date_debut ?? "").trim();
  const date_fin = normalizeText(input.date_fin);
  const task_id = normalizeText(input.task_id);
  const zone_id = normalizeText(input.zone_id);
  const applies_to_all = Boolean(input.applies_to_all);
  const intervenant_ids = uniqueIds(input.intervenant_ids ?? []);

  assertRequired(Boolean(chantier_id), "chantier_id obligatoire.");
  assertRequired(Boolean(description), "Description obligatoire.");
  if (!applies_to_all) {
    assertRequired(intervenant_ids.length > 0, "Choisir au moins un intervenant.");
  }

  const insertPayload: Record<string, unknown> = {
    chantier_id,
    title,
    description,
    priority: normalizePriority(input.priority),
    date_fin,
    task_id,
    zone_id,
    applies_to_all,
  };
  if (date_debut) {
    insertPayload.date_debut = date_debut;
  }

  const { data, error } = await (supabase as any)
    .from("chantier_consignes")
    .insert(insertPayload)
    .select("id, chantier_id")
    .single();

  if (error) throw new Error(error.message);

  const consigneId = String(data?.id ?? "");
  if (!consigneId) throw new Error("Creation consigne impossible.");

  if (!applies_to_all && intervenant_ids.length > 0) {
    const { error: assignmentsError } = await (supabase as any)
      .from("chantier_consigne_intervenants")
      .insert(intervenant_ids.map((intervenant_id) => ({ consigne_id: consigneId, intervenant_id })));
    if (assignmentsError) throw new Error(assignmentsError.message);
  }

  return getConsigneById(chantier_id, consigneId);
}

export async function updateChantierConsigne(
  id: string,
  patch: Partial<{
    chantier_id: string;
    title: string;
    description: string;
    priority: ChantierConsignePriority;
    date_debut: string;
    date_fin: string | null;
    task_id: string | null;
    zone_id: string | null;
    applies_to_all: boolean;
    intervenant_ids: string[];
  }>,
): Promise<ChantierConsigneRow> {
  const consigneId = String(id ?? "").trim();
  assertRequired(Boolean(consigneId), "id manquant.");

  const { data: existing, error: existingError } = await (supabase as any)
    .from("chantier_consignes")
    .select("id, chantier_id, applies_to_all")
    .eq("id", consigneId)
    .single();

  if (existingError) throw new Error(existingError.message);

  const chantier_id = String(patch.chantier_id ?? existing?.chantier_id ?? "").trim();
  assertRequired(Boolean(chantier_id), "chantier_id obligatoire.");

  const updatePayload: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    assertRequired(Boolean(String(patch.title).trim()), "Titre obligatoire.");
    updatePayload.title = String(patch.title).trim();
  }
  if (patch.description !== undefined) {
    const description = String(patch.description).trim();
    assertRequired(Boolean(description), "Description obligatoire.");
    updatePayload.description = description;
    if (patch.title === undefined) {
      updatePayload.title = deriveTitleFromDescription(description);
    }
  }
  if (patch.priority !== undefined) updatePayload.priority = normalizePriority(patch.priority);
  if (patch.date_debut !== undefined) {
    const date_debut = String(patch.date_debut).trim();
    if (date_debut) {
      updatePayload.date_debut = date_debut;
    }
  }
  if (patch.date_fin !== undefined) updatePayload.date_fin = normalizeText(patch.date_fin);
  if (patch.task_id !== undefined) updatePayload.task_id = normalizeText(patch.task_id);
  if (patch.zone_id !== undefined) updatePayload.zone_id = normalizeText(patch.zone_id);
  if (patch.applies_to_all !== undefined) updatePayload.applies_to_all = Boolean(patch.applies_to_all);

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await (supabase as any).from("chantier_consignes").update(updatePayload).eq("id", consigneId);
    if (error) throw new Error(error.message);
  }

  if (patch.intervenant_ids !== undefined || patch.applies_to_all !== undefined) {
    const applies_to_all = patch.applies_to_all !== undefined ? Boolean(patch.applies_to_all) : Boolean(existing?.applies_to_all);
    const intervenant_ids = uniqueIds(patch.intervenant_ids ?? []);

    await (supabase as any).from("chantier_consigne_intervenants").delete().eq("consigne_id", consigneId);

    if (!applies_to_all) {
      assertRequired(intervenant_ids.length > 0, "Choisir au moins un intervenant.");
      const { error: insertError } = await (supabase as any)
        .from("chantier_consigne_intervenants")
        .insert(intervenant_ids.map((intervenant_id) => ({ consigne_id: consigneId, intervenant_id })));
      if (insertError) throw new Error(insertError.message);
    }
  }

  return getConsigneById(chantier_id, consigneId);
}

export async function deleteChantierConsigne(id: string): Promise<void> {
  const consigneId = String(id ?? "").trim();
  assertRequired(Boolean(consigneId), "id manquant.");

  const { error } = await (supabase as any).from("chantier_consignes").delete().eq("id", consigneId);
  if (error) throw new Error(error.message);
}
