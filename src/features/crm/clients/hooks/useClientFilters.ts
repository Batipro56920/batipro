import { useMemo, useState } from "react";
import type { CrmClientRow } from "../../../../services/crm.service";
import { entityLabel } from "../../components/crmFormat";
import type { ClientFilters, ClientMetrics, ClientWithMetrics } from "../types";

const DEFAULT_FILTERS: ClientFilters = {
  query: "",
  type: "all",
  owner: "all",
  status: "all",
  chantier: "all",
  sav: "all",
  date: "all",
};

function isRecent(value: string | null | undefined, days: number) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() - days);
  return date >= limit;
}

export function useClientFilters({
  rows,
  metrics,
  globalQuery,
}: {
  rows: CrmClientRow[];
  metrics: ClientMetrics;
  globalQuery: string;
}) {
  const [filters, setFilters] = useState<ClientFilters>(DEFAULT_FILTERS);

  const rowsWithMetrics = useMemo<ClientWithMetrics[]>(() => rows.map((row) => {
    const chantiers = metrics.chantiers.filter((chantier) => chantier.crm_client_id === row.id);
    const activeChantiers = chantiers.filter((chantier) => ["PREPARATION", "EN_COURS", "EN_PAUSE"].includes(chantier.status)).length;
    const quotes = metrics.quotes.filter((quote) => quote.client_id === row.id);
    const invoices = metrics.invoices.filter((invoice) => invoice.client_id === row.id);
    const sav = metrics.sav.filter((ticket) => ticket.client_id === row.id);
    const documents = metrics.documents.filter((document) => document.client_id === row.id);

    return {
      ...row,
      label: entityLabel(row),
      activeChantiers,
      totalChantiers: chantiers.length,
      quotesCount: quotes.length,
      totalRevenue: chantiers.reduce((sum, chantier) => sum + Number(chantier.signed_quote_amount_ht ?? 0), 0),
      pendingInvoices: invoices.filter((invoice) => !invoice.paid_at && invoice.statut !== "payee").length,
      openSav: sav.filter((ticket) => ticket.statut !== "clos").length,
      documentsCount: documents.length,
    };
  }), [metrics.chantiers, metrics.documents, metrics.invoices, metrics.quotes, metrics.sav, rows]);

  const types = useMemo(() => Array.from(new Set(rows.map((row) => row.type).filter(Boolean))).sort(), [rows]);

  const filteredRows = useMemo(() => {
    const query = [globalQuery, filters.query].join(" ").trim().toLowerCase();
    return rowsWithMetrics.filter((row) => {
      const searchable = [row.label, row.email, row.telephone, row.mobile, row.societe, row.ville, row.notes].join(" ").toLowerCase();
      if (query && !searchable.includes(query)) return false;
      if (filters.type !== "all" && row.type !== filters.type) return false;
      if (filters.status === "active" && row.archived_at) return false;
      if (filters.status === "archived" && !row.archived_at) return false;
      if (filters.chantier === "active" && row.activeChantiers === 0) return false;
      if (filters.chantier === "none" && row.totalChantiers > 0) return false;
      if (filters.sav === "open" && row.openSav === 0) return false;
      if (filters.sav === "none" && row.openSav > 0) return false;
      if (filters.date === "month" && !isRecent(row.created_at, 30)) return false;
      if (filters.date === "week" && !isRecent(row.created_at, 7)) return false;
      return true;
    });
  }, [filters, globalQuery, rowsWithMetrics]);

  return { filters, setFilters, filteredRows, rowsWithMetrics, types };
}
