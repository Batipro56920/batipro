import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { DashboardSection } from "./DashboardSection";
import { TONE_SOFT, TONE_SOLID } from "./tone";
import type {
  DashboardChantierCard,
  DashboardChantierView,
  DashboardMeasure,
  DashboardQueueFilter,
  DashboardSeverity,
} from "../types";

type DashboardChantiersPanelProps = {
  chantiers: DashboardChantierCard[];
  measures: DashboardMeasure[];
  chantierView: DashboardChantierView;
  activeFilter: DashboardQueueFilter;
  onSelectView: (view: DashboardChantierView) => void;
  onSelectFilter: (filter: DashboardQueueFilter) => void;
  compact: boolean;
};

const SEVERITY_BAR: Record<DashboardSeverity, string> = {
  critical: TONE_SOLID.danger,
  action: TONE_SOLID.warning,
  control: TONE_SOLID.success,
};

function ChantierRow({ chantier }: { chantier: DashboardChantierCard }) {
  return (
    <li>
      <Link
        to={chantier.href}
        title={chantier.nextAction}
        className="bt-row relative grid grid-cols-1 items-center gap-x-5 gap-y-2.5 px-4 py-3 transition-colors duration-[90ms] hover:bg-interactive focus-visible:bg-interactive sm:px-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,auto)]"
      >
        <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${SEVERITY_BAR[chantier.severity]}`} />

        <span className="min-w-0">
          <span className="bt-card-title block truncate text-ink">{chantier.name}</span>
          <span className="bt-secondary mt-0.5 block truncate text-muted">
            {chantier.client}
            {chantier.itemCount > 0 ? (
              <span className="bt-num"> · {chantier.itemCount} point{chantier.itemCount > 1 ? "s" : ""} ouvert{chantier.itemCount > 1 ? "s" : ""}</span>
            ) : null}
          </span>
        </span>

        <span className="min-w-0">
          <span className="flex items-center gap-2.5">
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-track">
              <span
                className={`block h-full rounded-full ${chantier.isLate ? "bg-warning" : "bg-primary"} transition-[width] duration-[240ms]`}
                style={{ width: `${chantier.progress}%` }}
              />
            </span>
            <span className="bt-caption bt-num shrink-0 text-ink-secondary">{Math.round(chantier.progress)}%</span>
          </span>
          <span className={`bt-caption bt-num mt-1 block truncate ${chantier.isOverHours ? "text-warning-on" : "text-muted"}`}>
            {chantier.nextAction}
            {chantier.isOverHours ? " · dépassement" : ""}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-1.5 lg:justify-end">
          {/* Remplace StatusBadge (design-system.tsx), encore code en slate/blue :
              meme libelle et meme ton, mais rendu par les tokens semantiques. */}
          <span className={`bt-caption rounded-full px-2 py-0.5 ${TONE_SOFT[chantier.statusTone]}`}>{chantier.status}</span>
          {chantier.isLate ? (
            <span className={`bt-caption rounded-full px-2 py-0.5 ${TONE_SOFT.danger}`}>En retard</span>
          ) : chantier.dueSoonLabel ? (
            <span className={`bt-caption rounded-full px-2 py-0.5 ${TONE_SOFT.warning}`}>{chantier.dueSoonLabel}</span>
          ) : null}
          <span className="bt-caption whitespace-nowrap text-muted">{chantier.finishLabel}</span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Contexte, pas catalogue : une ligne dense par chantier.
 * La barre de mesures reprend les valeurs, info-bulles et clics des anciennes
 * cartes KPI ; chaque mesure reordonne la liste et change la destination du lien.
 */
export function DashboardChantiersPanel({
  chantiers,
  measures,
  chantierView,
  activeFilter,
  onSelectView,
  onSelectFilter,
  compact,
}: DashboardChantiersPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const collapsedRows = compact ? 3 : 5;
  const visibleChantiers = expanded ? chantiers : chantiers.slice(0, collapsedRows);
  const hiddenCount = chantiers.length - visibleChantiers.length;
  const lateCount = chantiers.filter((chantier) => chantier.isLate).length;

  const summary = chantiers.length === 0
    ? "Aucun chantier actif"
    : `${chantiers.length} actif${chantiers.length > 1 ? "s" : ""}${lateCount > 0 ? ` · ${lateCount} en retard` : ""}`;

  return (
    <DashboardSection
      title="Chantiers"
      summary={summary}
      defaultOpen
      action={
        <Link to="/chantiers">
          <Button variant="secondary" size="sm">Voir tous les chantiers</Button>
        </Link>
      }
    >
      {/* Bande de mesures : trois valeurs metier, aucune duplication d'un compteur
          deja affiche ailleurs. Aucun fond propre, aucun radius, aucune icone.
          Sans tri choisi, aucune mesure n'est active : la bande ne se lit pas comme
          une barre d'onglets. */}
      <div
        role="group"
        aria-label="Mesures du portefeuille"
        className="grid grid-cols-2 divide-x divide-y divide-subtle border-b border-subtle sm:grid-cols-4 sm:divide-y-0"
      >
        {measures.map((measure) => {
          const active =
            measure.target.kind === "tri"
              ? chantierView === measure.target.view
              : activeFilter === measure.target.filter;
          return (
            <button
              key={measure.key}
              type="button"
              title={measure.hint}
              aria-pressed={active}
              onClick={() => {
                if (measure.target.kind === "tri") onSelectView(active ? "priorite" : measure.target.view);
                else onSelectFilter(active ? "all" : measure.target.filter);
              }}
              className="group bt-tap relative px-4 py-2.5 text-left transition-colors duration-[90ms] focus-visible:outline-offset-[-2px] sm:px-5"
            >
              <span
                className={`bt-caption block truncate transition-colors duration-[90ms] ${
                  active ? "text-primary-on" : "text-muted group-hover:text-ink-secondary"
                }`}
              >
                {measure.label}
              </span>
              <span className="bt-num mt-0.5 block text-[15px] font-[650] leading-[20px] text-ink">{measure.value}</span>
              {active ? <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" /> : null}
            </button>
          );
        })}
      </div>

      {/* Ligne permanente : le tri courant et la destination des liens sont toujours
          annonces, ce qui evite un bandeau qui apparait et disparait. */}
      <p className="bt-caption border-b border-subtle px-4 py-2 text-muted sm:px-5">
        {chantierView === "priorite"
          ? "Triés par priorité — les lignes ouvrent la fiche chantier."
          : chantierView === "recents"
            ? "Triés par date de création — les lignes ouvrent la fiche chantier."
            : chantierView === "avancement"
              ? "Triés par avancement croissant — les lignes ouvrent l’onglet Exécution."
              : "Triés par dépassement d’heures — les lignes ouvrent l’onglet Exécution."}
      </p>

      {chantiers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <p className="bt-card-title text-ink">
            {chantierView === "heures" ? "Aucun chantier avec une prévision d’heures" : "Aucun chantier actif"}
          </p>
          <p className="bt-secondary text-muted">
            {chantierView === "heures"
              ? "Renseignez des heures prévues pour suivre les dépassements."
              : "Créez un chantier pour alimenter les priorités."}
          </p>
          <Link to="/chantiers/nouveau">
            <Button variant="primary" size="sm">Nouveau chantier</Button>
          </Link>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-subtle">
            {visibleChantiers.map((chantier) => (
              <ChantierRow key={chantier.id} chantier={chantier} />
            ))}
          </ul>
          {hiddenCount > 0 || expanded ? (
            <button
              type="button"
              onClick={() => setExpanded((previous) => !previous)}
              className="bt-control w-full border-t border-subtle text-[13px] font-medium text-ink-secondary transition-colors duration-[120ms] hover:bg-interactive hover:text-ink"
            >
              {expanded ? "Réduire" : `Afficher ${hiddenCount} chantier${hiddenCount > 1 ? "s" : ""} de plus`}
            </button>
          ) : null}
        </>
      )}
    </DashboardSection>
  );
}
