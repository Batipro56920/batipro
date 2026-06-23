import { Link } from "react-router-dom";
import type { CrmClientRow, CrmDataset } from "../../../services/crm.service";
import { dateOnly, entityLabel, eur, statusPill } from "../components/crmFormat";

export default function CrmInvoicesSection({ rows, clients }: { rows: CrmDataset["invoices"]; clients: Map<string, CrmClientRow> }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Factures client</h2>
          <p className="mt-1 text-sm text-slate-500">
            Ancien suivi CRM conservé en lecture. Les nouvelles factures sont générées depuis les devis des projets commerciaux.
          </p>
        </div>
        <Link
          to="/factures"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Ouvrir le suivi factures
        </Link>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        Pour facturer un client, ouvrez un projet commercial, onglet Devis, puis choisissez Acompte, Situation ou Finale. Cela conserve le lien devis, client, projet et chantier.
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>{["Numero", "Client", "Type", "Montant", "Echeance", "Statut"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3 font-semibold">{row.invoice_number ?? "A numeroter"}</td>
                <td className="px-4 py-3">{entityLabel(clients.get(row.client_id ?? ""))}</td>
                <td className="px-4 py-3">{row.type}</td>
                <td className="px-4 py-3">{eur(row.amount_ht)} HT<br /><span className="text-xs text-slate-500">{eur(row.amount_ttc)} TTC</span></td>
                <td className="px-4 py-3">{dateOnly(row.due_date)}</td>
                <td className="px-4 py-3"><span className={statusPill(row.statut)}>{row.statut}</span></td>
              </tr>
            ))}
            {!rows.length ? (
              <tr className="border-t">
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  Aucune ancienne facture CRM à afficher.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
