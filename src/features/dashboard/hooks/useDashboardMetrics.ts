import { useMemo } from "react";
import type { ChantierRow } from "../../../services/chantiers.service";
import type { DashboardAlertRow } from "../../../services/dashboardAlerts.service";
import type {
  DashboardAlertCard,
  DashboardBusinessMetric,
  DashboardKpi,
  DashboardPriorityItem,
  DashboardProjectCard,
  DashboardTone,
  DashboardView,
  MaterielSnapshot,
} from "../types";

type Translator = (key: string, values?: Record<string, string | number>) => string;

type DashboardMetricsInput = {
  chantiers: ChantierRow[];
  materiel: MaterielSnapshot[];
  alerts: DashboardAlertRow[];
  activeView: DashboardView;
  loading: boolean;
  locale: string;
  t: Translator;
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

export function useDashboardMetrics({ chantiers, materiel, alerts, activeView, loading, locale, t }: DashboardMetricsInput) {
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

  const avgAvancement = useMemo(() => {
    if (chantiers.length === 0) return 0;
    const total = chantiers.reduce((sum, chantier) => sum + Number(chantier.avancement ?? 0), 0);
    return total / chantiers.length;
  }, [chantiers]);

  const totalHeuresPrevues = useMemo(
    () => chantiers.reduce((sum, chantier) => sum + Number(chantier.heures_prevues ?? 0), 0),
    [chantiers],
  );

  const totalHeuresPassees = useMemo(
    () => chantiers.reduce((sum, chantier) => sum + Number(chantier.heures_passees ?? 0), 0),
    [chantiers],
  );

  const pendingMateriel = useMemo(
    () => materiel.filter((row) => !["livree", "refusee"].includes(normalizeMaterialStatus(row))),
    [materiel],
  );

  const alertStats = useMemo(() => {
    const urgentReserves = alerts.filter((alert) => alert.id.startsWith("reserve:") && alert.tone === "danger").length;
    const taskBlockers = alerts.filter((alert) => alert.id.startsWith("task-")).length;
    const purchaseBlockers = alerts.filter((alert) => alert.id.startsWith("purchase:")).length;
    const incompletePreparation = alerts.filter((alert) => alert.id.startsWith("preparation:")).length;
    const dangerAlerts = alerts.filter((alert) => alert.tone === "danger").length;

    return { urgentReserves, taskBlockers, purchaseBlockers, incompletePreparation, dangerAlerts };
  }, [alerts]);

  const focusRows = useMemo<DashboardPriorityItem[]>(() => {
    if (activeView === "alertes") {
      return alerts.slice(0, 12).map((alert) => ({
        key: alert.id,
        href: alert.href,
        title: alert.title,
        subtitle: alert.chantier_nom,
        meta: alertCategoryLabel(alert.category),
        detail: alert.detail,
        tone: alert.tone,
      }));
    }

    if (activeView === "materiel") {
      return pendingMateriel.slice(0, 8).map((row) => ({
        key: row.id,
        href: `/chantiers/${row.chantier_id}`,
        title: row.titre || row.designation || t("dashboard.materialRequest"),
        subtitle: chantierById.get(row.chantier_id)?.nom || t("sidebar.chantiers"),
        meta: `${materialStatusLabel(normalizeMaterialStatus(row), t)} · ${Number(row.quantite ?? 0).toLocaleString(locale)} ${row.unite ?? ""}`.trim(),
        tone: "normal",
      }));
    }

    if (activeView === "avancement") {
      return [...orderedChantiers]
        .sort((a, b) => Number(a.avancement ?? 0) - Number(b.avancement ?? 0))
        .slice(0, 8)
        .map((chantier) => ({
          key: chantier.id,
          href: `/chantiers/${chantier.id}`,
          title: chantier.nom,
          subtitle: chantier.client || t("dashboard.missingClient"),
          meta: t("dashboard.progressLabel", { value: formatPercent(Number(chantier.avancement ?? 0)) }),
          tone: Number(chantier.avancement ?? 0) < 35 ? "warning" : "normal",
        }));
    }

    if (activeView === "heures") {
      return [...orderedChantiers]
        .filter((chantier) => Number(chantier.heures_prevues ?? 0) > 0)
        .sort((a, b) => {
          const aGap = Number(a.heures_passees ?? 0) - Number(a.heures_prevues ?? 0);
          const bGap = Number(b.heures_passees ?? 0) - Number(b.heures_prevues ?? 0);
          return bGap - aGap;
        })
        .slice(0, 8)
        .map((chantier) => ({
          key: chantier.id,
          href: `/chantiers/${chantier.id}`,
          title: chantier.nom,
          subtitle: chantier.client || t("dashboard.missingClient"),
          meta: `${formatHours(Number(chantier.heures_passees ?? 0), locale)} / ${formatHours(Number(chantier.heures_prevues ?? 0), locale)}`,
          tone:
            Number(chantier.heures_prevues ?? 0) > 0 && Number(chantier.heures_passees ?? 0) > Number(chantier.heures_prevues ?? 0)
              ? "danger"
              : "normal",
        }));
    }

    return orderedChantiers.slice(0, 8).map((chantier) => ({
      key: chantier.id,
      href: `/chantiers/${chantier.id}`,
      title: chantier.nom,
      subtitle: chantier.client || t("dashboard.missingClient"),
      meta: chantier.date_fin_prevue
        ? t("dashboard.finishPlanned", { date: chantier.date_fin_prevue })
        : t("dashboard.finishNotPlanned"),
      tone: chantier.status === "PREPARATION" ? "warning" : "normal",
    }));
  }, [activeView, alerts, chantierById, locale, orderedChantiers, pendingMateriel, t]);

  const kpis = useMemo<DashboardKpi[]>(() => [
    {
      key: "chantiers",
      label: "Chantiers actifs",
      value: loading ? "..." : String(chantiers.length),
      hint: chantiers.length === 0 ? "Aucun chantier actif" : "Pilotage opérationnel",
      tone: chantiers.length === 0 ? "warning" : "success",
    },
    {
      key: "alertes",
      label: "Tâches urgentes",
      value: loading ? "..." : String(alertStats.taskBlockers),
      hint: alertStats.taskBlockers > 0 ? "Action requise" : "Flux sous contrôle",
      tone: alertStats.taskBlockers > 0 ? "danger" : "success",
    },
    {
      key: "avancement",
      label: "Retards",
      value: loading ? "..." : String(alertStats.dangerAlerts),
      hint: alertStats.dangerAlerts > 0 ? "À traiter aujourd’hui" : "Aucun retard critique",
      tone: alertStats.dangerAlerts > 0 ? "danger" : "success",
    },
    {
      key: "materiel",
      label: "Demandes matériel",
      value: loading ? "..." : String(pendingMateriel.length),
      hint: pendingMateriel.length > 0 ? "Achats / validations à suivre" : "Aucune demande bloquante",
      tone: pendingMateriel.length > 4 ? "danger" : pendingMateriel.length > 0 ? "warning" : "success",
    },
    {
      key: "heures",
      label: "Temps consommé",
      value: loading ? "..." : formatHours(totalHeuresPassees, locale),
      hint: totalHeuresPrevues > 0 ? `${formatHours(totalHeuresPrevues, locale)} prévues` : "Prévision non renseignée",
      tone:
        totalHeuresPrevues > 0 && totalHeuresPassees > totalHeuresPrevues
          ? "danger"
          : totalHeuresPrevues > 0 && totalHeuresPassees > totalHeuresPrevues * 0.85
            ? "warning"
            : "info",
    },
    {
      key: "marge",
      label: "Marge estimée",
      value: "—",
      hint: "À connecter au financier chantier",
      tone: "normal",
    },
  ], [alertStats, chantiers.length, loading, locale, pendingMateriel.length, totalHeuresPassees, totalHeuresPrevues]);

  const alertCards = useMemo<DashboardAlertCard[]>(() => [
    {
      key: "urgences",
      label: "Urgences",
      value: alertStats.urgentReserves + alertStats.dangerAlerts,
      description: "Réserves et blocages critiques",
      href: "/chantiers",
      tone: alertStats.urgentReserves + alertStats.dangerAlerts > 0 ? "danger" : "success",
    },
    {
      key: "retards",
      label: "Retards",
      value: alertStats.taskBlockers,
      description: "Tâches à reprendre ou en retard",
      href: "/chantiers",
      tone: alertStats.taskBlockers > 0 ? "danger" : "success",
    },
    {
      key: "achats",
      label: "Achats attente",
      value: alertStats.purchaseBlockers + pendingMateriel.length,
      description: "Approvisionnements à suivre",
      href: "/chantiers",
      tone: alertStats.purchaseBlockers + pendingMateriel.length > 0 ? "warning" : "success",
    },
    {
      key: "validations",
      label: "Validations",
      value: alertStats.incompletePreparation,
      description: "Préparations incomplètes",
      href: "/chantiers",
      tone: alertStats.incompletePreparation > 0 ? "warning" : "success",
    },
    {
      key: "reserves",
      label: "Réserves",
      value: alertStats.urgentReserves,
      description: "Réserves urgentes ouvertes",
      href: "/chantiers",
      tone: alertStats.urgentReserves > 0 ? "danger" : "success",
    },
  ], [alertStats, pendingMateriel.length]);

  const priorityToday = useMemo<DashboardPriorityItem[]>(() => {
    const alertItems = alerts.slice(0, 4).map((alert) => ({
      key: alert.id,
      href: alert.href,
      title: alert.title,
      subtitle: alert.chantier_nom,
      meta: alertCategoryLabel(alert.category),
      detail: alert.detail,
      tone: alert.tone,
    }));

    const materialItems = pendingMateriel.slice(0, Math.max(0, 5 - alertItems.length)).map((row) => ({
      key: row.id,
      href: `/chantiers/${row.chantier_id}`,
      title: row.titre || row.designation || t("dashboard.materialRequest"),
      subtitle: chantierById.get(row.chantier_id)?.nom || t("sidebar.chantiers"),
      meta: materialStatusLabel(normalizeMaterialStatus(row), t),
      detail: `${Number(row.quantite ?? 0).toLocaleString(locale)} ${row.unite ?? ""}`.trim(),
      tone: "warning" as DashboardTone,
    }));

    return [...alertItems, ...materialItems];
  }, [alerts, chantierById, locale, pendingMateriel, t]);

  const priorityWeek = useMemo<DashboardPriorityItem[]>(() => {
    return orderedChantiers.slice(0, 5).map((chantier) => ({
      key: chantier.id,
      href: `/chantiers/${chantier.id}`,
      title: chantier.nom,
      subtitle: chantier.client || t("dashboard.missingClient"),
      meta: chantier.date_fin_prevue ? `Fin prévue ${chantier.date_fin_prevue}` : "Date fin à compléter",
      detail: `Avancement ${formatPercent(Number(chantier.avancement ?? 0))}`,
      tone: Number(chantier.avancement ?? 0) < 35 ? "warning" : "normal",
    }));
  }, [orderedChantiers, t]);

  const projects = useMemo<DashboardProjectCard[]>(() => {
    return orderedChantiers.slice(0, 8).map((chantier) => ({
      id: chantier.id,
      href: `/chantiers/${chantier.id}`,
      name: chantier.nom,
      client: chantier.client || t("dashboard.missingClient"),
      status: chantierStatusLabel(chantier.status),
      statusTone: chantierTone(chantier.status),
      finishLabel: chantier.date_fin_prevue ? `Fin prévue ${chantier.date_fin_prevue}` : "Fin non planifiée",
      progress: Math.max(0, Math.min(100, Number(chantier.avancement ?? 0))),
      nextAction: Number(chantier.heures_prevues ?? 0) > 0
        ? `${formatHours(Number(chantier.heures_passees ?? 0), locale)} consommées`
        : "Préparer les prochaines actions",
    }));
  }, [locale, orderedChantiers, t]);

  const businessMetrics = useMemo<DashboardBusinessMetric[]>(() => [
    {
      key: "quotes",
      label: "Devis à relancer",
      value: "—",
      hint: "À connecter au CRM devis",
      href: "/crm/devis",
      tone: "info",
    },
    {
      key: "opportunities",
      label: "Opportunités ouvertes",
      value: "—",
      hint: "Pipeline commercial",
      href: "/crm/opportunites",
      tone: "info",
    },
    {
      key: "invoices",
      label: "Factures en attente",
      value: "—",
      hint: "Suivi facturation",
      href: "/crm/factures",
      tone: "warning",
    },
    {
      key: "sav",
      label: "SAV ouverts",
      value: "—",
      hint: "Tickets après chantier",
      href: "/crm/sav",
      tone: "normal",
    },
  ], []);

  return {
    alertCards,
    alertStats,
    avgAvancement,
    businessMetrics,
    focusRows,
    kpis,
    orderedChantiers,
    pendingMateriel,
    priorityToday,
    priorityWeek,
    projects,
    totalHeuresPassees,
    totalHeuresPrevues,
  };
}
