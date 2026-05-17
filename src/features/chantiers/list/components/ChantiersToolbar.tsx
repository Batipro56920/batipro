import { Search } from "lucide-react";
import type { ChantierStatus } from "../../../../types/chantier";
import { Input } from "../../../../components/ui/input";
import type { ChantierListFilter, ChantierListFilters, ChantierListView } from "../types";
import { statusLabel } from "../utils/chantiersListUtils";

const SCOPES: Array<{ key: ChantierListFilter; label: string }> = [
  { key: "actifs", label: "Actifs" },
  { key: "termines", label: "Terminés" },
  { key: "archives", label: "Archivés" },
  { key: "annules", label: "Annulés" },
  { key: "all", label: "Tous" },
];

const STATUSES: Array<"all" | ChantierStatus> = ["all", "BROUILLON", "PREPARATION", "EN_COURS", "EN_PAUSE", "TERMINE", "ARCHIVE", "ANNULE"];
const VIEWS: Array<{ key: ChantierListView; label: string }> = [
  { key: "list", label: "Liste" },
  { key: "cards", label: "Cartes" },
  { key: "planning", label: "Planning" },
  { key: "kanban", label: "Kanban" },
];

type Props = {
  scope: ChantierListFilter;
  onScope: (scope: ChantierListFilter) => void;
  filters: ChantierListFilters;
  onFilters: (filters: ChantierListFilters) => void;
  clients: string[];
  view: ChantierListView;
  onView: (view: ChantierListView) => void;
  onRefresh: () => void;
};

export function ChantiersToolbar({ scope, onScope, filters, onFilters, clients, view, onView, onRefresh }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-950/[0.03]">
      <div className="flex flex-wrap items-center gap-2">
        {SCOPES.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={["rounded-xl px-3 py-2 text-sm font-medium transition", scope === entry.key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"].join(" ")}
            onClick={() => onScope(entry.key)}
          >
            {entry.label}
          </button>
        ))}
        <button type="button" className="ml-auto rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onRefresh}>
          Rafraîchir
        </button>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(260px,1fr)_repeat(5,minmax(130px,170px))]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-9" value={filters.query} onChange={(event) => onFilters({ ...filters, query: event.target.value })} placeholder="Rechercher chantier, client, adresse..." />
        </label>
        <select className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={filters.status} onChange={(event) => onFilters({ ...filters, status: event.target.value as ChantierListFilters["status"] })}>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status === "all" ? "Tous statuts" : statusLabel(status)}
            </option>
          ))}
        </select>
        <select className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={filters.client} onChange={(event) => onFilters({ ...filters, client: event.target.value })}>
          <option value="">Tous clients</option>
          {clients.map((client) => (
            <option key={client} value={client}>{client}</option>
          ))}
        </select>
        <select className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={filters.conducteur} onChange={(event) => onFilters({ ...filters, conducteur: event.target.value })} disabled title="Conducteur à relier aux profils chantier.">
          <option value="">Conducteur</option>
        </select>
        <select className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={filters.commercial} onChange={(event) => onFilters({ ...filters, commercial: event.target.value })} disabled title="Commercial à relier au CRM.">
          <option value="">Commercial</option>
        </select>
        <select className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={filters.period} onChange={(event) => onFilters({ ...filters, period: event.target.value as ChantierListFilters["period"] })}>
          <option value="all">Toute période</option>
          <option value="this_month">Ce mois</option>
          <option value="next_30">30 prochains jours</option>
          <option value="late">En retard</option>
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <select className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={filters.type} onChange={(event) => onFilters({ ...filters, type: event.target.value })} disabled title="Type chantier à brancher quand la donnée existe.">
          <option value="">Type chantier</option>
        </select>
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          {VIEWS.map((entry) => (
            <button key={entry.key} type="button" onClick={() => onView(entry.key)} className={["rounded-lg px-3 py-1.5 text-sm font-medium transition", view === entry.key ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-950"].join(" ")}>
              {entry.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

