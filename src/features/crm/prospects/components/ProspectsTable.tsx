import { Mail, MoreHorizontal, Phone } from "lucide-react";
import type { CrmProspectRow } from "../../../../services/crm.service";
import { dateOnly, entityLabel, eur } from "../../components/crmFormat";
import { ProspectStatusBadge } from "./ProspectStatusBadge";
import type { ProspectActionHandlers } from "../types";

function initials(row: CrmProspectRow) {
  const label = entityLabel(row);
  return label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "P";
}

export function ProspectsTable({
  rows,
  actions,
  onSelect,
}: {
  rows: CrmProspectRow[];
  actions: ProspectActionHandlers;
  onSelect: (row: CrmProspectRow) => void;
}) {
  return (
    <section className="overflow-hidden rounded-surface border border-subtle bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="border-b border-subtle bg-interactive text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            <tr>
              {["Prospect", "Projet", "Budget", "Source", "Commercial", "Dernière activité", "Statut", "Actions"].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => onSelect(row)} className="group cursor-pointer border-b border-subtle align-top transition hover:bg-interactive">
                <td className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-primary text-xs font-semibold text-primary-contrast">{initials(row)}</div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-ink">{entityLabel(row)}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{row.email ?? "—"}</span>
                        <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{row.mobile ?? row.telephone ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink-secondary">{row.type_projet ?? "—"}</div>
                  <div className="mt-1 line-clamp-2 max-w-xs text-xs text-muted">{row.description_besoin ?? row.notes ?? "Aucune description"}</div>
                </td>
                <td className="px-4 py-3 font-medium text-ink">{row.budget_estime ? eur(row.budget_estime) : "—"}</td>
                <td className="px-4 py-3 text-ink-secondary">{row.source_acquisition ?? "—"}</td>
                <td className="px-4 py-3 text-ink-secondary">{row.owner_id ?? "—"}</td>
                <td className="px-4 py-3 text-ink-secondary">{dateOnly(row.updated_at ?? row.created_at)}</td>
                <td className="px-4 py-3"><ProspectStatusBadge status={row.statut} /></td>
                <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                  <div className="flex flex-wrap gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                    <a href={row.mobile || row.telephone ? `tel:${row.mobile ?? row.telephone}` : undefined} className="bt-control rounded-field border border-subtle px-2 py-1 text-xs font-semibold text-ink-secondary hover:bg-interactive">Appeler</a>
                    <a href={row.email ? `mailto:${row.email}` : undefined} className="bt-control rounded-field border border-subtle px-2 py-1 text-xs font-semibold text-ink-secondary hover:bg-interactive">Email</a>
                    <button type="button" onClick={() => actions.onTask(row)} className="bt-control rounded-field border border-subtle px-2 py-1 text-xs font-semibold text-ink-secondary hover:bg-interactive">Tâche</button>
                    <button type="button" onClick={() => actions.onCreateOpportunity(row)} className="bt-control rounded-field border border-subtle px-2 py-1 text-xs font-semibold text-ink-secondary hover:bg-interactive">Affaire</button>
                    <button type="button" onClick={() => actions.onCreateAppointment(row)} className="bt-control rounded-field border border-subtle px-2 py-1 text-xs font-semibold text-ink-secondary hover:bg-interactive">RDV</button>
                    <button type="button" onClick={() => actions.onCreateQuote(row)} className="bt-control rounded-field border border-subtle px-2 py-1 text-xs font-semibold text-ink-secondary hover:bg-interactive">Devis</button>
                    <button type="button" onClick={() => actions.onConvert(row)} className="bt-control rounded-field border border-success/20 bg-success-soft px-2 py-1 text-xs font-semibold text-success-on hover:bg-interactive">Convertir</button>
                    <button type="button" disabled className="bt-control rounded-field border border-subtle px-2 py-1 text-xs font-semibold text-muted" title="Menu d’actions avancées à finaliser"><MoreHorizontal className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-subtle px-4 py-3 text-xs text-muted">
        <span>{rows.length} prospect(s)</span>
        <span>Pagination avancée à connecter si volume élevé.</span>
      </div>
    </section>
  );
}
