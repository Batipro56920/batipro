import { supabase } from "../lib/supabaseClient";

export type TaskMaterialConsumption = {
  id: string;
  chantier_task_id: string;
  material_ratio_id: string;
  intervenant_id: string;
  quantite_consommee: number;
  work_date: string;
  created_at: string | null;
};

export type NewTaskMaterialConsumption = Omit<TaskMaterialConsumption, "id" | "created_at">;

function mapConsumption(raw: Record<string, unknown>): TaskMaterialConsumption {
  return {
    id: String(raw.id ?? ""),
    chantier_task_id: String(raw.chantier_task_id ?? ""),
    material_ratio_id: String(raw.material_ratio_id ?? ""),
    intervenant_id: String(raw.intervenant_id ?? ""),
    quantite_consommee: Number(raw.quantite_consommee ?? 0),
    work_date: String(raw.work_date ?? ""),
    created_at: typeof raw.created_at === "string" ? raw.created_at : null,
  };
}

export async function listTaskMaterialConsumptions(taskIds: string[]): Promise<TaskMaterialConsumption[]> {
  const ids = [...new Set(taskIds.filter(Boolean))];
  if (!ids.length) return [];
  // The table exists in the 20260825180000 migration but has not yet been
  // included in the project's generated Database TypeScript declarations.
  const { data, error } = await supabase.from("chantier_task_material_consumptions" as never)
    .select("id,chantier_task_id,material_ratio_id,intervenant_id,quantite_consommee,work_date,created_at")
    .in("chantier_task_id", ids)
    .order("work_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapConsumption(row as Record<string, unknown>));
}

export async function createTaskMaterialConsumption(
  value: NewTaskMaterialConsumption,
  allowedMaterialRatioIds: string[],
  allowedIntervenantIds: string[],
): Promise<TaskMaterialConsumption> {
  if (!allowedMaterialRatioIds.includes(value.material_ratio_id)) throw new Error("Matériau non lié à cette tâche.");
  if (!allowedIntervenantIds.includes(value.intervenant_id)) throw new Error("Intervenant non affecté à cette tâche.");
  if (!Number.isFinite(value.quantite_consommee) || value.quantite_consommee <= 0) {
    throw new Error("La quantité consommée doit être supérieure à zéro.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.work_date)) throw new Error("Date invalide.");
  const { data, error } = await supabase.from("chantier_task_material_consumptions" as never)
    .insert(value as never)
    .select("id,chantier_task_id,material_ratio_id,intervenant_id,quantite_consommee,work_date,created_at")
    .single();
  if (error) throw error;
  return mapConsumption(data as Record<string, unknown>);
}
