import type { CrmProspectRow } from "../../../services/crm.service";
import { entityLabel, eur, statusPill } from "../components/crmFormat";
import ListShell from "../components/ListShell";

export default function CrmProspectsSection({
  rows,
  query,
  setQuery,
  onCreate,
  onConvert,
  onStatus,
  onTask,
}: {
  rows: CrmProspectRow[];
  query: string;
  setQuery: (value: string) => void;
  onCreate: () => void;
  onConvert: (row: CrmProspectRow) => void;
  onStatus: (row: CrmProspectRow, status: CrmProspectRow["statut"]) => void;
  onTask: (row: CrmProspectRow) => void;
}) {
  return (
    <ListShell title="Prospects" actionLabel="Ajouter un prospect" query={query} setQuery={setQuery} onCreate={onCreate}>
      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {["Prospect", "Projet", "Budget", "Source", "Statut", "Actions"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="px-4 py-3">
                  <div className="font-semibold">{entityLabel(row)}</div>
                  <div className="text-xs text-slate-500">{row.email ?? "—"} · {row.mobile ?? row.telephone ?? "—"}</div>
                  <div className="text-xs text-slate-500">{row.adresse ?? ""} {row.ville ?? ""}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{row.type_projet ?? "—"}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-slate-500">{row.description_besoin ?? row.notes ?? ""}</div>
                </td>
                <td className="px-4 py-3">{eur(row.budget_estime)}</td>
                <td className="px-4 py-3">{row.source_acquisition ?? "—"}</td>
                <td className="px-4 py-3"><span className={statusPill(row.statut)}>{row.statut}</span></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <a href={row.telephone ? `tel:${row.telephone}` : undefined} className="rounded-xl border px-3 py-2 hover:bg-slate-50">Appeler</a>
                    <a href={row.email ? `mailto:${row.email}` : undefined} className="rounded-xl border px-3 py-2 hover:bg-slate-50">Email</a>
                    <button onClick={() => onTask(row)} className="rounded-xl border px-3 py-2 hover:bg-slate-50">Créer tâche</button>
                    <button onClick={() => onStatus(row, "devis_en_cours")} className="rounded-xl border px-3 py-2 hover:bg-slate-50">Créer devis</button>
                    <button onClick={() => onConvert(row)} className="rounded-xl border border-emerald-200 px-3 py-2 text-emerald-700 hover:bg-emerald-50">Convertir client</button>
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
