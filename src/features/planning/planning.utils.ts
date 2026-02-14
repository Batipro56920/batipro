export type PlanningPeriod = "week" | "2weeks" | "month";

export function parseDate(dateStr: string): Date {
  // dateStr expected YYYY-MM-DD
  return new Date(`${dateStr}T00:00:00`);
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function nextWorkingDay(date: Date) {
  let d = new Date(date);
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

export function addWorkingDays(date: Date, days: number) {
  let d = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    d = addDays(d, 1);
    if (!isWeekend(d)) remaining -= 1;
  }
  return d;
}

export function diffDays(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay() || 7; // Sunday -> 7
  d.setDate(d.getDate() - (day - 1));
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getPeriodRange(anchor: Date, period: PlanningPeriod) {
  let start = startOfWeek(anchor);
  let days = 7;
  if (period === "2weeks") {
    days = 14;
  } else if (period === "month") {
    start = startOfMonth(anchor);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    days = diffDays(start, last) + 1;
  }
  const end = addDays(start, days - 1);
  const range: Date[] = [];
  for (let i = 0; i < days; i += 1) range.push(addDays(start, i));
  return { start, end, days: range };
}

export function clampEndDate(start: Date, end: Date) {
  return end < start ? start : end;
}

export type DependencyRow = {
  predecessor_task_id: string;
  successor_task_id: string;
  type?: string | null;
};

export type PlanningEntryLike = {
  id: string;
  task_id: string;
  start_date: string;
  end_date: string;
  assigned_intervenant_ids?: string[] | null;
  is_locked?: boolean | null;
};

export type ConflictInfo = {
  intervenantId: string;
  entries: string[];
};

export function checkIntervenantConflicts(entries: PlanningEntryLike[]): ConflictInfo[] {
  const byIntervenant = new Map<string, PlanningEntryLike[]>();
  for (const entry of entries) {
    const ids = entry.assigned_intervenant_ids ?? [];
    for (const intervenantId of ids) {
      const list = byIntervenant.get(intervenantId) ?? [];
      list.push(entry);
      byIntervenant.set(intervenantId, list);
    }
  }

  const conflicts: ConflictInfo[] = [];
  for (const [intervenantId, list] of byIntervenant.entries()) {
    const sorted = list.slice().sort((a, b) => a.start_date.localeCompare(b.start_date));
    const conflictingIds = new Set<string>();
    for (let i = 0; i < sorted.length; i += 1) {
      const a = sorted[i];
      const aStart = parseDate(a.start_date);
      const aEnd = parseDate(a.end_date);
      for (let j = i + 1; j < sorted.length; j += 1) {
        const b = sorted[j];
        const bStart = parseDate(b.start_date);
        const bEnd = parseDate(b.end_date);
        if (aStart < bEnd && aEnd > bStart) {
          conflictingIds.add(a.id);
          conflictingIds.add(b.id);
        }
      }
    }
    if (conflictingIds.size) {
      conflicts.push({ intervenantId, entries: Array.from(conflictingIds) });
    }
  }
  return conflicts;
}

export function checkDependencyViolations(entries: PlanningEntryLike[], deps: DependencyRow[]) {
  const byTask = new Map<string, PlanningEntryLike>();
  for (const entry of entries) byTask.set(entry.task_id, entry);

  const violatedEntries = new Set<string>();
  for (const dep of deps) {
    const predecessor = byTask.get(dep.predecessor_task_id);
    const successor = byTask.get(dep.successor_task_id);
    if (!predecessor || !successor) continue;
    const predEnd = parseDate(predecessor.end_date);
    const succStart = parseDate(successor.start_date);
    if (succStart < predEnd) {
      violatedEntries.add(successor.id);
    }
  }

  return Array.from(violatedEntries);
}

export function topologicalSort(taskIds: string[], deps: DependencyRow[]) {
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const id of taskIds) {
    graph.set(id, new Set());
    inDegree.set(id, 0);
  }

  for (const dep of deps) {
    const from = dep.predecessor_task_id;
    const to = dep.successor_task_id;
    if (!graph.has(from) || !graph.has(to)) continue;
    if (!graph.get(from)!.has(to)) {
      graph.get(from)!.add(to);
      inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length) {
    const node = queue.shift()!;
    result.push(node);
    for (const next of graph.get(node) ?? []) {
      const nextDeg = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, nextDeg);
      if (nextDeg === 0) queue.push(next);
    }
  }

  if (result.length !== taskIds.length) {
    throw new Error("Dépendance circulaire détectée.");
  }

  return result;
}

export function computeSequentialSchedule(
  entries: PlanningEntryLike[],
  deps: DependencyRow[],
  anchor: Date,
  options?: { skipWeekends?: boolean },
) {
  const taskIds = entries.map((e) => e.task_id);
  const order = topologicalSort(taskIds, deps);
  const byTask = new Map(entries.map((e) => [e.task_id, e]));
  const byId = new Map(entries.map((e) => [e.id, e]));
  const endDates = new Map<string, Date>();
  const updates: { id: string; start: string; end: string }[] = [];

  const skipWeekends = !!options?.skipWeekends;
  let cursor = startOfWeek(anchor);
  if (skipWeekends) cursor = nextWorkingDay(cursor);

  for (const taskId of order) {
    const entry = byTask.get(taskId);
    if (!entry) continue;
    const start = parseDate(entry.start_date);
    const end = parseDate(entry.end_date);
    const durationDays = Math.max(1, diffDays(start, end) + 1);

    let earliest = cursor;
    for (const dep of deps) {
      if (dep.successor_task_id !== taskId) continue;
      const predEnd = endDates.get(dep.predecessor_task_id);
      if (predEnd && predEnd > earliest) earliest = addDays(predEnd, 1);
    }

    let nextStart = entry.is_locked ? start : earliest;
    if (skipWeekends) nextStart = nextWorkingDay(nextStart);
    let nextEnd = entry.is_locked ? end : addDays(nextStart, durationDays - 1);
    if (skipWeekends && !entry.is_locked) {
      nextEnd = addWorkingDays(nextStart, durationDays - 1);
    }

    endDates.set(taskId, nextEnd);
    cursor = addDays(nextEnd, 1);
    if (skipWeekends) cursor = nextWorkingDay(cursor);

    if (nextStart.getTime() !== start.getTime() || nextEnd.getTime() !== end.getTime()) {
      updates.push({ id: entry.id, start: formatDate(nextStart), end: formatDate(nextEnd) });
      byId.set(entry.id, { ...entry, start_date: formatDate(nextStart), end_date: formatDate(nextEnd) });
    }
  }

  return { updates };
}



