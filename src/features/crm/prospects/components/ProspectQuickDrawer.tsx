import { X } from "lucide-react";
import type { CrmProspectRow } from "../../../../services/crm.service";
import { dateOnly, entityLabel, eur } from "../../components/crmFormat";
import { ProspectStatusBadge } from "./ProspectStatusBadge";
import type { ProspectActionHandlers } from "../types";

export function ProspectQuickDrawer({
  prospect,
  onClose,
  actions,
}: {
  prospect: CrmProspectRow | null;
  onClose: () => void;
  actions: ProspectActionHandlers;
}) {
  if (!prospect) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/20" role="dialog" aria-modal="true">
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Fiche rapide</div>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">{entityLabel(prospect)}</h3>
              <div className="mt-2">
                <ProspectStatusBadge status={prospect.statut} />
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <section className="rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">Coordonnées</h4>
            <div className="mt-3 grid gap-2 text-sm text-slate-600">
              <div>Email : {prospect.email ?? "—"}</div>
              <div>Téléphone : {prospect.mobile ?? prospect.telephone ?? "—"}</div>
              <div>Adresse : {[prospect.adresse, prospect.code_postal, prospect.ville].filter(Boolean).join(" ") || "—"}</div>
              <div>Source : {prospect.source_acquisition ?? "—"}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">Projet</h4>
            <div className="mt-3 grid gap-2 text-sm text-slate-600">
              <div>Type : {prospect.type_projet ?? "—"}</div>
              <div>Budget : {prospect.budget_estime ? eur(prospect.budget_estime) : "—"}</div>
              <div>Urgence : {prospect.urgence ?? "—"}</div>
              <p className="leading-6">{prospect.description_besoin ?? prospect.notes ?? "Aucune note projet renseignée."}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">Historique</h4>
            <div className="mt-3 text-sm text-slate-600">Créé le {dateOnly(prospect.created_at)} · Mis à jour le {dateOnly(prospect.updated_at)}</div>
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Tâches, devis et activité détaillée seront reliés ici lors de la fiche complète.</div>
          </section>

          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => actions.onTask(prospect)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50">Créer tâche</button>
            <button type="button" onClick={() => actions.onCreateOpportunity(prospect)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50">Créer opportunité</button>
            <button type="button" onClick={() => actions.onCreateQuote(prospect)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50">Créer devis</button>
            <button type="button" onClick={() => actions.onConvert(prospect)} className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">Convertir client</button>
            <button type="button" disabled className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400" title="Modification dédiée à finaliser">Modifier</button>
            <button type="button" onClick={() => actions.onStatus(prospect, "archive")} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Archiver</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
