import { AlertTriangle, CalendarDays, ClipboardList, Clock3, FileText, Hammer, MapPin, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { TONE_SOFT, type Tone } from "../../../../design-system/tone";
import type { ChantierDerived, ChantierListActions } from "../types";
import { budgetLabel, commercialAmountLabel, commercialSourceLabel, hasCommercialContext, shortDate, timeLabel } from "../utils/chantiersListUtils";
import { ChantierProgress } from "./ChantierProgress";
import { ChantierRowActions } from "./ChantierRowActions";
import { ChantierStatusPill } from "./ChantierStatusPill";

const QUICK_LINK_CLASS =
  "bt-tap inline-flex items-center justify-center gap-1.5 rounded-field border border-strong bg-surface px-2 text-[13px] font-medium text-ink-secondary transition-colors duration-[120ms] hover:bg-interactive hover:text-ink";

export function ChantiersCardsView({
  rows,
  onPreview,
  actions,
}: {
  rows: ChantierDerived[];
  onPreview: (row: ChantierDerived) => void;
  actions: ChantierListActions;
}) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => {
        const terrainFeedbackHref = `/chantiers/${encodeURIComponent(row.id)}/retours-terrain`;
        const qualityHref = `/chantiers/${row.id}/qualite`;

        return (
          <article
            key={row.id}
            role="button"
            tabIndex={0}
            onClick={() => onPreview(row)}
            onKeyDown={(event) => event.key === "Enter" && onPreview(row)}
            className="relative cursor-pointer overflow-hidden rounded-card border border-subtle bg-surface transition-colors duration-[120ms] hover:bg-interactive"
          >

            <div className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="bt-card-title truncate text-ink">{row.nom}</h3>
                  <p className="bt-secondary mt-0.5 truncate text-muted">{row.client ?? "Client non renseigné"}</p>
                </div>
                <ChantierStatusPill status={row.status} />
              </div>

              {hasCommercialContext(row) ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={`bt-caption inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${TONE_SOFT.info}`}>
                    <FileText className="h-3 w-3" strokeWidth={1.75} />
                    {commercialSourceLabel(row)}
                  </span>
                  <span className={`bt-caption bt-num inline-flex rounded-full px-2 py-0.5 ${TONE_SOFT.success}`}>{commercialAmountLabel(row)}</span>
                </div>
              ) : null}

              <div className="bt-secondary mt-2 flex items-center gap-1.5 text-muted">
                <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{row.adresse ?? "Adresse non renseignée"}</span>
              </div>

              <div className="mt-3">
                <ChantierProgress value={row.progress} />
              </div>
            </div>

            <div className="bt-caption bt-num flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-subtle px-4 py-2 text-muted">
              <span className="text-ink-secondary">{budgetLabel(row.budgetHt)}</span>
              <span aria-hidden>·</span>
              <span>{timeLabel(row.heures_prevues, row.heures_passees)}</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} />
                {shortDate(row.date_fin_prevue ?? row.planning_end_date)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 border-t border-subtle px-4 py-2 sm:grid-cols-4" onClick={(event) => event.stopPropagation()}>
              <QuickLink href={`/chantiers/${row.id}/preparation`} icon={ClipboardList} label="Préparer" />
              <QuickLink href={`/chantiers/${row.id}/execution`} icon={Hammer} label="Exécution" />
              <QuickLink href={`/chantiers/${row.id}/temps`} icon={Clock3} label="Temps" />
              <QuickLink href={`/chantiers/${row.id}/planning`} icon={CalendarDays} label="Planning" />
              <QuickLink href={terrainFeedbackHref} icon={AlertTriangle} label="Retours" />
              <QuickLink href={qualityHref} icon={AlertTriangle} label="Qualité" />
              <QuickLink href={`/chantiers/${row.id}/documents`} icon={FileText} label="Documents" />
            </div>

            <div className="border-t border-subtle px-4 py-2">
              <ChantierRowActions row={row} actions={actions} />
            </div>
          </article>
        );
      })}
    </section>
  );
}

function QuickLink({ href, icon: Icon, label, tone = "normal" }: { href: string; icon: LucideIcon; label: string; tone?: Tone }) {
  const className =
    tone === "normal"
      ? QUICK_LINK_CLASS
      : `bt-tap inline-flex items-center justify-center gap-1.5 rounded-field px-2 text-[13px] font-medium transition-opacity duration-[120ms] hover:opacity-80 ${TONE_SOFT[tone]}`;

  return (
    <Link to={href} className={className}>
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
