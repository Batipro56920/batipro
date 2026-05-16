import type { CrmClientRow, CrmProspectRow } from "../../../services/crm.service";
import { entityLabel } from "../components/crmFormat";

export default function CrmContactsSection({ prospects, clients }: { prospects: CrmProspectRow[]; clients: CrmClientRow[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-3xl border bg-white p-5">
        <div className="font-semibold">Clients</div>
        <div className="mt-4 space-y-2">
          {clients.map((row) => <div key={row.id} className="rounded-2xl border bg-slate-50 p-3">{entityLabel(row)}<div className="text-xs text-slate-500">{row.email ?? row.telephone ?? "Sans contact"}</div></div>)}
        </div>
      </section>
      <section className="rounded-3xl border bg-white p-5">
        <div className="font-semibold">Prospects</div>
        <div className="mt-4 space-y-2">
          {prospects.map((row) => <div key={row.id} className="rounded-2xl border bg-slate-50 p-3">{entityLabel(row)}<div className="text-xs text-slate-500">{row.statut} · {row.email ?? row.telephone ?? "Sans contact"}</div></div>)}
        </div>
      </section>
    </div>
  );
}
