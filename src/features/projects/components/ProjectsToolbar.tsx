import type { Dispatch, SetStateAction } from "react";
import type { ProjectFilters, ProjectStatus } from "../types";
import { projectStatusLabel } from "../utils/projectMappers";

const STATUS_OPTIONS: Array<"all" | ProjectStatus> = [
  "all",
  "nouveau",
  "qualification",
  "rdv_planifie",
  "visite_effectuee",
  "chiffrage",
  "devis_envoye",
  "negociation",
  "accepte",
  "preparation_chantier",
  "en_chantier",
  "cloture",
  "sav",
  "perdu",
];

export function ProjectsToolbar({
  filters,
  setFilters,
  projectTypes,
}: {
  filters: ProjectFilters;
  setFilters: Dispatch<SetStateAction<ProjectFilters>>;
  projectTypes: string[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
      <input
        value={filters.query}
        onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
        placeholder="Rechercher projet, client, adresse..."
        className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      <select
        value={filters.status}
        onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as ProjectFilters["status"] }))}
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {status === "all" ? "Tous les statuts" : projectStatusLabel(status)}
          </option>
        ))}
      </select>
      <select
        value={filters.type}
        onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <option value="all">Tous les types</option>
        {projectTypes.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
    </div>
  );
}
