/**
 * Conflits inter-chantiers entre affectations bureau et segments chantier.
 * Fonction pure : n'écrit ni en base ni dans le planning React.
 */
export type OfficeAssignmentInterval = {
  chantier_id: string;
  intervenant_id: string;
  date_start: string;
  date_end: string;
};

export type PlanningTaskInterval = {
  chantier_id: string;
  intervenant_id: string | null;
  start_at: string | null;
  end_at: string | null;
  start_date: string | null;
  duration_days: number | null;
  status?: string | null;
};

export type CrossChantierConflict = {
  workerId: string;
  day: string;
  chantierIds: string[];
};

const SKIPPED_STATUSES = new Set(["annule", "annulé", "cancelled", "canceled", "termine", "terminé"]);

function datePart(date: string | null | undefined): string | null {
  if (!date) return null;
  const part = date.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null;
}

function plusDays(date: string, amount: number): string {
  const dateValue = new Date(date + "T12:00:00Z");
  dateValue.setUTCDate(dateValue.getUTCDate() + amount);
  return dateValue.toISOString().slice(0, 10);
}

export function taskInterval(task: PlanningTaskInterval): { start: string; end: string } | null {
  const start = datePart(task.start_date) ?? datePart(task.start_at);
  if (!start) return null;
  const duration = task.duration_days != null && Number.isFinite(task.duration_days)
    ? Math.max(1, Math.ceil(task.duration_days))
    : null;
  // The chantier calendar uses start_date + duration_days when both are available.
  const end = task.start_date && duration !== null
    ? plusDays(start, duration - 1)
    : datePart(task.end_at) ?? plusDays(start, (duration ?? 1) - 1);
  return { start, end };
}

export function detectCrossChantierConflicts(
  office: OfficeAssignmentInterval[],
  tasks: PlanningTaskInterval[],
  days: string[],
): CrossChantierConflict[] {
  const conflicts: CrossChantierConflict[] = [];
  for (const day of days) {
    const workerChantiers = new Map<string, Set<string>>();
    const include = (workerId: string, chantierId: string) => {
      const existing = workerChantiers.get(workerId) ?? new Set<string>();
      existing.add(chantierId);
      workerChantiers.set(workerId, existing);
    };
    for (const assignment of office) {
      if (assignment.date_start <= day && assignment.date_end >= day) {
        include(assignment.intervenant_id, assignment.chantier_id);
      }
    }
    for (const task of tasks) {
      if (!task.intervenant_id || SKIPPED_STATUSES.has((task.status ?? "").toLowerCase())) continue;
      const interval = taskInterval(task);
      if (interval && interval.start <= day && day <= interval.end) {
        include(task.intervenant_id, task.chantier_id);
      }
    }
    for (const [workerId, sites] of workerChantiers) {
      if (sites.size > 1) conflicts.push({ workerId, day, chantierIds: [...sites] });
    }
  }
  return conflicts;
}
