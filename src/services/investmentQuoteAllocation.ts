import type { CompanyInvestmentEntry } from "./companySettings.service";

/**
 * Only explicitly selected non-duplicated business costs contribute to quotes.
 * Old investment entries without quoteAllocation are treated as cash reserves.
 *
 * This is a current-month allocation, not a forecast for a future chantier.
 */
export function investmentMonthlyQuoteOverhead(
  entries: CompanyInvestmentEntry[],
  asOf: Date = new Date(),
): number {
  const currentMonth = asOf.getUTCFullYear() * 12 + asOf.getUTCMonth();
  return entries.reduce((total, entry) => {
    if (entry.quoteAllocation !== "overhead" || entry.status !== "planned") return total;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.startDate)) return total;
    const [year, month] = entry.startDate.slice(0, 7).split("-").map(Number);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return total;
    const startMonth = year * 12 + month - 1;
    if (currentMonth < startMonth || currentMonth >= startMonth + entry.durationMonths) return total;
    const amount = Number(entry.targetAmountHt);
    return total + (Number.isFinite(amount) && amount > 0 && entry.durationMonths > 0
      ? amount / entry.durationMonths : 0);
  }, 0);
}

export function investmentQuoteHourlyRate(
  monthlyQuoteCosts: number,
  productiveEmployees: number,
  productiveHoursPerEmployeeYear: number,
): number {
  const annualHours = productiveEmployees * productiveHoursPerEmployeeYear;
  return annualHours > 0 && Number.isFinite(monthlyQuoteCosts)
    ? monthlyQuoteCosts * 12 / annualHours : 0;
}
