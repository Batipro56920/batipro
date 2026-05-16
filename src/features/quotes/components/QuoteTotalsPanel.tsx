import { useQuoteStore, useQuoteTotals } from "../store/quoteStore";

function money(value: number) {
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function QuoteTotalsPanel() {
  const totals = useQuoteTotals();
  const depositPercent = useQuoteStore((state) => state.draft.depositPercent);
  const depositAmount = totals.totalTtc * (Math.max(0, depositPercent) / 100);
  return (
    <aside className="h-full border-l bg-white p-4">
      <h2 className="font-semibold text-slate-950">Totaux</h2>
      <div className="mt-4 space-y-3 text-sm">
        <Row label="Total net HT" value={money(totals.totalHt)} />
        <Row label="TVA" value={money(totals.totalVat)} />
        <Row label="Total TTC" value={money(totals.totalTtc)} strong />
        <Row label={`Acompte ${depositPercent}%`} value={money(depositAmount)} />
        <Row label="Reste a facturer" value={money(totals.totalTtc - depositAmount)} />
        <Row label="Marge brute" value={money(totals.marginHt)} />
        <Row label="Taux marge" value={`${totals.marginRate}%`} />
      </div>
      <div className="mt-5 border-t pt-4">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ventilation TVA</div>
        <div className="mt-2 space-y-2">
          {totals.vatBreakdown.map((row) => (
            <div key={row.rate} className="rounded-xl bg-slate-50 p-3 text-sm">
              <Row label={`${row.rate}%`} value={money(row.vatAmount)} />
              <div className="text-xs text-slate-500">Base {money(row.baseHt)}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={["flex justify-between gap-3", strong ? "font-semibold text-slate-950" : "text-slate-600"].join(" ")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
