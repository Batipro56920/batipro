import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ProjectDetailHeader } from "../features/projects/components/ProjectDetailHeader";
import {
  ProjectActivityTab,
  ProjectDocumentsTab,
  ProjectQuotesTab,
  ProjectSavTab,
  ProjectSummaryTab,
  ProjectVisitsTab,
} from "../features/projects/components/ProjectDetailSections";
import { ProjectProfitabilityTab } from "../features/projects/components/ProjectProfitabilityTab";
import { useProjectsData } from "../features/projects/hooks/useProjectsData";
import { getApporteurLeads, getApporteursAffaires } from "../services/apporteurs.service";

type ProjectTab = "summary" | "visits" | "quotes" | "profitability" | "documents" | "activity" | "sav";

type ApporteurTracking = {
  label: string;
  path: string;
};

const TABS: Array<{ id: ProjectTab; label: string }> = [
  { id: "summary", label: "Résumé" },
  { id: "visits", label: "RDV / Visites" },
  { id: "quotes", label: "Devis" },
  { id: "profitability", label: "Rentabilite" },
  { id: "documents", label: "Documents" },
  { id: "activity", label: "Activité" },
  { id: "sav", label: "SAV" },
];

function readProjectTab(value: string | null): ProjectTab {
  return TABS.some((tab) => tab.id === value) ? (value as ProjectTab) : "summary";
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { projectsById, loading, error, refresh } = useProjectsData();
  const project = id ? projectsById.get(id) : null;
  const prospectApporteurLabel = project?.prospect?.apporteur_affaire?.trim() || null;
  const tabFromUrl = readProjectTab(searchParams.get("tab"));
  const [activeTab, setActiveTab] = useState<ProjectTab>(tabFromUrl);
  const [apporteurTracking, setApporteurTracking] = useState<ApporteurTracking | null>(null);

  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    setApporteurTracking(
      prospectApporteurLabel
        ? { label: prospectApporteurLabel, path: "/crm/apporteurs" }
        : null,
    );
    if (!project) return;

    const opportunityId = project.opportunity?.id ?? (project.sourceType === "opportunity" ? project.sourceId : null);
    const prospectId = project.prospect?.id ?? (project.sourceType === "prospect" ? project.sourceId : null);
    if (!opportunityId && !prospectId) return;

    let alive = true;
    async function resolveApporteurTracking() {
      try {
        const [leads, apporteurs] = await Promise.all([getApporteurLeads(), getApporteursAffaires()]);
        if (!alive) return;
        const linkedLead = leads.find((lead) => {
          if (opportunityId && lead.crm_opportunity_id === opportunityId) return true;
          return Boolean(prospectId && lead.crm_prospect_id === prospectId);
        });
        if (!linkedLead) {
          setApporteurTracking(
            prospectApporteurLabel
              ? { label: prospectApporteurLabel, path: "/crm/apporteurs" }
              : null,
          );
          return;
        }

        const linkedApporteur = apporteurs.find((apporteur) => apporteur.id === linkedLead.apporteur_id);
        const apporteurLabel = [linkedApporteur?.nom, linkedApporteur?.entreprise].filter(Boolean).join(" - ");
        const params = new URLSearchParams({ leadId: linkedLead.id });
        if (linkedLead.apporteur_id) params.set("apporteurId", linkedLead.apporteur_id);
        setApporteurTracking({
          label: apporteurLabel || prospectApporteurLabel || "Apporteur lié",
          path: `/crm/apporteurs?${params.toString()}`,
        });
      } catch {
        if (!alive) return;
        setApporteurTracking(
          prospectApporteurLabel
            ? { label: prospectApporteurLabel, path: "/crm/apporteurs" }
            : null,
        );
      }
    }

    void resolveApporteurTracking();
    return () => {
      alive = false;
    };
  }, [prospectApporteurLabel, project]);

  function selectTab(tabId: ProjectTab) {
    setActiveTab(tabId);
    if (!id) return;

    const nextSearchParams = new URLSearchParams(searchParams);
    if (tabId === "summary") {
      nextSearchParams.delete("tab");
    } else {
      nextSearchParams.set("tab", tabId);
    }
    const query = nextSearchParams.toString();
    navigate(`/projets/${id}${query ? `?${query}` : ""}`, { replace: true });
  }

  const content = useMemo(() => {
    if (!project) return null;
    if (activeTab === "visits") return <ProjectVisitsTab project={project} />;
    if (activeTab === "quotes") return <ProjectQuotesTab project={project} />;
    if (activeTab === "profitability") return <ProjectProfitabilityTab project={project} />;
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
      <ProjectDetailHeader project={project} onProjectUpdated={refresh} />

      {apporteurTracking ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">Projet issu d'un apporteur d'affaires</div>
              <p className="mt-1 text-amber-800">
                Source commerciale : {apporteurTracking.label}. Le suivi des commissions se pilote dans le module apporteurs.
              </p>
            </div>
            <Link
              to={apporteurTracking.path}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100"
            >
              Ouvrir le suivi apporteurs
            </Link>
          </div>
        </section>
      ) : null}

      <nav className="overflow-x-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Navigation projet">
        <div className="flex min-w-max gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
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
