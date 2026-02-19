export type PlanningTaskLike = {
  id: string;
  titre: string;
  status: string | null;
  duration_days: number | null;
  order_index: number | null;
};

export type ComputedTaskWindow<T extends PlanningTaskLike = PlanningTaskLike> = {
  task: T;
  start: string;
  endExclusive: string;
  durationDays: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map((v) => Number(v));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error("Date invalide");
  }
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDateOnly(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

export function diffDays(start: string, end: string): number {
  const a = parseDateOnly(start);
  const b = parseDateOnly(end);
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export function isWeekend(value: Date): boolean {
  const day = value.getUTCDay();
  return day === 0 || day === 6;
}

export function nextBusinessDay(value: Date): Date {
  let cursor = new Date(value);
  while (isWeekend(cursor)) {
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

export function addBusinessDays(value: Date, days: number): Date {
  let cursor = new Date(value);
  let remaining = Math.max(0, days);
  while (remaining > 0) {
    cursor = addDays(cursor, 1);
    if (!isWeekend(cursor)) {
      remaining -= 1;
    }
  }
  return cursor;
}

function safeDurationDays(raw: number | null | undefined): number {
  const n = Number(raw ?? 1);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.trunc(n));
}

function safeOrder(raw: number | null | undefined): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

export function computeLotTaskTimeline<T extends PlanningTaskLike>(
  lotStartDate: string,
  tasks: T[],
  options?: { skipWeekends?: boolean },
): ComputedTaskWindow<T>[] {
  const skipWeekends = !!options?.skipWeekends;
  const sorted = [...tasks].sort((a, b) => {
    const orderDiff = safeOrder(a.order_index) - safeOrder(b.order_index);
    if (orderDiff !== 0) return orderDiff;
    return a.titre.localeCompare(b.titre, "fr");
  });

  let cursor = parseDateOnly(lotStartDate);
  if (skipWeekends) {
    cursor = nextBusinessDay(cursor);
  }

  const windows: ComputedTaskWindow<T>[] = [];

  for (const task of sorted) {
    const durationDays = safeDurationDays(task.duration_days);
    const taskStart = new Date(cursor);
    const endExclusive = skipWeekends ? addBusinessDays(taskStart, durationDays) : addDays(taskStart, durationDays);

    windows.push({
      task,
      start: formatDateOnly(taskStart),
      endExclusive: formatDateOnly(endExclusive),
      durationDays,
    });

    cursor = new Date(endExclusive);
    if (skipWeekends) {
      cursor = nextBusinessDay(cursor);
    }
  }

  return windows;
}

export function recomputeLotEndDate(
  lotStartDate: string | null | undefined,
  tasks: PlanningTaskLike[],
  options?: { skipWeekends?: boolean },
): string | null {
  const start = String(lotStartDate ?? "").trim();
  if (!start) return null;
  const windows = computeLotTaskTimeline(start, tasks, options);
  if (!windows.length) return start;
  return windows[windows.length - 1].endExclusive;
}

export function toLotProgress(tasks: PlanningTaskLike[]): number {
  if (!tasks.length) return 0;
  const done = tasks.filter((task) => String(task.status ?? "").toUpperCase() === "FAIT").length;
  return Math.round((done / tasks.length) * 100);
}

export function pickTimelineScale(totalDays: number): "week" | "month" {
  return totalDays <= 120 ? "week" : "month";
}

export function startOfWeek(dateStr: string): string {
  const date = parseDateOnly(dateStr);
  const day = date.getUTCDay() || 7;
  return formatDateOnly(addDays(date, 1 - day));
}

export function startOfMonth(dateStr: string): string {
  const date = parseDateOnly(dateStr);
  return formatDateOnly(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
}

export function addDaysToDateString(dateStr: string, days: number): string {
  return formatDateOnly(addDays(parseDateOnly(dateStr), days));
}

export function clampRange(start: string, end: string): { start: string; end: string } {
  return diffDays(start, end) >= 0 ? { start, end } : { start, end: start };
}

