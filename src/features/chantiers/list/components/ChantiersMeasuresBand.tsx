import { currency } from "../utils/chantiersListUtils";

type Metrics = {
  active: number;
  preparation: number;
  late: number;
  alerts: number;
  completedThisMonth: number;
  estimatedMargin: number | null;
  terrainFeedbackOpen: number;
  terrainFeedbackPriority: number;
};

export type ChantiersMeasureKey = "active" | "preparation" | "late" | "alerts" | "terrainFeedback";

type Measure = {
  key: string;
  label: string;
  value: number | string;
  hint: string;
  selectKey?: ChantiersMeasureKey;
  actionLabel?: string;
};

function terrainFeedbackAlertHint(metrics: Metrics) {
  if (metrics.terrainFeedbackPriority > 0) return "Retards, temps et retours urgents";
  if (metrics.terrainFeedbackOpen > 0) return "Retards, temps ou retours ouverts";
  return "Retards, temps ou retours terrain";
}

function terrainFeedbackValue(metrics: Metrics) {
  if (metrics.terrainFeedbackPriority > 0) return metrics.terrainFeedbackPriority;
  return metrics.terrainFeedbackOpen;
}

function terrainFeedbackHint(metrics: Metrics) {
  if (metrics.terrainFeedbackPriority > 0) {
    return `${metrics.terrainFeedbackPriority} urgent${metrics.terrainFeedbackPriority > 1 ? "s" : ""} / ${metrics.terrainFeedbackOpen} ouvert${metrics.terrainFeedbackOpen > 1 ? "s" : ""}`;
  }
  if (metrics.terrainFeedbackOpen > 0) {
    return `${metrics.terrainFeedbackOpen} retour${metrics.terrainFeedbackOpen > 1 ? "s" : ""} terrain ouvert${metrics.terrainFeedbackOpen > 1 ? "s" : ""}`;
  }
  return "Aucun retour terrain ouvert";
}

/**
 * Remplace la rangee de cartes KPI (interdite par la charte, annexe F.8) par la
 * bande de mesures cliquables de l'annexe C. Les valeurs, les info-bulles et les
 * filtres declenches au clic sont rigoureusement ceux des anciennes cartes ;
 * les trois mesures qui ne portent pas d'action de premier plan passent sur la
 * ligne d'en-tete pour tenir la limite de quatre mesures par bande.
 */
export function ChantiersMeasuresBand({
  metrics,
  activeKey = null,
  onSelect,
}: {
  metrics: Metrics;
  activeKey?: ChantiersMeasureKey | null;
  onSelect?: (key: ChantiersMeasureKey) => void;
}) {
  const measures: Measure[] = [
    { key: "active", selectKey: "active", label: "Chantiers actifs", value: metrics.active, hint: "Préparation, en cours, pause", actionLabel: "Afficher les chantiers actifs" },
    { key: "late", selectKey: "late", label: "En retard", value: metrics.late, hint: "Échéance dépassée", actionLabel: "Voir les chantiers en retard" },
    { key: "alerts", selectKey: "alerts", label: "Alertes", value: metrics.alerts, hint: terrainFeedbackAlertHint(metrics), actionLabel: "Voir les alertes à traiter" },
    { key: "terrainFeedback", selectKey: "terrainFeedback", label: "Retours terrain", value: terrainFeedbackValue(metrics), hint: terrainFeedbackHint(metrics), actionLabel: "Ouvrir le pilotage des retours terrain" },
  ];

  const preparationActive = activeKey === "preparation";

  return (
    <section className="overflow-hidden rounded-card border border-subtle bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
        <h2 className="bt-section-title text-ink">Portefeuille</h2>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
          {onSelect ? (
            <button
              type="button"
              title="À lancer prochainement"
              aria-label="Filtrer les chantiers en préparation"
              aria-pressed={preparationActive}
              onClick={() => onSelect("preparation")}
              className={`bt-tap bt-caption inline-flex items-center gap-1.5 rounded-field px-2 transition-colors duration-[120ms] hover:bg-interactive ${
                preparationActive ? "bg-interactive" : ""
              }`}
            >
              <span className={preparationActive ? "text-primary-on" : "text-muted"}>En préparation</span>
              <span className="bt-num text-ink">{metrics.preparation}</span>
            </button>
          ) : (
            <span className="bt-tap bt-caption inline-flex items-center gap-1.5 px-2" title="À lancer prochainement">
              <span className="text-muted">En préparation</span>
              <span className="bt-num text-ink">{metrics.preparation}</span>
            </span>
          )}
          <span className="bt-tap bt-caption inline-flex items-center gap-1.5 px-2" title="Historique mensuel">
            <span className="text-muted">Terminés ce mois</span>
            <span className="bt-num text-ink">{metrics.completedThisMonth}</span>
          </span>
          <span className="bt-tap bt-caption inline-flex items-center gap-1.5 px-2" title="Selon budgets renseignés">
            <span className="text-muted">Marge estimée</span>
            <span className="bt-num text-ink">{currency(metrics.estimatedMargin)}</span>
          </span>
        </div>
      </div>

      <div
        role="group"
        aria-label="Mesures du portefeuille chantiers"
        className="grid grid-cols-2 divide-x divide-y divide-subtle border-t border-subtle sm:grid-cols-4 sm:divide-y-0"
      >
        {measures.map((measure) => {
          const active = Boolean(measure.selectKey) && activeKey === measure.selectKey;
          const content = (
            <>
              <span
                className={`bt-caption block truncate transition-colors duration-[90ms] ${
                  active ? "text-primary-on" : "text-muted group-hover:text-ink-secondary"
                }`}
              >
                {measure.label}
              </span>
              <span className="bt-num mt-0.5 block text-[18px] font-[650] leading-[22px] text-ink">{measure.value}</span>
              {active ? <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" /> : null}
            </>
          );

          if (measure.selectKey && onSelect) {
            const selectKey = measure.selectKey;
            return (
              <button
                key={measure.key}
                type="button"
                title={measure.hint}
                aria-label={measure.actionLabel}
                aria-pressed={active}
                onClick={() => onSelect(selectKey)}
                className="group bt-tap relative px-4 py-2.5 text-left transition-colors duration-[90ms] hover:bg-interactive focus-visible:outline-offset-[-2px] sm:px-5"
              >
                {content}
              </button>
            );
          }

          return (
            <div key={measure.key} className="group bt-tap relative px-4 py-2.5 sm:px-5" title={measure.hint}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
