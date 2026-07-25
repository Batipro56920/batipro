import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, FileCheck2, RefreshCw, Search } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { PageHeader } from "../../../components/layout/PageHeader";
import { StatCard } from "../../../components/data/StatCard";
import { supabase } from "../../../lib/supabaseClient";
import { calculateDocumentTotals, type ElectronicInvoicingMetadata, type ElectronicInvoicingTransmissionStatus } from "../../document-engine";
import { getInvoiceElectronicInvoicingReadiness, normalizeInvoiceElectronicInvoicing } from "../application/electronicInvoicing";
import { getFacturXExportReadiness } from "../application/facturxExport";
import { listInvoices, saveInvoice } from "../infrastructure/invoiceRepository";
import type { InvoiceRecord, InvoiceStatus } from "../domain/types";
import { InvoiceEditor } from "../components/InvoiceEditor";
import { InvoiceStatusBadge } from "../components/InvoiceStatusBadge";
import { getPaidAmount } from "../application/invoicePayments";
import { invoiceTypeLabel } from "../application/invoiceFactory";

type InvoiceStatusFilter = "all" | "a_encaisser" | InvoiceStatus;
type ClientWorkflowFilter = "all" | "actionable";
type ElectronicInvoicingFilter = "all" | "facturx_incomplete" | "facturx_ready";

const COLLECTABLE_INVOICE_STATUSES: InvoiceStatus[] = ["sent", "partially_paid", "overdue"];
const ACTIONABLE_CLIENT_WORKFLOW_STATUSES = ["sent", "viewed", "modification_requested", "expired"] as const;
type ClientWorkflowStatus = (typeof ACTIONABLE_CLIENT_WORKFLOW_STATUSES)[number];

const CLIENT_WORKFLOW_STATUS_META: Record<ClientWorkflowStatus, { label: string; className: string }> = {
  sent: { label: "Doc envoyé", className: "bg-blue-100 text-blue-800" },
  viewed: { label: "Doc consulté", className: "bg-cyan-100 text-cyan-800" },
  modification_requested: { label: "Modif. demandée", className: "bg-amber-100 text-amber-800" },
  expired: { label: "Lien expiré", className: "bg-red-100 text-red-800" },
};

const INVOICE_STATUS_FILTERS: Array<{ value: InvoiceStatusFilter; label: string }> = [
  { value: "all", label: "Tous statuts" },
  { value: "a_encaisser", label: "À encaisser" },
  { value: "draft", label: "Brouillon" },
  { value: "sent", label: "Envoyée" },
  { value: "partially_paid", label: "Partiellement payée" },
  { value: "paid", label: "Payée" },
  { value: "overdue", label: "En retard" },
  { value: "cancelled", label: "Annulée" },
];

const CLIENT_WORKFLOW_FILTERS: Array<{ value: ClientWorkflowFilter; label: string }> = [
  { value: "all", label: "Tous documents client" },
  { value: "actionable", label: "Docs client à traiter" },
];

const ELECTRONIC_INVOICING_FILTERS: Array<{ value: ElectronicInvoicingFilter; label: string }> = [
  { value: "all", label: "Toutes Factur-X" },
  { value: "facturx_incomplete", label: "Factur-X à corriger" },
  { value: "facturx_ready", label: "Factur-X prévalidée" },
];

function matchesStatusFilter(invoice: InvoiceRecord, filter: InvoiceStatusFilter) {
  if (filter === "all") return true;
  if (filter === "a_encaisser") return COLLECTABLE_INVOICE_STATUSES.includes(invoice.status);
  return invoice.status === filter;
}

function matchesClientWorkflowFilter(invoice: InvoiceRecord, filter: ClientWorkflowFilter, workflowByInvoiceId: Map<string, ClientWorkflowStatus>) {
  if (filter === "all") return true;
  return workflowByInvoiceId.has(invoice.id);
}

function matchesElectronicInvoicingFilter(invoice: InvoiceRecord, filter: ElectronicInvoicingFilter) {
  if (filter === "all") return true;
  const readiness = getFacturXExportReadiness(invoice.document);
  if (filter === "facturx_ready") return readiness.canExport;
  return !readiness.canExport;
}

function getFacturXBlockingIssue(invoice: InvoiceRecord) {
  return getFacturXExportReadiness(invoice.document).missingFields[0] ?? null;
}

export default function InvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceIdFromUrl = searchParams.get("invoice")?.trim() || null;
  const statusFromUrl = searchParams.get("status")?.trim() || "";
  const clientWorkflowFromUrl = searchParams.get("clientWorkflow")?.trim() || "";
  const statusFilterFromUrl = INVOICE_STATUS_FILTERS.some((option) => option.value === statusFromUrl)
    ? (statusFromUrl as InvoiceStatusFilter)
    : null;
  const clientWorkflowFilterFromUrl = CLIENT_WORKFLOW_FILTERS.some((option) => option.value === clientWorkflowFromUrl)
    ? (clientWorkflowFromUrl as ClientWorkflowFilter)
    : null;
  const invalidStatusFromUrl = Boolean(statusFromUrl && !statusFilterFromUrl);
  const invalidClientWorkflowFromUrl = Boolean(clientWorkflowFromUrl && !clientWorkflowFilterFromUrl);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [clientWorkflowByInvoiceId, setClientWorkflowByInvoiceId] = useState<Map<string, ClientWorkflowStatus>>(() => new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirtyInvoiceIds, setDirtyInvoiceIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [clientWorkflowLoadFailed, setClientWorkflowLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>("all");
  const [clientWorkflowFilter, setClientWorkflowFilter] = useState<ClientWorkflowFilter>("all");
  const [electronicInvoicingFilter, setElectronicInvoicingFilter] = useState<ElectronicInvoicingFilter>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const selected = invoices.find((invoice) => invoice.id === selectedId) ?? null;
  const targetedInvoice = useMemo(
    () => (invoiceIdFromUrl ? invoices.find((invoice) => invoice.id === invoiceIdFromUrl) ?? null : null),
    [invoiceIdFromUrl, invoices],
  );
  const targetedInvoiceMissing = Boolean(invoiceIdFromUrl && !loading && !targetedInvoice);
  const activeClientWorkflowFilterLabel = CLIENT_WORKFLOW_FILTERS.find((option) => option.value === clientWorkflowFilter)?.label ?? "Documents client";

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (invalidStatusFromUrl) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("status");
      setSearchParams(nextParams, { replace: true });
      return;
    }
    setStatusFilter(statusFilterFromUrl ?? "all");
  }, [invalidStatusFromUrl, searchParams, setSearchParams, statusFilterFromUrl]);

  useEffect(() => {
    if (invalidClientWorkflowFromUrl) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("clientWorkflow");
      setSearchParams(nextParams, { replace: true });
      return;
    }
    setClientWorkflowFilter(clientWorkflowFilterFromUrl ?? "all");
  }, [clientWorkflowFilterFromUrl, invalidClientWorkflowFromUrl, searchParams, setSearchParams]);

  useEffect(() => {
    if (!invoiceIdFromUrl) return;
    if (targetedInvoice) {
      const targetedStatusFilter =
        statusFilterFromUrl && matchesStatusFilter(targetedInvoice, statusFilterFromUrl)
          ? statusFilterFromUrl
          : "all";
      const targetedClientWorkflowFilter =
        clientWorkflowFilterFromUrl && matchesClientWorkflowFilter(targetedInvoice, clientWorkflowFilterFromUrl, clientWorkflowByInvoiceId)
          ? clientWorkflowFilterFromUrl
          : "all";
      setSelectedId(targetedInvoice.id);
      setQuery("");
      setStatusFilter(targetedStatusFilter);
      setClientWorkflowFilter(targetedClientWorkflowFilter);
      setElectronicInvoicingFilter("all");
      setTypeFilter("all");
      if ((statusFilterFromUrl && targetedStatusFilter === "all") || (clientWorkflowFilterFromUrl && targetedClientWorkflowFilter === "all")) {
        const nextParams = new URLSearchParams(searchParams);
        if (statusFilterFromUrl && targetedStatusFilter === "all") nextParams.delete("status");
        if (clientWorkflowFilterFromUrl && targetedClientWorkflowFilter === "all") nextParams.delete("clientWorkflow");
        setSearchParams(nextParams, { replace: true });
      }
    }
  }, [clientWorkflowByInvoiceId, clientWorkflowFilterFromUrl, invoiceIdFromUrl, searchParams, setSearchParams, statusFilterFromUrl, targetedInvoice]);

  const stats = useMemo(() => {
    const totals = invoices.reduce((acc, invoice) => {
      const documentTotals = invoice.document.totals ?? calculateDocumentTotals(invoice.document);
      const facturXReadiness = getFacturXExportReadiness(invoice.document);
      const electronicInvoicing = normalizeInvoiceElectronicInvoicing(invoice.document.electronicInvoicing, invoice.document);
      acc.amount += documentTotals.totalTtc;
      acc.paid += getPaidAmount(invoice);
      if (invoice.status === "overdue") acc.overdue += 1;
      if (invoice.status === "draft") acc.drafts += 1;
      if (facturXReadiness.canExport) acc.facturXReady += 1;
      else acc.facturXIncomplete += 1;
      if (electronicInvoicing.lastFacturXExportAt) acc.facturXExported += 1;
      return acc;
    }, { amount: 0, paid: 0, overdue: 0, drafts: 0, facturXReady: 0, facturXIncomplete: 0, facturXExported: 0 });
    return totals;
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const text = query.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const matchesText = !text || [
        invoice.document.number,
        invoice.document.recipient.displayName,
        invoice.document.siteAddress,
        invoice.document.title,
      ].some((value) => String(value ?? "").toLowerCase().includes(text));
      const matchesStatus = matchesStatusFilter(invoice, statusFilter);
      const matchesClientWorkflow = matchesClientWorkflowFilter(invoice, clientWorkflowFilter, clientWorkflowByInvoiceId);
      const matchesElectronicInvoicing = matchesElectronicInvoicingFilter(invoice, electronicInvoicingFilter);
      const matchesType = typeFilter === "all" || invoice.type === typeFilter;
      return matchesText && matchesStatus && matchesClientWorkflow && matchesElectronicInvoicing && matchesType;
    });
  }, [clientWorkflowByInvoiceId, clientWorkflowFilter, electronicInvoicingFilter, invoices, query, statusFilter, typeFilter]);

  const firstFacturXIncompleteInvoice = useMemo(
    () => filteredInvoices.find((invoice) => !getFacturXExportReadiness(invoice.document).canExport) ?? null,
    [filteredInvoices],
  );

  async function refresh(selectFirst = true) {
    if (dirtyInvoiceIds.size > 0) {
      const shouldDiscardChanges = typeof window !== "undefined" && window.confirm("Des modifications de facture ne sont pas enregistrées. Les perdre et rafraîchir les données ?");
      if (!shouldDiscardChanges) return;
    }

    setLoading(true);
    setClientWorkflowLoadFailed(false);
    setError(null);
    try {
      const [rows, workflowByInvoiceId] = await Promise.all([
        listInvoices(),
        listActionableClientWorkflowByInvoiceId().catch(() => {
          setClientWorkflowLoadFailed(true);
          return new Map<string, ClientWorkflowStatus>();
        }),
      ]);
      setInvoices(rows);
      setClientWorkflowByInvoiceId(workflowByInvoiceId);
      setDirtyInvoiceIds(new Set());
      if (selectFirst) {
        setSelectedId((current) => {
          if (invoiceIdFromUrl && rows.some((invoice) => invoice.id === invoiceIdFromUrl)) return invoiceIdFromUrl;
          const urlStatusFilter = statusFilterFromUrl ?? "all";
          const urlClientWorkflowFilter = clientWorkflowFilterFromUrl ?? "all";
          const matchesUrlFilters = (invoice: InvoiceRecord) =>
            matchesStatusFilter(invoice, urlStatusFilter) && matchesClientWorkflowFilter(invoice, urlClientWorkflowFilter, workflowByInvoiceId);
          const firstMatchingFilters = rows.find(matchesUrlFilters);
          const hasActiveUrlFilter = urlStatusFilter !== "all" || urlClientWorkflowFilter !== "all";
          if (current && rows.some((invoice) => invoice.id === current && matchesUrlFilters(invoice))) return current;
          return firstMatchingFilters?.id ?? (hasActiveUrlFilter ? null : rows[0]?.id ?? null);
        });
      }
    } catch (err: any) {
      setError(err?.message ?? "Chargement des factures impossible.");
      setInvoices([]);
      setClientWorkflowByInvoiceId(new Map());
      setDirtyInvoiceIds(new Set());
    } finally {
      setLoading(false);
    }
  }

  function clearActiveInvoiceParam() {
    if (!invoiceIdFromUrl) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("invoice");
    setSearchParams(nextParams, { replace: true });
  }

  function selectInvoice(invoiceId: string) {
    if (invoiceIdFromUrl && invoiceIdFromUrl !== invoiceId) clearActiveInvoiceParam();
    setSelectedId(invoiceId);
  }

  function selectStatusFilter(nextStatus: InvoiceStatusFilter) {
    setStatusFilter(nextStatus);
    const nextParams = new URLSearchParams(searchParams);
    if (nextStatus === "all") nextParams.delete("status");
    else nextParams.set("status", nextStatus);
    setSearchParams(nextParams, { replace: true });
  }

  function selectClientWorkflowFilter(nextFilter: ClientWorkflowFilter) {
    setClientWorkflowFilter(nextFilter);
    const nextParams = new URLSearchParams(searchParams);
    if (nextFilter === "all") nextParams.delete("clientWorkflow");
    else nextParams.set("clientWorkflow", nextFilter);
    setSearchParams(nextParams, { replace: true });
  }

  function selectElectronicInvoicingFilter(nextFilter: ElectronicInvoicingFilter) {
    setElectronicInvoicingFilter(nextFilter);
    if (nextFilter !== "facturx_incomplete") return;
    const firstIncompleteInvoice = invoices.find((invoice) => {
      const text = query.trim().toLowerCase();
      const matchesText = !text || [
        invoice.document.number,
        invoice.document.recipient.displayName,
        invoice.document.siteAddress,
        invoice.document.title,
      ].some((value) => String(value ?? "").toLowerCase().includes(text));
      return matchesText
        && matchesStatusFilter(invoice, statusFilter)
        && matchesClientWorkflowFilter(invoice, clientWorkflowFilter, clientWorkflowByInvoiceId)
        && matchesElectronicInvoicingFilter(invoice, nextFilter)
        && (typeFilter === "all" || invoice.type === typeFilter);
    });
    if (firstIncompleteInvoice) selectInvoice(firstIncompleteInvoice.id);
  }

  function update(invoice: InvoiceRecord) {
    setInvoices((current) => current.map((row) => row.id === invoice.id ? invoice : row));
    markInvoiceDirty(invoice.id, true);
  }

  function markInvoiceDirty(invoiceId: string, dirty: boolean) {
    setDirtyInvoiceIds((current) => {
      const next = new Set(current);
      if (dirty) next.add(invoiceId);
      else next.delete(invoiceId);
      return next;
    });
  }

  async function save(invoice: InvoiceRecord) {
    const saved = await saveInvoice(invoice);
    setInvoices((current) => current.map((row) => row.id === saved.id ? saved : row));
    setSelectedId(saved.id);
    markInvoiceDirty(saved.id, false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestion"
        title="Factures"
        description="Suivi des factures générées depuis les devis : acompte, situation, finale et avoir."
        actions={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => void refresh(false)}><RefreshCw className="h-4 w-4" /> Rafraîchir</Button><Link to="/projets?facturation=1" className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-medium text-white shadow-sm shadow-blue-600/15 transition hover:bg-blue-700"><ArrowRight className="h-4 w-4" /> Choisir un projet à facturer</Link></div>}
      />

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Chargement des factures...</div> : null}

      {!loading ? <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Factures" value={invoices.length} hint="Documents de facturation" />
        <StatCard label="Brouillons" value={stats.drafts} hint="À finaliser" />
        <StatCard label="Factur-X prévalidées" value={stats.facturXReady} hint="Validation externe requise" />
        <StatCard label="Exports Factur-X" value={stats.facturXExported} hint="PDF générés" />
        <StatCard label="Factur-X à corriger" value={stats.facturXIncomplete} hint="Avant export" />
        <StatCard label="Encaissé" value={formatCurrency(stats.paid)} hint={`${stats.overdue} en retard`} />
      </section> : null}

      {!loading && invoiceIdFromUrl ? (
        <div className={[
          "rounded-2xl border p-4 text-sm",
          targetedInvoiceMissing ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900",
        ].join(" ")}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">
                {targetedInvoiceMissing ? "Facture introuvable" : "Facture ouverte depuis la recherche globale"}
              </div>
              <p className={targetedInvoiceMissing ? "mt-1 text-amber-800" : "mt-1 text-blue-800"}>
                {targetedInvoiceMissing
                  ? "Le lien pointe vers une facture supprimée ou non accessible avec les droits actuels."
                  : `${targetedInvoice?.document.number ?? "La facture"} est sélectionnée et prête à être contrôlée, relancée ou encaissée.`}
              </p>
            </div>
            <button
              type="button"
              onClick={clearActiveInvoiceParam}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              Retirer le ciblage
            </button>
          </div>
        </div>
      ) : null}

      {!loading && clientWorkflowFilter !== "all" ? (
        <div className={[
          "rounded-2xl border p-4 text-sm",
          clientWorkflowLoadFailed ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900",
        ].join(" ")}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">{activeClientWorkflowFilterLabel}</div>
              <p className={clientWorkflowLoadFailed ? "mt-1 text-amber-800" : "mt-1 text-blue-800"}>
                {clientWorkflowLoadFailed
                  ? "Le suivi des documents client n'a pas pu être chargé. Rafraîchissez la page pour relancer la lecture."
                  : "Liste limitée aux factures dont le document client attend une validation, une signature, une relance ou une réponse."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => selectClientWorkflowFilter("all")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              Afficher toutes les factures
            </button>
          </div>
        </div>
      ) : null}

      {!loading && electronicInvoicingFilter === "facturx_incomplete" ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">Factures Factur-X à corriger</div>
              <p className="mt-1 text-red-800">
                {firstFacturXIncompleteInvoice
                  ? `Prochain blocage : ${getFacturXBlockingIssue(firstFacturXIncompleteInvoice) ?? "contrôle Factur-X incomplet"}.`
                  : "Aucune facture à corriger avec les filtres actifs."}
              </p>
            </div>
            <button
              type="button"
              disabled={!firstFacturXIncompleteInvoice}
              onClick={() => firstFacturXIncompleteInvoice && selectInvoice(firstFacturXIncompleteInvoice.id)}
              className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ouvrir la première à corriger
            </button>
          </div>
        </div>
      ) : null}

      {!loading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            La création d'une facture part du devis afin de conserver le client, le projet, les lignes, les montants et le lien commercial. Depuis un projet commercial, ouvrez l'onglet Devis puis choisissez Acompte, Situation ou Finale. Cette page sert au suivi, aux paiements et aux relances des factures déjà générées.
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_190px_220px_220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-300" placeholder="Rechercher numéro, client, chantier..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <select className={selectClass} value={statusFilter} onChange={(event) => selectStatusFilter(event.target.value as InvoiceStatusFilter)}>
              {INVOICE_STATUS_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className={selectClass} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">Tous types</option>
              <option value="deposit">Acompte</option>
              <option value="intermediate">Intermédiaire</option>
              <option value="final">Finale</option>
              <option value="credit_note">Avoir</option>
            </select>
            <select className={selectClass} value={clientWorkflowFilter} onChange={(event) => selectClientWorkflowFilter(event.target.value as ClientWorkflowFilter)}>
              {CLIENT_WORKFLOW_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className={selectClass} value={electronicInvoicingFilter} onChange={(event) => selectElectronicInvoicingFilter(event.target.value as ElectronicInvoicingFilter)}>
              {ELECTRONIC_INVOICING_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </section>
      ) : null}

      {!loading ? <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><FileCheck2 className="h-4 w-4 text-blue-600" /> Liste factures</div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{filteredInvoices.length}</span>
          </div>
          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1 xl:max-h-[calc(100vh-220px)]">
            {filteredInvoices.map((invoice) => {
              const totals = invoice.document.totals ?? calculateDocumentTotals(invoice.document);
              const hasUnsavedChanges = dirtyInvoiceIds.has(invoice.id);
              const clientWorkflowStatus = clientWorkflowByInvoiceId.get(invoice.id);
              const electronicInvoicing = normalizeInvoiceElectronicInvoicing(invoice.document.electronicInvoicing, invoice.document);
              const electronicReadiness = getInvoiceElectronicInvoicingReadiness(electronicInvoicing);
              const facturXReadiness = getFacturXExportReadiness(invoice.document);
              const firstFacturXIssue = getFacturXBlockingIssue(invoice);
              return (
                <button key={invoice.id} type="button" onClick={() => selectInvoice(invoice.id)} className={`w-full rounded-2xl border px-3 py-2.5 text-left transition ${selectedId === invoice.id ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-950">{invoice.document.number}</div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">{invoice.document.recipient.displayName || "Client à définir"}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold text-slate-900">{formatCurrency(totals.totalTtc)}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{invoiceTypeLabel(invoice.type)}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <InvoiceStatusBadge status={invoice.status} />
                    <ElectronicInvoicingStatusBadge readiness={electronicReadiness} status={electronicInvoicing.transmissionStatus} />
                    <FacturXStatusBadge canExport={facturXReadiness.canExport} />
                    <FacturXExportStatusBadge metadata={electronicInvoicing} />
                    {clientWorkflowStatus ? <ClientWorkflowStatusBadge status={clientWorkflowStatus} /> : null}
                    {hasUnsavedChanges ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Non enregistré</span> : null}
                  </div>
                  {firstFacturXIssue ? <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">Premier blocage : {firstFacturXIssue}</div> : null}
                  {!firstFacturXIssue && electronicInvoicing.lastFacturXExportAt ? <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">Dernier export : {formatDateTime(electronicInvoicing.lastFacturXExportAt)}</div> : null}
                </button>
              );
            })}
            {!filteredInvoices.length ? <EmptyState title="Aucune facture" description={emptyStateDescription(clientWorkflowFilter, clientWorkflowLoadFailed, electronicInvoicingFilter)} /> : null}
          </div>
        </aside>

        {selected ? <InvoiceEditor invoice={selected} hasUnsavedChanges={dirtyInvoiceIds.has(selected.id)} clientWorkflowStatus={clientWorkflowByInvoiceId.get(selected.id) ?? null} onUnsavedChange={markInvoiceDirty} onChange={update} onSave={save} /> : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Sélectionnez une facture existante ou choisissez un projet commercial pour facturer un devis.
          </div>
        )}
      </section> : null}
    </div>
  );
}

async function listActionableClientWorkflowByInvoiceId() {
  const { data, error } = await supabase
    .from("document_client_workflows" as any)
    .select("source_id,status")
    .eq("source_kind", "invoice")
    .is("revoked_at", null)
    .in("status", ACTIONABLE_CLIENT_WORKFLOW_STATUSES)
    .order("created_at", { ascending: false })
    .overrideTypes<Array<{ source_id: string | null; status: string | null }>>();

  if (error) throw new Error(error.message);

  return (data ?? []).reduce((acc, row) => {
    const status = normalizeClientWorkflowStatus(row.status);
    if (row.source_id && status && !acc.has(row.source_id)) acc.set(row.source_id, status);
    return acc;
  }, new Map<string, ClientWorkflowStatus>());
}

function normalizeClientWorkflowStatus(status: string | null): ClientWorkflowStatus | null {
  return ACTIONABLE_CLIENT_WORKFLOW_STATUSES.includes(status as ClientWorkflowStatus) ? (status as ClientWorkflowStatus) : null;
}

function ClientWorkflowStatusBadge({ status }: { status: ClientWorkflowStatus }) {
  const meta = CLIENT_WORKFLOW_STATUS_META[status];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span>;
}

function ElectronicInvoicingStatusBadge({ readiness, status }: { readiness: ReturnType<typeof getInvoiceElectronicInvoicingReadiness>; status: ElectronicInvoicingTransmissionStatus }) {
  if (!readiness.canMarkReady) {
    return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">À compléter e-fact.</span>;
  }
  if (status === "ready") {
    return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Prête PDP</span>;
  }
  if (status === "pending_pdp") {
    return <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">En attente PDP</span>;
  }
  if (status === "transmitted") {
    return <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">Transmise PDP</span>;
  }
  if (status === "rejected") {
    return <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">Rejetée PDP</span>;
  }
  return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Données OK</span>;
}

function FacturXStatusBadge({ canExport }: { canExport: boolean }) {
  return canExport
    ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Factur-X prévalidée</span>
    : <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">Factur-X à corriger</span>;
}

function FacturXExportStatusBadge({ metadata }: { metadata: ElectronicInvoicingMetadata }) {
  return metadata.lastFacturXExportAt
    ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Export généré</span>
    : null;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
      <div className="text-sm font-semibold text-slate-950">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{description}</div>
    </div>
  );
}

function emptyStateDescription(clientWorkflowFilter: ClientWorkflowFilter, clientWorkflowLoadFailed: boolean, electronicInvoicingFilter: ElectronicInvoicingFilter) {
  if (electronicInvoicingFilter === "facturx_incomplete") {
    return "Aucune facture n'est à corriger pour l'export Factur-X avec les filtres actifs.";
  }
  if (electronicInvoicingFilter === "facturx_ready") {
    return "Aucune facture n'est prévalidée Factur-X avec les filtres actifs.";
  }
  if (clientWorkflowFilter === "actionable" && clientWorkflowLoadFailed) {
    return "Le suivi des documents client n'a pas pu être chargé. Rafraîchissez la page pour réessayer.";
  }
  if (clientWorkflowFilter === "actionable") {
    return "Aucune facture n'a de document client en attente de validation, signature, relance ou réponse.";
  }
  return "Aucune facture ne correspond aux filtres actifs.";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function formatDateTime(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

const selectClass = "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300";