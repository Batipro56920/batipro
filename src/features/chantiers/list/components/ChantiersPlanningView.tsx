import { AlertTriangle, ArrowRight, CalendarDays, ClipboardList, Eye, FileText, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { ChantierDerived } from "../types";
import { shortDate } from "../utils/chantiersListUtils";
import { ChantierProgress } from "./ChantierProgress";
import { ChantierStatusPill } from "./ChantierStatusPill";

const PLANNING_QUICK_LINKS = [
  { label: "Préparer", path: "preparation", icon: ClipboardList },
  { label: "Planning", path: "planning", icon: CalendarDays },
  { label: "Documents", path: "documents", icon: FileText },
  { label: "Équipe", path: "equipe", icon: Users },
  { label: "Qualité", path: "qualite", icon: ShieldCheck },
] as const;

function getPlanningDate(row: ChantierDerived) {
  return row.date_fin_prevue ?? row.planning_end_date ?? row.planning_start_date ?? row.date_debut ?? null;
}

function getPlanningTimingLabel(row: ChantierDerived) {
  const planningDate = getPlanningDate(row);
  if (row.isLate) return "En retard";
  if (!planningDate) return "À planifier";
  if (planningDate === row.planning_start_date || planningDate === row.date_debut) return "Début planifié";
  return "Prochain jalon";
}

function ChantierPlanningRow({ row, onPreview }: { row: ChantierDerived; onPreview: (row: ChantierDerived) => void }) {
  const planningDate = getPlanningDate(row);
  const timingLabel = getPlanningTimingLabel(row);

  return (
    <div className="grid w-full gap-3 rounded-2xl border border-slate-200 p-3 text-left transition hover:bg-slate-50 md:grid-cols-[160px_minmax(0,1fr)_180px_120px_auto] md:items-center">
      <div>
        <div className="text-sm font-semibold text-slate-950">{shortDate(planningDate)}</div>
        <div
          className={[
            "mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
            row.isLate
              ? "bg-red-100 text-red-700"
              : planningDate
                ? "bg-blue-50 text-blue-700"
                : "bg-amber-100 text-amber-800",
          ].join(" ")}
        >
          {timingLabel}
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate font-semibold text-slate-950">{row.nom}</div>
        <div className="truncate text-sm text-slate-500">{row.client ?? "Client non renseigné"}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PLANNING_QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.path}
                to={`/chantiers/${row.id}/${link.path}`}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
              >
                <Icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            );
          })}
          <Link
            to={`/retours-terrain?chantierId=${row.id}`}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 text-xs font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Retours terrain
          </Link>
        </div>
      </div>
      <ChantierProgress value={row.progress} />
      <ChantierStatusPill status={row.status} />
      <div className="flex flex-wrap gap-2 md:justify-end">
        <button
          type="button"
          onClick={() => onPreview(row)}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
        >
          <Eye className="h-4 w-4" />
          Aperçu
        </button>
        <Link
          to={`/chantiers/${row.id}`}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
        >
          Dossier
        </Link>
        <Link
          to={`/chantiers/${row.id}/planning`}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Planning chantier
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function UnplannedChantierCard({ row, onPreview }: { row: ChantierDerived; onPreview: (row: ChantierDerived) => void }) {
  return (
    <article className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase text-amber-700">À planifier</div>
          <h3 className="mt-1 truncate font-semibold text-slate-950">{row.nom}</h3>
          <p className="truncate text-sm text-slate-600">{row.client ?? "Client non renseigné"}</p>
        </div>
        <ChantierStatusPill status={row.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to={`/chantiers/${row.id}/preparation`}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-amber-900 px-3 text-sm font-semibold text-white transition hover:bg-amber-800"
        >
          Cadrer la préparation
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to={`/chantiers/${row.id}/planning`}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
        >
          Ouvrir le planning
          <CalendarDays className="h-4 w-4" />
        </Link>
        <Link
          to={`/chantiers/${row.id}`}
          className="inline-flex h-9 items-center rounded-xl border border-amber-200 bg-white px-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
        >
          Dossier
        </Link>
        <button
          type="button"
          onClick={() => onPreview(row)}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
        >
          <Eye className="h-4 w-4" />
          Aperçu
        </button>
      </div>
    </article>
  );
}

export function ChantiersPlanningView({ rows, onPreview }: { rows: ChantierDerived[]; onPreview: (row: ChantierDerived) => void }) {
  const scheduledRows = rows
    .filter((row) => getPlanningDate(row))
    .sort((a, b) => String(getPlanningDate(a)).localeCompare(String(getPlanningDate(b))));
  const unplannedRows = rows
    .filter((row) => !getPlanningDate(row))
    .sort((a, b) => a.nom.localeCompare(b.nom));
  const lateCount = rows.filter((row) => row.isLate).length;
  const toPlanCount = unplannedRows.length;
  const activeCount = rows.length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Planning chantiers</h2>
          <p className="text-sm text-slate-500">Vue chronologique des échéances chantier avec accès direct au planning détaillé et aux espaces terrain.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[420px]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Chantiers</div>
            <div className="text-lg font-semibold text-slate-950">{activeCount}</div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <div className="text-xs font-semibold uppercase text-red-600">En retard</div>
            <div className="text-lg font-semibold text-red-700">{lateCount}</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="text-xs font-semibold uppercase text-amber-700">À planifier</div>
            <div className="text-lg font-semibold text-amber-800">{toPlanCount}</div>
          </div>
        </div>
      </div>

      {unplannedRows.length > 0 ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-amber-950">Chantiers à cadrer</h3>
              <p className="text-sm text-amber-800">Ces dossiers n'ont pas encore de jalon chantier exploitable dans le planning.</p>
            </div>
            <span className="text-xs font-semibold uppercase text-amber-700">{toPlanCount} à reprendre</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {unplannedRows.map((row) => (
              <UnplannedChantierCard key={row.id} row={row} onPreview={onPreview} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {scheduledRows.length > 0 ? (
          scheduledRows.map((row) => <ChantierPlanningRow key={row.id} row={row} onPreview={onPreview} />)
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Aucun chantier avec échéance datée dans les filtres actuels.
          </div>
        )}
      </div>
    </section>
  );
}
