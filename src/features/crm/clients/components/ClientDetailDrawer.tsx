import { ArrowUpRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ClientMetrics, ClientWithMetrics } from "../types";
import { dateOnly, eur } from "../../components/crmFormat";

type PanelItem = {
  id: string;
  label: string;
  path?: string;
};

export function ClientDetailDrawer({
  client,
  metrics,
  onClose,
}: {
  client: ClientWithMetrics | null;
  metrics: ClientMetrics;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  if (!client) return null;

  const chantiers = metrics.chantiers.filter((row) => row.crm_client_id === client.id);
  const quotes = metrics.quotes.filter((row) => row.client_id === client.id);
  const invoices = metrics.invoices.filter((row) => row.client_id === client.id);
  const sav = metrics.sav.filter((row) => row.client_id === client.id);
  const documents = metrics.documents.filter((row) => row.client_id === client.id);

  function openLinkedItem(path: string) {
    onClose();
    navigate(path);
  }

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
            <Panel
              title="Devis"
              items={quotes.map((row) => ({
                id: row.id,
                label: `${row.quote_number} · ${eur(row.montant_ht)}`,
                path: `/crm/devis/${encodeURIComponent(row.id)}/edit`,
              }))}
              onOpen={openLinkedItem}
            />
            <Panel
              title="Chantiers"
              items={chantiers.map((row) => ({
                id: row.id,
                label: `${row.nom} · ${row.status}`,
                path: `/chantiers/${encodeURIComponent(row.id)}`,
              }))}
              onOpen={openLinkedItem}
            />
            <Panel
              title="Facturation"
              items={invoices.map((row) => ({
                id: row.id,
                label: `${row.invoice_number ?? row.type} · ${eur(row.amount_ttc)}`,
                path: `/factures?invoice=${encodeURIComponent(row.id)}`,
              }))}
              onOpen={openLinkedItem}
            />
            <Panel
              title="SAV"
              items={sav.map((row) => ({
                id: row.id,
                label: `${row.titre} · ${row.statut}`,
                path: `/crm/sav?savId=${encodeURIComponent(row.id)}`,
              }))}
              onOpen={openLinkedItem}
            />
            <Panel title="Documents" items={documents.map((row) => ({ id: row.id, label: row.nom }))} />
            <Panel
              title="Historique"
              items={[
                { id: "created", label: `Créé le ${dateOnly(client.created_at)}` },
                { id: "updated", label: `Mis à jour le ${dateOnly(client.updated_at)}` },
              ]}
            />
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

function Panel({ title, items, onOpen }: { title: string; items: PanelItem[]; onOpen?: (path: string) => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Aucun élément.</div>
        ) : (
          items.slice(0, 5).map((item) =>
            item.path && onOpen ? (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpen(item.path!)}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 p-2 text-left text-sm text-slate-700 transition hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span className="min-w-0 break-words">{item.label}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
            ) : (
              <div key={item.id} className="rounded-xl bg-slate-50 p-2 text-sm text-slate-700">{item.label}</div>
            ),
          )
        )}
      </div>
    </div>
  );
}
