import { useMemo } from "react";
import type { ChantierRow } from "../../../services/chantiers.service";
import type { DashboardAlertRow } from "../../../services/dashboardAlerts.service";
import type {
  DashboardBusinessMetric,
  DashboardChantierCard,
  DashboardFilterChip,
  DashboardQueueFilter,
  DashboardQueueItem,
  DashboardQueueKind,
  DashboardSeverity,
  DashboardSeveritySegment,
  DashboardTone,
  DashboardVerdict,
  MaterielSnapshot,
} from "../types";

type Translator = (key: string, values?: Record<string, string | number>) => string;

type DashboardMetricsInput = {
  chantiers: ChantierRow[];
  materiel: MaterielSnapshot[];
  alerts: DashboardAlertRow[];
  filter: DashboardQueueFilter;
  locale: string;
  t: Translator;
};

const DAY_MS = 86_400_000;

/** Au-dela de ce score, un element est traite comme critique (verdict + barre de charge). */
export const CRITICAL_SCORE = 85;

/**
 * Poids de base par nature d'element. L'echelle traduit un cout metier :
 * du travail deja fait a refaire coute plus cher qu'une preparation incomplete.
 */
const BASE_SCORE: Record<DashboardQueueKind, number> = {
  task_reprise: 120,
  reserve_urgente: 100,
  achat_retard: 85,
  task_retard: 70,
  reserve_ouverte: 60,
  materiel_attente: 55,
  achat_a_commander: 45,
  achat_non_livre: 45,
  preparation_incomplete: 40,
  materiel_validee: 35,
};

const KIND_TONE: Record<DashboardQueueKind, DashboardTone> = {
  task_reprise: "danger",
  reserve_urgente: "danger",
  achat_retard: "danger",
  task_retard: "warning",
  reserve_ouverte: "warning",
  materiel_attente: "warning",
  achat_a_commander: "warning",
  achat_non_livre: "info",
  preparation_incomplete: "info",
  materiel_validee: "info",
};

const MATERIEL_KINDS: DashboardQueueKind[] = ["materiel_attente", "materiel_validee"];
const ALERT_KINDS: DashboardQueueKind[] = [
  "task_reprise",
  "reserve_urgente",
  "achat_retard",
  "task_retard",
  "reserve_ouverte",
  "achat_a_commander",
  "achat_non_livre",
  "preparation_incomplete",
];

const FILTER_KINDS: Record<Exclude<DashboardQueueFilter, "all" | "urgences">, DashboardQueueKind[]> = {
  qualite: ["task_reprise", "reserve_urgente", "reserve_ouverte"],
  retards: ["task_retard", "achat_retard"],
  achats: ["achat_a_commander", "achat_non_livre", "materiel_validee"],
  validations: ["preparation_incomplete", "materiel_attente"],
  /* Equivalents des anciennes vues `?view=` : meme contenu qu'avant la refonte. */
  alertes: ALERT_KINDS,
  materiel: MATERIEL_KINDS,
};

const LEGACY_FILTER_LABELS: Partial<Record<DashboardQueueFilter, string>> = {
  alertes: "Alertes chantier",
  materiel: "Matériel",
};

export function formatHours(value: number, locale: string): string {
  return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })} h`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function normalizeMaterialStatus(row: Pick<MaterielSnapshot, "statut" | "status">): string {
  const value = String(row.statut ?? row.status ?? "").trim().toLowerCase();
  if (value === "validee") return "validee";
  if (value === "refusee") return "refusee";
  if (value === "livree") return "livree";
  return "en_attente";
}

export function materialStatusLabel(value: string, t: Translator): string {
  if (value === "validee") return t("common.materielStatus.validee");
  if (value === "refusee") return t("common.materielStatus.refusee");
  if (value === "livree") return t("common.materielStatus.livree");
  return t("common.materielStatus.en_attente");
}

export function alertCategoryLabel(category: DashboardAlertRow["category"]): string {
  if (category === "reserve") return "Réserve";
  if (category === "task") return "Tâche";
  if (category === "purchase") return "Approvisionnement";
  return "Préparation";
}

function chantierStatusLabel(status: string | null | undefined): string {
  const value = String(status ?? "").toLowerCase();
  if (value === "preparation") return "Préparation";
  if (value === "en_cours") return "En cours";
  if (value === "en pause" || value === "en_pause") return "En pause";
  if (value === "termine" || value === "terminé") return "Terminé";
  if (value === "archive" || value === "archivé") return "Archivé";
  if (value === "annule" || value === "annulé") return "Annulé";
  return value ? String(status) : "Actif";
}

function chantierTone(status: string | null | undefined): DashboardTone {
  const value = String(status ?? "").toLowerCase();
  if (value.includes("pause")) return "warning";
  if (value.includes("preparation")) return "info";
  return "success";
}

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function daysSince(iso: string | null | undefined, todayTime: number): number {
  const parsed = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor((todayTime - parsed) / DAY_MS));
}

/** Jours restants avant l'echeance (negatif si depassee). */
function daysUntil(dateOnly: string | null | undefined, todayTime: number): number | null {
  if (!dateOnly) return null;
  const parsed = Date.parse(`${dateOnly}T00:00:00`);
  if (!Number.isFinite(parsed)) return null;
  return Math.round((parsed - todayTime) / DAY_MS);
}

function ageLabel(days: number): string {
  if (days <= 0) return "aujourd’hui";
  if (days === 1) return "hier";
  if (days < 14) return `il y a ${days} j`;
  return `il y a ${Math.floor(days / 7)} sem.`;
}

type ChantierContext = {
  bonus: number;
  isLate: boolean;
  isOverHours: boolean;
};

export function useDashboardMetrics({ chantiers, materiel, alerts, filter, locale, t }: DashboardMetricsInput) {
  const todayTime = useMemo(() => startOfToday(), []);

  const chantierById = useMemo(() => {
    const map = new Map<string, ChantierRow>();
    chantiers.forEach((chantier) => map.set(chantier.id, chantier));
    return map;
  }, [chantiers]);

  const orderedChantiers = useMemo(() => {
    return [...chantiers].sort((a, b) => {
      const aCreated = Date.parse(String(a.created_at ?? "")) || 0;
      const bCreated = Date.parse(String(b.created_at ?? "")) || 0;
      if (aCreated !== bCreated) return bCreated - aCreated;
      return String(a.nom ?? "").localeCompare(String(b.nom ?? ""), "fr");
    });
  }, [chantiers]);

  const pendingMateriel = useMemo(
    () => materiel.filter((row) => !["livree", "refusee"].includes(normalizeMaterialStatus(row))),
    [materiel],
  );

  /** Un chantier qui derape remonte tous ses elements, sans casser le tri global. */
  const chantierContext = useMemo(() => {
    const map = new Map<string, ChantierContext>();

    chantiers.forEach((chantier) => {
      const plannedHours = Number(chantier.heures_prevues ?? 0);
      const spentHours = Number(chantier.heures_passees ?? 0);
      const progress = Number(chantier.avancement ?? 0);
      const remaining = daysUntil(chantier.date_fin_prevue, todayTime);
      const isOverHours = plannedHours > 0 && spentHours > plannedHours;
      const isLate = remaining !== null && remaining < 0 && progress < 100;

      let bonus = 0;
      if (isOverHours) bonus += 15;
      if (isLate) bonus += 20;
      else if (remaining !== null && remaining <= 7) bonus += 10;
      if (progress < 35 && remaining !== null && remaining <= 14) bonus += 8;

      map.set(chantier.id, { bonus, isLate, isOverHours });
    });

    return map;
  }, [chantiers, todayTime]);

  /** File unique : alertes chantier et demandes materiel sont de meme nature. */
  const queue = useMemo<DashboardQueueItem[]>(() => {
    const items: DashboardQueueItem[] = [];

    alerts.forEach((alert) => {
      const days = daysSince(alert.sort_at, todayTime);
      items.push({
        key: alert.id,
        kind: alert.kind,
        href: alert.href,
        title: alert.title,
        detail: alert.detail,
        chantierId: alert.chantier_id,
        chantierNom: alert.chantier_nom,
        tone: KIND_TONE[alert.kind],
        score: BASE_SCORE[alert.kind],
        isCritical: false,
        ageDays: days,
        ageLabel: ageLabel(days),
        sortAt: alert.sort_at,
      });
    });

    pendingMateriel.forEach((row) => {
      const status = normalizeMaterialStatus(row);
      const kind: DashboardQueueKind = status === "validee" ? "materiel_validee" : "materiel_attente";
      const days = daysSince(row.created_at, todayTime);
      const quantity = `${Number(row.quantite ?? 0).toLocaleString(locale)} ${row.unite ?? ""}`.trim();

      const designation = row.titre || row.designation || t("dashboard.materialRequest");

      items.push({
        key: `materiel:${row.id}`,
        kind,
        href: `/chantiers/${row.chantier_id}/financier`,
        // Comme pour les alertes : le titre porte la nature, le detail porte les specifics.
        title: kind === "materiel_validee" ? "Matériel à réceptionner" : "Matériel à valider",
        detail: quantity ? `${designation} · ${quantity}` : designation,
        chantierId: row.chantier_id,
        chantierNom: chantierById.get(row.chantier_id)?.nom || t("sidebar.chantiers"),
        tone: KIND_TONE[kind],
        score: BASE_SCORE[kind],
        isCritical: false,
        ageDays: days,
        ageLabel: ageLabel(days),
        sortAt: row.created_at ?? "1970-01-01T00:00:00.000Z",
      });
    });

    const countByChantier = new Map<string, number>();
    items.forEach((item) => countByChantier.set(item.chantierId, (countByChantier.get(item.chantierId) ?? 0) + 1));

    const scored = items.map((item) => {
      const context = chantierContext.get(item.chantierId);
      const ageBonus = Math.min(20, Math.floor(item.ageDays / 3) * 2);
      const concentrationBonus = (countByChantier.get(item.chantierId) ?? 0) >= 3 ? 5 : 0;
      const score = item.score + ageBonus + (context?.bonus ?? 0) + concentrationBonus;
      return { ...item, score, isCritical: score >= CRITICAL_SCORE };
    });

    return scored.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      const timeDiff = Date.parse(b.sortAt) - Date.parse(a.sortAt);
      if (timeDiff !== 0) return timeDiff;
      return a.chantierNom.localeCompare(b.chantierNom, "fr");
    });
  }, [alerts, chantierById, chantierContext, locale, pendingMateriel, t, todayTime]);

  const criticalItems = useMemo(() => queue.filter((item) => item.score >= CRITICAL_SCORE), [queue]);

  const filteredQueue = useMemo(() => {
    if (filter === "all") return queue;
    if (filter === "urgences") return criticalItems;
    const kinds = FILTER_KINDS[filter];
    return queue.filter((item) => kinds.includes(item.kind));
  }, [criticalItems, filter, queue]);

  const filterChips = useMemo<DashboardFilterChip[]>(() => {
    const countKinds = (kinds: DashboardQueueKind[]) => queue.filter((item) => kinds.includes(item.kind)).length;

    const chips: DashboardFilterChip[] = [
      { key: "all", label: "Tout", value: queue.length, tone: "normal" },
      { key: "urgences", label: "Urgences", value: criticalItems.length, tone: "danger" },
      { key: "qualite", label: "Qualité", value: countKinds(FILTER_KINDS.qualite), tone: "danger" },
      { key: "retards", label: "Retards", value: countKinds(FILTER_KINDS.retards), tone: "warning" },
      { key: "achats", label: "Achats", value: countKinds(FILTER_KINDS.achats), tone: "info" },
      { key: "validations", label: "Validations", value: countKinds(FILTER_KINDS.validations), tone: "warning" },
    ];

    // Un filtre legacy arrive par l'URL : on lui donne un chip pour qu'il reste
    // visible et desactivable, sans encombrer le rail en usage normal.
    const legacyLabel = LEGACY_FILTER_LABELS[filter];
    if (legacyLabel) {
      chips.push({ key: filter, label: legacyLabel, value: countKinds(FILTER_KINDS[filter as "alertes" | "materiel"]), tone: "info" });
    }

    return chips;
  }, [criticalItems.length, filter, queue]);

  /** Chaque chantier actif appartient a un seul segment : la barre est une vraie part-a-tout. */
  const severityByChantier = useMemo(() => {
    const map = new Map<string, DashboardSeverity>();
    chantiers.forEach((chantier) => map.set(chantier.id, "control"));
    queue.forEach((item) => {
      if (!map.has(item.chantierId)) return;
      const current = map.get(item.chantierId);
      if (item.score >= CRITICAL_SCORE) map.set(item.chantierId, "critical");
      else if (current === "control") map.set(item.chantierId, "action");
    });
    return map;
  }, [chantiers, queue]);

  const severitySegments = useMemo<DashboardSeveritySegment[]>(() => {
    let critical = 0;
    let action = 0;
    let control = 0;
    severityByChantier.forEach((severity) => {
      if (severity === "critical") critical += 1;
      else if (severity === "action") action += 1;
      else control += 1;
    });

    return [
      { key: "critical", label: "Critique", description: "Chantiers à traiter en premier", value: critical, filter: "urgences" },
      { key: "action", label: "À traiter", description: "Chantiers avec des points ouverts", value: action, filter: "all" },
      { key: "control", label: "Sous contrôle", description: "Chantiers sans point ouvert", value: control, filter: "all" },
    ];
  }, [severityByChantier]);

  const verdict = useMemo<DashboardVerdict>(() => {
    const criticalCount = criticalItems.length;
    const criticalChantiers = new Set(criticalItems.map((item) => item.chantierId)).size;
    const actionCount = queue.length - criticalCount;

    if (queue.length === 0) {
      return {
        tone: "success",
        criticalCount: 0,
        criticalChantiers: 0,
        actionCount: 0,
        totalCount: 0,
        headline: chantiers.length === 0 ? "Aucun chantier actif." : "Tout est à jour.",
      };
    }

    if (criticalCount === 0) {
      return {
        tone: "warning",
        criticalCount: 0,
        criticalChantiers: 0,
        actionCount,
        totalCount: queue.length,
        headline: `Rien d’urgent. ${queue.length} action${queue.length > 1 ? "s" : ""} en attente.`,
      };
    }

    const urgences = `${criticalCount} urgence${criticalCount > 1 ? "s" : ""}`;
    const chantierPart = `sur ${criticalChantiers} chantier${criticalChantiers > 1 ? "s" : ""}`;
    const rest = actionCount > 0 ? `, ${actionCount} action${actionCount > 1 ? "s" : ""} en attente` : "";

    return {
      tone: "danger",
      criticalCount,
      criticalChantiers,
      actionCount,
      totalCount: queue.length,
      headline: `${urgences} ${chantierPart}${rest}.`,
    };
  }, [chantiers.length, criticalItems, queue.length]);

  /** Chantiers portant au moins un element de la file, les plus exposes d'abord. */
  const chantierCards = useMemo<DashboardChantierCard[]>(() => {
    const stats = new Map<string, { items: number; critical: number; topScore: number }>();
    queue.forEach((item) => {
      const entry = stats.get(item.chantierId) ?? { items: 0, critical: 0, topScore: 0 };
      entry.items += 1;
      if (item.score >= CRITICAL_SCORE) entry.critical += 1;
      entry.topScore = Math.max(entry.topScore, item.score);
      stats.set(item.chantierId, entry);
    });

    return orderedChantiers
      .map((chantier) => {
        const entry = stats.get(chantier.id) ?? { items: 0, critical: 0, topScore: 0 };
        const context = chantierContext.get(chantier.id);
        const plannedHours = Number(chantier.heures_prevues ?? 0);
        const spentHours = Number(chantier.heures_passees ?? 0);

        const card: DashboardChantierCard = {
          id: chantier.id,
          href: `/chantiers/${chantier.id}`,
          name: chantier.nom,
          client: chantier.client || t("dashboard.missingClient"),
          status: chantierStatusLabel(chantier.status),
          statusTone: chantierTone(chantier.status),
          finishLabel: chantier.date_fin_prevue
            ? t("dashboard.finishPlanned", { date: chantier.date_fin_prevue })
            : t("dashboard.finishNotPlanned"),
          progress: Math.max(0, Math.min(100, Number(chantier.avancement ?? 0))),
          severity: severityByChantier.get(chantier.id) ?? "control",
          itemCount: entry.items,
          criticalCount: entry.critical,
          isLate: context?.isLate ?? false,
          isOverHours: context?.isOverHours ?? false,
          hoursLabel:
            plannedHours > 0
              ? `${formatHours(spentHours, locale)} / ${formatHours(plannedHours, locale)}`
              : formatHours(spentHours, locale),
        };

        return { card, topScore: entry.topScore };
      })
      .sort((a, b) => {
        if (a.topScore !== b.topScore) return b.topScore - a.topScore;
        return a.card.name.localeCompare(b.card.name, "fr");
      })
      .map((entry) => entry.card);
  }, [chantierContext, locale, orderedChantiers, queue, severityByChantier, t]);

  /**
   * Agregats de portefeuille. Ils ne sont pas actionnables, donc ils ne montent pas
   * en tete d'ecran : ils vivent au pied de la section Chantiers, ou ils font sens.
   */
  const portfolio = useMemo(() => {
    const count = chantiers.length;
    const avgProgress = count === 0 ? 0 : chantiers.reduce((sum, c) => sum + Number(c.avancement ?? 0), 0) / count;
    const plannedHours = chantiers.reduce((sum, c) => sum + Number(c.heures_prevues ?? 0), 0);
    const spentHours = chantiers.reduce((sum, c) => sum + Number(c.heures_passees ?? 0), 0);

    return {
      count,
      avgProgressLabel: formatPercent(avgProgress),
      hoursLabel:
        plannedHours > 0
          ? `${formatHours(spentHours, locale)} / ${formatHours(plannedHours, locale)}`
          : formatHours(spentHours, locale),
      isOverHours: plannedHours > 0 && spentHours > plannedHours,
      pendingMaterielCount: pendingMateriel.length,
    };
  }, [chantiers, locale, pendingMateriel.length]);

  const businessMetrics = useMemo<DashboardBusinessMetric[]>(() => [
    { key: "invoices", label: "Factures à encaisser", value: "—", hint: "Factures émises non soldées", href: "/factures?status=a_encaisser", tone: "warning", actionable: true },
    { key: "clientDocuments", label: "Docs client en attente", value: "—", hint: "Validation / signature / relance", href: "/factures?clientWorkflow=actionable", tone: "warning", actionable: true },
    { key: "purchaseOrders", label: "Commandes à traiter", value: "—", hint: "Bons de commande ouverts", href: "/bons-commande?status=open", tone: "warning", actionable: true },
    { key: "quotes", label: "Devis à relancer", value: "—", hint: "Envoyés, non signés ni refusés", href: "/crm/devis?signatureStatus=attente_signature", tone: "info", actionable: false },
    { key: "opportunities", label: "Opportunités ouvertes", value: "—", hint: "Projets commerciaux en cours", href: "/projets", tone: "info", actionable: false },
    { key: "sav", label: "SAV ouverts", value: "—", hint: "Dossiers SAV non clôturés", href: "/crm/sav", tone: "normal", actionable: false },
    { key: "apporteurCommissions", label: "Commissions à payer", value: "—", hint: "Apporteurs d’affaires", href: "/crm/apporteurs?status=commission_a_payer", tone: "warning", actionable: false },
  ], []);

  return {
    businessMetrics,
    chantierCards,
    criticalItems,
    filterChips,
    filteredQueue,
    orderedChantiers,
    pendingMateriel,
    portfolio,
    queue,
    severitySegments,
    verdict,
  };
}
