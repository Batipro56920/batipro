import { useMemo, useState } from "react";
import type { CrmClientRow, CrmProspectRow, CrmQuoteRow } from "../../../../services/crm.service";
import { entityLabel } from "../../components/crmFormat";
import type { QuoteFilters, QuoteWithParty } from "../types";

const DEFAULT_FILTERS: QuoteFilters = {
  query: "",
  status: "all",
  salesperson: "all",
  client: "all",
  period: "all",
  amount: "all",
};

function isRecent(value: string | null | undefined, days: number) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() - days);
  return date >= limit;
}

export function useQuoteFilters({
  rows,
  prospectById,
  clientById,
  globalQuery,
}: {
  rows: CrmQuoteRow[];
  prospectById: Map<string, CrmProspectRow>;
  clientById: Map<string, CrmClientRow>;
  globalQuery: string;
}) {
  const [filters, setFilters] = useState<QuoteFilters>(DEFAULT_FILTERS);

  const rowsWithParty = useMemo<QuoteWithParty[]>(() => rows.map((row) => ({
    ...row,
    partyLabel: entityLabel(clientById.get(row.client_id ?? "") ?? prospectById.get(row.prospect_id ?? "")),
  })), [clientById, prospectById, rows]);

  const statuses = useMemo(() => Array.from(new Set(rows.map((row) => row.statut))).sort(), [rows]);
  const clients = useMemo(() => Array.from(new Set(rowsWithParty.map((row) => row.partyLabel).filter((value) => value !== "—"))).sort(), [rowsWithParty]);

  const filteredRows = useMemo(() => {
    const query = [globalQuery, filters.query].join(" ").trim().toLowerCase();
    return rowsWithParty
      .filter((row) => {
        const searchable = [row.quote_number, row.partyLabel, row.description, row.statut, row.signature_status, row.lot].join(" ").toLowerCase();
        if (query && !searchable.includes(query)) return false;
        if (filters.status !== "all" && row.statut !== filters.status) return false;
        if (filters.client !== "all" && row.partyLabel !== filters.client) return false;
        if (filters.period === "week" && !isRecent(row.created_at, 7)) return false;
        if (filters.period === "month" && !isRecent(row.created_at, 30)) return false;
        if (filters.amount === "small" && row.montant_ht >= 5000) return false;
        if (filters.amount === "medium" && (row.montant_ht < 5000 || row.montant_ht >= 20000)) return false;
        if (filters.amount === "large" && row.montant_ht < 20000) return false;
        return true;
      })
      .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));
  }, [filters, globalQuery, rowsWithParty]);

  return { filters, setFilters, filteredRows, statuses, clients };
}
