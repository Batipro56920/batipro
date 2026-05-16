import type { DashboardAlertRow } from "../../../services/dashboardAlerts.service";

export type DashboardView = "chantiers" | "avancement" | "heures" | "materiel" | "alertes" | null;

export type MaterielSnapshot = {
  id: string;
  chantier_id: string;
  titre: string | null;
  designation: string | null;
  statut: string | null;
  status: string | null;
  quantite: number | null;
  unite: string | null;
  created_at: string | null;
};

export type DashboardTone = "normal" | "warning" | "danger" | "success" | "info";

export type DashboardKpi = {
  key: Exclude<DashboardView, null> | "marge";
  label: string;
  value: string;
  hint: string;
  tone: DashboardTone;
};

export type DashboardPriorityItem = {
  key: string;
  href: string;
  title: string;
  subtitle: string;
  meta: string;
  detail?: string;
  tone: DashboardTone;
};

export type DashboardAlertCard = {
  key: string;
  label: string;
  value: number;
  description: string;
  href: string;
  tone: DashboardTone;
};

export type DashboardProjectCard = {
  id: string;
  href: string;
  name: string;
  client: string;
  status: string;
  statusTone: DashboardTone;
  finishLabel: string;
  progress: number;
  nextAction: string;
};

export type DashboardBusinessMetric = {
  key: string;
  label: string;
  value: string;
  hint: string;
  href: string;
  tone: DashboardTone;
};

export type DashboardAlertCategory = DashboardAlertRow["category"];
