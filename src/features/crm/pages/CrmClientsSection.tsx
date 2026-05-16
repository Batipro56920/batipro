import type { CrmClientRow, CrmDataset } from "../../../services/crm.service";
import { entityLabel, eur, statusPill } from "../components/crmFormat";
import ListShell from "../components/ListShell";

export default function CrmClientsSection({
  rows,
  chantiers,
  sav,
  query,
  setQuery,
  onCreate,
}: {
  rows: CrmClientRow[];
  chantiers: CrmDataset["chantiers"];
  sav: CrmDataset["sav"];
  query: string;
  setQuery: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <ListShell title="Clients" actionLabel="Ajouter un client" query={query} setQuery={setQuery} onCreate={onCreate}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-3xl border bg-white p-5">
            {(() => {
              const clientChantiers = chantiers.filter((chantier) => chantier.crm_client_id === row.id);
              const activeCount = clientChantiers.filter((chantier) => ["PREPARATION", "EN_COURS", "EN_PAUSE"].includes(chantier.status)).length;
              const doneCount = clientChantiers.filter((chantier) => chantier.status === "TERMINE").length;
              const archivedCount = clientChantiers.filter((chantier) => chantier.status === "ARCHIVE").length;
              const amount = clientChantiers.reduce((sum, chantier) => sum + Number(chantier.signed_quote_amount_ht ?? 0), 0);
              const savCount = sav.filter((ticket) => ticket.client_id === row.id).length;
              return (
                <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{entityLabel(row)}</div>
                <div className="mt-1 text-sm text-slate-500">{row.type} · {row.ville ?? "Ville non renseignée"}</div>
              </div>
              <span className={statusPill(row.archived_at ? "archive" : "actif")}>{row.archived_at ? "archivé" : "actif"}</span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <div>Email : {row.email ?? "—"}</div>
              <div>Téléphone : {row.mobile ?? row.telephone ?? "—"}</div>
              <div>Adresse : {row.adresse ?? "—"}</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 p-2">En cours : <span className="font-semibold">{activeCount}</span></div>
              <div className="rounded-xl bg-slate-50 p-2">Terminés : <span className="font-semibold">{doneCount}</span></div>
              <div className="rounded-xl bg-slate-50 p-2">Archivés : <span className="font-semibold">{archivedCount}</span></div>
              <div className="rounded-xl bg-slate-50 p-2">SAV : <span className="font-semibold">{savCount}</span></div>
            </div>
            <div className="mt-2 rounded-xl border bg-slate-50 p-2 text-xs text-slate-600">Montant total chantiers : <span className="font-semibold text-slate-950">{eur(amount)}</span></div>
                </>
              );
            })()}
          </div>
        ))}
      </div>
    </ListShell>
  );
}
