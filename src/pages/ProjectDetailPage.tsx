import { Link, useParams } from "react-router-dom";
import { ProjectDetailHeader } from "../features/projects/components/ProjectDetailHeader";
import {
  ProjectChantierSection,
  ProjectDocumentsSection,
  ProjectOverviewSection,
  ProjectPreparationSection,
  ProjectQuotesSection,
  ProjectSavSection,
  ProjectTimelineSection,
  ProjectVisitsSection,
} from "../features/projects/components/ProjectDetailSections";
import { useProjectsData } from "../features/projects/hooks/useProjectsData";

export default function ProjectDetailPage() {
  const { id } = useParams();
  const { projectsById, loading, error } = useProjectsData();
  const project = id ? projectsById.get(id) : null;

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Chargement du projet...
      </div>
    );
  }

  if (error) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  if (!project) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="text-lg font-semibold text-slate-950">Projet introuvable</div>
        <p className="mt-2 text-sm text-slate-500">Le dossier demandé n’existe pas ou n’est plus accessible.</p>
        <Link
          to="/projets"
          className="mt-5 inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Retour aux projets
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProjectDetailHeader project={project} />
      <ProjectOverviewSection project={project} />
      <ProjectVisitsSection project={project} />
      <ProjectQuotesSection project={project} />
      <ProjectDocumentsSection project={project} />
      <ProjectPreparationSection project={project} />
      <ProjectChantierSection project={project} />
      <ProjectSavSection project={project} />
      <ProjectTimelineSection project={project} />
    </div>
  );
}
