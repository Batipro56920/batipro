import { supabase } from "../lib/supabaseClient";

export type TaskLaborObservation = {
  templateId: string;
  taskCount: number;
  totalHours: number;
  executedQuantity: number;
  measuredHoursPerUnit: number | null;
  excludedTasks: number;
};

type TaskRow = { id: string };
type TimeRow = { task_id: string | null; duration_hours: number | null; quantite_realisee: number | null };

export async function loadTaskLaborObservation(templateId: string): Promise<TaskLaborObservation> {
  const empty: TaskLaborObservation = {
    templateId, taskCount: 0, totalHours: 0, executedQuantity: 0,
    measuredHoursPerUnit: null, excludedTasks: 0,
  };
  if (!templateId) return empty;
  const { data: taskData, error: tasksError } = await supabase.from("chantier_tasks")
    .select("id")
    .eq("task_template_id", templateId)
    .limit(1000);
  if (tasksError) throw tasksError;
  const taskIds = (taskData ?? []).map((row: TaskRow) => row.id);
  if (!taskIds.length) return empty;
  const { data: entries, error: timeError } = await supabase.from("chantier_time_entries" as never)
    .select("task_id,duration_hours,quantite_realisee")
    .in("task_id", taskIds);
  if (timeError) throw timeError;
  const byTask = new Map<string, TimeRow[]>();
  for (const row of (entries ?? []) as TimeRow[]) {
    if (!row.task_id) continue;
    byTask.set(row.task_id, [...(byTask.get(row.task_id) ?? []), row]);
  }
  let taskCount = 0;
  let totalHours = 0;
  let executedQuantity = 0;
  let excludedTasks = 0;
  for (const id of taskIds) {
    const rows = byTask.get(id) ?? [];
    if (!rows.length) continue;
    // A task is only usable when all its time entries include positive work
    // and a measurable executed quantity. Never divide by a sold quantity.
    if (rows.some((row) => !(Number(row.duration_hours) > 0) || !(Number(row.quantite_realisee) > 0))) {
      excludedTasks += 1;
      continue;
    }
    taskCount += 1;
    totalHours += rows.reduce((sum, row) => sum + Number(row.duration_hours), 0);
    executedQuantity += rows.reduce((sum, row) => sum + Number(row.quantite_realisee), 0);
  }
  return {
    templateId, taskCount, totalHours, executedQuantity, excludedTasks,
    measuredHoursPerUnit: executedQuantity > 0 ? totalHours / executedQuantity : null,
  };
}
