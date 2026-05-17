import { Search } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { SavFilters, SavView } from "../types";
import { SavViewSwitcher } from "./SavViewSwitcher";

export function SavToolbar({
  filters,
  setFilters,
  clients,
  chantiers,
  priorities,
  statuses,
  assignees,
  view,
  setView,
}: {
  filters: SavFilters;
  setFilters: Dispatch<SetStateAction<SavFilters>>;
  clients: string[];
  chantiers: string[];
  priorities: string[];
  statuses: string[];
  assignees: string[];
  view: SavView;
  setView: (value: SavView) => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Rechercher ticket, client, chantier..." className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
        </div>
        <SavViewSwitcher value={view} onChange={setView} />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Select value={filters.client} onChange={(value) => setFilters((current) => ({ ...current, client: value }))} all="Tous clients" items={clients} />
        <Select value={filters.chantier} onChange={(value) => setFilters((current) => ({ ...current, chantier: value }))} all="Tous chantiers" items={chantiers} />
        <Select value={filters.priority} onChange={(value) => setFilters((current) => ({ ...current, priority: value }))} all="Toutes priorités" items={priorities} />
        <Select value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} all="Tous statuts" items={statuses} />
        <Select value={filters.assignee} onChange={(value) => setFilters((current) => ({ ...current, assignee: value }))} all="Tous intervenants" items={assignees} />
        <select value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <option value="all">Toute date</option>
          <option value="week">Créé semaine</option>
          <option value="month">Créé mois</option>
        </select>
      </div>
    </section>
  );
}

function Select({ value, onChange, all, items }: { value: string; onChange: (value: string) => void; all: string; items: string[] }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
      <option value="all">{all}</option>
      {items.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  );
}
