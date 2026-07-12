import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ProjectsHeader } from "../features/projects/components/ProjectsHeader";
import { ProjectsKpiGrid } from "../features/projects/components/ProjectsKpiGrid";
import { ProjectsTable } from "../features/projects/components/ProjectsTable";
import { ProjectsToolbar } from "../features/projects/components/ProjectsToolbar";
import { useProjectsData } from "../features/projects/hooks/useProjectsData";
import type { ProjectRecord } from "../features/projects/types";

const QUOTE_CREATION_EXCLUDED_STATUSES = new Set<ProjectRecord["status"]>([
  "accepte",
  "preparation_chantier",
  "en_chantier",
  "cloture",
  "sav",
  "perdu",
]);

function hasAcceptedQuoteAwaitingChantier(project: ProjectRecord) {
  if (project.chantiers.length > 0) return false;
  return project.quotes.some((quote) => quote.statut === "accepte" && !quote.chantier_id);
}

function canCreateNewQuote(project: ProjectRecord) {
  if (project.chantiers.length > 0) return false;
  return !QUOTE_CREATION_EXCLUDED_STATUSES.has(project.status);
}

export default function ProjectsPage() {
  const [searchParams] = useSearchParams();
  const billingMode = searchParams.get("facturation") === "1";
  const quoteCreationMode = searchParams.get("devis") === "nouveau";
  const chantierCreationMode = searchParams.get("chantier") === "a-creer";
  const urlQuery = searchParams.get("q")?.trim() ?? "";
  const { filteredProjects, metrics, projectTypes, filters, setFilters, loading, error, refresh } = useProjectsData();

  useEffect(() => {
    setFilters((current) => (current.query === urlQuery ? current : { ...current, query: urlQuery }));
  }, [setFilters, urlQuery]);

  const visibleProjects = useMemo(() => {
    if (billingMode) {
      return filteredProjects.filter((project) => project.quotes.some((quote) => quote.statut === "accepte" && Number(quote.montant_ttc ?? 0) > 0));
    }
    if (quoteCreationMode) {
      return filteredProjects.filter(canCreateNewQuote);
    }
    if (chantierCreationMode) {
      return filteredProjects.filter(hasAcceptedQuoteAwaitingChantier);
    }
    return filteredProjects;
  }, [billingMode, quoteCreationMode, chantierCreationMode, filteredProjects]);

  return (
    <div className="space-y-6">
      <ProjectsHeader billingMode={billingMode} quoteCreationMode={quoteCreationMode} chantierCreationMode={chantierCreationMode} onRefresh={refresh} />

      {billingMode ? (
        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          Sélectionnez un projet commercial avec devis accepté. L'action ouvre directement l'onglet Devis pour créer une facture d'acompte, de situation ou finale.
        </div>
      ) : null}

      {quoteCreationMode ? (
        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          Sélectionnez le dossier projet à chiffrer. Si un devis brouillon ou en préparation existe déjà, l'action reprend ce devis ; sinon elle ouvre un nouveau devis sur le projet.
        </div>
      ) : null}

      {chantierCreationMode ? (
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
          Sélectionnez une affaire signée non encore rattachée à un chantier. L'action ouvre l'onglet Devis du projet pour lancer la création chantier avec les données du devis accepté.
        </div>
      ) : null}

      {urlQuery ? (
        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
          Recherche projet ouverte depuis un lien entrant : <strong>{urlQuery}</strong>. La recherche couvre les noms, clients, adresses, identifiants projet/source et devis liés.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      <ProjectsKpiGrid metrics={metrics} />
      <ProjectsToolbar filters={filters} setFilters={setFilters} projectTypes={projectTypes} />

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Chargement des projets...
        </div>
      ) : (
        <ProjectsTable
          projects={visibleProjects}
          billingMode={billingMode}
          quoteCreationMode={quoteCreationMode}
          chantierCreationMode={chantierCreationMode}
        />
      )}
    </div>
  );
}
