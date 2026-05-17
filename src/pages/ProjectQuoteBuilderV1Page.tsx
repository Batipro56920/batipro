import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QuoteBuilderWorkspace } from "../features/quotes/builder/QuoteBuilderWorkspace";
import { loadQuoteBuilder } from "../features/quotes/builder/quoteBuilderRepository";
import { useQuoteBuilderStore } from "../features/quotes/builder/quoteBuilderStore";
import { QuoteDocumentLoader } from "../features/quotes/builder/QuoteBuilderWorkspace";
import { useProjectsData } from "../features/projects/hooks/useProjectsData";

export default function ProjectQuoteBuilderV1Page() {
  const { projectId, quoteId } = useParams();
  const navigate = useNavigate();
  const { projectsById, loading, error } = useProjectsData();
  const project = projectId ? projectsById.get(projectId) ?? null : null;
  const quote = useQuoteBuilderStore((state) => state.quote);
  const hydrate = useQuoteBuilderStore((state) => state.hydrate);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    void loadQuoteBuilder(project, quoteId).then((loaded) => {
      if (!cancelled) hydrate(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrate, project, quoteId]);

  if (loading || (project && !quote)) return <QuoteDocumentLoader />;

  if (error || !project) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error ?? "Projet introuvable."}</div>;
  }

  return <QuoteBuilderWorkspace onClose={() => navigate(`/projets/${project.id}?tab=quotes`)} />;
}
