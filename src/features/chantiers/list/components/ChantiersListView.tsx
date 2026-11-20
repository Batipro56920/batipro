import { FileText, MapPin } from "lucide-react";
import { TONE_SOFT } from "../../../../design-system/tone";
import type { ChantierDerived, ChantierListActions } from "../types";
import { budgetLabel, commercialAmountLabel, commercialSourceLabel, hasCommercialContext, shortDate, timeLabel } from "../utils/chantiersListUtils";
import { ChantierProgress } from "./ChantierProgress";
import { ChantierRowActions } from "./ChantierRowActions";
import { ChantierStatusPill } from "./ChantierStatusPill";

type Props = {
  rows: ChantierDerived[];
  selectedIds: string[];
  onToggleSelection: (id: string) => void;
  onPreview: (row: ChantierDerived) => void;
  actions: ChantierListActions;
};

const TABLE_COLUMNS = "44px minmax(240px,1.5fr) 110px 110px 130px 100px 170px";

const CHECKBOX_CLASS =
  "h-[18px] w-[18px] rounded-[5px] border-[1.5px] border-strong bg-surface accent-[var(--bt-primary)]";

export function ChantiersListView({ rows, selectedIds, onToggleSelection, onPreview, actions }: Props) {
  return (
    <section className="overflow-hidden rounded-card border border-subtle bg-surface">
      {/* En-tete de table : jamais en capitales, aligne sur le padding de la surface. */}
      <div
        className="bt-caption hidden gap-3 border-b border-subtle bg-app px-4 py-3 text-muted lg:grid dark:bg-elevated"
        style={{ gridTemplateColumns: TABLE_COLUMNS }}
      >
        <span aria-hidden />
        <span>Chantier</span>
        <span>Statut</span>
        <span>Budget</span>
        <span>Temps</span>
        <span>Échéance</span>
        <span className="text-right">Actions</span>
      </div>

      <div className="hidden divide-y divide-subtle lg:block">
        {rows.map((row) => {
          const selected = selectedIds.includes(row.id);
          return (
            <div
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => onPreview(row)}
              onKeyDown={(event) => event.key === "Enter" && onPreview(row)}
              className={`relative grid cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors duration-[90ms] ${
                selected ? "bg-selected" : "hover:bg-interactive focus-visible:bg-interactive"
              }`}
              style={{ gridTemplateColumns: TABLE_COLUMNS }}
            >
              {selected ? <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" /> : null}
              <div onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  className={CHECKBOX_CLASS}
                  checked={selected}
                  onChange={() => onToggleSelection(row.id)}
                  aria-label={`Sélectionner ${row.nom}`}
                />
              </div>
              <ChantierIdentity row={row} />
              <div>
                <ChantierStatusPill status={row.status} />
              </div>
              <div className="bt-num text-sm text-ink">{budgetLabel(row.budgetHt)}</div>
              <div className="bt-num text-sm text-ink-secondary">{timeLabel(row.heures_prevues, row.heures_passees)}</div>
              <div className="bt-num text-sm text-ink-secondary">{shortDate(row.date_fin_prevue ?? row.planning_end_date)}</div>
              <ChantierRowActions row={row} actions={actions} />
            </div>
          );
        })}
      </div>

      {/* Sous 1024 px la table devient une liste : une colonne stricte, meme donnees. */}
      <div className="divide-y divide-subtle lg:hidden">
        {rows.map((row) => {
          const selected = selectedIds.includes(row.id);
          return (
            <article
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => onPreview(row)}
              onKeyDown={(event) => event.key === "Enter" && onPreview(row)}
              className={`bt-row relative px-4 py-3 transition-colors duration-[90ms] ${selected ? "bg-selected" : "hover:bg-interactive"}`}
            >
              {selected ? <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" /> : null}
              <div className="flex items-start gap-3">
                <div className="pt-0.5" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    className={CHECKBOX_CLASS}
                    checked={selected}
                    onChange={() => onToggleSelection(row.id)}
                    aria-label={`Sélectionner ${row.nom}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <ChantierIdentity row={row} />
                    <ChantierStatusPill status={row.status} />
                  </div>

                  <div className="mt-3">
                    <ChantierProgress value={row.progress} />
                  </div>

                  <p className="bt-caption bt-num mt-2 text-muted">
                    {budgetLabel(row.budgetHt)} <span aria-hidden>·</span> {timeLabel(row.heures_prevues, row.heures_passees)}{" "}
                    <span aria-hidden>·</span> {shortDate(row.date_fin_prevue ?? row.planning_end_date)}
                  </p>


                  <div className="mt-3">
                    <ChantierRowActions row={row} actions={actions} />
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ChantierIdentity({ row }: { row: ChantierDerived }) {
  return (
    <div className="min-w-0">
      <div className="bt-card-title truncate text-ink">{row.nom}</div>
      <div className="bt-secondary mt-0.5 flex min-w-0 items-center gap-1.5 text-muted">
        <span className="truncate">{row.client ?? "Client non renseigné"}</span>
        <span aria-hidden>·</span>
        <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span className="truncate">{row.adresse ?? "Adresse non renseignée"}</span>
      </div>
      {hasCommercialContext(row) ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className={`bt-caption inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${TONE_SOFT.info}`}>
            <FileText className="h-3 w-3" strokeWidth={1.75} />
            {commercialSourceLabel(row)}
          </span>
          <span className={`bt-caption bt-num inline-flex rounded-full px-2 py-0.5 ${TONE_SOFT.success}`}>{commercialAmountLabel(row)}</span>
        </div>
      ) : null}
    </div>
  );
}

