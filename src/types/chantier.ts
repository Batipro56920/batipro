// src/types/chantier.ts

/* =========================================================
   STATUTS CHANTIER
   ========================================================= */

export type ChantierStatus =
  | "EN_ATTENTE"
  | "EN_COURS"
  | "TERMINE";

/* =========================================================
   PLANNING / TÂCHES
   ========================================================= */

export type TaskStatus =
  | "A_FAIRE"
  | "EN_COURS"
  | "FAIT";

export type ChantierTask = {
  id: string;
  titre: string;
  corpsEtat?: string;
  date?: string; // YYYY-MM-DD
  status: TaskStatus;
};

/* =========================================================
   RÉSERVES
   ========================================================= */

export type ReserveStatus =
  | "OUVERTE"
  | "EN_COURS"
  | "LEVEE";

export type ChantierReserve = {
  id: string;
  piece?: string;
  description: string;
  status: ReserveStatus;
  createdAt: string; // ISO string
};

/* =========================================================
   DOCUMENTS
   ========================================================= */

export type DocumentType =
  | "DEVIS"
  | "PLAN"
  | "FACTURE"
  | "PV"
  | "PHOTO"
  | "AUTRE";

export type ChantierDocument = {
  id: string;
  type: DocumentType;
  nom: string;
  date?: string; // YYYY-MM-DD
  url?: string;  // lien (Drive, Dropbox, etc.)
  notes?: string;
};

/* =========================================================
   CHANTIER (ENTITÉ PRINCIPALE)
   ========================================================= */

export type Chantier = {
  id: string;
  nom: string;
  client?: string | null;
  adresse?: string | null;

  status: ChantierStatus;
  avancement: number; // 0 → 100

  dateDebut?: string | null; // YYYY-MM-DD
  dateFinPrevue?: string | null; // YYYY-MM-DD
  heuresPrevues: number;
  heuresPassees: number;

  /**
   * Données métier optionnelles
   * (optionnelles = compatibilité seed / évolution progressive)
   */
  tasks?: ChantierTask[];
  reserves?: ChantierReserve[];
  documents?: ChantierDocument[];
};

