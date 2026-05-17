import { AlertCircle, CheckCircle2, Euro, FileClock, FolderKanban, TrendingDown } from "lucide-react";
import type { ProjectMetrics } from "../types";
import { formatCurrency } from "./ProjectShared";

export function ProjectsKpiGrid({ metrics }: { metrics: ProjectMetrics }) {
  const cards = [
    { label: "Projets actifs", value: metrics.activeProjects, icon: FolderKanban, hint: "Dossiers en cours" },
    { label: "Devis en attente", value: metrics.pendingQuotes, icon: FileClock, hint: "Chiffrage, envoi, négociation" },
    { label: "À relancer", value: metrics.followUpsDue, icon: AlertCircle, hint: "Actions dépassées" },
    { label: "Acceptés", value: metrics.acceptedProjects, icon: CheckCircle2, hint: "Signés ou en production" },
    { label: "Perdus", value: metrics.lostProjects, icon: TrendingDown, hint: "Affaires clôturées perdues" },
    { label: "CA pipeline projet", value: formatCurrency(metrics.pipelineAmount), icon: Euro, hint: "Hors perdus et clôturés" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-blue-50 p-2 text-blue-700">
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 text-2xl font-bold text-slate-950">{card.value}</div>
            <div className="mt-1 text-sm font-semibold text-slate-700">{card.label}</div>
            <div className="mt-1 text-xs text-slate-500">{card.hint}</div>
          </div>
        );
      })}
    </div>
  );
}
