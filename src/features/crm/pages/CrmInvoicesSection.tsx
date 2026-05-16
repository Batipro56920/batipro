import type { CrmClientRow, CrmDataset } from "../../../services/crm.service";
import { dateOnly, entityLabel, eur, statusPill } from "../components/crmFormat";
import ListShell from "../components/ListShell";

export default function CrmInvoicesSection({ rows, clients, onCreate }: { rows: CrmDataset["invoices"]; clients: Map<string, CrmClientRow>; onCreate: () => void }) {
  return (
    <ListShell title="Factures client" actionLabel="Nouvelle facture" query="" setQuery={() => undefined} onCreate={onCreate} hideSearch>
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
          </tbody>
        </table>
      </div>
    </ListShell>
  );
}
