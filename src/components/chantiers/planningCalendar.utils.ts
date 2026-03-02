export type PlanningCalendarSettings = {
  hoursPerDay: number;
  dayCapacity: number;
  workingDays: number[];
  skipWeekends: boolean;
};

export type SplitMode = "sequential" | "same_day";

export const DAY_CODE_TO_INDEX: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

export const DAY_INDEX_TO_CODE = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export const DEFAULT_PLANNING_SETTINGS: PlanningCalendarSettings = {
  hoursPerDay: 7,
  dayCapacity: 3,
  workingDays: [1, 2, 3, 4, 5],
  skipWeekends: true,
};

export function clampDurationDays(value: number | null | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  const quarter = Math.round(parsed * 4) / 4;
  return Math.max(0.25, quarter);
}

export function parseWorkingDays(input: string[] | null | undefined, skipWeekends: boolean): number[] {
  const codes = Array.isArray(input)
    ? input
        .map((value) => DAY_CODE_TO_INDEX[String(value).trim().toUpperCase()])
        .filter((value): value is number => Number.isInteger(value))
    : [];
  if (codes.length) return [...new Set(codes)].sort((a, b) => a - b);
  return skipWeekends ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
}

export function encodeWorkingDays(input: number[]): string[] {
  return [...new Set(input)]
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    .sort((a, b) => a - b)
    .map((value) => DAY_INDEX_TO_CODE[value]);
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map((item) => Number(item));
  return new Date(year, (month || 1) - 1, day || 1);
}

export function addDays(date: Date, amount: number): Date {
  const clone = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  clone.setDate(clone.getDate() + amount);
  return clone;
}

export function addDaysToKey(dateKey: string, amount: number): string {
  return formatDateKey(addDays(parseDateKey(dateKey), amount));
}

export function compareDateKeys(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function diffCalendarDays(startDate: string, endDate: string): number {
  const start = parseDateKey(startDate).getTime();
  const end = parseDateKey(endDate).getTime();
  return Math.round((end - start) / 86400000);
}

export function startOfWeek(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return formatDateKey(addDays(date, diff));
}

export function startOfMonthGrid(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfWeek(formatDateKey(first));
}

export function isWorkingDay(dateKey: string, settings: PlanningCalendarSettings): boolean {
  const dayIndex = parseDateKey(dateKey).getDay();
  if (settings.skipWeekends && (dayIndex === 0 || dayIndex === 6)) return false;
  return settings.workingDays.includes(dayIndex);
}

export function nextPlannableDate(dateKey: string, settings: PlanningCalendarSettings): string {
  let cursor = dateKey;
  let guard = 0;
  while (!isWorkingDay(cursor, settings) && guard < 14) {
    cursor = addDaysToKey(cursor, 1);
    guard += 1;
  }
  return cursor;
}

export function getCoveredDates(startDate: string, durationDays: number, settings: PlanningCalendarSettings): string[] {
  const safeDuration = clampDurationDays(durationDays);
  const covered: string[] = [];
  let remaining = safeDuration;
  let cursor = nextPlannableDate(startDate, settings);

  while (remaining > 0) {
    covered.push(cursor);
    remaining = Math.max(0, Number((remaining - 1).toFixed(2)));
    if (remaining > 0) {
      cursor = nextPlannableDate(addDaysToKey(cursor, 1), settings);
    }
  }

  return covered;
}

export function computeEndDate(startDate: string, durationDays: number, settings: PlanningCalendarSettings): string {
  const covered = getCoveredDates(startDate, durationDays, settings);
  return covered[covered.length - 1] ?? nextPlannableDate(startDate, settings);
}

export function computePlannedHours(durationDays: number, settings: PlanningCalendarSettings): number {
  return Math.round(clampDurationDays(durationDays) * settings.hoursPerDay * 100) / 100;
}

export function distributeDayLoads(durationDays: number, startDate: string, settings: PlanningCalendarSettings): Array<{
  date: string;
  load: number;
}> {
  const safeDuration = clampDurationDays(durationDays);
  const coveredDates = getCoveredDates(startDate, safeDuration, settings);
  const loads: Array<{ date: string; load: number }> = [];
  let remaining = safeDuration;

  for (const date of coveredDates) {
    const load = Math.min(1, remaining);
    loads.push({ date, load });
    remaining = Math.max(0, Number((remaining - load).toFixed(2)));
  }

  return loads;
}

export function splitDuration(durationDays: number, parts: number): number[] {
  const count = Math.max(2, Math.trunc(parts));
  const total = clampDurationDays(durationDays);
  const base = Math.max(0.25, Math.floor((total / count) * 4) / 4);
  const values = Array.from({ length: count }, () => base);
  let consumed = values.reduce((sum, value) => sum + value, 0);
  let index = 0;

  while (consumed < total - 0.001) {
    values[index] = clampDurationDays(values[index] + 0.25);
    consumed = Number((consumed + 0.25).toFixed(2));
    index = (index + 1) % count;
  }

  return values;
}

export function buildSplitDates(
  startDate: string,
  durationDays: number,
  parts: number,
  mode: SplitMode,
  settings: PlanningCalendarSettings,
): Array<{ startDate: string; durationDays: number }> {
  const durations = splitDuration(durationDays, parts);
  const items: Array<{ startDate: string; durationDays: number }> = [];
  let cursor = nextPlannableDate(startDate, settings);

  for (const partDuration of durations) {
    items.push({ startDate: cursor, durationDays: partDuration });
    if (mode === "same_day") continue;
    const partEnd = computeEndDate(cursor, partDuration, settings);
    cursor = nextPlannableDate(addDaysToKey(partEnd, 1), settings);
  }

  return items;
}

export function statusPriority(status: string | null | undefined): number {
  const key = String(status ?? "").toUpperCase();
  if (key === "EN_COURS" || key === "DOING") return 0;
  if (key === "A_FAIRE" || key === "TODO") return 1;
  if (key === "BLOQUE" || key === "BLOCKED") return 2;
  if (key === "FAIT" || key === "DONE") return 3;
  return 4;
}
