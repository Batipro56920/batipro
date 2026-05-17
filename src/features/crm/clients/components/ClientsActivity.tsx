import type { ClientWithMetrics } from "../types";
import { dateOnly, eur } from "../../components/crmFormat";

export function ClientsActivity({ rows, onSelect }: { rows: ClientWithMetrics[]; onSelect: (row: ClientWithMetrics) => void }) {
  const activity = [...rows].sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""))).slice(0, 20);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Activité</div>
        <h3 className="mt-1 text-lg font-semibold text-slate-950">Dernières mises à jour client</h3>
      </div>
      <div className="space-y-2">
        {activity.map((row) => (
          <button key={row.id} type="button" onClick={() => onSelect(row)} className="block w-full rounded-2xl border border-slate-200 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-950">{row.label}</div>
                <div className="mt-1 text-sm text-slate-500">{row.totalChantiers} chantier(s) · {row.quotesCount} devis · {row.openSav} SAV</div>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>{dateOnly(row.updated_at ?? row.created_at)}</div>
                <div className="mt-1 font-semibold text-slate-700">{eur(row.totalRevenue)}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
