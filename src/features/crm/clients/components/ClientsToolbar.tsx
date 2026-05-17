import { Search } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { ClientFilters, ClientView } from "../types";
import { ClientViewSwitcher } from "./ClientViewSwitcher";

export function ClientsToolbar({
  filters,
  setFilters,
  types,
  view,
  setView,
}: {
  filters: ClientFilters;
  setFilters: Dispatch<SetStateAction<ClientFilters>>;
  types: string[];
  view: ClientView;
  setView: (value: ClientView) => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.query}
            onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
            placeholder="Rechercher nom, email, téléphone, société, projet..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <ClientViewSwitcher value={view} onChange={setView} />
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <option value="all">Tous types</option>
          {types.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        <select value={filters.owner} onChange={(event) => setFilters((current) => ({ ...current, owner: event.target.value }))} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700" disabled title="Commercial client à connecter">
          <option value="all">Tous commerciaux</option>
        </select>
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <option value="all">Tous statuts</option>
          <option value="active">Actifs</option>
          <option value="archived">Archivés</option>
        </select>
        <select value={filters.chantier} onChange={(event) => setFilters((current) => ({ ...current, chantier: event.target.value }))} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <option value="all">Tous chantiers</option>
          <option value="active">Chantier actif</option>
          <option value="none">Sans chantier</option>
        </select>
        <select value={filters.sav} onChange={(event) => setFilters((current) => ({ ...current, sav: event.target.value }))} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <option value="all">Tous SAV</option>
          <option value="open">SAV ouvert</option>
          <option value="none">Sans SAV ouvert</option>
        </select>
        <select value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <option value="all">Toute date</option>
          <option value="week">Créé semaine</option>
          <option value="month">Créé mois</option>
        </select>
      </div>
    </section>
  );
}
