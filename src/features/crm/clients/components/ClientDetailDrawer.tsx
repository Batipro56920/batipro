import { X } from "lucide-react";
import type { ClientMetrics, ClientWithMetrics } from "../types";
import { dateOnly, eur } from "../../components/crmFormat";

export function ClientDetailDrawer({
  client,
  metrics,
  onClose,
}: {
  client: ClientWithMetrics | null;
  metrics: ClientMetrics;
  onClose: () => void;
}) {
  if (!client) return null;

  const chantiers = metrics.chantiers.filter((row) => row.crm_client_id === client.id);
  const quotes = metrics.quotes.filter((row) => row.client_id === client.id);
  const invoices = metrics.invoices.filter((row) => row.client_id === client.id);
  const sav = metrics.sav.filter((row) => row.client_id === client.id);
  const documents = metrics.documents.filter((row) => row.client_id === client.id);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/20" role="dialog" aria-modal="true">
      <aside className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Fiche client</div>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">{client.label}</h3>
              <p className="mt-1 text-sm text-slate-500">{client.type} · {client.ville ?? "Ville non renseignée"}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500">CA total</div>
              <div className="mt-1 font-semibold text-slate-950">{eur(client.totalRevenue)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500">Chantiers</div>
              <div className="mt-1 font-semibold text-slate-950">{client.totalChantiers}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500">SAV ouverts</div>
              <div className="mt-1 font-semibold text-slate-950">{client.openSav}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">Identité</h4>
            <div className="mt-3 grid gap-2 text-sm text-slate-600">
              <div>Société : {client.societe ?? "—"}</div>
              <div>Email : {client.email ?? "—"}</div>
              <div>Téléphone : {client.mobile ?? client.telephone ?? "—"}</div>
              <div>Adresse : {[client.adresse, client.code_postal, client.ville].filter(Boolean).join(" ") || "—"}</div>
              <div>Commercial : —</div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <Panel title="Devis" items={quotes.map((row) => `${row.quote_number} · ${eur(row.montant_ht)}`)} />
            <Panel title="Chantiers" items={chantiers.map((row) => `${row.nom} · ${row.status}`)} />
            <Panel title="Facturation" items={invoices.map((row) => `${row.invoice_number ?? row.type} · ${eur(row.amount_ttc)}`)} />
            <Panel title="SAV" items={sav.map((row) => `${row.titre} · ${row.statut}`)} />
            <Panel title="Documents" items={documents.map((row) => row.nom)} />
            <Panel title="Historique" items={[`Créé le ${dateOnly(client.created_at)}`, `Mis à jour le ${dateOnly(client.updated_at)}`]} />
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">Notes</h4>
            <p className="mt-3 text-sm leading-6 text-slate-600">{client.notes ?? "Aucune note interne renseignée."}</p>
          </section>
        </div>
      </aside>
    </div>
  );
}

function Panel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Aucun élément.</div>
        ) : (
          items.slice(0, 5).map((item) => <div key={item} className="rounded-xl bg-slate-50 p-2 text-sm text-slate-700">{item}</div>)
        )}
      </div>
    </div>
  );
}
