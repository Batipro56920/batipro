import { Link } from "react-router-dom";
import type { CrmDataset } from "../../../services/crm.service";
import { eur, statusPill } from "../components/crmFormat";
import ListShell from "../components/ListShell";

export default function CrmPurchasesSection({ rows, chantiers }: { rows: CrmDataset["purchases"]; chantiers: CrmDataset["chantiers"]; onCreate: () => void }) {
  const chantierById = new Map(chantiers.map((row) => [row.id, row]));
  return (
    <ListShell
      title="Achats / factures fournisseurs"
      actionLabel="Bons de commande"
      query=""
      setQuery={() => undefined}
      onCreate={() => { window.location.href = "/fournisseurs?tab=orders"; }}
      hideSearch
    >
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <div className="font-semibold">Les nouveaux achats fournisseurs se pilotent dans Bons de commande.</div>
        <p className="mt-1 text-blue-800">
          Cet onglet conserve l'ancien suivi CRM en lecture. Pour créer, suivre ou ouvrir une commande fournisseur exploitable,
          utilisez le module Achats / Fournisseurs.
        </p>
        <Link
          to="/fournisseurs?tab=orders"
          className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Ouvrir les bons de commande
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-3xl border bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{row.label}</div>
                <div className="text-xs text-slate-500">{row.category} · {chantierById.get(row.chantier_id ?? "")?.nom ?? "Hors chantier"}</div>
              </div>
              <span className={statusPill(row.status)}>{row.status}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">HT<br /><b>{eur(row.amount_ht)}</b></div>
              <div className="rounded-2xl bg-slate-50 p-3">TTC<br /><b>{eur(row.amount_ttc)}</b></div>
            </div>
          </div>
        ))}
      </div>
    </ListShell>
  );
}
