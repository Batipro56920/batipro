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

const STATUS_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  en_preparation: "En préparation",
  envoye: "Envoyé",
  vu: "Vu",
  relance_1: "Relance 1",
  relance_2: "Relance 2",
  accepte: "Accepté",
  refuse: "Refusé",
};

const SIGNATURE_STATUS_LABELS: Record<string, string> = {
  attente_signature: "Attente signature",
  signe: "Signé",
  refuse: "Refusé",
};

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
  const urlSignatureStatus = searchParams.get("signatureStatus") ?? "";
  const availableStatuses = useMemo(
    () => new Set(["accepte", ...rows.map((row) => row.statut).filter(Boolean)]),
    [rows],
  );
  const availableSignatureStatuses = useMemo(
    () => new Set(["attente_signature", ...rows.map((row) => row.signature_status).filter(Boolean)]),
    [rows],
  );
  const statusFromUrl = availableStatuses.has(urlStatus) ? urlStatus : "";
  const signatureStatusFromUrl = availableSignatureStatuses.has(urlSignatureStatus) ? urlSignatureStatus : "";
  const invalidStatusFromUrl = Boolean(urlStatus && !statusFromUrl);
  const invalidSignatureStatusFromUrl = Boolean(urlSignatureStatus && !signatureStatusFromUrl);
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

  useEffect(() => {
    if (!urlQuery) return;
    setFilters((current) => (current.query === urlQuery ? current : { ...current, query: urlQuery }));
  }, [setFilters, urlQuery]);

  useEffect(() => {
    if (invalidStatusFromUrl) {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.delete("status");
      setSearchParams(nextSearchParams, { replace: true });
      return;
    }

    setFilters((current) => {
      const nextStatus = statusFromUrl || "all";
      return current.status === nextStatus ? current : { ...current, status: nextStatus };
    });
  }, [invalidStatusFromUrl, searchParams, setFilters, setSearchParams, statusFromUrl]);

  useEffect(() => {
    if (invalidSignatureStatusFromUrl) {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.delete("signatureStatus");
      setSearchParams(nextSearchParams, { replace: true });
      return;
    }

    setFilters((current) => {
      const nextSignatureStatus = signatureStatusFromUrl || "all";
      return current.signatureStatus === nextSignatureStatus ? current : { ...current, signatureStatus: nextSignatureStatus };
    });
  }, [invalidSignatureStatusFromUrl, searchParams, setFilters, setSearchParams, signatureStatusFromUrl]);

  const hasActiveFilters =
    filters.query.trim().length > 0 ||
    filters.status !== "all" ||
    filters.signatureStatus !== "all" ||
    filters.salesperson !== "all" ||
    filters.client !== "all" ||
    filters.period !== "all" ||
    filters.amount !== "all";

  function resetFilters() {
    setFilters({
      query: "",
      status: "all",
      signatureStatus: "all",
      salesperson: "all",
      client: "all",
      period: "all",
      amount: "all",
    });
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("q");
    nextSearchParams.delete("status");
    nextSearchParams.delete("signatureStatus");
    setSearchParams(nextSearchParams, { replace: true });
  }

  function clearStatusFilter() {
    setFilters((current) => ({ ...current, status: "all" }));
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("status");
    setSearchParams(nextSearchParams, { replace: true });
  }

  function clearSignatureStatusFilter() {
    setFilters((current) => ({ ...current, signatureStatus: "all" }));
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("signatureStatus");
    setSearchParams(nextSearchParams, { replace: true });
  }

  const actions = { onCreate, onStatus, onTransform, onPdf };
  const statusLabel = STATUS_LABELS[filters.status] ?? filters.status;
  const signatureStatusLabel = SIGNATURE_STATUS_LABELS[filters.signatureStatus] ?? filters.signatureStatus;

  return (
    <div className="space-y-5">
      <QuotesHeader onCreate={onCreate} />
      <QuotesKpiGrid rows={rows} />
      <QuotesToolbar
        filters={filters}
        setFilters={setFilters}
        statuses={statuses}
        clients={clients}
        salespeople={salespeople}
      />
      {filters.status !== "all" ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">Devis filtrés sur le statut commercial</div>
              <p className="mt-1 text-emerald-800">Statut : {statusLabel}. Ce contexte peut venir d'un KPI Devis et reste partageable dans l'URL.</p>
            </div>
            <button
              type="button"
              onClick={clearStatusFilter}
              className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Afficher tous les statuts
            </button>
          </div>
        </div>
      ) : null}
      {filters.signatureStatus !== "all" ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">Devis filtrés sur la signature client</div>
              <p className="mt-1 text-blue-800">Statut signature : {signatureStatusLabel}. Ce contexte vient du dashboard et reste partageable dans l'URL.</p>
            </div>
            <button
              type="button"
              onClick={clearSignatureStatusFilter}
              className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Afficher tous les devis
            </button>
          </div>
        </div>
      ) : null}
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
