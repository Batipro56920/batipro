import { useCallback, useEffect, useMemo, useState } from "react";
import { loadCrmDataset, type CrmDataset } from "../../../services/crm.service";
import type { ProjectFilters, ProjectRecord } from "../types";
import { buildProjectMetrics, buildProjects } from "../utils/projectMappers";

const DEFAULT_FILTERS: ProjectFilters = {
  query: "",
  status: "all",
  type: "all",
};

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
        [project.name, project.clientName, project.address, project.projectType, project.sourceLabel]
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

export function getPrimaryQuote(project: ProjectRecord) {
  return project.quotes.find((quote) => quote.statut === "accepte") ?? project.quotes[0] ?? null;
}
