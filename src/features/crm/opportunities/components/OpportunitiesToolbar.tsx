import { Search } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { OpportunityFilters } from "../types";

export function OpportunitiesToolbar({
  filters,
  setFilters,
  owners,
  sources,
}: {
  filters: OpportunityFilters;
  setFilters: Dispatch<SetStateAction<OpportunityFilters>>;
  owners: string[];
  sources: string[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="grid gap-2 lg:grid-cols-[minmax(260px,1fr)_repeat(5,minmax(140px,180px))]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.query}
            onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
            placeholder="Rechercher affaire, client, notes..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select value={filters.owner} onChange={(event) => setFilters((current) => ({ ...current, owner: event.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <option value="all">Tous commerciaux</option>
          {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
        </select>
        <select value={filters.source} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <option value="all">Toutes sources</option>
          {sources.map((source) => <option key={source} value={source}>{source}</option>)}
        </select>
        <select value={filters.budget} onChange={(event) => setFilters((current) => ({ ...current, budget: event.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <option value="all">Tous budgets</option>
          <option value="small">Moins de 5k€</option>
          <option value="medium">5k€ à 20k€</option>
          <option value="large">Plus de 20k€</option>
        </select>
        <select value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <option value="all">Toute date</option>
          <option value="week">Créé semaine</option>
          <option value="month">Créé mois</option>
        </select>
        <select value={filters.temperature} onChange={(event) => setFilters((current) => ({ ...current, temperature: event.target.value as OpportunityFilters["temperature"] }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <option value="all">Tous statuts</option>
          <option value="hot">Chaud</option>
          <option value="warm">Tiède</option>
          <option value="cold">Froid</option>
          <option value="won">Gagné</option>
          <option value="lost">Perdu</option>
        </select>
      </div>
    </section>
  );
}
