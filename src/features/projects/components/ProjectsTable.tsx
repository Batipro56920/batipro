import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { ProjectRecord } from "../types";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { formatCurrency, formatDate } from "./ProjectShared";

export function ProjectsTable({ projects }: { projects: ProjectRecord[] }) {
  if (!projects.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="text-lg font-semibold text-slate-950">Aucun projet trouvé</div>
        <p className="mt-2 text-sm text-slate-500">Créez un prospect ou une opportunité pour initialiser un dossier projet.</p>
        <Link
          to="/crm/prospects"
          className="mt-5 inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Ajouter un prospect
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Projet</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Adresse</th>
              <th className="px-4 py-3">Commercial</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Prochaine action</th>
              <th className="px-4 py-3 text-right">Montant devis</th>
              <th className="px-4 py-3">Création</th>
              <th className="px-4 py-3">Échéance</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((project) => (
              <tr key={project.id} className="transition hover:bg-slate-50/80">
                <td className="max-w-[260px] px-4 py-3">
                  <Link to={`/projets/${project.id}`} className="font-semibold text-slate-950 hover:text-blue-700">
                    {project.name}
                  </Link>
                  <div className="mt-1 truncate text-xs text-slate-500">{project.projectType || "Type à qualifier"}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">{project.clientName}</td>
                <td className="max-w-[220px] truncate px-4 py-3 text-slate-500">{project.address || "Adresse à renseigner"}</td>
                <td className="px-4 py-3 text-slate-500">{project.salesperson || "À assigner"}</td>
                <td className="px-4 py-3">
                  <ProjectStatusBadge status={project.status} />
                </td>
                <td className="max-w-[220px] px-4 py-3">
                  <div className="truncate text-slate-700">{project.nextAction || "Aucune action planifiée"}</div>
                  {project.nextActionDate ? <div className="mt-1 text-xs text-slate-500">{formatDate(project.nextActionDate)}</div> : null}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(project.quoteAmount)}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(project.createdAt)}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(project.desiredDeadline)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/projets/${project.id}`}
                    className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    Ouvrir
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
