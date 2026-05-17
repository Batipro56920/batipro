import { useMemo, useState } from "react";
import type { CrmDataset } from "../../../../services/crm.service";
import { entityLabel } from "../../components/crmFormat";
import type { SavContext, SavFilters, SavWithContext } from "../types";

const DEFAULT_FILTERS: SavFilters = {
  query: "",
  client: "all",
  chantier: "all",
  priority: "all",
  status: "all",
  assignee: "all",
  date: "all",
};

function isRecent(value: string, days: number) {
  const date = new Date(value);
  const limit = new Date();
  limit.setDate(limit.getDate() - days);
  return date >= limit;
}

export function useSavFilters(rows: CrmDataset["sav"], context: SavContext) {
  const [filters, setFilters] = useState<SavFilters>(DEFAULT_FILTERS);

  const rowsWithContext = useMemo<SavWithContext[]>(() => rows.map((row) => ({
    ...row,
    clientLabel: entityLabel(context.clients.get(row.client_id ?? "")),
    chantierLabel: context.chantiers.find((chantier) => chantier.id === row.chantier_id)?.nom ?? "—",
  })), [context.chantiers, context.clients, rows]);

  const clients = useMemo(() => Array.from(new Set(rowsWithContext.map((row) => row.clientLabel).filter((value) => value !== "—"))).sort(), [rowsWithContext]);
  const chantiers = useMemo(() => Array.from(new Set(rowsWithContext.map((row) => row.chantierLabel).filter((value) => value !== "—"))).sort(), [rowsWithContext]);
  const priorities = useMemo(() => Array.from(new Set(rows.map((row) => row.urgence))).sort(), [rows]);
  const statuses = useMemo(() => Array.from(new Set(rows.map((row) => row.statut))).sort(), [rows]);
  const assignees = useMemo(() => Array.from(new Set(rows.map((row) => row.assigned_to).filter(Boolean) as string[])).sort(), [rows]);

  const filteredRows = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return rowsWithContext.filter((row) => {
      const searchable = [row.titre, row.description, row.clientLabel, row.chantierLabel, row.statut, row.urgence].join(" ").toLowerCase();
      if (query && !searchable.includes(query)) return false;
      if (filters.client !== "all" && row.clientLabel !== filters.client) return false;
      if (filters.chantier !== "all" && row.chantierLabel !== filters.chantier) return false;
      if (filters.priority !== "all" && row.urgence !== filters.priority) return false;
      if (filters.status !== "all" && row.statut !== filters.status) return false;
      if (filters.assignee !== "all" && row.assigned_to !== filters.assignee) return false;
      if (filters.date === "week" && !isRecent(row.created_at, 7)) return false;
      if (filters.date === "month" && !isRecent(row.created_at, 30)) return false;
      return true;
    });
  }, [filters, rowsWithContext]);

  return { filters, setFilters, filteredRows, rowsWithContext, clients, chantiers, priorities, statuses, assignees };
}
