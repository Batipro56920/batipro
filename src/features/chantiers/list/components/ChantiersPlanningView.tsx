import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, ClipboardCheck, ClipboardList, Clock3, Eye, FileText, Hammer, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { ChantierDerived } from "../types";
import { shortDate } from "../utils/chantiersListUtils";
import { ChantierProgress } from "./ChantierProgress";
import { ChantierStatusPill } from "./ChantierStatusPill";

const PLANNING_QUICK_LINKS = [
  { label: "Préparer", path: "preparation", icon: ClipboardList },
  { label: "Exécuter", path: "execution", icon: Hammer },
  { label: "Temps", path: "temps", icon: Clock3 },
  { label: "Planning", path: "planning", icon: CalendarDays },
  { label: "Documents", path: "documents", icon: FileText },
  { label: "Équipe", path: "equipe", icon: Users },
  { label: "Qualité", path: "qualite", icon: ShieldCheck },
  { label: "Visites", path: "visites", icon: ClipboardCheck },
] as const;

type PlanningMilestone = {
  date: string | null;
  label: string;
  isPlanningDate: boolean;
};

type PlanningFilter = "all" | "late" | "unplanned" | "terrain" | "priority";

const PLANNING_FILTER_LABELS: Record<PlanningFilter, string> = {
  all: "Tous les chantiers",
  late: "Chantiers en retard",
  unplanned: "Chantiers à planifier",
  terrain: "Retours terrain ouverts",
  priority: "Retours terrain urgents",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getPlanningMilestone(row: ChantierDerived, today = todayIso()): PlanningMilestone {
  if (row.planning_start_date && row.planning_start_date >= today) {
    return { date: row.planning_start_date, label: "Début planning", isPlanningDate: true };
  }
  if (row.planning_end_date) {
    return { date: row.planning_end_date, label: "Fin planning", isPlanningDate: true };
  }
  if (row.planning_start_date) {
    return { date: row.planning_start_date, label: "Début planning", isPlanningDate: true };
  }
  if (row.date_fin_prevue) {
    return { date: row.date_fin_prevue, label: "Échéance chantier", isPlanningDate: false };
  }
  if (row.date_debut) {
    return { date: row.date_debut, label: "Début indicatif", isPlanningDate: false };
  }
  return { date: null, label: "À planifier", isPlanningDate: false };
}

function getPlanningSortDate(row: ChantierDerived) {
  return row.planning_start_date ?? getPlanningMilestone(row).date;
}

function getTerrainFeedbackSortWeight(row: ChantierDerived) {
  if ((row.terrainFeedbackPriorityCount ?? 0) > 0) return 0;
  if ((row.terrainFeedbackOpenCount ?? 0) > 0) return 1;
  if (row.isLate) return 2;
  return 3;
}

function comparePlanningRows(a: ChantierDerived, b: ChantierDerived) {
  const alertWeight = getTerrainFeedbackSortWeight(a) - getTerrainFeedbackSortWeight(b);
  if (alertWeight !== 0) return alertWeight;

  const dateCompare = String(getPlanningSortDate(a) ?? "").localeCompare(String(getPlanningSortDate(b) ?? ""));
  if (dateCompare !== 0) return dateCompare;

  return a.nom.localeCompare(b.nom);
}

function matchesPlanningFilter(row: ChantierDerived, filter: PlanningFilter) {
  if (filter === "late") return row.isLate;
  if (filter === "unplanned") return !getPlanningMilestone(row).date;
  if (filter === "terrain") return (row.terrainFeedbackOpenCount ?? 0) > 0;
  if (filter === "priority") return (row.terrainFeedbackPriorityCount ?? 0) > 0;
  return true;
}

function getPlanningTimingLabel(row: ChantierDerived) {
  const milestone = getPlanningMilestone(row);
  if (row.isLate) return "En retard";
  return milestone.label;
}

function getPlanningWindowLabel(row: ChantierDerived) {
  if (row.planning_start_date && row.planning_end_date) {
    return `Du ${shortDate(row.planning_start_date)} au ${shortDate(row.planning_end_date)}`;
  }
  if (row.planning_start_date) return `Début ${shortDate(row.planning_start_date)}`;
  if (row.planning_end_date) return `Fin ${shortDate(row.planning_end_date)}`;
  return "Planning détaillé non cadré";
}

function getTerrainFeedbackHref(row: ChantierDerived) {
  return `/retours-terrain?chantierId=${encodeURIComponent(row.id)}`;
}

function getTerrainFeedbackLabel(row: ChantierDerived) {
  const priorityCount = row.terrainFeedbackPriorityCount ?? 0;
  const openCount = row.terrainFeedbackOpenCount ?? 0;
  if (priorityCount > 0) return `${priorityCount} urgent${priorityCount > 1 ? "s" : ""}`;
  if (openCount > 0) return `${openCount} à traiter`;
  return "Retours terrain";
}

function PlanningFilterCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  tone: "slate" | "red" | "amber";
  active: boolean;
  onClick: () => void;
}) {
  const toneClass =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-950";
  const activeClass = active ? "ring-2 ring-blue-300 ring-offset-2" : "hover:bg-white";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left transition ${toneClass} ${activeClass}`}
      aria-pressed={active}
    >
      <div className="text-xs font-semibold uppercase opacity-80">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </button>
  );
}

function ChantierPlanningRow({ row, onPreview }: { row: ChantierDerived; onPreview: (row: ChantierDerived) => void }) {
  const milestone = getPlanningMilestone(row);
  const timingLabel = getPlanningTimingLabel(row);
  const openTerrainFeedbackCount = row.terrainFeedbackOpenCount ?? 0;
  const priorityTerrainFeedbackCount = row.terrainFeedbackPriorityCount ?? 0;
  const hasOpenTerrainFeedbacks = openTerrainFeedbackCount > 0;
  const terrainFeedbackTone = priorityTerrainFeedbackCount > 0
    ? "border-red-200 bg-red-50 text-red-800 hover:border-red-300 hover:bg-red-100"
    : "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100";

  return (
    <div className="grid w-full gap-3 rounded-2xl border border-slate-200 p-3 text-left transition hover:bg-slate-50 md:grid-cols-[160px_minmax(0,1fr)_180px_120px_auto] md:items-center">
      <div>
        <div className="text-sm font-semibold text-slate-950">{shortDate(milestone.date)}</div>
        <div
          className={[
            "mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
            row.isLate
              ? "bg-red-100 text-red-700"
              : milestone.isPlanningDate
                ? "bg-blue-50 text-blue-700"
                : milestone.date
                  ? "bg-slate-100 text-slate-700"
                  : "bg-amber-100 text-amber-800",
          ].join(" ")}
        >
          {timingLabel}
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate font-semibold text-slate-950">{row.nom}</div>
        <div className="truncate text-sm text-slate-500">{row.client ?? "Client non renseigné"}</div>
        <div className="mt-1 text-xs font-medium text-slate-500">{getPlanningWindowLabel(row)}</div>
        {hasOpenTerrainFeedbacks ? (
          <Link
            to={getTerrainFeedbackHref(row)}
            className={`mt-2 inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition ${terrainFeedbackTone}`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {getTerrainFeedbackLabel(row)}
          </Link>
        ) : null}
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
            to={getTerrainFeedbackHref(row)}
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
  const hasOpenTerrainFeedbacks = (row.terrainFeedbackOpenCount ?? 0) > 0;
  const terrainFeedbackTone = (row.terrainFeedbackPriorityCount ?? 0) > 0
    ? "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
    : "border-amber-200 bg-white text-amber-900 hover:bg-amber-100";

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
          to={getTerrainFeedbackHref(row)}
          className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${terrainFeedbackTone}`}
        >
          Retours terrain{hasOpenTerrainFeedbacks ? ` · ${getTerrainFeedbackLabel(row)}` : ""}
          <AlertTriangle className="h-4 w-4" />
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
  const [activeFilter, setActiveFilter] = useState<PlanningFilter>("all");
  const filteredRows = useMemo(
    () => rows.filter((row) => matchesPlanningFilter(row, activeFilter)),
    [activeFilter, rows],
  );
  const scheduledRows = filteredRows
    .filter((row) => getPlanningMilestone(row).date)
    .sort(comparePlanningRows);
  const unplannedRows = filteredRows
    .filter((row) => !getPlanningMilestone(row).date)
    .sort(comparePlanningRows);
  const lateCount = rows.filter((row) => row.isLate).length;
  const toPlanCount = rows.filter((row) => !getPlanningMilestone(row).date).length;
  const activeCount = rows.length;
  const openTerrainFeedbackCount = rows.reduce((total, row) => total + (row.terrainFeedbackOpenCount ?? 0), 0);
  const priorityTerrainFeedbackCount = rows.reduce((total, row) => total + (row.terrainFeedbackPriorityCount ?? 0), 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Planning chantiers</h2>
          <p className="text-sm text-slate-500">Vue chronologique priorisée par les retours terrain urgents, les alertes ouvertes et les échéances chantier.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-4 lg:min-w-[520px]">
          <PlanningFilterCard
            label="Chantiers"
            value={activeCount}
            tone="slate"
            active={activeFilter === "all"}
            onClick={() => setActiveFilter("all")}
          />
          <PlanningFilterCard
            label="En retard"
            value={lateCount}
            tone="red"
            active={activeFilter === "late"}
            onClick={() => setActiveFilter("late")}
          />
          <PlanningFilterCard
            label="À planifier"
            value={toPlanCount}
            tone="amber"
            active={activeFilter === "unplanned"}
            onClick={() => setActiveFilter("unplanned")}
          />
          <PlanningFilterCard
            label="Retours terrain"
            value={priorityTerrainFeedbackCount > 0 ? `${priorityTerrainFeedbackCount} urgents` : openTerrainFeedbackCount}
            tone={priorityTerrainFeedbackCount > 0 ? "red" : "amber"}
            active={activeFilter === "terrain" || activeFilter === "priority"}
            onClick={() => setActiveFilter(priorityTerrainFeedbackCount > 0 ? "priority" : "terrain")}
          />
        </div>
      </div>

      {activeFilter !== "all" ? (
        <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Filtre actif : <strong>{PLANNING_FILTER_LABELS[activeFilter]}</strong> · {filteredRows.length} chantier{filteredRows.length > 1 ? "s" : ""} affiché{filteredRows.length > 1 ? "s" : ""}.
          </span>
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className="rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
          >
            Réinitialiser
          </button>
        </div>
      ) : null}

      {unplannedRows.length > 0 ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-amber-950">Chantiers à cadrer</h3>
              <p className="text-sm text-amber-800">Ces dossiers n'ont pas encore de jalon chantier exploitable ; ceux avec retours terrain ouverts remontent en premier.</p>
            </div>
            <span className="text-xs font-semibold uppercase text-amber-700">{unplannedRows.length} à reprendre</span>
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
        ) : unplannedRows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Aucun chantier ne correspond au filtre planning actif.
          </div>
        ) : null}
      </div>
    </section>
  );
}