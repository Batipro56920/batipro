import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ProjectDetailHeader } from "../features/projects/components/ProjectDetailHeader";
import {
  ProjectActivityTab,
  ProjectDocumentsTab,
  ProjectQuotesTab,
  ProjectSavTab,
  ProjectSummaryTab,
  ProjectVisitsTab,
} from "../features/projects/components/ProjectDetailSections";
import { useProjectsData } from "../features/projects/hooks/useProjectsData";

type ProjectTab = "summary" | "visits" | "quotes" | "documents" | "activity" | "sav";

const TABS: Array<{ id: ProjectTab; label: string }> = [
  { id: "summary", label: "Résumé" },
  { id: "visits", label: "RDV / Visites" },
  { id: "quotes", label: "Devis" },
  { id: "documents", label: "Documents" },
  { id: "activity", label: "Activité" },
  { id: "sav", label: "SAV" },
];

export default function ProjectDetailPage() {
  const { id } = useParams();
  const { projectsById, loading, error } = useProjectsData();
  const project = id ? projectsById.get(id) : null;
  const [activeTab, setActiveTab] = useState<ProjectTab>("summary");

  const content = useMemo(() => {
    if (!project) return null;
    if (activeTab === "visits") return <ProjectVisitsTab project={project} />;
    if (activeTab === "quotes") return <ProjectQuotesTab project={project} />;
    if (activeTab === "documents") return <ProjectDocumentsTab project={project} />;
    if (activeTab === "activity") return <ProjectActivityTab project={project} />;
    if (activeTab === "sav") return <ProjectSavTab project={project} />;
    return <ProjectSummaryTab project={project} />;
  }, [activeTab, project]);

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
    <div className="space-y-5">
      <ProjectDetailHeader project={project} />

      <nav className="overflow-x-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Navigation projet">
        <div className="flex min-w-max gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "h-10 rounded-2xl px-4 text-sm font-semibold transition",
                activeTab === tab.id
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {content}
    </div>
  );
}
