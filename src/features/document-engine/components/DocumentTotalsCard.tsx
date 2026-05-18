import { calculateDocumentTotals } from "../application/documentCalculations";
import type { BusinessDocument, DocumentTotals } from "../domain/types";

export function DocumentTotalsCard({ document, totals = calculateDocumentTotals(document) }: { document: BusinessDocument; totals?: DocumentTotals }) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-950">Totaux</h3>
      <div className="mt-4 space-y-2 text-sm">
        <TotalLine label="Total HT" value={totals.totalHt} />
        <TotalLine label="TVA" value={totals.totalVat} />
        <TotalLine label="Total TTC" value={totals.totalTtc} strong />
        <TotalLine label="Acompte" value={totals.depositAmount} />
        <TotalLine label="Reste" value={totals.remainingAmount} />
      </div>
      <details className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-700">Ventilation TVA</summary>
        <div className="mt-3 space-y-2">
          {totals.vatBreakdown.map((entry) => (
            <div key={entry.rate} className="flex justify-between gap-3 text-slate-600">
              <span>{entry.rate}%</span>
              <span>{formatCurrency(entry.vatAmount)}</span>
            </div>
          ))}
        </div>
      </details>
    </aside>
  );
}

function TotalLine({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "text-base font-bold text-slate-950" : "text-slate-600"}`}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
