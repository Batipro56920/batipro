import { useMemo, useState } from "react";
import type { CrmProspectRow } from "../../../../services/crm.service";
import type { ProspectFilters, ProspectQuickFilter } from "../types";

const DEFAULT_FILTERS: ProspectFilters = {
  status: "all",
  source: "all",
  owner: "all",
  budget: "all",
  createdAt: "all",
  due: "all",
  quick: "all",
};

function isRecent(value: string | null | undefined, days: number) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() - days);
  return date >= limit;
}

function matchesQuickFilter(row: CrmProspectRow, filter: ProspectQuickFilter) {
  if (filter === "all") return true;
  if (filter === "converted") return row.client_id !== null || row.statut === "gagne";
  if (filter === "lost") return ["perdu", "archive"].includes(row.statut);
  if (filter === "hot") return row.urgence === "haute" || Number(row.budget_estime ?? 0) >= 10000 || ["qualifie", "negociation"].includes(row.statut);
  if (filter === "followup") return !["gagne", "perdu", "archive"].includes(row.statut);
  return true;
}

export function useProspectsFilters(rows: CrmProspectRow[], query: string) {
  const [filters, setFilters] = useState<ProspectFilters>(DEFAULT_FILTERS);

  const sources = useMemo(() => Array.from(new Set(rows.map((row) => row.source_acquisition).filter(Boolean) as string[])).sort(), [rows]);
  const statuses = useMemo(() => Array.from(new Set(rows.map((row) => row.statut))).sort(), [rows]);
  const owners = useMemo(() => Array.from(new Set(rows.map((row) => row.owner_id).filter(Boolean) as string[])).sort(), [rows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      const searchable = [row.prenom, row.nom, row.societe, row.email, row.telephone, row.mobile, row.ville, row.type_projet, row.statut, row.source_acquisition]
        .join(" ")
        .toLowerCase();

      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
      if (!matchesQuickFilter(row, filters.quick)) return false;
      if (filters.status !== "all" && row.statut !== filters.status) return false;
      if (filters.source !== "all" && row.source_acquisition !== filters.source) return false;
      if (filters.owner !== "all" && row.owner_id !== filters.owner) return false;
      if (filters.budget === "with_budget" && !row.budget_estime) return false;
      if (filters.budget === "high" && Number(row.budget_estime ?? 0) < 10000) return false;
      if (filters.createdAt === "week" && !isRecent(row.created_at, 7)) return false;
      if (filters.createdAt === "month" && !isRecent(row.created_at, 30)) return false;
      if (filters.due === "to_follow" && ["gagne", "perdu", "archive"].includes(row.statut)) return false;
      return true;
    });
  }, [filters, query, rows]);

  return { filteredRows, filters, setFilters, sources, statuses, owners };
}
