import type { CrmClientRow, CrmProspectRow, CrmQuoteRow } from "../../../services/crm.service";
import { dateOnly, entityLabel, eur, statusPill } from "../components/crmFormat";
import ListShell from "../components/ListShell";

export default function CrmQuotesSection({
  rows,
  prospectById,
  clientById,
  onCreate,
  onStatus,
  onTransform,
  onOpen,
  onPdf,
  query,
  setQuery,
}: {
  rows: CrmQuoteRow[];
  prospectById: Map<string, CrmProspectRow>;
  clientById: Map<string, CrmClientRow>;
  onCreate: () => void;
  onStatus: (row: CrmQuoteRow, status: CrmQuoteRow["statut"]) => void;
  onTransform: (row: CrmQuoteRow) => void;
  onOpen: (row: CrmQuoteRow) => void;
  onPdf: (row: CrmQuoteRow) => void;
  query: string;
  setQuery: (value: string) => void;
}) {
  const statusFilter = "tous";
  const visibleRows = rows
    .filter((row) => statusFilter === "tous" || row.statut === statusFilter)
    .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));
  const pageRows = visibleRows.slice(0, 30);
  return (
    <ListShell title="Devis CRM" actionLabel="Créer un devis" query={query} setQuery={setQuery} onCreate={onCreate}>
      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>{["N°", "Client/prospect", "Montant", "Validité", "Statut", "Signature", "Actions"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="px-4 py-3 font-semibold">{row.quote_number}</td>
                <td className="px-4 py-3">{entityLabel(clientById.get(row.client_id ?? "") ?? prospectById.get(row.prospect_id ?? ""))}</td>
                <td className="px-4 py-3">{eur(row.montant_ht)} HT<br /><span className="text-xs text-slate-500">{eur(row.montant_ttc)} TTC</span></td>
                <td className="px-4 py-3">{dateOnly(row.valid_until)}</td>
                <td className="px-4 py-3"><span className={statusPill(row.statut)}>{row.statut}</span></td>
                <td className="px-4 py-3">{row.signature_status}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => onOpen(row)} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-blue-800 hover:bg-blue-100">Chiffrage</button>
                    <button onClick={() => onPdf(row)} className="rounded-xl border px-3 py-2 hover:bg-slate-50">PDF</button>
                    <button onClick={() => onStatus(row, "envoye")} className="rounded-xl border px-3 py-2 hover:bg-slate-50">Envoyer</button>
                    <button onClick={() => onStatus(row, "relance_1")} className="rounded-xl border px-3 py-2 hover:bg-slate-50">Relancer</button>
                    <button onClick={() => onStatus(row, "accepte")} className="rounded-xl border border-emerald-200 px-3 py-2 text-emerald-700 hover:bg-emerald-50">Accepter</button>
                    <button onClick={() => onStatus(row, "refuse")} className="rounded-xl border border-red-200 px-3 py-2 text-red-700 hover:bg-red-50">Refuser</button>
                    <button onClick={() => onTransform(row)} className="rounded-xl bg-slate-900 px-3 py-2 text-white">Transformer chantier</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ListShell>
  );
}
