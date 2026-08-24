export type FinancialPeriod = "all" | "year" | "quarter" | "month";

export const FINANCIAL_PERIOD_OPTIONS: Array<{ value: FinancialPeriod; label: string }> = [
  { value: "all", label: "Toutes les périodes" },
  { value: "year", label: "Année en cours" },
  { value: "quarter", label: "Trimestre en cours" },
  { value: "month", label: "Mois en cours" },
];

export function parseFinancialPeriod(value: string | null | undefined): FinancialPeriod {
  return FINANCIAL_PERIOD_OPTIONS.some((option) => option.value === value)
    ? (value as FinancialPeriod)
    : "all";
}

export function isInFinancialPeriod(
  value: string | null | undefined,
  period: FinancialPeriod,
  now = new Date(),
) {
  if (period === "all") return true;
  const date = parseLocalDate(value);
  if (!date) return false;

  const start = getFinancialPeriodStart(period, now);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return date >= start && date < end;
}

function getFinancialPeriodStart(period: Exclude<FinancialPeriod, "all">, now: Date) {
  if (period === "year") return new Date(now.getFullYear(), 0, 1);
  if (period === "quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), quarterStartMonth, 1);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function parseLocalDate(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}
