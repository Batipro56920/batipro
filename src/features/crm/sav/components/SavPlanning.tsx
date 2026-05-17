import type { SavWithContext } from "../types";
import { dateOnly } from "../../components/crmFormat";

export function SavPlanning({ rows, onSelect }: { rows: SavWithContext[]; onSelect: (row: SavWithContext) => void }) {
  const planned = [...rows].sort((a, b) => String(a.planned_at ?? a.created_at).localeCompare(String(b.planned_at ?? b.created_at)));
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Planning</div>
        <h3 className="mt-1 text-lg font-semibold text-slate-950">Interventions SAV</h3>
      </div>
      <div className="space-y-2">
        {planned.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Aucune intervention planifiée.</div> : planned.map((row) => (
          <button key={row.id} type="button" onClick={() => onSelect(row)} className="block w-full rounded-2xl border border-slate-200 p-3 text-left hover:border-blue-200 hover:bg-blue-50/30">
            <div className="flex items-start justify-between gap-3">
              <div><div className="font-semibold text-slate-950">{row.titre}</div><div className="mt-1 text-sm text-slate-500">{row.clientLabel} · {row.chantierLabel}</div></div>
              <div className="text-sm font-medium text-slate-700">{dateOnly(row.planned_at ?? row.created_at)}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
