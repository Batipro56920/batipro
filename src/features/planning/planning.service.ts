import { supabase } from "../../lib/supabaseClient";
import {
  checkDependencyViolations as checkDependencyViolationsUtil,
  checkIntervenantConflicts as checkIntervenantConflictsUtil,
  type DependencyRow,
  type PlanningEntryLike,
} from "./planning.utils";

export type PlanningEntryRow = {
  id: string;
  chantier_id: string;
  task_id: string;
  start_date: string;
  end_date: string;
  assigned_intervenant_ids: string[] | null;
  order_index: number | null;
  is_locked: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type TaskDependencyRow = {
  id: string;
  chantier_id: string;
  predecessor_task_id: string;
  successor_task_id: string;
  type: string;
  created_at: string | null;
};

export type PlanningTaskRow = {
  id: string;
  chantier_id: string;
  titre: string;
  status: string;
  lot: string | null;
  corps_etat: string | null;
  intervenant_id: string | null;
  date_debut: string | null;
  date_fin: string | null;
};

export async function getPlanningEntries(chantierId: string): Promise<PlanningEntryRow[]> {
  if (!chantierId) throw new Error("chantierId manquant.");
  const { data, error } = await supabase
    .from("planning_entries")
    .select(
      [
        "id",
        "chantier_id",
        "task_id",
        "start_date",
        "end_date",
        "assigned_intervenant_ids",
        "order_index",
        "is_locked",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .eq("chantier_id", chantierId)
    .order("start_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PlanningEntryRow[];
}

export async function createPlanningEntry(payload: {
  chantier_id: string;
  task_id: string;
  start_date: string;
  end_date: string;
  assigned_intervenant_ids?: string[] | null;
  order_index?: number | null;
  is_locked?: boolean | null;
}): Promise<PlanningEntryRow> {
  const { data, error } = await supabase
    .from("planning_entries")
    .insert({
      ...payload,
      assigned_intervenant_ids: payload.assigned_intervenant_ids ?? null,
      order_index: payload.order_index ?? 0,
      is_locked: payload.is_locked ?? false,
    })
    .select(
      [
        "id",
        "chantier_id",
        "task_id",
        "start_date",
        "end_date",
        "assigned_intervenant_ids",
        "order_index",
        "is_locked",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Entrée planning introuvable.");
  return data as PlanningEntryRow;
}

export async function updatePlanningEntry(
  id: string,
  patch: Partial<Omit<PlanningEntryRow, "id" | "chantier_id" | "task_id" | "created_at">>,
): Promise<PlanningEntryRow> {
  if (!id) throw new Error("id manquant.");
  const { data, error } = await supabase
    .from("planning_entries")
    .update(patch)
    .eq("id", id)
    .select(
      [
        "id",
        "chantier_id",
        "task_id",
        "start_date",
        "end_date",
        "assigned_intervenant_ids",
        "order_index",
        "is_locked",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Entrée planning introuvable.");
  return data as PlanningEntryRow;
}

export async function deletePlanningEntry(id: string): Promise<void> {
  if (!id) throw new Error("id manquant.");
  const { error } = await supabase.from("planning_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getDependencies(chantierId: string): Promise<TaskDependencyRow[]> {
  if (!chantierId) throw new Error("chantierId manquant.");
  const { data, error } = await supabase
    .from("task_dependencies")
    .select(
      [
        "id",
        "chantier_id",
        "predecessor_task_id",
        "successor_task_id",
        "type",
        "created_at",
      ].join(","),
    )
    .eq("chantier_id", chantierId);

  if (error) throw new Error(error.message);
  return (data ?? []) as TaskDependencyRow[];
}

export async function createDependency(payload: {
  chantier_id: string;
  predecessor_task_id: string;
  successor_task_id: string;
  type?: string;
}): Promise<TaskDependencyRow> {
  if (!payload.chantier_id) throw new Error("chantier_id manquant.");
  if (!payload.predecessor_task_id || !payload.successor_task_id) {
    throw new Error("Dépendances invalides.");
  }

  if (payload.predecessor_task_id === payload.successor_task_id) {
    throw new Error("Une tâche ne peut pas dépendre d'elle-même.");
  }

  const { data: existingDeps, error: depsError } = await supabase
    .from("task_dependencies")
    .select("predecessor_task_id,successor_task_id")
    .eq("chantier_id", payload.chantier_id);

  if (depsError) throw new Error(depsError.message);

  const edges = (existingDeps ?? []).map((d) => ({
    from: d.predecessor_task_id as string,
    to: d.successor_task_id as string,
  }));
  edges.push({ from: payload.predecessor_task_id, to: payload.successor_task_id });

  const graph = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!graph.has(edge.from)) graph.set(edge.from, new Set());
    graph.get(edge.from)!.add(edge.to);
  }

  const hasPath = (start: string, target: string, visited = new Set<string>()): boolean => {
    if (start === target) return true;
    if (visited.has(start)) return false;
    visited.add(start);
    const nexts = graph.get(start);
    if (!nexts) return false;
    for (const next of nexts) {
      if (hasPath(next, target, visited)) return true;
    }
    return false;
  };

  if (hasPath(payload.successor_task_id, payload.predecessor_task_id)) {
    throw new Error("Dépendance circulaire détectée.");
  }

  const { data, error } = await supabase
    .from("task_dependencies")
    .insert({
      chantier_id: payload.chantier_id,
      predecessor_task_id: payload.predecessor_task_id,
      successor_task_id: payload.successor_task_id,
      type: payload.type ?? "FINISH_TO_START",
    })
    .select(
      [
        "id",
        "chantier_id",
        "predecessor_task_id",
        "successor_task_id",
        "type",
        "created_at",
      ].join(","),
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Dépendance introuvable.");
  return data as TaskDependencyRow;
}

export async function getPlanningTasks(chantierId: string): Promise<PlanningTaskRow[]> {
  if (!chantierId) throw new Error("chantierId manquant.");
  const { data, error } = await supabase
    .from("chantier_tasks")
    .select(
      [
        "id",
        "chantier_id",
        "titre",
        "status",
        "lot",
        "corps_etat",
        "intervenant_id",
        "date_debut",
        "date_fin",
      ].join(","),
    )
    .eq("chantier_id", chantierId)
    .order("ordre", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PlanningTaskRow[];
}

export function checkIntervenantConflicts(entries: PlanningEntryRow[]) {
  return checkIntervenantConflictsUtil(entries as PlanningEntryLike[]);
}

export function checkDependencyViolations(entries: PlanningEntryRow[], deps: TaskDependencyRow[]) {
  return checkDependencyViolationsUtil(entries as PlanningEntryLike[], deps as DependencyRow[]);
}
