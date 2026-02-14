import { supabase } from "../lib/supabaseClient";

export type TaskTemplateRow = {
  id: string;
  titre: string;
  lot: string | null;
  unite: string | null;
  quantite_defaut: number | null;
  temps_prevu_par_unite_h: number | null;
  remarques: string | null;
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
};

function isMissingTableError(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    (msg.includes("relation") && msg.includes("task_templates")) ||
    (msg.includes("schema cache") && msg.includes("task_templates")) ||
    msg.includes("does not exist")
  );
}

function migrationErrorMessage() {
  return "Table task_templates introuvable. Appliquez les migrations Supabase.";
}

function normalizeInput(input: TaskTemplateInput) {
  const titre = (input.titre ?? "").trim();
  if (!titre) throw new Error("Le titre est obligatoire.");

  const quantiteDefaut =
    input.quantite_defaut === null || input.quantite_defaut === undefined
      ? null
      : Number(input.quantite_defaut);
  const tempsPrevu =
    input.temps_prevu_par_unite_h === null || input.temps_prevu_par_unite_h === undefined
      ? null
      : Number(input.temps_prevu_par_unite_h);

  if (quantiteDefaut !== null && Number.isNaN(quantiteDefaut)) {
    throw new Error("Quantité défaut invalide.");
  }
  if (tempsPrevu !== null && Number.isNaN(tempsPrevu)) {
    throw new Error("Temps/unité invalide.");
  }

  return {
    titre,
    lot: (input.lot ?? "").trim() || null,
    unite: (input.unite ?? "").trim() || null,
    quantite_defaut: quantiteDefaut,
    temps_prevu_par_unite_h: tempsPrevu,
    remarques: (input.remarques ?? "").trim() || null,
  };
}

export async function list(): Promise<TaskTemplateRow[]> {
  const { data, error } = await supabase
    .from("task_templates")
    .select("id, titre, lot, unite, quantite_defaut, temps_prevu_par_unite_h, remarques, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? []) as TaskTemplateRow[];
}

export async function create(input: TaskTemplateInput): Promise<TaskTemplateRow> {
  const payload = normalizeInput(input);
  const { data, error } = await supabase
    .from("task_templates")
    .insert(payload)
    .select("id, titre, lot, unite, quantite_defaut, temps_prevu_par_unite_h, remarques, created_at, updated_at")
    .single();

  if (error) {
    if (isMissingTableError(error)) throw new Error(migrationErrorMessage());
    throw new Error(error.message);
  }
  return data as TaskTemplateRow;
}

export async function update(id: string, input: TaskTemplateInput): Promise<TaskTemplateRow> {
  if (!id) throw new Error("id template manquant.");
  const payload = normalizeInput(input);
  const { data, error } = await supabase
    .from("task_templates")
    .update(payload)
    .eq("id", id)
    .select("id, titre, lot, unite, quantite_defaut, temps_prevu_par_unite_h, remarques, created_at, updated_at")
    .single();

  if (error) {
    if (isMissingTableError(error)) throw new Error(migrationErrorMessage());
    throw new Error(error.message);
  }
  return data as TaskTemplateRow;
}

export async function remove(id: string): Promise<void> {
  if (!id) throw new Error("id template manquant.");
  const { error } = await supabase.from("task_templates").delete().eq("id", id);
  if (error) {
    if (isMissingTableError(error)) throw new Error(migrationErrorMessage());
    throw new Error(error.message);
  }
}

export async function duplicate(id: string): Promise<TaskTemplateRow> {
  if (!id) throw new Error("id template manquant.");
  const { data: source, error: sourceError } = await supabase
    .from("task_templates")
    .select("id, titre, lot, unite, quantite_defaut, temps_prevu_par_unite_h, remarques")
    .eq("id", id)
    .single();

  if (sourceError) {
    if (isMissingTableError(sourceError)) throw new Error(migrationErrorMessage());
    throw new Error(sourceError.message);
  }
  if (!source) throw new Error("Template introuvable.");

  return create({
    titre: `${source.titre} (copie)`,
    lot: source.lot,
    unite: source.unite,
    quantite_defaut: source.quantite_defaut,
    temps_prevu_par_unite_h: source.temps_prevu_par_unite_h,
    remarques: source.remarques,
  });
}
