import { useMemo, useState } from "react";
import type { CrmClientRow, CrmOpportunityRow, CrmProspectRow, CrmQuoteRow, CrmUserRow } from "../../../../services/crm.service";
import { buildUserLabelMap, entityLabel, salespersonLabel } from "../../components/crmFormat";
import type { QuoteFilterOption, QuoteFilters, QuoteWithParty } from "../types";

const DEFAULT_FILTERS: QuoteFilters = {
  query: "",
  status: "all",
  signatureStatus: "all",
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

function quoteCrmFallbackPath(row: CrmQuoteRow) {
  return `/crm/devis/${encodeURIComponent(row.id)}/edit`;
}

function quoteEditPath(row: CrmQuoteRow, projectPath: string) {
  const [projectBasePath] = projectPath.split("?");
  if (projectBasePath?.startsWith("/projets/") && projectBasePath !== "/projets") {
    return `${projectBasePath}/devis/${encodeURIComponent(row.id)}/edit`;
  }

  return quoteCrmFallbackPath(row);
}

function quoteSalesperson(
  row: CrmQuoteRow,
  prospectById: Map<string, CrmProspectRow>,
  opportunityById: Map<string, CrmOpportunityRow> | undefined,
  userLabelById: Map<string, string>,
) {
  const opportunity = row.opportunity_id ? opportunityById?.get(row.opportunity_id) ?? null : null;
  const prospect = row.prospect_id ? prospectById.get(row.prospect_id) ?? null : null;
  const ownerId = opportunity?.responsable_id ?? prospect?.owner_id ?? null;
  if (!ownerId) return { key: "unassigned", label: "Non assigné" };
  return { key: ownerId, label: salespersonLabel(ownerId, userLabelById) };
}

export function useQuoteFilters({
  rows,
  prospectById,
  clientById,
  opportunityById,
  users,
  projectPathByQuoteId,
  chantierPathByQuoteId,
  globalQuery,
}: {
  rows: CrmQuoteRow[];
  prospectById: Map<string, CrmProspectRow>;
  clientById: Map<string, CrmClientRow>;
  opportunityById?: Map<string, CrmOpportunityRow>;
  users?: CrmUserRow[];
  projectPathByQuoteId?: Map<string, string>;
  chantierPathByQuoteId?: Map<string, string>;
  globalQuery: string;
}) {
  const [filters, setFilters] = useState<QuoteFilters>(DEFAULT_FILTERS);
  const userLabelById = useMemo(() => buildUserLabelMap(users), [users]);

  const rowsWithParty = useMemo<QuoteWithParty[]>(() => rows.map((row) => {
    const linkedProjectPath = projectPathByQuoteId?.get(row.id) ?? "";
    const projectPath = linkedProjectPath || "/projets";
    const salesperson = quoteSalesperson(row, prospectById, opportunityById, userLabelById);
    return {
      ...row,
      partyLabel: entityLabel(clientById.get(row.client_id ?? "") ?? prospectById.get(row.prospect_id ?? "")),
      projectPath,
      hasProjectLink: Boolean(linkedProjectPath),
      quoteEditPath: quoteEditPath(row, projectPath),
      chantierPath: chantierPathByQuoteId?.get(row.id),
      salespersonKey: salesperson.key,
      salespersonLabel: salesperson.label,
    };
  }), [chantierPathByQuoteId, clientById, opportunityById, projectPathByQuoteId, prospectById, rows, userLabelById]);

  const statuses = useMemo(() => Array.from(new Set(rows.map((row) => row.statut))).sort(), [rows]);
  const clients = useMemo(() => Array.from(new Set(rowsWithParty.map((row) => row.partyLabel).filter((value) => value !== "—"))).sort(), [rowsWithParty]);
  const salespeople = useMemo<QuoteFilterOption[]>(() => {
    const options = new Map<string, string>();
    rowsWithParty.forEach((row) => options.set(row.salespersonKey, row.salespersonLabel));
    return Array.from(options, ([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rowsWithParty]);

  const filteredRows = useMemo(() => {
    const query = [globalQuery, filters.query].join(" ").trim().toLowerCase();
    return rowsWithParty
      .filter((row) => {
        const searchable = [
          row.id,
          row.quote_number,
          row.partyLabel,
          row.description,
          row.statut,
          row.signature_status,
          row.lot,
          row.salespersonLabel,
        ].join(" ").toLowerCase();
        if (query && !searchable.includes(query)) return false;
        if (filters.status !== "all" && row.statut !== filters.status) return false;
        if (filters.signatureStatus !== "all" && row.signature_status !== filters.signatureStatus) return false;
        if (filters.salesperson !== "all" && row.salespersonKey !== filters.salesperson) return false;
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

  return { filters, setFilters, filteredRows, statuses, clients, salespeople };
}