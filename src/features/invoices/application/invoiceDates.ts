export function getLocalInputDate(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

export function addLocalDays(days: number, date = new Date()) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return getLocalInputDate(nextDate);
}

export function isBeforeLocalToday(value?: string | null) {
  if (!value) return false;
  const [dateOnly] = value.split("T");
  if (!dateOnly) return false;
  return dateOnly < getLocalInputDate();
}
