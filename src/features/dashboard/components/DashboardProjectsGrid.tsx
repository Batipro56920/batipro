import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { EmptyState, StatusBadge } from "../../../components/ui/design-system";
import type { DashboardProjectCard } from "../types";

type DashboardProjectsGridProps = {
  projects: DashboardProjectCard[];
};

const badgeTone = {
  normal: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
} as const;

export function DashboardProjectsGrid({ projects }: DashboardProjectsGridProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Production</div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Chantiers en cours</h2>
        </div>
        <Link to="/chantiers">
          <Button variant="secondary" size="sm">Voir tous les chantiers</Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title="Aucun chantier actif"
          description="Créez un chantier pour alimenter le cockpit opérationnel."
          action={
            <Link to="/chantiers/nouveau">
              <Button variant="primary" size="sm">Nouveau chantier</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((project) => (
            <Link key={project.id} to={project.href} className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-950">{project.name}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{project.client}</div>
                </div>
                <StatusBadge tone={badgeTone[project.statusTone]}>{project.status}</StatusBadge>
              </div>
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                  <span>Avancement</span>
                  <span className="font-semibold text-slate-700">{Math.round(project.progress)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${project.progress}%` }} />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{project.finishLabel}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
              </div>
              <div className="mt-2 truncate text-xs font-medium text-slate-700">{project.nextAction}</div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
