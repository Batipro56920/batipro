import { supabase } from "../lib/supabaseClient";

export type TaskTemplateRow = {
  id: string;
  titre: string;
  lot: string | null;
  unite: string | null;
  quantite_defaut: number | null;
  temps_prevu_par_unite_h: number | null;
  remarques: string | null;
  description_technique: string | null;
  caracteristiques: string[];
  cout_reference_unitaire_ht: number | null;
  created_at: string;
  updated_at: string;
};

export type TaskTemplateInput = {
  titre: string;
  lot?: string | null;
  unite?: string | null;
  quantite_defaut?: number | null;
  temps_prevu_par_unite_h?: number | null;
  remarques?: string | null;
  description_technique?: string | null;
  caracteristiques?: string[];
  cout_reference_unitaire_ht?: number | null;
};

const SELECT_V2 = [
  "id",
  "titre",
  "lot",
  "unite",
  "quantite_defaut",
  "temps_prevu_par_unite_h",
  "remarques",
  "description_technique",
  "caracteristiques",
  "cout_reference_unitaire_ht",
  "created_at",
  "updated_at",
].join(", ");

const SELECT_LEGACY = [
  "id",
  "titre",
  "lot",
  "unite",
  "quantite_defaut",
  "temps_prevu_par_unite_h",
  "remarques",
  "created_at",
  "updated_at",
].join(", ");

let supportsV2Columns: boolean | null = null;

function isMissingTableError(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    (msg.includes("relation") && msg.includes("task_templates")) ||
    (msg.includes("schema cache") && msg.includes("task_templates")) ||
    msg.includes("does not exist")
  );
}

function isMissingV2ColumnsError(error: { code?: string; message?: string } | null): boolean {
  const code = String(error?.code ?? "");
  const msg = String(error?.message ?? "").toLowerCase();
  if (code === "42703") return true;
  return (
    msg.includes("task_templates") &&
    (msg.includes("description_technique") ||
      msg.includes("caracteristiques") ||
      msg.includes("cout_reference_unitaire_ht") ||
      msg.includes("schema cache") ||
      msg.includes("could not find"))
  );
}

function normalizeCaracteristiques(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => String(value ?? "").trim())
    .filter((value) => value.length > 0);
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizeRow(row: any): TaskTemplateRow {
  return {
    id: String(row?.id ?? ""),
    titre: String(row?.titre ?? "").trim(),
    lot: row?.lot ?? null,
    unite: row?.unite ?? null,
    quantite_defaut: normalizeNumber(row?.quantite_defaut),
    temps_prevu_par_unite_h: normalizeNumber(row?.temps_prevu_par_unite_h),
    remarques: row?.remarques ?? null,
    description_technique: row?.description_technique ?? null,
    caracteristiques: normalizeCaracteristiques(row?.caracteristiques),
    cout_reference_unitaire_ht: normalizeNumber(row?.cout_reference_unitaire_ht),
    created_at: String(row?.created_at ?? ""),
    updated_at: String(row?.updated_at ?? ""),
  };
}

function normalizeInput(input: TaskTemplateInput) {
  const titre = String(input.titre ?? "").trim();
  if (!titre) throw new Error("Le titre est obligatoire.");

  const quantiteDefaut = normalizeNumber(input.quantite_defaut);
  const tempsPrevuParUnite = normalizeNumber(input.temps_prevu_par_unite_h);
  const coutReference = normalizeNumber(input.cout_reference_unitaire_ht);

  if (input.quantite_defaut !== null && input.quantite_defaut !== undefined && quantiteDefaut === null) {
    throw new Error("Quantité défaut invalide.");
  }
  if (
    input.temps_prevu_par_unite_h !== null &&
    input.temps_prevu_par_unite_h !== undefined &&
    tempsPrevuParUnite === null
  ) {
    throw new Error("Temps par unité invalide.");
  }
  if (
    input.cout_reference_unitaire_ht !== null &&
    input.cout_reference_unitaire_ht !== undefined &&
    coutReference === null
  ) {
    throw new Error("Coût de référence invalide.");
  }

  return {
    titre,
    lot: String(input.lot ?? "").trim() || null,
    unite: String(input.unite ?? "").trim() || null,
    quantite_defaut: quantiteDefaut,
    temps_prevu_par_unite_h: tempsPrevuParUnite,
    remarques: String(input.remarques ?? "").trim() || null,
    description_technique: String(input.description_technique ?? "").trim() || null,
    caracteristiques: normalizeCaracteristiques(input.caracteristiques),
    cout_reference_unitaire_ht: coutReference,
  };
}

function stripV2Columns<T extends Record<string, unknown>>(payload: T): T {
  const next = { ...payload };
  delete (next as Record<string, unknown>).description_technique;
  delete (next as Record<string, unknown>).caracteristiques;
  delete (next as Record<string, unknown>).cout_reference_unitaire_ht;
  return next;
}

async function fetchSingle(id: string): Promise<TaskTemplateRow> {
  const { data, error } = await supabase
    .from("task_templates")
    .select(supportsV2Columns === false ? SELECT_LEGACY : SELECT_V2)
    .eq("id", id)
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error("Table task_templates introuvable. Appliquez les migrations Supabase.");
    }
    if (supportsV2Columns !== false && isMissingV2ColumnsError(error)) {
      supportsV2Columns = false;
      const fallback = await supabase
        .from("task_templates")
        .select(SELECT_LEGACY)
        .eq("id", id)
        .single();
      if (fallback.error) throw new Error(fallback.error.message);
      return normalizeRow(fallback.data);
    }
    throw new Error(error.message);
  }

  if (supportsV2Columns !== false) supportsV2Columns = true;
  return normalizeRow(data);
}

export async function list(): Promise<TaskTemplateRow[]> {
  const { data, error } = await supabase
    .from("task_templates")
    .select(supportsV2Columns === false ? SELECT_LEGACY : SELECT_V2)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error)) return [];
    if (supportsV2Columns !== false && isMissingV2ColumnsError(error)) {
      supportsV2Columns = false;
      const fallback = await supabase
        .from("task_templates")
        .select(SELECT_LEGACY)
        .order("updated_at", { ascending: false });
      if (fallback.error) {
        if (isMissingTableError(fallback.error)) return [];
        throw new Error(fallback.error.message);
      }
      return (fallback.data ?? []).map(normalizeRow);
    }
    throw new Error(error.message);
  }

  if (supportsV2Columns !== false) supportsV2Columns = true;
  return (data ?? []).map(normalizeRow);
}

export async function create(input: TaskTemplateInput): Promise<TaskTemplateRow> {
  const payload = normalizeInput(input);
  const { data, error } = await supabase
    .from("task_templates")
    .insert(supportsV2Columns === false ? stripV2Columns(payload) : payload)
    .select(supportsV2Columns === false ? SELECT_LEGACY : SELECT_V2)
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error("Table task_templates introuvable. Appliquez les migrations Supabase.");
    }
    if (supportsV2Columns !== false && isMissingV2ColumnsError(error)) {
      supportsV2Columns = false;
      const retry = await supabase
        .from("task_templates")
        .insert(stripV2Columns(payload))
        .select(SELECT_LEGACY)
        .single();
      if (retry.error) throw new Error(retry.error.message);
      return normalizeRow(retry.data);
    }
    throw new Error(error.message);
  }

  if (supportsV2Columns !== false) supportsV2Columns = true;
  return normalizeRow(data);
}

export async function update(id: string, input: TaskTemplateInput): Promise<TaskTemplateRow> {
  if (!id) throw new Error("id template manquant.");
  const payload = normalizeInput(input);
  const { data, error } = await supabase
    .from("task_templates")
    .update(supportsV2Columns === false ? stripV2Columns(payload) : payload)
    .eq("id", id)
    .select(supportsV2Columns === false ? SELECT_LEGACY : SELECT_V2)
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error("Table task_templates introuvable. Appliquez les migrations Supabase.");
    }
    if (supportsV2Columns !== false && isMissingV2ColumnsError(error)) {
      supportsV2Columns = false;
      const retry = await supabase
        .from("task_templates")
        .update(stripV2Columns(payload))
        .eq("id", id)
        .select(SELECT_LEGACY)
        .single();
      if (retry.error) throw new Error(retry.error.message);
      return normalizeRow(retry.data);
    }
    throw new Error(error.message);
  }

  if (supportsV2Columns !== false) supportsV2Columns = true;
  return normalizeRow(data);
}

export async function remove(id: string): Promise<void> {
  if (!id) throw new Error("id template manquant.");
  const { error } = await supabase.from("task_templates").delete().eq("id", id);
  if (error) {
    if (isMissingTableError(error)) {
      throw new Error("Table task_templates introuvable. Appliquez les migrations Supabase.");
    }
    throw new Error(error.message);
  }
}

export async function duplicate(id: string): Promise<TaskTemplateRow> {
  const source = await fetchSingle(id);
  return create({
    titre: `${source.titre} (copie)`,
    lot: source.lot,
    unite: source.unite,
    quantite_defaut: source.quantite_defaut,
    temps_prevu_par_unite_h: source.temps_prevu_par_unite_h,
    remarques: source.remarques,
    description_technique: source.description_technique,
    caracteristiques: source.caracteristiques,
    cout_reference_unitaire_ht: source.cout_reference_unitaire_ht,
  });
}
