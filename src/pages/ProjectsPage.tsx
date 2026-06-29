import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ProjectsHeader } from "../features/projects/components/ProjectsHeader";
import { ProjectsKpiGrid } from "../features/projects/components/ProjectsKpiGrid";
import { ProjectsTable } from "../features/projects/components/ProjectsTable";
import { ProjectsToolbar } from "../features/projects/components/ProjectsToolbar";
import { useProjectsData } from "../features/projects/hooks/useProjectsData";

export default function ProjectsPage() {
  const [searchParams] = useSearchParams();
  const billingMode = searchParams.get("facturation") === "1";
  const quoteCreationMode = searchParams.get("devis") === "nouveau";
  const { filteredProjects, metrics, projectTypes, filters, setFilters, loading, error, refresh } = useProjectsData();
  const visibleProjects = useMemo(() => {
    if (!billingMode) return filteredProjects;
    return filteredProjects.filter((project) => project.quotes.some((quote) => quote.statut === "accepte" && Number(quote.montant_ttc ?? 0) > 0));
  }, [billingMode, filteredProjects]);

  return (
    <div className="space-y-6">
      <ProjectsHeader billingMode={billingMode} onRefresh={refresh} />

      {billingMode ? (
        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          Sélectionnez un projet commercial avec devis accepté. L'action ouvre directement l'onglet Devis pour créer une facture d'acompte, de situation ou finale.
        </div>
      ) : null}

      {quoteCreationMode ? (
        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          Sélectionnez le dossier projet à chiffrer. L'action ouvre directement le Quote Builder pour créer un nouveau devis sur ce projet.
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
        <ProjectsTable projects={visibleProjects} billingMode={billingMode} quoteCreationMode={quoteCreationMode} />
      )}
    </div>
  );
}
