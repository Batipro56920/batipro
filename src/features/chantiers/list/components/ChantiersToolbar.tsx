import { RotateCcw, Search, X } from "lucide-react";
import { useId, type ReactNode } from "react";
import type { ChantierStatus } from "../../../../types/chantier";
import type { ChantierListFilter, ChantierListFilters } from "../types";
import { statusLabel } from "../utils/chantiersListUtils";

const SCOPES: Array<{ key: ChantierListFilter; label: string }> = [
  { key: "actifs", label: "Actifs" },
  { key: "termines", label: "Terminés" },
  { key: "archives", label: "Archivés" },
  { key: "annules", label: "Annulés" },
  { key: "all", label: "Tous" },
];

const STATUSES: Array<"all" | ChantierStatus> = ["all", "BROUILLON", "PREPARATION", "EN_COURS", "EN_PAUSE", "TERMINE", "ARCHIVE", "ANNULE"];

const PERIODS: Array<{ key: ChantierListFilters["period"]; label: string }> = [
  { key: "all", label: "Toute période" },
  { key: "this_month", label: "Ce mois" },
  { key: "next_30", label: "30 prochains jours" },
  { key: "late", label: "En retard" },
  { key: "alerts", label: "Alertes à traiter" },
  { key: "terrain_feedback", label: "Retours terrain ouverts" },
  { key: "terrain_feedback_priority", label: "Retours terrain urgents" },
];

const FIELD_CLASS =
  "bt-control w-full rounded-field border border-strong bg-surface px-3 text-sm text-ink outline-none transition-colors duration-[120ms] focus:border-primary disabled:cursor-not-allowed disabled:border-subtle disabled:bg-interactive disabled:opacity-60";

type Props = {
  scope: ChantierListFilter;
  onScope: (scope: ChantierListFilter) => void;
  filters: ChantierListFilters;
  onFilters: (filters: ChantierListFilters) => void;
  clients: string[];
  onRefresh: () => void;
};

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="bt-caption mb-1.5 block text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Niveau 1 : le filtrage forme une unite manipulable.
 * Le rail de perimetre reprend l'anatomie des onglets de navigation locale ;
 * le selecteur de vue n'est plus ici, il vit sur la ligne de titre de la liste.
 */
export function ChantiersToolbar({ scope, onScope, filters, onFilters, clients, onRefresh }: Props) {
  const id = useId();

  return (
    <section className="overflow-hidden rounded-card border border-subtle bg-surface">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-subtle px-2 [scrollbar-width:none] sm:px-3 [&::-webkit-scrollbar]:hidden">
        <div role="group" aria-label="Périmètre des chantiers" className="flex items-center gap-1">
          {SCOPES.map((entry) => {
            const active = scope === entry.key;
            return (
              <button
                key={entry.key}
                type="button"
                aria-pressed={active}
                onClick={() => onScope(entry.key)}
                className={`bt-control relative shrink-0 px-3 text-sm font-medium transition-colors duration-[120ms] ${
                  active ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {entry.label}
                {active ? <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 bg-primary" /> : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="bt-control ml-auto inline-flex shrink-0 items-center gap-2 rounded-field px-3 text-sm font-medium text-ink-secondary transition-colors duration-[120ms] hover:bg-interactive hover:text-ink"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
          Rafraîchir
        </button>
      </div>

      <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-[minmax(220px,1.6fr)_repeat(5,minmax(0,1fr))]">
        <div className="min-w-0">
          <label htmlFor={`${id}-query`} className="bt-caption mb-1.5 block text-muted">
            Recherche
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
            <input
              id={`${id}-query`}
              type="text"
              className={`${FIELD_CLASS} pl-[34px] pr-9 placeholder:text-muted`}
              value={filters.query}
              onChange={(event) => onFilters({ ...filters, query: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Escape" && filters.query) onFilters({ ...filters, query: "" });
              }}
              placeholder="Chantier, client, adresse..."
            />
            {filters.query ? (
              <button
                type="button"
                aria-label="Effacer la recherche"
                onClick={() => onFilters({ ...filters, query: "" })}
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-field text-muted transition-colors duration-[120ms] hover:bg-interactive hover:text-ink"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            ) : null}
          </div>
        </div>

        <Field label="Statut" htmlFor={`${id}-status`}>
          <select
            id={`${id}-status`}
            className={FIELD_CLASS}
            value={filters.status}
            onChange={(event) => onFilters({ ...filters, status: event.target.value as ChantierListFilters["status"] })}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "Tous statuts" : statusLabel(status)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Client" htmlFor={`${id}-client`}>
          <select
            id={`${id}-client`}
            className={FIELD_CLASS}
            value={filters.client}
            onChange={(event) => onFilters({ ...filters, client: event.target.value })}
          >
            <option value="">Tous clients</option>
            {clients.map((client) => (
              <option key={client} value={client}>
                {client}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Responsable" htmlFor={`${id}-conducteur`}>
          <select
            id={`${id}-conducteur`}
            className={FIELD_CLASS}
            value={filters.conducteur}
            onChange={(event) => onFilters({ ...filters, conducteur: event.target.value })}
            disabled
            title="Responsable à relier aux profils chantier."
          >
            <option value="">Responsable</option>
          </select>
        </Field>

        <Field label="Période" htmlFor={`${id}-period`}>
          <select
            id={`${id}-period`}
            className={FIELD_CLASS}
            value={filters.period}
            onChange={(event) => onFilters({ ...filters, period: event.target.value as ChantierListFilters["period"] })}
          >
            {PERIODS.map((period) => (
              <option key={period.key} value={period.key}>
                {period.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Type" htmlFor={`${id}-type`}>
          <select
            id={`${id}-type`}
            className={FIELD_CLASS}
            value={filters.type}
            onChange={(event) => onFilters({ ...filters, type: event.target.value })}
            disabled
            title="Type chantier à brancher quand la donnée existe."
          >
            <option value="">Type chantier</option>
          </select>
        </Field>
      </div>
    </section>
  );
}
