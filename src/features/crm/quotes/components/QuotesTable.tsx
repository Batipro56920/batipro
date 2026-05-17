import { Link } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import type { QuoteActionHandlers, QuoteWithParty } from "../types";
import { dateOnly, eur } from "../../components/crmFormat";
import { QuoteStatusChip } from "./QuoteStatusChip";

function signatureLabel(value: string) {
  if (value === "attente_signature") return "Attente signature";
  if (value === "signe" || value === "signé") return "Signé";
  if (value === "refuse") return "Refusé";
  return value || "—";
}

export function QuotesTable({
  rows,
  actions,
  onSelect,
}: {
  rows: QuoteWithParty[];
  actions: QuoteActionHandlers;
  onSelect: (row: QuoteWithParty) => void;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <tr>
              {["N°", "Client", "Projet", "Montant", "Validité", "Statut", "Signature", "Commercial", "Actions"].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => onSelect(row)} className="group cursor-pointer border-b border-slate-100 align-top transition hover:bg-blue-50/30">
                <td className="px-4 py-3 font-semibold text-slate-950">{row.quote_number}</td>
                <td className="px-4 py-3 text-slate-700">{row.partyLabel}</td>
                <td className="px-4 py-3">
                  <div className="line-clamp-2 max-w-xs font-medium text-slate-800">{row.description ?? row.lot ?? "Projet à compléter"}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-950">{eur(row.montant_ht)} HT</div>
                  <div className="mt-1 text-xs text-slate-500">{eur(row.montant_ttc)} TTC</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{dateOnly(row.valid_until)}</td>
                <td className="px-4 py-3"><QuoteStatusChip status={row.statut} /></td>
                <td className="px-4 py-3 text-slate-600">{signatureLabel(row.signature_status)}</td>
                <td className="px-4 py-3 text-slate-600">—</td>
                <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                  <div className="flex flex-wrap gap-1">
                    <Link to={`/crm/devis/${row.id}/edit`} className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100">Éditer</Link>
                    <button type="button" onClick={() => actions.onStatus(row, "envoye")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50">Envoyer</button>
                    <button type="button" onClick={() => actions.onStatus(row, "relance_1")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50">Relancer</button>
                    <details className="relative">
                      <summary className="flex cursor-pointer list-none items-center rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-950/10">
                        <button type="button" onClick={() => actions.onPdf(row)} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50">PDF</button>
                        <button type="button" onClick={() => actions.onStatus(row, "accepte")} className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50">Accepter</button>
                        <button type="button" onClick={() => actions.onStatus(row, "refuse")} className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50">Refuser</button>
                        <button type="button" onClick={() => actions.onTransform(row)} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50">Transformer chantier</button>
                        <button type="button" disabled className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-400" title="Duplication à finaliser">Dupliquer</button>
                        <button type="button" disabled className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-400" title="Suppression à sécuriser">Supprimer</button>
                      </div>
                    </details>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
        <span>{rows.length} devis</span>
        <span>Pagination avancée à connecter si volume élevé.</span>
      </div>
    </section>
  );
}
