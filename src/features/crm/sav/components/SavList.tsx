import type { SavWithContext } from "../types";
import { dateOnly } from "../../components/crmFormat";
import { SavPriorityChip, SavStatusChip } from "./SavStatusChip";

export function SavList({ rows, onSelect }: { rows: SavWithContext[]; onSelect: (row: SavWithContext) => void }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <tr>{["Ticket", "Client", "Chantier", "Sujet", "Priorité", "Statut", "Intervenant", "Date ouverture", "SLA", "Actions"].map((heading) => <th key={heading} className="px-4 py-3 text-left">{heading}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => onSelect(row)} className="group cursor-pointer border-b border-slate-100 align-top transition hover:bg-blue-50/30">
                <td className="px-4 py-3 font-semibold text-slate-950">{row.id.slice(0, 8)}</td>
                <td className="px-4 py-3 text-slate-700">{row.clientLabel}</td>
                <td className="px-4 py-3 text-slate-700">{row.chantierLabel}</td>
                <td className="px-4 py-3"><div className="font-medium text-slate-900">{row.titre}</div><div className="mt-1 line-clamp-2 max-w-xs text-xs text-slate-500">{row.description ?? "—"}</div></td>
                <td className="px-4 py-3"><SavPriorityChip priority={row.urgence} /></td>
                <td className="px-4 py-3"><SavStatusChip status={row.statut} /></td>
                <td className="px-4 py-3 text-slate-600">{row.assigned_to ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{dateOnly(row.created_at)}</td>
                <td className="px-4 py-3 text-slate-600">{row.planned_at ? `Planifié ${dateOnly(row.planned_at)}` : "À planifier"}</td>
                <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => onSelect(row)} className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100">Ouvrir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
