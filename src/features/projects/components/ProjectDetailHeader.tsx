import { Link } from "react-router-dom";
import { ArrowLeft, CalendarPlus, FileText, Hammer, RefreshCw } from "lucide-react";
import type { ProjectRecord } from "../types";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { formatCurrency, formatDate } from "./ProjectShared";
import { getPrimaryQuote } from "../hooks/useProjectsData";

export function ProjectDetailHeader({ project }: { project: ProjectRecord }) {
  const quote = getPrimaryQuote(project);
  const chantier = project.chantiers[0] ?? null;

  return (
    <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link to="/projets" className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Projet</span>
            <ProjectStatusBadge status={project.status} />
          </div>
          <h1 className="truncate text-3xl font-bold tracking-tight text-slate-950">{project.name}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {project.clientName} · {project.address || "Adresse à renseigner"} · {formatCurrency(project.quoteAmount)}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>Créé le {formatDate(project.createdAt)}</span>
            <span>Échéance {formatDate(project.desiredDeadline)}</span>
            <span>Commercial {project.salesperson || "à assigner"}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to="/crm/agenda" className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50">
            <CalendarPlus className="h-4 w-4" />
            Planifier RDV
          </Link>
          <Link to={quote ? `/crm/devis/${quote.id}/edit` : "/crm/devis"} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700">
            <FileText className="h-4 w-4" />
            {quote ? "Ouvrir devis" : "Créer devis"}
          </Link>
          {chantier ? (
            <Link to={`/chantiers/${chantier.id}`} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50">
              <Hammer className="h-4 w-4" />
              Ouvrir chantier
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="Disponible après acceptation du devis et création chantier."
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-400"
            >
              <Hammer className="h-4 w-4" />
              Convertir chantier
            </button>
          )}
          <Link to="/crm/agenda" className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
            Relancer
          </Link>
        </div>
      </div>
    </header>
  );
}
