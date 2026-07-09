import { AlertTriangle, ArrowRight, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
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

  return (
    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
      {items.join(" · ")}
    </div>
  );
}

function TerrainFeedbackLink({ row, compact = false }: { row: ChantierDerived; compact?: boolean }) {
  const feedback = getTerrainFeedbackMeta(row);
  const tone = feedback.hasPriority
    ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
    : feedback.hasOpen
      ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  const label = feedback.hasOpen ? feedback.label : "Retours terrain";

  return (
    <Link
      to={`/retours-terrain?chantierId=${encodeURIComponent(row.id)}`}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 font-semibold transition",
        compact ? "text-xs" : "text-sm",
        tone,
      ].join(" ")}
    >
      <AlertTriangle className="h-4 w-4" />
      {label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function PlanningDelayLink({ row }: { row: ChantierDerived }) {
  return (
    <Link
      to={`/chantiers/${row.id}/planning`}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
    >
      <CalendarDays className="h-4 w-4" />
      Recaler le planning
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export function ChantiersKanbanView({ rows, onPreview, actions }: { rows: ChantierDerived[]; onPreview: (row: ChantierDerived) => void; actions: ChantierListActions }) {
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
    <section className="grid gap-3 xl:grid-cols-4">
      {COLUMNS.map((column) => (
        <div key={column.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="sticky top-0 z-10 mb-3 flex items-center justify-between rounded-xl bg-slate-50 py-1">
            <h3 className="font-semibold text-slate-950">{column.label}</h3>
            <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">{byColumn[column.key].length}</span>
          </div>
          <div className="space-y-3">
            {byColumn[column.key].length ? byColumn[column.key].map((row) => {
              const feedback = getTerrainFeedbackMeta(row);
              return (
                <article key={`${column.key}-${row.id}`} role="button" tabIndex={0} onClick={() => onPreview(row)} onKeyDown={(event) => event.key === "Enter" && onPreview(row)} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md">
                  <div className="font-semibold text-slate-950">{row.nom}</div>
                  <div className="mt-1 text-sm text-slate-500">{row.client ?? "Client non renseigné"}</div>
                  <div className="mt-3">
                    <ChantierProgress value={row.progress} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span className="truncate">{budgetLabel(row.budgetHt)}</span>
                    <span className="shrink-0">{shortDate(row.date_fin_prevue ?? row.planning_end_date)}</span>
                  </div>
                  {column.key === "blocage" ? <BlockageSummary row={row} /> : null}
                  {feedback.hasOpen && column.key !== "blocage" ? (
                    <div className="mt-3" onClick={(event) => event.stopPropagation()}>
                      <TerrainFeedbackLink row={row} compact />
                    </div>
                  ) : null}
                  {column.key === "blocage" ? (
                    <div className="mt-3 grid gap-2" onClick={(event) => event.stopPropagation()}>
                      {row.isLate ? <PlanningDelayLink row={row} /> : null}
                      {feedback.hasOpen ? (
                        <>
                          <TerrainFeedbackLink row={row} />
                          <Link
                            to={`/chantiers/${row.id}/qualite`}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                          >
                            <AlertTriangle className="h-4 w-4" />
                            Traiter en qualité
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-3">
                    <ChantierRowActions row={row} actions={actions} />
                  </div>
                </article>
              );
            }) : <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Aucun chantier</div>}
          </div>
        </div>
      ))}
    </section>
  );
}
