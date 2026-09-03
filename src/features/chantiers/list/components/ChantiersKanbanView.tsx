import { AlertTriangle, ArrowRight, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { TONE_SOFT } from "../../../../design-system/tone";
import type { ChantierDerived, ChantierListActions } from "../types";
import { budgetLabel, shortDate } from "../utils/chantiersListUtils";
import { ChantierProgress } from "./ChantierProgress";
import { ChantierRowActions } from "./ChantierRowActions";

const COLUMNS = [
  { key: "preparation", label: "Préparation" },
  { key: "en_cours", label: "En cours" },
  { key: "blocage", label: "Blocage" },
  { key: "termine", label: "Terminé" },
] as const;

const ACTION_LINK_CLASS =
  "bt-tap inline-flex w-full items-center justify-center gap-2 rounded-field border border-strong bg-surface px-3 text-[13px] font-medium text-ink-secondary transition-colors duration-[120ms] hover:bg-interactive hover:text-ink";

function getTerrainFeedbackMeta(row: ChantierDerived) {
  const openCount = row.terrainFeedbackOpenCount ?? 0;
  const priorityCount = row.terrainFeedbackPriorityCount ?? 0;
  return {
    openCount,
    priorityCount,
    hasOpen: openCount > 0,
    hasPriority: priorityCount > 0,
    label: priorityCount > 0
      ? `${priorityCount} retour${priorityCount > 1 ? "s" : ""} terrain urgent${priorityCount > 1 ? "s" : ""}`
      : `${openCount} retour${openCount > 1 ? "s" : ""} terrain à traiter`,
  };
}

function isBlockedChantier(row: ChantierDerived) {
  return row.status !== "TERMINE" && (row.isLate || (row.terrainFeedbackOpenCount ?? 0) > 0);
}

function BlockageSummary({ row }: { row: ChantierDerived }) {
  const feedback = getTerrainFeedbackMeta(row);
  const items: string[] = [];
  if (row.isLate) items.push("Chantier en retard");
  if (feedback.hasOpen) items.push(feedback.label);

  if (items.length === 0) return null;

  return <p className={`bt-caption mt-2 rounded-field px-2 py-1 ${TONE_SOFT.danger}`}>{items.join(" · ")}</p>;
}

function TerrainFeedbackLink({ row, compact = false }: { row: ChantierDerived; compact?: boolean }) {
  const feedback = getTerrainFeedbackMeta(row);
  const tone = feedback.hasPriority ? TONE_SOFT.danger : feedback.hasOpen ? TONE_SOFT.warning : null;
  const label = feedback.hasOpen ? feedback.label : "Retours terrain";

  return (
    <Link
      to={`/chantiers/${encodeURIComponent(row.id)}/retours-terrain`}
      className={
        tone
          ? `bt-tap inline-flex w-full items-center justify-center gap-2 rounded-field px-3 font-medium transition-opacity duration-[120ms] hover:opacity-80 ${
              compact ? "text-[13px]" : "text-sm"
            } ${tone}`
          : `${ACTION_LINK_CLASS} ${compact ? "text-[13px]" : "text-sm"}`
      }
    >
      <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span className="truncate">{label}</span>
      <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={1.75} />
    </Link>
  );
}

function PlanningDelayLink({ row }: { row: ChantierDerived }) {
  return (
    <Link to={`/chantiers/${row.id}/planning`} className={ACTION_LINK_CLASS}>
      <CalendarDays className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      Recaler le planning
      <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={1.75} />
    </Link>
  );
}

/** Colonnes de niveau 0 : seules les fiches sont des surfaces (pas de surface imbriquee). */
export function ChantiersKanbanView({
  rows,
  onPreview,
  actions,
}: {
  rows: ChantierDerived[];
  onPreview: (row: ChantierDerived) => void;
  actions: ChantierListActions;
}) {
  const blockedRows = rows.filter(isBlockedChantier);
  const blockedIds = new Set(blockedRows.map((row) => row.id));
  const availableRows = rows.filter((row) => !blockedIds.has(row.id));
  const byColumn = {
    preparation: availableRows.filter((row) => row.status === "PREPARATION"),
    en_cours: availableRows.filter((row) => row.status === "EN_COURS" || row.status === "EN_PAUSE"),
    blocage: blockedRows,
    termine: availableRows.filter((row) => row.status === "TERMINE"),
  };

  return (
    <section className="grid gap-4 xl:grid-cols-4">
      {COLUMNS.map((column) => (
        <div key={column.key} className="min-w-0">
          <div className="sticky top-0 z-10 mb-2 flex items-center justify-between gap-2 border-b border-subtle bg-app py-2">
            <h3 className="bt-section-title text-ink">{column.label}</h3>
            <span className="bt-caption bt-num rounded-full bg-interactive px-2 py-0.5 text-muted">{byColumn[column.key].length}</span>
          </div>
          <div className="space-y-2">
            {byColumn[column.key].length ? (
              byColumn[column.key].map((row) => {
                const feedback = getTerrainFeedbackMeta(row);
                return (
                  <article
                    key={`${column.key}-${row.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onPreview(row)}
                    onKeyDown={(event) => event.key === "Enter" && onPreview(row)}
                    className="cursor-pointer rounded-card border border-subtle bg-surface p-3 transition-colors duration-[120ms] hover:bg-interactive"
                  >
                    <div className="bt-card-title truncate text-ink">{row.nom}</div>
                    <div className="bt-secondary mt-0.5 truncate text-muted">{row.client ?? "Client non renseigné"}</div>
                    <div className="mt-2.5">
                      <ChantierProgress value={row.progress} />
                    </div>
                    <div className="bt-caption bt-num mt-2 flex items-center justify-between gap-3 text-muted">
                      <span className="truncate">{budgetLabel(row.budgetHt)}</span>
                      <span className="shrink-0">{shortDate(row.date_fin_prevue ?? row.planning_end_date)}</span>
                    </div>
                    {column.key === "blocage" ? <BlockageSummary row={row} /> : null}
                    {feedback.hasOpen && column.key !== "blocage" ? (
                      <div className="mt-2" onClick={(event) => event.stopPropagation()}>
                        <TerrainFeedbackLink row={row} compact />
                      </div>
                    ) : null}
                    {column.key === "blocage" ? (
                      <div className="mt-2 grid gap-1.5" onClick={(event) => event.stopPropagation()}>
                        {row.isLate ? <PlanningDelayLink row={row} /> : null}
                        {feedback.hasOpen ? (
                          <>
                            <TerrainFeedbackLink row={row} />
                            <Link
                              to={`/chantiers/${row.id}/qualite`}
                              className={`bt-tap inline-flex w-full items-center justify-center gap-2 rounded-field px-3 text-sm font-medium transition-opacity duration-[120ms] hover:opacity-80 ${TONE_SOFT.danger}`}
                            >
                              <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                              Traiter en qualité
                              <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                            </Link>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-2.5">
                      <ChantierRowActions row={row} actions={actions} />
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="bt-secondary rounded-card border border-subtle bg-surface px-3 py-6 text-center text-muted">Aucun chantier</p>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
