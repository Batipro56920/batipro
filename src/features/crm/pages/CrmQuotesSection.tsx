import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { CrmClientRow, CrmOpportunityRow, CrmProspectRow, CrmQuoteRow } from "../../../services/crm.service";
import { QuoteDetailDrawer } from "../quotes/components/QuoteDetailDrawer";
import { QuotesEmptyState } from "../quotes/components/QuotesEmptyState";
import { QuotesHeader } from "../quotes/components/QuotesHeader";
import { QuotesKpiGrid } from "../quotes/components/QuotesKpiGrid";
import { QuotesTable } from "../quotes/components/QuotesTable";
import { QuotesToolbar } from "../quotes/components/QuotesToolbar";
import { useQuoteFilters } from "../quotes/hooks/useQuoteFilters";
import type { QuoteWithParty } from "../quotes/types";

const URL_STATUS_FILTERS = new Set(["a_relancer"]);

export default function CrmQuotesSection({
  rows,
  prospectById,
  clientById,
  opportunityById,
  projectPathByQuoteId,
  chantierPathByQuoteId,
  onCreate,
  onStatus,
  onTransform,
  onPdf,
}: {
  rows: CrmQuoteRow[];
  prospectById: Map<string, CrmProspectRow>;
  clientById: Map<string, CrmClientRow>;
  opportunityById?: Map<string, CrmOpportunityRow>;
  projectPathByQuoteId?: Map<string, string>;
  chantierPathByQuoteId?: Map<string, string>;
  onCreate: () => void;
  onStatus: (row: CrmQuoteRow, status: CrmQuoteRow["statut"]) => void;
  onTransform: (row: CrmQuoteRow) => void;
  onPdf: (row: CrmQuoteRow) => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const urlStatus = searchParams.get("status") ?? "";
  const [selectedQuote, setSelectedQuote] = useState<QuoteWithParty | null>(null);
  const { filters, setFilters, filteredRows, statuses, clients, salespeople } = useQuoteFilters({
    rows,
    prospectById,
    clientById,
    opportunityById,
    projectPathByQuoteId,
    chantierPathByQuoteId,
    globalQuery: "",
  });
  const statusOptions = useMemo(() => ["a_relancer", ...statuses], [statuses]);
  const validUrlStatus = URL_STATUS_FILTERS.has(urlStatus) || statuses.includes(urlStatus);

  useEffect(() => {
    if (!urlQuery) return;
    setFilters((current) => (current.query === urlQuery ? current : { ...current, query: urlQuery }));
  }, [setFilters, urlQuery]);

  useEffect(() => {
    if (!urlStatus) return;
    if (!validUrlStatus) {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.delete("status");
      setSearchParams(nextSearchParams, { replace: true });
      return;
    }
    setFilters((current) => (current.status === urlStatus ? current : { ...current, status: urlStatus }));
  }, [searchParams, setFilters, setSearchParams, urlStatus, validUrlStatus]);

  useEffect(() => {
    const currentStatus = searchParams.get("status") ?? "";
    if (filters.status === "all") {
      if (!currentStatus) return;
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.delete("status");
      setSearchParams(nextSearchParams, { replace: true });
      return;
    }
    if (currentStatus === filters.status) return;
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("status", filters.status);
    setSearchParams(nextSearchParams, { replace: true });
  }, [filters.status, searchParams, setSearchParams]);

  const hasActiveFilters =
    filters.query.trim().length > 0 ||
    filters.status !== "all" ||
    filters.salesperson !== "all" ||
    filters.client !== "all" ||
    filters.period !== "all" ||
    filters.amount !== "all";

  function resetFilters() {
    setFilters({
      query: "",
      status: "all",
      salesperson: "all",
      client: "all",
      period: "all",
      amount: "all",
    });
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("q");
    nextSearchParams.delete("status");
    setSearchParams(nextSearchParams, { replace: true });
  }

  const actions = { onCreate, onStatus, onTransform, onPdf };

  return (
    <div className="space-y-5">
      <QuotesHeader onCreate={onCreate} />
      <QuotesKpiGrid rows={rows} />
      <QuotesToolbar
        filters={filters}
        setFilters={setFilters}
        statuses={statusOptions}
        clients={clients}
        salespeople={salespeople}
      />
      {filteredRows.length === 0 ? (
        <QuotesEmptyState
          onCreate={onCreate}
          hasActiveFilters={hasActiveFilters}
          searchTerm={filters.query.trim()}
          onResetFilters={resetFilters}
        />
      ) : (
        <QuotesTable rows={filteredRows} actions={actions} onSelect={setSelectedQuote} />
      )}

      <QuoteDetailDrawer quote={selectedQuote} actions={actions} onClose={() => setSelectedQuote(null)} />
    </div>
  );
}
