import { Link } from "react-router-dom";
import { X } from "lucide-react";
import type { SavWithContext } from "../types";
import { dateOnly } from "../../components/crmFormat";
import { SavPriorityChip, SavStatusChip } from "./SavStatusChip";

export function SavTicketDrawer({ ticket, onClose }: { ticket: SavWithContext | null; onClose: () => void }) {
  if (!ticket) return null;

  const clientHref = ticket.client_id ? `/crm/clients?client=${encodeURIComponent(ticket.client_id)}` : null;
  const chantierHref = ticket.chantier_id ? `/chantiers/${encodeURIComponent(ticket.chantier_id)}` : null;
  const chantierPlanningHref = ticket.chantier_id ? `/chantiers/${encodeURIComponent(ticket.chantier_id)}/planning` : null;
  const chantierDocumentsHref = ticket.chantier_id ? `/chantiers/${encodeURIComponent(ticket.chantier_id)}/documents` : null;
  const chantierQualityHref = ticket.chantier_id ? `/chantiers/${encodeURIComponent(ticket.chantier_id)}/qualite` : null;
  const chantierFeedbackHref = ticket.chantier_id ? `/retours-terrain?chantierId=${encodeURIComponent(ticket.chantier_id)}` : null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/20" role="dialog" aria-modal="true">
      <aside className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Ticket SAV</div>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">{ticket.titre}</h3>
              <div className="mt-2 flex gap-2"><SavPriorityChip priority={ticket.urgence} /><SavStatusChip status={ticket.statut} /></div>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex gap-2 overflow-x-auto border-b border-slate-200 text-sm font-medium text-slate-600">
            {["Détail", "Historique", "Photos", "Messages", "Intervention", "Documents", "Clôture"].map((tab, index) => (
              <span key={tab} className={`${index === 0 ? "border-b-2 border-blue-600 text-blue-700" : ""} shrink-0 px-1 pb-2`}>{tab}</span>
            ))}
          </div>
          <section className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
            <div>Client : {ticket.clientLabel}</div>
            <div className="mt-2">Chantier : {ticket.chantierLabel}</div>
            <div className="mt-2">Intervenant : {ticket.assigned_to ?? "—"}</div>
            <div className="mt-2">Ouvert le : {dateOnly(ticket.created_at)}</div>
            <div className="mt-2">Intervention : {dateOnly(ticket.planned_at)}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {clientHref ? (
                <Link
                  to={clientHref}
                  className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                >
                  Fiche client
                </Link>
              ) : null}
              {chantierHref ? (
                <Link
                  to={chantierHref}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Fiche chantier
                </Link>
              ) : null}
              {chantierPlanningHref ? (
                <Link
                  to={chantierPlanningHref}
                  className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50"
                >
                  Agenda / planning
                </Link>
              ) : null}
              {chantierDocumentsHref ? (
                <Link
                  to={chantierDocumentsHref}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Documents chantier
                </Link>
              ) : null}
              {chantierFeedbackHref ? (
                <Link
                  to={chantierFeedbackHref}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  Retours terrain
                </Link>
              ) : null}
              {chantierQualityHref ? (
                <Link
                  to={chantierQualityHref}
                  className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Qualité / réserves
                </Link>
              ) : null}
            </div>
            <p className="mt-3 leading-6">{ticket.description ?? "Aucune description renseignée."}</p>
          </section>
          <section className="rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">Photos</h4>
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">{Array.isArray(ticket.photos) ? ticket.photos.length : 0} photo(s) liées.</div>
          </section>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400" title="Assigner à finaliser">Assigner</button>
            {chantierPlanningHref ? (
              <Link
                to={chantierPlanningHref}
                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-center text-sm font-semibold text-blue-800 hover:bg-blue-100"
              >
                Agenda / planning
              </Link>
            ) : (
              <button type="button" disabled className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400" title="Chantier requis pour l'agenda / planning">Agenda / planning</button>
            )}
            <button type="button" disabled className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400" title="Message client à finaliser">Message client</button>
            {chantierDocumentsHref ? (
              <Link
                to={chantierDocumentsHref}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Documents
              </Link>
            ) : (
              <button type="button" disabled className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400" title="Chantier requis pour les documents">Documents</button>
            )}
            {chantierFeedbackHref ? (
              <Link
                to={chantierFeedbackHref}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                Retours terrain
              </Link>
            ) : (
              <button type="button" disabled className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400" title="Chantier requis pour les retours terrain">Retours terrain</button>
            )}
            {chantierQualityHref ? (
              <Link
                to={chantierQualityHref}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm font-semibold text-amber-800 hover:bg-amber-100"
              >
                Qualité / réserves
              </Link>
            ) : (
              <button type="button" disabled className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400" title="Chantier requis pour la qualité / réserves">Qualité / réserves</button>
            )}
            <button type="button" disabled className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400 sm:col-span-2" title="Clôture à finaliser">Clôturer</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
