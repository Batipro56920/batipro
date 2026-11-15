import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Euro, FileClock, FolderKanban, TrendingDown } from "lucide-react";
import type { ProjectMetrics } from "../types";
import { formatCurrency } from "./ProjectShared";

export function ProjectsKpiGrid({
  metrics,
  followUpsDueMode = false,
}: {
  metrics: ProjectMetrics;
  followUpsDueMode?: boolean;
}) {
  const cards = [
    { label: "Projets actifs", value: metrics.activeProjects, icon: FolderKanban, hint: "Dossiers en cours" },
    { label: "Devis en attente", value: metrics.pendingQuotes, icon: FileClock, hint: "Chiffrage, envoi, négociation" },
    {
      label: "À relancer",
      value: metrics.followUpsDue,
      icon: AlertCircle,
      hint: "Actions dépassées",
      to: "/projets?vue=a-relancer",
      active: followUpsDueMode,
    },
    { label: "Acceptés", value: metrics.acceptedProjects, icon: CheckCircle2, hint: "Signés ou en production" },
    { label: "Perdus", value: metrics.lostProjects, icon: TrendingDown, hint: "Affaires clôturées perdues" },
    { label: "CA pipeline projet", value: formatCurrency(metrics.pipelineAmount), icon: Euro, hint: "Hors perdus et clôturés" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const className = [
          "rounded-3xl border bg-white p-4 shadow-sm transition",
          card.to ? "hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200" : "",
          card.active ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200",
        ].join(" ");
        const content = (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-blue-50 p-2 text-blue-700">
                <Icon className="h-4 w-4" />
              </div>
              {card.to ? <span className="text-xs font-semibold text-blue-700">Voir</span> : null}
            </div>
            <div className="mt-4 text-2xl font-bold text-slate-950">{card.value}</div>
            <div className="mt-1 text-sm font-semibold text-slate-700">{card.label}</div>
            <div className="mt-1 text-xs text-slate-500">{card.hint}</div>
          </>
        );

        return card.to ? (
          <Link
            key={card.label}
            to={card.to}
            className={className}
            aria-current={card.active ? "page" : undefined}
            title="Afficher uniquement les projets dont la relance est échue"
          >
            {content}
          </Link>
        ) : (
          <div key={card.label} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
