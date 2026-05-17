import type { ChantierStatus } from "../../../../types/chantier";
import type { ChantierRow, ChantierScope } from "../../../../services/chantiers.service";

export type ChantierListFilter = Exclude<ChantierScope, "en_cours">;
export type ChantierListView = "list" | "cards" | "planning" | "kanban";

export type ChantierDerived = ChantierRow & {
  progress: number;
  isLate: boolean;
  budgetHt: number | null;
  timeRatio: number | null;
  estimatedMargin: number | null;
};

export type ChantierListFilters = {
  query: string;
  status: "all" | ChantierStatus;
  client: string;
  conducteur: string;
  commercial: string;
  period: "all" | "this_month" | "next_30" | "late";
  type: string;
};

export type ChantierListActions = {
  onOpen: (row: ChantierRow) => void;
  onFinish: (row: ChantierRow) => void;
  onArchive: (row: ChantierRow) => void;
  onRestore: (row: ChantierRow) => void;
  onDeleteDraft: (row: ChantierRow) => void;
  onExportRow: (row: ChantierRow) => void;
};

