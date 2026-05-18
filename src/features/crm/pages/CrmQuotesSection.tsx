import { useState } from "react";
import type { CrmClientRow, CrmProspectRow, CrmQuoteRow } from "../../../services/crm.service";
import { QuoteDetailDrawer } from "../quotes/components/QuoteDetailDrawer";
import { QuotesEmptyState } from "../quotes/components/QuotesEmptyState";
import { QuotesHeader } from "../quotes/components/QuotesHeader";
import { QuotesKpiGrid } from "../quotes/components/QuotesKpiGrid";
import { QuotesTable } from "../quotes/components/QuotesTable";
import { QuotesToolbar } from "../quotes/components/QuotesToolbar";
import { useQuoteFilters } from "../quotes/hooks/useQuoteFilters";
import type { QuoteWithParty } from "../quotes/types";

export default function CrmQuotesSection({
  rows,
  prospectById,
  clientById,
  onCreate,
  onStatus,
  onTransform,
  onPdf,
}: {
  rows: CrmQuoteRow[];
  prospectById: Map<string, CrmProspectRow>;
  clientById: Map<string, CrmClientRow>;
  onCreate: () => void;
  onStatus: (row: CrmQuoteRow, status: CrmQuoteRow["statut"]) => void;
  onTransform: (row: CrmQuoteRow) => void;
  onPdf: (row: CrmQuoteRow) => void;
}) {
  const [selectedQuote, setSelectedQuote] = useState<QuoteWithParty | null>(null);
  const { filters, setFilters, filteredRows, statuses, clients } = useQuoteFilters({
    rows,
    prospectById,
    clientById,
    globalQuery: "",
  });

  const actions = { onCreate, onStatus, onTransform, onPdf };

  return (
    <div className="space-y-5">
      <QuotesHeader onCreate={onCreate} />
      <QuotesKpiGrid rows={rows} />
      <QuotesToolbar
        filters={filters}
        setFilters={setFilters}
        statuses={statuses}
        clients={clients}
      />
      {filteredRows.length === 0 ? (
        <QuotesEmptyState onCreate={onCreate} />
      ) : (
        <QuotesTable rows={filteredRows} actions={actions} onSelect={setSelectedQuote} />
      )}

      <QuoteDetailDrawer quote={selectedQuote} actions={actions} onClose={() => setSelectedQuote(null)} />
    </div>
  );
}
