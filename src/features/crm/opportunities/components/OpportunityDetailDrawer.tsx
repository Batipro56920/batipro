import { X } from "lucide-react";
import type { OpportunityWithParty } from "../types";
import { dateOnly, eur } from "../../components/crmFormat";

export function OpportunityDetailDrawer({ row, onClose }: { row: OpportunityWithParty | null; onClose: () => void }) {
  if (!row) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/20" role="dialog" aria-modal="true">
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Détail opportunité</div>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">{row.nom_affaire}</h3>
              <p className="mt-1 text-sm text-slate-500">{row.partyLabel}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500">Montant</div>
              <div className="mt-1 font-semibold text-slate-950">{eur(row.montant_estime)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500">Probabilité</div>
              <div className="mt-1 font-semibold text-slate-950">{row.probabilite}%</div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500">Échéance</div>
              <div className="mt-1 font-semibold text-slate-950">{dateOnly(row.echeance)}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">Infos client</h4>
            <div className="mt-3 text-sm text-slate-600">Client / prospect : {row.partyLabel}</div>
            <div className="mt-1 text-sm text-slate-600">Source : {row.partySource ?? "—"}</div>
            <div className="mt-1 text-sm text-slate-600">Commercial : {row.responsable_id ?? "—"}</div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">Notes</h4>
            <p className="mt-3 text-sm leading-6 text-slate-600">{row.notes ?? "Aucune note renseignée."}</p>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">Activité / tâches / relances / devis liés</h4>
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
              Historique détaillé à connecter aux tâches, relances et devis associés.
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">Historique</h4>
            <div className="mt-3 text-sm text-slate-600">Créée le {dateOnly(row.created_at)} · Mise à jour le {dateOnly(row.updated_at)}</div>
          </section>
        </div>
      </aside>
    </div>
  );
}
