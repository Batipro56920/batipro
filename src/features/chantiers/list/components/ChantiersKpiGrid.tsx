import { AlertTriangle, BarChart3, CalendarCheck, Euro, Factory, MessageSquareWarning, TimerReset, type LucideIcon } from "lucide-react";
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

export type ChantiersKpiKey = "active" | "preparation" | "late" | "alerts" | "terrainFeedback";

type KpiCard = {
  key: string;
  label: string;
  value: number | string;
  hint: string;
  icon: LucideIcon;
  tone: string;
  selectKey?: ChantiersKpiKey;
  actionLabel?: string;
};

function terrainFeedbackAlertHint(metrics: Metrics) {
  if (metrics.terrainFeedbackPriority > 0) return "Retards, temps et retours urgents";
  if (metrics.terrainFeedbackOpen > 0) return "Retards, temps ou retours ouverts";
  return "Retards, temps ou retours terrain";
}

function terrainFeedbackKpiValue(metrics: Metrics) {
  if (metrics.terrainFeedbackPriority > 0) return metrics.terrainFeedbackPriority;
  return metrics.terrainFeedbackOpen;
}

function terrainFeedbackKpiHint(metrics: Metrics) {
  if (metrics.terrainFeedbackPriority > 0) {
    return `${metrics.terrainFeedbackPriority} urgent${metrics.terrainFeedbackPriority > 1 ? "s" : ""} / ${metrics.terrainFeedbackOpen} ouvert${metrics.terrainFeedbackOpen > 1 ? "s" : ""}`;
  }
  if (metrics.terrainFeedbackOpen > 0) {
    return `${metrics.terrainFeedbackOpen} retour${metrics.terrainFeedbackOpen > 1 ? "s" : ""} terrain ouvert${metrics.terrainFeedbackOpen > 1 ? "s" : ""}`;
  }
  return "Aucun retour terrain ouvert";
}

export function ChantiersKpiGrid({ metrics, onSelect }: { metrics: Metrics; onSelect?: (key: ChantiersKpiKey) => void }) {
  const cards: KpiCard[] = [
    { key: "active", selectKey: "active", label: "Chantiers actifs", value: metrics.active, hint: "Préparation, en cours, pause", icon: Factory, tone: "text-blue-700 bg-blue-50 border-blue-200", actionLabel: "Afficher les chantiers actifs" },
    { key: "preparation", selectKey: "preparation", label: "En préparation", value: metrics.preparation, hint: "À lancer prochainement", icon: CalendarCheck, tone: "text-sky-700 bg-sky-50 border-sky-200", actionLabel: "Filtrer les chantiers en préparation" },
    { key: "late", selectKey: "late", label: "En retard", value: metrics.late, hint: "Échéance dépassée", icon: TimerReset, tone: "text-red-700 bg-red-50 border-red-200", actionLabel: "Voir les chantiers en retard" },
    { key: "alerts", selectKey: "alerts", label: "Alertes", value: metrics.alerts, hint: terrainFeedbackAlertHint(metrics), icon: AlertTriangle, tone: metrics.terrainFeedbackPriority > 0 ? "text-red-700 bg-red-50 border-red-200" : "text-amber-700 bg-amber-50 border-amber-200", actionLabel: "Voir les alertes à traiter" },
    { key: "terrainFeedback", selectKey: "terrainFeedback", label: "Retours terrain", value: terrainFeedbackKpiValue(metrics), hint: terrainFeedbackKpiHint(metrics), icon: MessageSquareWarning, tone: metrics.terrainFeedbackPriority > 0 ? "text-red-700 bg-red-50 border-red-200" : "text-amber-700 bg-amber-50 border-amber-200", actionLabel: "Voir les chantiers avec retours terrain ouverts" },
    { key: "completedThisMonth", label: "Terminés ce mois", value: metrics.completedThisMonth, hint: "Historique mensuel", icon: BarChart3, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { key: "estimatedMargin", label: "Marge estimée", value: currency(metrics.estimatedMargin), hint: "Selon budgets renseignés", icon: Euro, tone: "text-slate-700 bg-slate-50 border-slate-200" },
  ];

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActionable = Boolean(card.selectKey && onSelect);
        const content = (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{card.label}</div>
              <span className={`rounded-xl border p-2 ${card.tone}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{card.value}</div>
            <div className="mt-1 text-xs text-slate-500">{card.hint}</div>
          </>
        );
        const className = [
          "rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm shadow-slate-950/[0.03] transition hover:-translate-y-0.5 hover:shadow-md",
          isActionable ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200" : "",
        ].join(" ");

        if (card.selectKey && onSelect) {
          return (
            <button key={card.key} type="button" className={className} onClick={() => onSelect(card.selectKey!)} aria-label={card.actionLabel}>
              {content}
            </button>
          );
        }

        return (
          <div key={card.key} className={className}>
            {content}
          </div>
        );
      })}
    </section>
  );
}
