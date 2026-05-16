import type { CrmClientRow, CrmDataset } from "../../../services/crm.service";
import { dateOnly, entityLabel, statusPill } from "../components/crmFormat";
import ListShell from "../components/ListShell";

export default function CrmSavSection({ rows, clients, onCreate }: { rows: CrmDataset["sav"]; clients: Map<string, CrmClientRow>; onCreate: () => void }) {
  return (
    <ListShell title="SAV / Après chantier" actionLabel="Créer ticket SAV" query="" setQuery={() => undefined} onCreate={onCreate} hideSearch>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-3xl border bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="font-semibold">{row.titre}</div>
              <span className={statusPill(row.statut)}>{row.statut}</span>
            </div>
            <div className="mt-2 text-sm text-slate-500">{entityLabel(clients.get(row.client_id ?? ""))}</div>
            <p className="mt-3 text-sm text-slate-700">{row.description ?? "—"}</p>
            <div className="mt-3 text-xs text-slate-500">Urgence : {row.urgence} · Créé le {dateOnly(row.created_at)}</div>
          </div>
        ))}
      </div>
    </ListShell>
  );
}
