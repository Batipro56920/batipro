import { Mail, Phone } from "lucide-react";
import type { ClientWithMetrics } from "../types";
import { eur } from "../../components/crmFormat";

export function ClientsCards({ rows, onSelect }: { rows: ClientWithMetrics[]; onSelect: (row: ClientWithMetrics) => void }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <article key={row.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
          <button type="button" onClick={() => onSelect(row)} className="block w-full text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-slate-950">{row.label}</h3>
                <p className="mt-1 truncate text-xs text-slate-500">{row.type} · {row.ville ?? "Ville non renseignée"}</p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${row.archived_at ? "border-slate-200 bg-slate-50 text-slate-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                {row.archived_at ? "Archivé" : "Actif"}
              </span>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{row.email ?? "—"}</div>
              <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{row.mobile ?? row.telephone ?? "—"}</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 p-2">Devis <span className="font-semibold text-slate-950">{row.quotesCount}</span></div>
              <div className="rounded-xl bg-slate-50 p-2">Chantiers <span className="font-semibold text-slate-950">{row.totalChantiers}</span></div>
              <div className="rounded-xl bg-slate-50 p-2">SAV <span className="font-semibold text-slate-950">{row.openSav}</span></div>
              <div className="rounded-xl bg-slate-50 p-2">Factures <span className="font-semibold text-slate-950">{row.pendingInvoices}</span></div>
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-xs text-slate-500">CA total</div>
              <div className="mt-1 font-semibold text-slate-950">{eur(row.totalRevenue)}</div>
            </div>
          </button>
        </article>
      ))}
    </section>
  );
}
