import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ProjectDetailHeader } from "../features/projects/components/ProjectDetailHeader";
import {
  ProjectDocumentsTab,
  ProjectQuotesTab,
  ProjectSummaryTab,
  ProjectVisitsTab,
} from "../features/projects/components/ProjectDetailSections";
import { ProjectProfitabilityTab } from "../features/projects/components/ProjectProfitabilityTab";
import { useProjectsData } from "../features/projects/hooks/useProjectsData";
import { isApporteurSource } from "../services/crm.service";
import type { ProjectRecord } from "../features/projects/types";
import { getApporteurLeads, getApporteursAffaires } from "../services/apporteurs.service";

type ProjectTab = "summary" | "visits" | "quotes" | "profitability" | "documents";

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
];

function readProjectTab(value: string | null): ProjectTab {
  return TABS.some((tab) => tab.id === value) ? (value as ProjectTab) : "summary";
}

/**
 * Un projet est indexé sous "opportunity-<id>" dès qu'une affaire existe, sinon
 * sous "prospect-<id>". Les raccourcis venant du CRM ne peuvent pas toujours
 * connaître la bonne clé : on retrouve le dossier par son origine.
 */
function resolveProjectAlias(projects: ProjectRecord[], id: string): ProjectRecord | null {
  const separator = id.indexOf("-");
  if (separator < 0) return null;
  const kind = id.slice(0, separator);
  const sourceId = id.slice(separator + 1);
  if (!sourceId) return null;
  if (kind === "prospect") return projects.find((project) => project.prospect?.id === sourceId) ?? null;
  if (kind === "opportunity") return projects.find((project) => project.opportunity?.id === sourceId) ?? null;
  if (kind === "client") return projects.find((project) => project.client?.id === sourceId) ?? null;
  return null;
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { projects, projectsById, loading, error, refresh } = useProjectsData();
  const project = id ? projectsById.get(id) ?? resolveProjectAlias(projects, id) : null;
  // La bannière apporteur n'a de sens que si la provenance en désigne un.
  // "Recommandation" porte aussi le nom de quelqu'un, sans être un apporteur.
  const prospectApporteurLabel = isApporteurSource(project?.prospect?.source_acquisition)
    ? project?.prospect?.apporteur_affaire?.trim() || null
    : null;
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
    return <ProjectSummaryTab project={project} onUpdated={refresh} />;
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

  const projectQuotesPath = `/projets/${project.id}?tab=quotes`;

  return (
    <div className="space-y-5">
      <ProjectDetailHeader project={project} onProjectUpdated={refresh} />

      {apporteurTracking ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">Projet issu d'un apporteur d'affaires</div>
              <p className="mt-1 text-amber-800">
                Source commerciale : {apporteurTracking.label}. Le suivi des commissions se pilote dans le module apporteurs, puis le chiffrage se poursuit dans les devis du projet.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to={apporteurTracking.path}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100"
              >
                Ouvrir le suivi apporteurs
              </Link>
              <Link
                to={projectQuotesPath}
                className="inline-flex h-9 items-center justify-center rounded-xl bg-amber-600 px-3 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Préparer le devis
              </Link>
            </div>
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
