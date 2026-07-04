import { useMemo, useState } from "react";
import type { CrmClientRow, CrmOpportunityRow, CrmProspectRow, CrmQuoteRow } from "../../../../services/crm.service";
import { entityLabel } from "../../components/crmFormat";
import type { QuoteFilterOption, QuoteFilters, QuoteWithParty } from "../types";

const DEFAULT_FILTERS: QuoteFilters = {
  query: "",
  status: "all",
  salesperson: "all",
  client: "all",
  period: "all",
  amount: "all",
};

const QUOTE_FOLLOW_UP_STATUSES: Set<string> = new Set(["envoye", "vu", "relance_1", "relance_2", "negociation"]);
const QUOTE_CLOSED_STATUSES: Set<string> = new Set(["accepte", "refuse", "expire", "annule"]);
const QUOTE_CLOSED_SIGNATURE_STATUSES: Set<string> = new Set(["signe", "signé", "refuse"]);

function isRecent(value: string | null | undefined, days: number) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() - days);
  return date >= limit;
}

function matchesStatusFilter(row: QuoteWithParty, status: string) {
  if (status === "all") return true;
  if (status === "a_relancer") {
    const isClosed = QUOTE_CLOSED_STATUSES.has(row.statut) || QUOTE_CLOSED_SIGNATURE_STATUSES.has(row.signature_status);
    return QUOTE_FOLLOW_UP_STATUSES.has(row.statut) && !isClosed;
  }
  return row.statut === status;
}

function quoteEditPath(row: CrmQuoteRow, projectPath: string) {
  const [projectBasePath] = projectPath.split("?");
  if (projectBasePath && projectBasePath !== "/projets") {
    return `${projectBasePath}/devis/${encodeURIComponent(row.id)}/edit`;
  }

  return `/crm/devis/${encodeURIComponent(row.id)}/edit`;
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function quoteSalesperson(
  row: CrmQuoteRow,
  prospectById: Map<string, CrmProspectRow>,
  opportunityById?: Map<string, CrmOpportunityRow>,
) {
  const opportunity = row.opportunity_id ? opportunityById?.get(row.opportunity_id) ?? null : null;
  if (opportunity?.responsable_id) {
    return {
      key: `opportunity:${opportunity.responsable_id}`,
      label: `Opportunité ${shortId(opportunity.responsable_id)}`,
    };
  }

  const prospect = row.prospect_id ? prospectById.get(row.prospect_id) ?? null : null;
  if (prospect?.owner_id) {
    return {
      key: `prospect:${prospect.owner_id}`,
      label: `Prospect ${shortId(prospect.owner_id)}`,
    };
  }

  return { key: "unassigned", label: "Non assigné" };
}

export function useQuoteFilters({
  rows,
  prospectById,
  clientById,
  opportunityById,
  projectPathByQuoteId,
  chantierPathByQuoteId,
  globalQuery,
}: {
  rows: CrmQuoteRow[];
  prospectById: Map<string, CrmProspectRow>;
  clientById: Map<string, CrmClientRow>;
  opportunityById?: Map<string, CrmOpportunityRow>;
  projectPathByQuoteId?: Map<string, string>;
  chantierPathByQuoteId?: Map<string, string>;
  globalQuery: string;
}) {
  const [filters, setFilters] = useState<QuoteFilters>(DEFAULT_FILTERS);

  const rowsWithParty = useMemo<QuoteWithParty[]>(() => rows.map((row) => {
    const projectPath = projectPathByQuoteId?.get(row.id) ?? "/projets";
    const salesperson = quoteSalesperson(row, prospectById, opportunityById);
    return {
      ...row,
      partyLabel: entityLabel(clientById.get(row.client_id ?? "") ?? prospectById.get(row.prospect_id ?? "")),
      projectPath,
      quoteEditPath: quoteEditPath(row, projectPath),
      chantierPath: chantierPathByQuoteId?.get(row.id),
      salespersonKey: salesperson.key,
      salespersonLabel: salesperson.label,
    };
  }), [chantierPathByQuoteId, clientById, opportunityById, projectPathByQuoteId, prospectById, rows]);

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
        if (!matchesStatusFilter(row, filters.status)) return false;
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
