import { Search } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { ProspectFilters, ProspectQuickFilter, ProspectView } from "../types";
import { ProspectViewSwitcher } from "./ProspectViewSwitcher";

const quickFilters: Array<{ key: ProspectQuickFilter; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "followup", label: "À relancer" },
  { key: "hot", label: "Chauds" },
  { key: "lost", label: "Sans suite" },
  { key: "converted", label: "Convertis" },
];

export function ProspectsFilterBar({
  query,
  setQuery,
  filters,
  setFilters,
  statuses,
  sources,
  owners,
  view,
  setView,
}: {
  query: string;
  setQuery: (value: string) => void;
  filters: ProspectFilters;
  setFilters: Dispatch<SetStateAction<ProspectFilters>>;
  statuses: string[];
  sources: string[];
  owners: string[];
  view: ProspectView;
  setView: (value: ProspectView) => void;
}) {
  return (
    <section className="rounded-surface border border-subtle bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un prospect, email, ville, projet..."
            className="bt-control h-10 w-full rounded-field border border-subtle bg-surface pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <ProspectViewSwitcher value={view} onChange={setView} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {quickFilters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setFilters((current) => ({ ...current, quick: filter.key }))}
            className={["bt-control rounded-full border px-3 py-1.5 text-xs font-semibold transition", filters.quick === filter.key ? "border-primary/20 bg-primary-soft text-primary-on" : "border-subtle text-ink-secondary hover:bg-interactive"].join(" ")}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="bt-control h-9 rounded-field border border-subtle bg-surface px-3 text-sm text-ink">
          <option value="all">Tous les statuts</option>
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select value={filters.source} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))} className="bt-control h-9 rounded-field border border-subtle bg-surface px-3 text-sm text-ink">
          <option value="all">Toutes sources</option>
          {sources.map((source) => <option key={source} value={source}>{source}</option>)}
        </select>
        <select value={filters.owner} onChange={(event) => setFilters((current) => ({ ...current, owner: event.target.value }))} className="bt-control h-9 rounded-field border border-subtle bg-surface px-3 text-sm text-ink">
          <option value="all">Tous commerciaux</option>
          {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
        </select>
        <select value={filters.budget} onChange={(event) => setFilters((current) => ({ ...current, budget: event.target.value }))} className="bt-control h-9 rounded-field border border-subtle bg-surface px-3 text-sm text-ink">
          <option value="all">Tous budgets</option>
          <option value="with_budget">Budget renseigné</option>
          <option value="high">Budget élevé</option>
        </select>
        <select value={filters.createdAt} onChange={(event) => setFilters((current) => ({ ...current, createdAt: event.target.value }))} className="bt-control h-9 rounded-field border border-subtle bg-surface px-3 text-sm text-ink">
          <option value="all">Toute date</option>
          <option value="week">Créé cette semaine</option>
          <option value="month">Créé ce mois</option>
        </select>
        <select value={filters.due} onChange={(event) => setFilters((current) => ({ ...current, due: event.target.value }))} className="bt-control h-9 rounded-field border border-subtle bg-surface px-3 text-sm text-ink">
          <option value="all">Toute relance</option>
          <option value="to_follow">Relance due</option>
        </select>
      </div>
    </section>
  );
}
