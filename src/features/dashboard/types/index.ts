import type { DashboardAlertKind, DashboardAlertRow } from "../../../services/dashboardAlerts.service";

export type DashboardTone = "normal" | "warning" | "danger" | "success" | "info";

/** Filtre applique EN PLACE a la file "A traiter" (jamais un changement d'ecran). */
export type DashboardQueueFilter =
  | "all"
  | "urgences"
  | "qualite"
  | "retards"
  | "achats"
  | "validations"
  /* Conserves pour que les anciens liens `?view=alertes` et `?view=materiel`
     retrouvent exactement le meme contenu qu'avant la refonte. */
  | "alertes"
  | "materiel"
  /* Complement du filtre "urgences" : tout ce qui est ouvert sans etre critique. */
  | "encours";

/** Nature d'un element de la file : alertes chantier + demandes materiel. */
export type DashboardQueueKind = DashboardAlertKind | "materiel_attente" | "materiel_validee";

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

/** Une chose bloquee, sur un chantier, avec un lien pour la traiter. */
export type DashboardQueueItem = {
  key: string;
  /** Rang dans la source (alertes du service, puis materiel par date) : sert a
   *  restituer l'ordre d'origine sur les filtres legacy. */
  sourceIndex: number;
  kind: DashboardQueueKind;
  href: string;
  title: string;
  detail: string;
  chantierId: string;
  chantierNom: string;
  tone: DashboardTone;
  /** Score de priorite calcule (cf. docs/charte-ux-batipro.md). */
  score: number;
  /** Au-dessus du seuil critique : double le trait de couleur par un libelle. */
  isCritical: boolean;
  ageDays: number;
  ageLabel: string;
  sortAt: string;
};

export type DashboardSeverity = "critical" | "action" | "control";

/** Reponse litterale a "est-ce que ca necessite mon attention maintenant ?". */
export type DashboardVerdict = {
  tone: DashboardTone;
  criticalCount: number;
  criticalChantiers: number;
  actionCount: number;
  totalCount: number;
  headline: string;
};

/** Segment de la barre de charge : chaque chantier actif appartient a un seul segment. */
export type DashboardSeveritySegment = {
  key: DashboardSeverity;
  label: string;
  description: string;
  value: number;
  filter: DashboardQueueFilter;
};

/**
 * Vue de la liste des chantiers. Reprend a l'identique les focus `?view=` d'origine :
 * le tri ET la destination du lien changent avec la vue.
 */
export type DashboardChantierView = "priorite" | "recents" | "avancement" | "heures";

export type DashboardChantierCard = {
  id: string;
  href: string;
  name: string;
  client: string;
  status: string;
  statusTone: DashboardTone;
  finishLabel: string;
  progress: number;
  severity: DashboardSeverity;
  itemCount: number;
  criticalCount: number;
  isLate: boolean;
  isOverHours: boolean;
  hoursLabel: string;
  /** Libelle d'origine : heures consommees, ou invitation a preparer le chantier. */
  nextAction: string;
  /** Echeance proche (<= 7 jours) : recupere l intention de l ancienne liste "Cette semaine". */
  dueSoonLabel: string | null;
};

/**
 * Mesure de synthese cliquable : elle porte la valeur d'une ancienne carte KPI
 * et declenche exactement le meme focus, sans occuper un bandeau de cartes.
 */
export type DashboardMeasure = {
  key: "chantiers" | "alertes" | "avancement" | "heures";
  label: string;
  value: string;
  hint: string;
  tone: DashboardTone;
  /** Reprend a l'identique le focus de la carte KPI d'origine. */
  target:
    | { kind: "tri"; view: DashboardChantierView }
    | { kind: "filter"; filter: DashboardQueueFilter };
};

export type DashboardFilterChip = {
  key: DashboardQueueFilter;
  label: string;
  value: number;
  tone: DashboardTone;
};

export type DashboardBusinessMetricKey =
  | "invoices"
  | "clientDocuments"
  | "purchaseOrders"
  | "quotes"
  | "opportunities"
  | "sav"
  | "apporteurCommissions";

export type DashboardBusinessMetric = {
  key: DashboardBusinessMetricKey;
  label: string;
  value: string;
  hint: string;
  href: string;
  tone: DashboardTone;
  /** Un compteur "actionnable" alimente le total affiche sur la section repliee. */
  actionable: boolean;
};

export type DashboardAlertCategory = DashboardAlertRow["category"];
