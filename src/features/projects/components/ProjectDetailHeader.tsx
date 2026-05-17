import { Link } from "react-router-dom";
import { ArrowLeft, CalendarPlus, CheckCircle2, FileText, Hammer, Pencil, RefreshCw, XCircle } from "lucide-react";
import type { ProjectRecord } from "../types";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { formatCurrency, formatDate } from "./ProjectShared";
import { getPrimaryQuote } from "../hooks/useProjectsData";

export function ProjectDetailHeader({ project }: { project: ProjectRecord }) {
  const quote = getPrimaryQuote(project);
  const acceptedQuote = project.quotes.find((item) => item.statut === "accepte");
  const chantier = project.chantiers[0] ?? null;
  const editTarget = project.opportunity ? "/crm/opportunites" : "/crm/prospects";

  return (
    <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link to="/projets" className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50" aria-label="Retour aux projets">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Projet commerce</span>
            <ProjectStatusBadge status={project.status} />
          </div>
          <h1 className="truncate text-3xl font-bold tracking-tight text-slate-950">{project.name}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {project.clientName} · {project.address || "Adresse à renseigner"} · {formatCurrency(project.budgetEstimate || project.quoteAmount)}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>Commercial {project.salesperson || "à assigner"}</span>
            <span>Source {project.sourceLabel || "non renseignée"}</span>
            <span>Échéance {formatDate(project.desiredDeadline)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to={editTarget} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50">
            <Pencil className="h-4 w-4" />
            Modifier
          </Link>
          <Link to={`/projets/${project.id}/visites/nouveau`} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50">
            <CalendarPlus className="h-4 w-4" />
            Visite de chiffrage
          </Link>
          <Link to={quote ? `/crm/devis/${quote.id}/edit` : "/crm/devis"} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700">
            <FileText className="h-4 w-4" />
            {quote ? "Ouvrir devis" : "Créer devis"}
          </Link>
          <Link to="/crm/agenda" className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
            Relancer
          </Link>
          {chantier ? (
            <Link to={`/chantiers/${chantier.id}`} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50">
              <Hammer className="h-4 w-4" />
              Ouvrir chantier
            </Link>
          ) : acceptedQuote ? (
            <Link to="/chantiers/nouveau" className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100">
              <Hammer className="h-4 w-4" />
              Créer chantier
            </Link>
          ) : (
            <button type="button" disabled title="Disponible uniquement après acceptation d’un devis." className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-400">
              <Hammer className="h-4 w-4" />
              Créer chantier
            </button>
          )}
          <button type="button" disabled title="Statut à connecter aux actions métier projet persistées." className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-400">
            <CheckCircle2 className="h-4 w-4" />
            Gagné
          </button>
          <button type="button" disabled title="Statut à connecter aux actions métier projet persistées." className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-400">
            <XCircle className="h-4 w-4" />
            Perdu
          </button>
        </div>
      </div>
    </header>
  );
}
