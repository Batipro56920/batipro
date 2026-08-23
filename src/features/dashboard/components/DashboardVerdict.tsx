import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react";
import type { DashboardSeverity, DashboardSeveritySegment, DashboardVerdict as Verdict } from "../types";

type DashboardVerdictProps = {
  verdict: Verdict;
  segments: DashboardSeveritySegment[];
};

const VERDICT_ICON = {
  danger: AlertTriangle,
  warning: CircleAlert,
  success: CheckCircle2,
  info: CircleAlert,
  normal: CircleAlert,
} as const;

const VERDICT_ICON_TONE = {
  danger: "bg-danger-soft text-danger-on",
  warning: "bg-warning-soft text-warning-on",
  success: "bg-success-soft text-success-on",
  info: "bg-info-soft text-info-on",
  normal: "bg-neutral-soft text-neutral-on",
} as const;

/** Accent de bord : le verdict est le seul bloc a porter une barre pleine hauteur. */
const VERDICT_ACCENT = {
  danger: "bg-danger",
  warning: "bg-warning",
  success: "bg-success",
  info: "bg-info",
  normal: "bg-neutral",
} as const;

const SEGMENT_FILL: Record<DashboardSeverity, string> = {
  critical: "bg-danger",
  action: "bg-warning",
  control: "bg-success",
};

/**
 * Titre reel de l'ecran : la reponse a "est-ce que ca necessite mon attention
 * maintenant ?" occupe le premier niveau de hierarchie, pas la salutation.
 * La repartition est indicative : la commande de filtrage reste les chips de la file.
 */
export function DashboardVerdict({ verdict, segments }: DashboardVerdictProps) {
  const Icon = VERDICT_ICON[verdict.tone];
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const visibleSegments = segments.filter((segment) => segment.value > 0);

  return (
    <section className="relative overflow-hidden rounded-card border border-strong bg-elevated p-4 shadow-elevated sm:p-5">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${VERDICT_ACCENT[verdict.tone]}`} />

      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${VERDICT_ICON_TONE[verdict.tone]}`}>
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="bt-page-title min-w-0 flex-1 text-balance text-ink">{verdict.headline}</h1>
      </div>

      {total > 0 ? (
        <div className="mt-4">
          <p className="bt-caption text-muted">
            Répartition des {total} chantier{total > 1 ? "s" : ""} actif{total > 1 ? "s" : ""}
          </p>
          <div
            className="mt-1.5 flex h-2 gap-[2px] overflow-hidden rounded-full bg-track"
            role="img"
            aria-label={segments.map((segment) => `${segment.label} : ${segment.value}`).join(", ")}
          >
            {visibleSegments.map((segment) => (
              <span
                key={segment.key}
                className={`${SEGMENT_FILL[segment.key]} transition-[flex-grow] duration-[240ms]`}
                style={{ flexGrow: segment.value }}
              />
            ))}
          </div>

          <ul className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {segments.map((segment) => (
              <li key={segment.key} className="bt-caption inline-flex items-center gap-1.5">
                <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEGMENT_FILL[segment.key]}`} />
                <span className="text-muted">{segment.label}</span>
                <span className="bt-num font-semibold text-ink">{segment.value}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
