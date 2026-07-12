import { useCallback, useEffect, useMemo, useState } from "react";
import { loadCrmDataset, type CrmDataset } from "../../../services/crm.service";
import type { ProjectFilters, ProjectRecord } from "../types";
import { buildProjectMetrics, buildProjects } from "../utils/projectMappers";

const DEFAULT_FILTERS: ProjectFilters = {
  query: "",
  status: "all",
  type: "all",
};

const ACTIVE_PRIMARY_QUOTE_STATUSES = new Set<string>([
  "en_preparation",
  "envoye",
  "relance_1",
  "relance_2",
  "vu",
  "negociation",
  "brouillon",
]);

export function useProjectsData() {
  const [dataset, setDataset] = useState<CrmDataset | null>(null);
  const [filters, setFilters] = useState<ProjectFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDataset(await loadCrmDataset());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les projets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const projects = useMemo(() => (dataset ? buildProjects(dataset) : []), [dataset]);

  const filteredProjects = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesQuery =
        !query ||
        [
          project.id,
          project.sourceId,
          project.name,
          project.clientName,
          project.address,
          project.projectType,
          project.sourceLabel,
          project.prospect?.source_acquisition,
          project.prospect?.apporteur_affaire,
          ...project.quotes.flatMap((quote) => [quote.id, quote.quote_number]),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus = filters.status === "all" || project.status === filters.status;
      const matchesType = filters.type === "all" || project.projectType === filters.type;
      return matchesQuery && matchesStatus && matchesType;
    });
  }, [filters, projects]);

  const metrics = useMemo(() => buildProjectMetrics(projects), [projects]);

  const projectTypes = useMemo(
    () => Array.from(new Set(projects.map((project) => project.projectType).filter(Boolean) as string[])).sort(),
    [projects],
  );

  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  return {
    dataset,
    projects,
    filteredProjects,
    projectsById,
    metrics,
    projectTypes,
    filters,
    setFilters,
    loading,
    error,
    refresh,
  };
}

function quoteActivityDate(quote: ProjectRecord["quotes"][number]) {
  return String(quote.accepted_at ?? quote.updated_at ?? quote.created_at ?? "");
}

function latestQuote(quotes: ProjectRecord["quotes"]) {
  return [...quotes].sort((a, b) => quoteActivityDate(b).localeCompare(quoteActivityDate(a)))[0] ?? null;
}

export function getPrimaryQuote(project: ProjectRecord) {
  const chantierIds = new Set(project.chantiers.map((chantier) => chantier.id));
  const quoteLinkedToProduction = latestQuote(
    project.quotes.filter(
      (quote) =>
        quote.statut === "accepte" &&
        Boolean(quote.chantier_id && chantierIds.has(quote.chantier_id)),
    ),
  );
  if (quoteLinkedToProduction) return quoteLinkedToProduction;

  const acceptedQuote = latestQuote(project.quotes.filter((quote) => quote.statut === "accepte"));
  if (acceptedQuote) return acceptedQuote;

  const activeQuote = latestQuote(project.quotes.filter((quote) => ACTIVE_PRIMARY_QUOTE_STATUSES.has(quote.statut)));
  if (activeQuote) return activeQuote;

  return latestQuote(project.quotes);
}
