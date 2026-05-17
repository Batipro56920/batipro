import { Search } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { QuoteFilters } from "../types";

export function QuotesToolbar({
  filters,
  setFilters,
  statuses,
  clients,
}: {
  filters: QuoteFilters;
  setFilters: Dispatch<SetStateAction<QuoteFilters>>;
  statuses: string[];
  clients: string[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="grid gap-2 lg:grid-cols-[minmax(260px,1fr)_repeat(5,minmax(140px,180px))]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.query}
            onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
            placeholder="Rechercher numéro, client, projet..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <option value="all">Tous statuts</option>
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select value={filters.salesperson} onChange={(event) => setFilters((current) => ({ ...current, salesperson: event.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700" disabled title="Commercial à connecter">
          <option value="all">Tous commerciaux</option>
        </select>
        <select value={filters.client} onChange={(event) => setFilters((current) => ({ ...current, client: event.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <option value="all">Tous clients</option>
          {clients.map((client) => <option key={client} value={client}>{client}</option>)}
        </select>
        <select value={filters.period} onChange={(event) => setFilters((current) => ({ ...current, period: event.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <option value="all">Toute période</option>
          <option value="week">Créé semaine</option>
          <option value="month">Créé mois</option>
        </select>
        <select value={filters.amount} onChange={(event) => setFilters((current) => ({ ...current, amount: event.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <option value="all">Tous montants</option>
          <option value="small">Moins de 5k€</option>
          <option value="medium">5k€ à 20k€</option>
          <option value="large">Plus de 20k€</option>
        </select>
      </div>
    </section>
  );
}
