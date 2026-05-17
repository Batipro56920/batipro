import { ProjectsHeader } from "../features/projects/components/ProjectsHeader";
import { ProjectsKpiGrid } from "../features/projects/components/ProjectsKpiGrid";
import { ProjectsTable } from "../features/projects/components/ProjectsTable";
import { ProjectsToolbar } from "../features/projects/components/ProjectsToolbar";
import { useProjectsData } from "../features/projects/hooks/useProjectsData";

export default function ProjectsPage() {
  const { filteredProjects, metrics, projectTypes, filters, setFilters, loading, error, refresh } = useProjectsData();

  return (
    <div className="space-y-6">
      <ProjectsHeader onRefresh={refresh} />

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
        <ProjectsTable projects={filteredProjects} />
      )}
    </div>
  );
}
