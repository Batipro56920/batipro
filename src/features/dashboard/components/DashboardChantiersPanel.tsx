import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { DashboardSection } from "./DashboardSection";
import { TONE_SOFT, TONE_SOLID } from "./tone";
import type { DashboardChantierCard, DashboardSeverity } from "../types";

type DashboardPortfolio = {
  count: number;
  avgProgressLabel: string;
  hoursLabel: string;
  isOverHours: boolean;
  pendingMaterielCount: number;
};

type DashboardChantiersPanelProps = {
  chantiers: DashboardChantierCard[];
  portfolio: DashboardPortfolio;
};

const COLLAPSED_ROWS = 5;

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
            {chantier.hoursLabel}
            {chantier.isOverHours ? " · dépassement" : ""}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-1.5 lg:justify-end">
          <span className={`bt-caption rounded-full px-2 py-0.5 ${TONE_SOFT[chantier.statusTone]}`}>{chantier.status}</span>
          {chantier.isLate ? (
            <span className={`bt-caption rounded-full px-2 py-0.5 ${TONE_SOFT.danger}`}>En retard</span>
          ) : null}
          <span className="bt-caption whitespace-nowrap text-muted">{chantier.finishLabel}</span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Contexte, pas catalogue : une ligne dense par chantier, les plus exposes d'abord.
 */
export function DashboardChantiersPanel({ chantiers, portfolio }: DashboardChantiersPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleChantiers = expanded ? chantiers : chantiers.slice(0, COLLAPSED_ROWS);
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
          <Button variant="secondary" size="sm">Voir tous</Button>
        </Link>
      }
    >
      {chantiers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <p className="bt-card-title text-ink">Aucun chantier actif</p>
          <p className="bt-secondary text-muted">Créez un chantier pour alimenter les priorités.</p>
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

          {/* Agregats de portefeuille : du contexte, jamais une action.
              Ils restent disponibles sans occuper le haut de l'ecran. */}
          <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-subtle px-4 py-3 sm:px-5">
            <div className="flex items-baseline gap-1.5">
              <dt className="bt-caption text-muted">Avancement moyen</dt>
              <dd className="bt-caption bt-num font-semibold text-ink">{portfolio.avgProgressLabel}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="bt-caption text-muted">Heures</dt>
              <dd className={`bt-caption bt-num font-semibold ${portfolio.isOverHours ? "text-warning-on" : "text-ink"}`}>
                {portfolio.hoursLabel}
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="bt-caption text-muted">Demandes matériel</dt>
              <dd className="bt-caption bt-num font-semibold text-ink">{portfolio.pendingMaterielCount}</dd>
            </div>
          </dl>
        </>
      )}
    </DashboardSection>
  );
}
