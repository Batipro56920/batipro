import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, ClipboardCheck, ClipboardList, Clock3, Eye, FileText, Hammer, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { TONE_SOFT, type Tone } from "../../../../design-system/tone";
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

const CHIP_CLASS = "bt-tap inline-flex items-center gap-1.5 rounded-field px-2 text-[13px] font-medium transition-opacity duration-[120ms] hover:opacity-80";

const NEUTRAL_CHIP_CLASS =
  "bt-tap inline-flex items-center gap-1.5 rounded-field border border-strong bg-surface px-2 text-[13px] font-medium text-ink-secondary transition-colors duration-[120ms] hover:bg-interactive hover:text-ink";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getChantierHref(row: ChantierDerived, section?: string) {
  const basePath = `/chantiers/${encodeURIComponent(row.id)}`;
  return section ? `${basePath}/${section}` : basePath;
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

function getNextPlanningAction(row: ChantierDerived) {
  const priorityCount = row.terrainFeedbackPriorityCount ?? 0;
  const openCount = row.terrainFeedbackOpenCount ?? 0;
  const milestone = getPlanningMilestone(row);

  if (priorityCount > 0) {
    return {
      href: getTerrainFeedbackHref(row),
      label: "Traiter urgence terrain",
      description: "Retour urgent avant recalage planning.",
      tone: "danger" as Tone,
    };
  }

  if (openCount > 0) {
    return {
      href: getTerrainFeedbackHref(row),
      label: "Traiter retour terrain",
      description: "Observation ouverte à arbitrer.",
      tone: "warning" as Tone,
    };
  }

  if (!milestone.date) {
    return {
      href: getChantierHref(row, "preparation"),
      label: "Cadrer la préparation",
      description: "Jalon chantier manquant.",
      tone: "warning" as Tone,
    };
  }

  if (row.isLate) {
    return {
      href: getChantierHref(row, "planning"),
      label: "Recaler le planning",
      description: "Échéance dépassée à reprendre.",
      tone: "danger" as Tone,
    };
  }

  if (row.progress < 100) {
    return {
      href: getChantierHref(row, "execution"),
      label: "Piloter l'exécution",
      description: `${row.progress}% d'avancement chantier.`,
      tone: "info" as Tone,
    };
  }

  return {
    href: getChantierHref(row),
    label: "Contrôler le dossier",
    description: "Chantier à vérifier avant clôture.",
    tone: "normal" as Tone,
  };
}

function toneChipClass(tone: Tone) {
  return tone === "normal" ? NEUTRAL_CHIP_CLASS : `${CHIP_CLASS} ${TONE_SOFT[tone]}`;
}

function ChantierPlanningRow({ row, onPreview }: { row: ChantierDerived; onPreview: (row: ChantierDerived) => void }) {
  const milestone = getPlanningMilestone(row);
  const timingLabel = getPlanningTimingLabel(row);
  const nextAction = getNextPlanningAction(row);
  const openTerrainFeedbackCount = row.terrainFeedbackOpenCount ?? 0;
  const priorityTerrainFeedbackCount = row.terrainFeedbackPriorityCount ?? 0;
  const hasOpenTerrainFeedbacks = openTerrainFeedbackCount > 0;
  const terrainFeedbackTone: Tone = priorityTerrainFeedbackCount > 0 ? "danger" : "warning";
  const timingTone: Tone = row.isLate ? "danger" : milestone.isPlanningDate ? "info" : milestone.date ? "normal" : "warning";

  return (
    <div className="relative grid w-full gap-3 px-4 py-3 text-left transition-colors duration-[90ms] hover:bg-interactive sm:px-5 md:grid-cols-[150px_minmax(0,1fr)_170px_110px_auto] md:items-start">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${row.isLate ? "bg-danger" : hasOpenTerrainFeedbacks ? "bg-warning" : "bg-transparent"}`} />

      <div>
        <div className="bt-card-title bt-num text-ink">{shortDate(milestone.date)}</div>
        <span className={`bt-caption mt-1 inline-flex rounded-full px-2 py-0.5 ${TONE_SOFT[timingTone]}`}>{timingLabel}</span>
      </div>

      <div className="min-w-0">
        <div className="bt-card-title truncate text-ink">{row.nom}</div>
        <div className="bt-secondary truncate text-muted">{row.client ?? "Client non renseigné"}</div>
        <div className="bt-caption mt-0.5 text-muted">{getPlanningWindowLabel(row)}</div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Link to={nextAction.href} className={toneChipClass(nextAction.tone)} title={nextAction.description}>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            {nextAction.label}
          </Link>
          {hasOpenTerrainFeedbacks ? (
            <Link to={getTerrainFeedbackHref(row)} className={`${CHIP_CLASS} ${TONE_SOFT[terrainFeedbackTone]}`}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              {getTerrainFeedbackLabel(row)}
            </Link>
          ) : null}
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {PLANNING_QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.path} to={getChantierHref(row, link.path)} className={NEUTRAL_CHIP_CLASS}>
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                {link.label}
              </Link>
            );
          })}
          <Link to={getTerrainFeedbackHref(row)} className={`${CHIP_CLASS} ${TONE_SOFT.warning}`}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            Retours terrain
          </Link>
        </div>
      </div>

      <ChantierProgress value={row.progress} />

      <div>
        <ChantierStatusPill status={row.status} />
      </div>

      <div className="flex flex-wrap gap-1.5 md:justify-end">
        <button type="button" onClick={() => onPreview(row)} className={NEUTRAL_CHIP_CLASS}>
          <Eye className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          Aperçu
        </button>
        <Link to={getChantierHref(row)} className={NEUTRAL_CHIP_CLASS}>
          Dossier
        </Link>
        <Link to={nextAction.href} className={toneChipClass(nextAction.tone)} title={nextAction.description}>
          {nextAction.label}
          <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        </Link>
      </div>
    </div>
  );
}

function UnplannedChantierRow({ row, onPreview }: { row: ChantierDerived; onPreview: (row: ChantierDerived) => void }) {
  const hasOpenTerrainFeedbacks = (row.terrainFeedbackOpenCount ?? 0) > 0;
  const terrainFeedbackTone: Tone = (row.terrainFeedbackPriorityCount ?? 0) > 0 ? "danger" : "warning";

  return (
    <div className="relative px-4 py-3 transition-colors duration-[90ms] hover:bg-interactive sm:px-5">
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`bt-caption inline-flex rounded-full px-2 py-0.5 ${TONE_SOFT.warning}`}>À planifier</span>
          <h4 className="bt-card-title mt-1 truncate text-ink">{row.nom}</h4>
          <p className="bt-secondary truncate text-muted">{row.client ?? "Client non renseigné"}</p>
        </div>
        <ChantierStatusPill status={row.status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Link to={getChantierHref(row, "preparation")} className={`${CHIP_CLASS} ${TONE_SOFT.warning}`}>
          Cadrer la préparation
          <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        </Link>
        <Link to={getChantierHref(row, "planning")} className={NEUTRAL_CHIP_CLASS}>
          Ouvrir le planning
          <CalendarDays className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        </Link>
        <Link to={getTerrainFeedbackHref(row)} className={`${CHIP_CLASS} ${TONE_SOFT[terrainFeedbackTone]}`}>
          Retours terrain{hasOpenTerrainFeedbacks ? ` · ${getTerrainFeedbackLabel(row)}` : ""}
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        </Link>
        <Link to={getChantierHref(row)} className={NEUTRAL_CHIP_CLASS}>
          Dossier
        </Link>
        <button type="button" onClick={() => onPreview(row)} className={NEUTRAL_CHIP_CLASS}>
          <Eye className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          Aperçu
        </button>
      </div>
    </div>
  );
}

export function ChantiersPlanningView({ rows, onPreview }: { rows: ChantierDerived[]; onPreview: (row: ChantierDerived) => void }) {
  const [activeFilter, setActiveFilter] = useState<PlanningFilter>("all");
  const filteredRows = useMemo(() => rows.filter((row) => matchesPlanningFilter(row, activeFilter)), [activeFilter, rows]);
  const scheduledRows = filteredRows.filter((row) => getPlanningMilestone(row).date).sort(comparePlanningRows);
  const unplannedRows = filteredRows.filter((row) => !getPlanningMilestone(row).date).sort(comparePlanningRows);
  const lateCount = rows.filter((row) => row.isLate).length;
  const toPlanCount = rows.filter((row) => !getPlanningMilestone(row).date).length;
  const activeCount = rows.length;
  const openTerrainFeedbackCount = rows.reduce((total, row) => total + (row.terrainFeedbackOpenCount ?? 0), 0);
  const priorityTerrainFeedbackCount = rows.reduce((total, row) => total + (row.terrainFeedbackPriorityCount ?? 0), 0);

  const measures: Array<{ key: PlanningFilter; label: string; value: string | number; target: PlanningFilter }> = [
    { key: "all", label: "Chantiers", value: activeCount, target: "all" },
    { key: "late", label: "En retard", value: lateCount, target: "late" },
    { key: "unplanned", label: "À planifier", value: toPlanCount, target: "unplanned" },
    {
      key: "terrain",
      label: "Retours terrain",
      value: priorityTerrainFeedbackCount > 0 ? `${priorityTerrainFeedbackCount} urgents` : openTerrainFeedbackCount,
      target: priorityTerrainFeedbackCount > 0 ? "priority" : "terrain",
    },
  ];

  return (
    <section className="overflow-hidden rounded-card border border-subtle bg-surface">
      <div className="px-4 py-3 sm:px-5">
        <h2 className="bt-section-title text-ink">Planning chantiers</h2>
        <p className="bt-secondary mt-0.5 max-w-3xl text-muted">
          Vue chronologique priorisée par les retours terrain urgents, les alertes ouvertes et les échéances chantier.
        </p>
      </div>

      {/* Bande de mesures cliquables (annexe C) : elle remplace les cartes de filtre. */}
      <div
        role="group"
        aria-label="Filtres du planning"
        className="grid grid-cols-2 divide-x divide-y divide-subtle border-y border-subtle sm:grid-cols-4 sm:divide-y-0"
      >
        {measures.map((measure) => {
          const active = measure.key === "terrain" ? activeFilter === "terrain" || activeFilter === "priority" : activeFilter === measure.key;
          return (
            <button
              key={measure.key}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveFilter(measure.target)}
              className="group bt-tap relative px-4 py-2.5 text-left transition-colors duration-[90ms] hover:bg-interactive focus-visible:outline-offset-[-2px] sm:px-5"
            >
              <span
                className={`bt-caption block truncate transition-colors duration-[90ms] ${
                  active ? "text-primary-on" : "text-muted group-hover:text-ink-secondary"
                }`}
              >
                {measure.label}
              </span>
              <span className="bt-num mt-0.5 block text-[18px] font-[650] leading-[22px] text-ink">{measure.value}</span>
              {active ? <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" /> : null}
            </button>
          );
        })}
      </div>

      {activeFilter !== "all" ? (
        <div className="bt-secondary flex flex-col gap-2 border-b border-subtle px-4 py-2 text-ink-secondary sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span>
            Filtre actif : <strong className="text-ink">{PLANNING_FILTER_LABELS[activeFilter]}</strong> <span aria-hidden>·</span>{" "}
            <span className="bt-num">{filteredRows.length}</span> chantier{filteredRows.length > 1 ? "s" : ""} affiché{filteredRows.length > 1 ? "s" : ""}.
          </span>
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className="bt-tap shrink-0 rounded-field px-2.5 text-[13px] font-medium text-ink-secondary transition-colors duration-[120ms] hover:bg-interactive hover:text-ink"
          >
            Réinitialiser
          </button>
        </div>
      ) : null}

      {unplannedRows.length > 0 ? (
        <div className="border-b border-subtle">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 pt-3 sm:px-5">
            <h3 className="bt-card-title text-ink">Chantiers à cadrer</h3>
            <span className="bt-caption bt-num text-muted">{unplannedRows.length} à reprendre</span>
          </div>
          <p className="bt-secondary px-4 pb-2 pt-0.5 text-muted sm:px-5">
            Ces dossiers n'ont pas encore de jalon chantier exploitable ; ceux avec retours terrain ouverts remontent en premier.
          </p>
          <div className="divide-y divide-subtle border-t border-subtle">
            {unplannedRows.map((row) => (
              <UnplannedChantierRow key={row.id} row={row} onPreview={onPreview} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="divide-y divide-subtle">
        {scheduledRows.length > 0 ? (
          scheduledRows.map((row) => <ChantierPlanningRow key={row.id} row={row} onPreview={onPreview} />)
        ) : unplannedRows.length === 0 ? (
          <p className="bt-secondary px-4 py-10 text-center text-muted sm:px-5">Aucun chantier ne correspond au filtre planning actif.</p>
        ) : null}
      </div>
    </section>
  );
}
