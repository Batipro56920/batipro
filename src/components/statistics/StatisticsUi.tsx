import type { ReactNode } from "react";
import type {
  StatisticsDefinition,
  StatisticsDistributionRow,
  StatisticsDriftRow,
  StatisticsMetric,
  StatisticsTaskFrequencyRow,
} from "../../lib/statistiques";

export function formatStatValue(locale: string, value: number | null, unit?: string) {
  if (value === null || Number.isNaN(value)) return "Non disponible";
  const decimals = Math.abs(value) >= 100 || Number.isInteger(value) ? 0 : 1;
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals === 0 ? 0 : 1,
  }).format(value)}${unit ? ` ${unit}` : ""}`;
}

export function StatisticsSectionCard({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        {eyebrow ? <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">{eyebrow}</div> : null}
        <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function StatisticsMetricCard({ locale, metric }: { locale: string; metric: StatisticsMetric }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{metric.label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-950">{formatStatValue(locale, metric.value, metric.unit)}</div>
      {metric.help ? <div className="mt-1 text-sm text-slate-500">{metric.help}</div> : null}
    </div>
  );
}

export function StatisticsSimpleTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">{empty}</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 text-left font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-slate-200 align-top">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 text-slate-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatisticsDistributionList({
  locale,
  rows,
  unit,
  empty,
}: {
  locale: string;
  rows: StatisticsDistributionRow[];
  unit?: string;
  empty: string;
}) {
  if (rows.length === 0) {
    return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">{empty}</div>;
  }

  const max = Math.max(...rows.map((row) => Number(row.value ?? 0)), 1);
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const value = Number(row.value ?? 0);
        return (
          <div key={row.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-slate-900">{row.label}</div>
                {row.secondary ? <div className="mt-1 text-xs text-slate-500">{row.secondary}</div> : null}
              </div>
              <div className="text-sm font-semibold text-slate-700">{formatStatValue(locale, row.value, unit)}</div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StatisticsDriftTable({ locale, rows, empty }: { locale: string; rows: StatisticsDriftRow[]; empty: string }) {
  return (
    <StatisticsSimpleTable
      headers={["Élément", "Chantier", "Prévu", "Réel", "Écart", "Dérive %"]}
      rows={rows.map((row) => [
        <div className="min-w-[14rem]">
          <div className="font-medium text-slate-900">{row.label}</div>
        </div>,
        row.chantierName,
        formatStatValue(locale, row.plannedHours, "h"),
        formatStatValue(locale, row.actualHours, "h"),
        <span className={(row.driftHours ?? 0) > 0 ? "font-medium text-red-700" : "text-slate-700"}>{formatStatValue(locale, row.driftHours, "h")}</span>,
        <span className={(row.driftPercent ?? 0) > 0 ? "font-medium text-red-700" : "text-slate-700"}>{formatStatValue(locale, row.driftPercent, "%")}</span>,
      ])}
      empty={empty}
    />
  );
}

export function StatisticsTaskFrequencyTable({
  locale,
  rows,
  empty,
}: {
  locale: string;
  rows: StatisticsTaskFrequencyRow[];
  empty: string;
}) {
  return (
    <StatisticsSimpleTable
      headers={["Tâche / famille", "Occurrences", "Temps moyen", "Temps total", "Qté totale", "Lot"]}
      rows={rows.map((row) => [
        <div className="min-w-[14rem]">
          <div className="font-medium text-slate-900">{row.label}</div>
          <div className="mt-1 text-xs text-slate-500">{row.family}</div>
        </div>,
        row.count,
        <div>
          <div>{formatStatValue(locale, row.averageHours, "h")}</div>
          {row.averageHoursPerUnit !== null && row.unit ? <div className="text-xs text-slate-500">{formatStatValue(locale, row.averageHoursPerUnit, `h/${row.unit}`)}</div> : null}
        </div>,
        formatStatValue(locale, row.totalHours, "h"),
        row.totalQuantity !== null ? formatStatValue(locale, row.totalQuantity, row.unit ?? undefined) : "Non disponible",
        row.lot,
      ])}
      empty={empty}
    />
  );
}

export function StatisticsDefinitionsTable({ definitions }: { definitions: StatisticsDefinition[] }) {
  return (
    <StatisticsSimpleTable
      headers={["Indicateur", "Source", "Formule"]}
      rows={definitions.map((definition) => [definition.label, definition.source, definition.formula])}
      empty="Aucune définition disponible."
    />
  );
}
