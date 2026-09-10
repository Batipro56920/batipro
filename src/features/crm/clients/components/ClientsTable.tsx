import { Mail, Phone } from "lucide-react";
import type { ClientWithMetrics } from "../types";
import { eur } from "../../components/crmFormat";

function status(row: ClientWithMetrics) {
  return row.archived_at
    ? "border-slate-200 bg-slate-50 text-slate-600"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function ClientsTable({ rows, onSelect }: { rows: ClientWithMetrics[]; onSelect: (row: ClientWithMetrics) => void }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <tr>
              {["Client", "Type", "Contact", "Commercial", "Devis", "Chantiers", "CA", "Statut", "Actions"].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => onSelect(row)} className="group cursor-pointer border-b border-slate-100 align-top transition hover:bg-blue-50/30">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-950">{row.label}</div>
                  <div className="mt-1 text-xs text-slate-500">{row.societe ?? row.ville ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">{row.type}</td>
                <td className="px-4 py-3 text-slate-600">
                  <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{row.email ?? "—"}</div>
                  <div className="mt-1 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{row.mobile ?? row.telephone ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">—</td>
                <td className="px-4 py-3 font-medium text-slate-900">{row.quotesCount}</td>
                <td className="px-4 py-3 text-slate-700">{row.activeChantiers} actif(s) / {row.totalChantiers}</td>
                <td className="px-4 py-3 font-semibold text-slate-950">{eur(row.totalRevenue)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${status(row)}`}>{row.archived_at ? "Archivé" : "Actif"}</span>
                </td>
                <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                  {/* Une seule ligne, sans retour : sinon la colonne étroite empile les boutons et étire toute la ligne. */}
                  <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                    <a
                      href={row.mobile || row.telephone ? `tel:${row.mobile ?? row.telephone}` : undefined}
                      title="Appeler"
                      aria-label="Appeler"
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 ${row.mobile || row.telephone ? "" : "pointer-events-none opacity-40"}`}
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                    <a
                      href={row.email ? `mailto:${row.email}` : undefined}
                      title="Envoyer un email"
                      aria-label="Envoyer un email"
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 ${row.email ? "" : "pointer-events-none opacity-40"}`}
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                    <button type="button" onClick={() => onSelect(row)} className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100">Ouvrir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
        <span>{rows.length} client(s)</span>
        <span>Pagination avancée à connecter si volume élevé.</span>
      </div>
    </section>
  );
}
