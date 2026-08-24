import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, RefreshCw, TrendingUp } from "lucide-react";
import { calculateDocumentTotals } from "../features/document-engine";
import type { InvoiceRecord } from "../features/invoices/domain/types";
import { listInvoices } from "../features/invoices/infrastructure/invoiceRepository";
import type { PurchaseOrderRecord } from "../features/purchase-orders";
import { listPurchaseOrders } from "../features/purchase-orders";
import {
  buildFinancialDocumentMetrics,
  type FinancialDocumentMetrics,
  getBreakEvenMonthly,
  getInvoiceSign,
  getOperatingChargeMetrics,
  isCommittedPurchaseOrder,
  isIssuedInvoice,
  isOpenPurchaseOrderStatus,
} from "../features/financial/application/financialMetrics";
import {
  getFinancialPeriodDateRange,
  isInFinancialPeriod,
  parseFinancialPeriod,
  type FinancialPeriod,
} from "../features/financial/application/financialPeriod";
import {
  FinancialNavigation,
  FinancialPeriodSelector,
} from "../features/financial/components/FinancialNavigation";
import { useProjectsData } from "../features/projects/hooks/useProjectsData";
import {
  listChantierLaborCostSummaries,
  type ChantierLaborCostSummary,
} from "../services/chantierBudget.service";
import type { ProjectRecord } from "../features/projects/types";
import {
  getCompanySettings,
  type CompanyChargeEntry,
} from "../services/companySettings.service";

type ProjectFinancialRow = {
  key: string;
  project: ProjectRecord | null;
  chantierIds: string[];
  invoiceCount: number;
  purchaseOrderCount: number;
  laborHours: number;
  laborHoursUsingChantierRate: number;
  laborCostHt: number;
  laborUsesDefaultRate: boolean;
  marginAfterLaborHt: number;
  marginAfterLaborRate: number;
  metrics: FinancialDocumentMetrics;
};

type ProfitabilitySummary = {
  invoicedHt: number;
  invoicedTtc: number;
  paidTtc: number;
  remainingTtc: number;
  purchasesHt: number;
  purchasesTtc: number;
  estimatedMarginHt: number;
  estimatedMarginRate: number;
  cashPositionTtc: number;
  forecastNetTtc: number;
  openInvoices: number;
  openPurchases: number;
  operatingChargesMonthly: number;
  operatingChargesAnnual: number;
  breakEvenMonthly: number | null;
};

type FinancialCoverage = {
  totalDocuments: number;
  attachedDocuments: number;
  coverageRate: number;
  unassignedInvoices: number;
  unassignedPurchaseOrders: number;
  unassignedSalesHt: number;
  unassignedPurchasesHt: number;
  riskRows: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value || 0);
}

function formatHours(value: number) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value || 0)} h`;
}

function formatRate(value: number) {
  return `${Math.round(value || 0)}%`;
}

function invoiceHref(invoiceId: string) {
  return `/factures?invoice=${encodeURIComponent(invoiceId)}`;
}

function collectableInvoicesHref() {
  return "/factures?status=a_encaisser";
}

function purchaseOrdersHref() {
  return "/bons-commande?status=open";
}

function purchaseOrderHref(order: PurchaseOrderRecord) {
  const params = new URLSearchParams({ purchaseOrderId: order.id });
  if (isOpenPurchaseOrderStatus(order.status)) {
    params.set("status", "open");
  }
  return `/bons-commande?${params.toString()}`;
}

function buildSummary(
  invoices: InvoiceRecord[],
  purchaseOrders: PurchaseOrderRecord[],
  charges: CompanyChargeEntry[],
): ProfitabilitySummary {
  const metrics = buildFinancialDocumentMetrics(invoices, purchaseOrders);
  const operatingCharges = getOperatingChargeMetrics(charges);

  return {
    invoicedHt: metrics.invoicedHt,
    invoicedTtc: metrics.invoicedTtc,
    paidTtc: metrics.paidTtc,
    remainingTtc: metrics.remainingToCollectTtc,
    purchasesHt: metrics.purchasesHt,
    purchasesTtc: metrics.purchasesTtc,
    estimatedMarginHt: metrics.grossMarginHt,
    estimatedMarginRate: metrics.grossMarginRate,
    cashPositionTtc: metrics.documentPositionTtc,
    forecastNetTtc: metrics.invoicedTtc - metrics.purchasesTtc,
    openInvoices: invoices.filter(isIssuedInvoice).filter(
      (invoice) => invoice.type !== "credit_note" && invoice.status !== "paid",
    ).length,
    openPurchases: purchaseOrders.filter(isCommittedPurchaseOrder).filter(
      (order) => isOpenPurchaseOrderStatus(order.status),
    ).length,
    operatingChargesMonthly: operatingCharges.monthly,
    operatingChargesAnnual: operatingCharges.annual,
    breakEvenMonthly: getBreakEvenMonthly(operatingCharges.monthly, metrics.grossMarginRate),
  };
}

function projectRiskScore(row: ProjectFinancialRow) {
  if (!row.project) return 100;
  let score = 0;
  if (row.metrics.purchasesHt > 0 && row.metrics.invoicedHt <= 0) score += 30;
  if (row.marginAfterLaborHt < 0) score += 20;
  if (row.metrics.remainingToCollectTtc > 0) score += 10;
  return score;
}

function getProjectSignal(row: ProjectFinancialRow) {
  if (!row.project) {
    return { label: "À rattacher", className: "bg-amber-50 text-amber-700" };
  }
  if (row.metrics.purchasesHt > 0 && row.metrics.invoicedHt <= 0) {
    return { label: "Achats sans vente", className: "bg-red-50 text-red-700" };
  }
  if (row.marginAfterLaborHt < 0) {
    return { label: "Marge après MO négative", className: "bg-red-50 text-red-700" };
  }
  if (row.metrics.remainingToCollectTtc > 0) {
    return { label: "À encaisser", className: "bg-amber-50 text-amber-700" };
  }
  return { label: "Documenté", className: "bg-emerald-50 text-emerald-700" };
}

function buildProjectFinancialRows(
  invoices: InvoiceRecord[],
  purchaseOrders: PurchaseOrderRecord[],
  projects: ProjectRecord[],
  laborCosts: Map<string, ChantierLaborCostSummary>,
): ProjectFinancialRow[] {
  const projectByRef = new Map<string, ProjectRecord>();
  const projectByChantierId = new Map<string, ProjectRecord>();

  projects.forEach((project) => {
    [
      project.id,
      project.sourceId,
      project.opportunity?.id,
      project.prospect?.id,
      ...project.quotes.map((quote) => quote.id),
    ].filter((value): value is string => Boolean(value)).forEach((value) => projectByRef.set(value, project));
    project.chantiers.forEach((chantier) => projectByChantierId.set(chantier.id, project));
  });

  const groups = new Map<string, {
    project: ProjectRecord | null;
    invoices: InvoiceRecord[];
    purchaseOrders: PurchaseOrderRecord[];
    chantierIds: Set<string>;
  }>();

  function getGroup(project: ProjectRecord | null) {
    const key = project?.id ?? "unassigned";
    const existing = groups.get(key);
    if (existing) return existing;
    const created = {
      project,
      invoices: [] as InvoiceRecord[],
      purchaseOrders: [] as PurchaseOrderRecord[],
      chantierIds: new Set<string>(),
    };
    groups.set(key, created);
    return created;
  }

  invoices.filter(isIssuedInvoice).forEach((invoice) => {
    const project = (invoice.chantierId ? projectByChantierId.get(invoice.chantierId) : null)
      ?? (invoice.projectId ? projectByRef.get(invoice.projectId) : null)
      ?? (invoice.sourceQuoteId ? projectByRef.get(invoice.sourceQuoteId) : null)
      ?? null;
    const group = getGroup(project);
    group.invoices.push(invoice);
    if (invoice.chantierId) group.chantierIds.add(invoice.chantierId);
  });

  purchaseOrders.filter(isCommittedPurchaseOrder).forEach((order) => {
    const project = (order.chantierId ? projectByChantierId.get(order.chantierId) : null)
      ?? (order.projectId ? projectByRef.get(order.projectId) : null)
      ?? null;
    const group = getGroup(project);
    group.purchaseOrders.push(order);
    if (order.chantierId) group.chantierIds.add(order.chantierId);
  });

  laborCosts.forEach((labor) => {
    if (labor.hours <= 0) return;
    const project = projectByChantierId.get(labor.chantierId) ?? null;
    const group = getGroup(project);
    group.chantierIds.add(labor.chantierId);
  });

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const chantierIds = Array.from(group.chantierIds);
      const laborRows = chantierIds
        .map((chantierId) => laborCosts.get(chantierId))
        .filter((row): row is ChantierLaborCostSummary => Boolean(row));
      const laborHours = laborRows.reduce((sum, row) => sum + row.hours, 0);
      const laborHoursUsingChantierRate = laborRows.reduce((sum, row) => sum + row.hoursUsingChantierRate, 0);
      const laborCostHt = laborRows.reduce((sum, row) => sum + row.laborCostHt, 0);
      const metrics = buildFinancialDocumentMetrics(group.invoices, group.purchaseOrders);
      const marginAfterLaborHt = metrics.grossMarginHt - laborCostHt;
      return {
        key,
        project: group.project,
        chantierIds,
        invoiceCount: group.invoices.length,
        purchaseOrderCount: group.purchaseOrders.length,
        laborHours,
        laborHoursUsingChantierRate,
        laborCostHt,
        laborUsesDefaultRate: laborRows.some((row) => row.usesDefaultRate),
        marginAfterLaborHt,
        marginAfterLaborRate: metrics.invoicedHt > 0 ? (marginAfterLaborHt / metrics.invoicedHt) * 100 : 0,
        metrics,
      };
    })
    .sort((left, right) => {
      const riskDifference = projectRiskScore(right) - projectRiskScore(left);
      if (riskDifference !== 0) return riskDifference;
      return right.metrics.invoicedHt - left.metrics.invoicedHt;
    });
}

function buildFinancialCoverage(rows: ProjectFinancialRow[]): FinancialCoverage {
  const unassigned = rows.find((row) => row.project === null);
  const totalDocuments = rows.reduce((sum, row) => sum + row.invoiceCount + row.purchaseOrderCount, 0);
  const unassignedInvoices = unassigned?.invoiceCount ?? 0;
  const unassignedPurchaseOrders = unassigned?.purchaseOrderCount ?? 0;
  const unassignedDocuments = unassignedInvoices + unassignedPurchaseOrders;
  const attachedDocuments = Math.max(0, totalDocuments - unassignedDocuments);

  return {
    totalDocuments,
    attachedDocuments,
    coverageRate: totalDocuments > 0 ? (attachedDocuments / totalDocuments) * 100 : 100,
    unassignedInvoices,
    unassignedPurchaseOrders,
    unassignedSalesHt: unassigned?.metrics.invoicedHt ?? 0,
    unassignedPurchasesHt: unassigned?.metrics.purchasesHt ?? 0,
    riskRows: rows.filter((row) => row.project && projectRiskScore(row) >= 20).length,
  };
}

function FinancialDataQualityPanel({ coverage }: { coverage: FinancialCoverage }) {
  const complete = coverage.totalDocuments === 0 || coverage.coverageRate === 100;
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="bt-card rounded-xl bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-950">Qualité des données financières</div>
            <div className="mt-1 text-xs text-slate-500">Un dossier fiable commence par des factures et commandes correctement rattachées.</div>
          </div>
          <div className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-1 text-xs font-semibold ${complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {formatRate(coverage.coverageRate)} rattaché
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${complete ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${Math.max(0, Math.min(100, coverage.coverageRate))}%` }} />
        </div>
        <div className="mt-3 text-xs text-slate-500">
          {coverage.attachedDocuments} document(s) rattaché(s) sur {coverage.totalDocuments}. Le taux porte sur le nombre de documents, pas sur leur montant.
        </div>
      </div>
      <aside className="bt-card rounded-xl bg-white p-5">
        <div className="text-sm font-semibold text-slate-950">À corriger en priorité</div>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3"><span className="text-slate-600">Factures non rattachées</span><span className="font-bold text-slate-950">{coverage.unassignedInvoices}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-slate-600">Commandes non rattachées</span><span className="font-bold text-slate-950">{coverage.unassignedPurchaseOrders}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-slate-600">Dossiers à risque</span><span className="font-bold text-slate-950">{coverage.riskRows}</span></div>
        </div>
        {(coverage.unassignedSalesHt !== 0 || coverage.unassignedPurchasesHt !== 0) ? (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Non rattaché : {formatCurrency(coverage.unassignedSalesHt)} de ventes HT et {formatCurrency(coverage.unassignedPurchasesHt)} d'achats HT.
          </div>
        ) : null}
      </aside>
    </section>
  );
}

function ProjectProfitabilityPanel({
  rows,
  loading,
  error,
  laborError,
}: {
  rows: ProjectFinancialRow[];
  loading: boolean;
  error: string | null;
  laborError: string | null;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <h2 className="font-semibold text-slate-950">Marge après main-d'œuvre par dossier</h2>
        <p className="mt-1 text-sm text-slate-500">
          Les dossiers nécessitant une action remontent en premier : rattachement manquant, achats sans vente ou marge après main-d'œuvre négative.
        </p>
      </div>
      {loading ? <div className="p-6 text-sm text-slate-500">Chargement des rattachements projets...</div> : null}
      {!loading && error ? (
        <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Ventilation indisponible : {error}
        </div>
      ) : null}
      {!loading && !error && laborError ? (
        <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Coût de main-d'œuvre indisponible : {laborError}
        </div>
      ) : null}
      {!loading && !error ? (
        <div className="overflow-x-auto p-4">
          <table className="min-w-[1360px] text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Dossier</th>
                <th className="px-4 py-3 text-left font-medium">Signal</th>
                <th className="px-4 py-3 text-left font-medium">Documents</th>
                <th className="px-4 py-3 text-right font-medium">Heures</th>
                <th className="px-4 py-3 text-right font-medium">Ventes HT</th>
                <th className="px-4 py-3 text-right font-medium">Achats HT</th>
                <th className="px-4 py-3 text-right font-medium">MO réelle</th>
                <th className="px-4 py-3 text-right font-medium">Marge après MO</th>
                <th className="px-4 py-3 text-right font-medium">Taux</th>
                <th className="px-4 py-3 text-right font-medium">À encaisser</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const chantier = row.chantierIds.length === 1
                  ? row.project?.chantiers.find((item) => item.id === row.chantierIds[0]) ?? null
                  : null;
                const marginTone = row.marginAfterLaborHt < 0 ? "text-red-700" : "text-emerald-700";
                const signal = getProjectSignal(row);
                return (
                  <tr key={row.key} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      {row.project ? (
                        <>
                          <Link to={`/projets/${row.project.id}`} className="font-semibold text-blue-700 hover:text-blue-800">
                            {row.project.name}
                          </Link>
                          <div className="mt-0.5 text-xs text-slate-500">{row.project.clientName}</div>
                          {chantier ? (
                            <Link to={`/chantiers/${chantier.id}/financier`} className="mt-1 block text-xs font-medium text-slate-600 hover:text-blue-700">
                              Chantier : {chantier.nom}
                            </Link>
                          ) : row.chantierIds.length > 1 ? (
                            <div className="mt-1 text-xs text-slate-500">{row.chantierIds.length} chantiers rattachés</div>
                          ) : (
                            <div className="mt-1 text-xs text-slate-500">Projet commercial</div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="font-semibold text-amber-700">Documents non rattachés</div>
                          <div className="mt-0.5 text-xs text-slate-500">Projet ou chantier à compléter</div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${signal.className}`}>{signal.label}</span></td>
                    <td className="px-4 py-3 text-slate-700">{row.invoiceCount} facture(s) · {row.purchaseOrderCount} commande(s)</td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      <div>{formatHours(row.laborHours)}</div>
                      {row.laborHoursUsingChantierRate > 0 ? (
                        <div className="mt-0.5 text-[11px] text-amber-700">
                          Taux chantier sur {formatHours(row.laborHoursUsingChantierRate)}
                        </div>
                      ) : null}
                      {row.laborUsesDefaultRate ? (
                        <div className="mt-0.5 text-[11px] text-red-700">dont taux par défaut</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(row.metrics.invoicedHt)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(row.metrics.purchasesHt)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(row.laborCostHt)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${marginTone}`}>{formatCurrency(row.marginAfterLaborHt)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${marginTone}`}>{formatRate(row.marginAfterLaborRate)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(row.metrics.remainingToCollectTtc)}</td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">Aucun document financier sur cette période.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        Marge après MO = ventes HT émises - commandes fournisseurs HT engagées - coût des heures saisies. Les heures utilisent le coût horaire de l'intervenant lorsqu'il est renseigné, sinon le taux du chantier. Elle n'inclut pas les frais chantier non saisis ni les paiements fournisseurs.
      </div>
    </section>
  );
}

function chartPercent(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(6, Math.min(100, Math.round((Math.max(0, value) / max) * 100)));
}

function getHealthStatus(summary: ProfitabilitySummary) {
  if (summary.invoicedTtc <= 0 && summary.purchasesTtc <= 0) {
    return { label: "À alimenter", detail: "Aucune donnée financière exploitable pour le moment.", className: "bg-slate-100 text-slate-700" };
  }
  if (summary.cashPositionTtc < 0 || summary.estimatedMarginHt < 0) {
    return { label: "À surveiller", detail: "Les achats engagés pèsent plus que les encaissements ou la marge.", className: "bg-red-50 text-red-700" };
  }
  if (summary.remainingTtc > summary.paidTtc && summary.paidTtc > 0) {
    return { label: "Correct", detail: "La marge existe, mais une partie importante reste à encaisser.", className: "bg-amber-50 text-amber-700" };
  }
  return { label: "Sain", detail: "Les encaissements et la marge restent bien orientés.", className: "bg-emerald-50 text-emerald-700" };
}

export default function RentabilitePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = parseFinancialPeriod(searchParams.get("period"));
  const { projects, loading: projectsLoading, error: projectsError } = useProjectsData();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>([]);
  const [charges, setCharges] = useState<CompanyChargeEntry[]>([]);
  const [laborCosts, setLaborCosts] = useState<Map<string, ChantierLaborCostSummary>>(() => new Map());
  const [laborLoading, setLaborLoading] = useState(false);
  const [laborError, setLaborError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [invoiceRows, purchaseRows, settings] = await Promise.all([listInvoices(), listPurchaseOrders(), getCompanySettings()]);
      setInvoices(invoiceRows);
      setPurchaseOrders(purchaseRows);
      setCharges(settings.charges_exploitation?.entries ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger la rentabilité.");
      setInvoices([]);
      setPurchaseOrders([]);
      setCharges([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    const chantierIds = Array.from(new Set(projects.flatMap((project) => project.chantiers.map((chantier) => chantier.id))));
    if (!chantierIds.length) {
      setLaborCosts(new Map());
      setLaborError(null);
      setLaborLoading(false);
      return;
    }

    let alive = true;
    setLaborLoading(true);
    setLaborError(null);
    listChantierLaborCostSummaries(chantierIds, getFinancialPeriodDateRange(period))
      .then((rows) => {
        if (!alive) return;
        setLaborCosts(new Map(rows.map((row) => [row.chantierId, row])));
      })
      .catch((err: any) => {
        if (!alive) return;
        setLaborCosts(new Map());
        setLaborError(err?.message ?? "Coûts de main-d'œuvre indisponibles.");
      })
      .finally(() => {
        if (!alive) return;
        setLaborLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [period, projects]);

  const scopedInvoices = useMemo(() => invoices.filter((invoice) => isInFinancialPeriod(invoice.document.issueDate, period)), [invoices, period]);
  const scopedPurchaseOrders = useMemo(() => purchaseOrders.filter((order) => isInFinancialPeriod(order.document.issueDate || order.createdAt, period)), [period, purchaseOrders]);
  const summary = useMemo(() => buildSummary(scopedInvoices, scopedPurchaseOrders, charges), [charges, scopedInvoices, scopedPurchaseOrders]);
  const recentInvoices = scopedInvoices.filter(isIssuedInvoice).slice(0, 6);
  const recentPurchases = scopedPurchaseOrders.filter(isCommittedPurchaseOrder).slice(0, 6);
  const projectFinancialRows = useMemo(
    () => buildProjectFinancialRows(scopedInvoices, scopedPurchaseOrders, projects, laborCosts),
    [laborCosts, projects, scopedInvoices, scopedPurchaseOrders],
  );
  const financialCoverage = useMemo(() => buildFinancialCoverage(projectFinancialRows), [projectFinancialRows]);

  function onPeriodChange(nextPeriod: FinancialPeriod) {
    const nextParams = new URLSearchParams(searchParams);
    if (nextPeriod === "all") nextParams.delete("period");
    else nextParams.set("period", nextPeriod);
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white"><TrendingUp className="h-5 w-5" /></div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Pilotage financier</div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Rentabilité</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">Marge brute documentée, encaissements et charges d'exploitation actuellement connues.</p>
          </div>
        </div>
        <button type="button" onClick={() => void refresh()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Rafraîchir</button>
      </header>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="bt-card rounded-xl bg-white p-8 text-center text-sm text-slate-500">Chargement de la rentabilité...</div> : null}

      {!loading ? (
        <>
          <FinancialNavigation />
          <FinancialPeriodSelector value={period} onChange={onPeriodChange} />
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Ventes émises" value={formatCurrency(summary.invoicedTtc)} detail="Hors brouillons et annulations, avoirs déduits" />
            <Metric label="Encaissé" value={formatCurrency(summary.paidTtc)} detail="Cash réellement reçu" />
            <Metric label="Reste à encaisser" value={formatCurrency(summary.remainingTtc)} detail={`${summary.openInvoices} facture(s) ouverte(s) · Voir les factures à encaisser`} tone={summary.remainingTtc > 0 ? "warning" : "neutral"} href={collectableInvoicesHref()} />
            <Metric label="Marge brute documentée" value={formatCurrency(summary.estimatedMarginHt)} detail={`${formatRate(summary.estimatedMarginRate)} sur HT, avant charges d'exploitation`} tone={summary.estimatedMarginHt < 0 ? "danger" : "success"} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="bt-card rounded-xl bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700"><TrendingUp className="h-5 w-5" /></div>
                <div><div className="text-sm font-semibold text-slate-950">Lecture documentaire</div><div className="text-xs text-slate-500">Ventes émises, achats engagés et écart brut.</div></div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <FlowBlock label="Ventes émises" value={formatCurrency(summary.invoicedTtc)} detail="Factures hors brouillons, avoirs déduits" />
                <FlowBlock label="Achats engagés" value={formatCurrency(summary.purchasesTtc)} detail="Commandes hors brouillons et annulations" href={purchaseOrdersHref()} />
                <FlowBlock label="Écart documentaire" value={formatCurrency(summary.forecastNetTtc)} detail="Ventes TTC - achats TTC" strong />
              </div>
              <SimpleFinancialChart summary={summary} />
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">Position simplifiée sur flux connus : <span className="font-semibold text-slate-950">{formatCurrency(summary.cashPositionTtc)}</span>. Elle ne constitue pas un solde bancaire.</div>
            </div>

            <aside className="bt-card rounded-xl bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><AlertTriangle className="h-4 w-4 text-amber-500" /> À surveiller</div>
              <div className="mt-4 space-y-3 text-sm">
                <WatchItem label="Factures ouvertes" value={String(summary.openInvoices)} detail={formatCurrency(summary.remainingTtc)} href={collectableInvoicesHref()} />
                <WatchItem label="Achats ouverts" value={String(summary.openPurchases)} detail={formatCurrency(summary.purchasesTtc)} href={purchaseOrdersHref()} />
                <WatchItem label="Charges mensuelles" value={formatCurrency(summary.operatingChargesMonthly)} detail={`${formatCurrency(summary.operatingChargesAnnual)} / an`} href="/financier/charges-fixes" />
                <WatchItem label="Seuil mensuel estimé" value={summary.breakEvenMonthly === null ? "À définir" : formatCurrency(summary.breakEvenMonthly)} detail="Selon marge brute documentée" href="/financier/charges-fixes" />
              </div>
            </aside>
          </section>

          <FinancialDataQualityPanel coverage={financialCoverage} />

          <ProjectProfitabilityPanel
            rows={projectFinancialRows}
            loading={projectsLoading || laborLoading}
            error={projectsError}
            laborError={laborError}
          />

          <section className="grid gap-4 xl:grid-cols-2">
            <DataPanel title="Dernières factures" empty={!recentInvoices.length ? "Aucune facture." : null}>
              {recentInvoices.map((invoice) => {
                const totals = invoice.document.totals ?? calculateDocumentTotals(invoice.document);
                return <Row key={invoice.id} title={invoice.document.number || "Facture sans numéro"} detail={invoice.document.recipient.displayName || "Client à définir"} value={formatCurrency(getInvoiceSign(invoice) * totals.totalTtc)} href={invoiceHref(invoice.id)} />;
              })}
            </DataPanel>
            <DataPanel title="Derniers achats" empty={!recentPurchases.length ? "Aucun achat." : null}>
              {recentPurchases.map((order) => {
                const totals = order.document.totals ?? calculateDocumentTotals(order.document);
                return <Row key={order.id} title={order.document.number} detail={order.supplierName || order.document.recipient.displayName || "Fournisseur à définir"} value={formatCurrency(totals.totalTtc)} href={purchaseOrderHref(order)} />;
              })}
            </DataPanel>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value, detail, tone = "neutral", href }: { label: string; value: string; detail: string; tone?: "neutral" | "success" | "warning" | "danger"; href?: string }) {
  const toneClass = tone === "success" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : tone === "danger" ? "text-red-700" : "text-slate-950";
  const className = "bt-card rounded-xl bg-white p-4 transition hover:border-blue-200 hover:shadow-sm";
  const content = <><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div><div className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</div><div className="mt-1 text-xs text-slate-500">{detail}</div></>;
  if (href) return <Link to={href} className={`${className} block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`}>{content}</Link>;
  return <div className={className}>{content}</div>;
}

function FlowBlock({ label, value, detail, strong = false, href }: { label: string; value: string; detail: string; strong?: boolean; href?: string }) {
  const className = strong ? "rounded-lg border border-blue-200 bg-blue-50 p-4" : "rounded-lg border border-slate-200 bg-slate-50 p-4";
  const content = <><div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div><div className="mt-2 text-lg font-bold text-slate-950">{value}</div><div className="mt-1 text-xs text-slate-500">{detail}</div></>;
  if (href) return <Link to={href} className={`${className} block transition hover:border-blue-200 hover:bg-blue-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`}>{content}</Link>;
  return <div className={className}>{content}</div>;
}

function SimpleFinancialChart({ summary }: { summary: ProfitabilitySummary }) {
  const health = getHealthStatus(summary);
  const maxValue = Math.max(summary.paidTtc, summary.remainingTtc, summary.purchasesTtc, 1);
  const rows = [
    { label: "Encaissé", value: summary.paidTtc, className: "bg-emerald-500" },
    { label: "À encaisser", value: summary.remainingTtc, className: "bg-amber-400" },
    { label: "Achats engagés", value: summary.purchasesTtc, className: "bg-slate-400" },
  ];
  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="text-sm font-semibold text-slate-950">Équilibre documentaire</div><div className="text-xs text-slate-500">Lecture limitée aux factures, encaissements et commandes enregistrés.</div></div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${health.className}`}>{health.label}</div>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_100px] sm:items-center">
            <div className="text-xs font-medium text-slate-600">{row.label}</div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${row.className}`} style={{ width: `${chartPercent(row.value, maxValue)}%` }} /></div>
            <div className="text-right text-xs font-semibold text-slate-900">{formatCurrency(row.value)}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{health.detail}</div>
    </div>
  );
}

function WatchItem({ label, value, detail, href }: { label: string; value: string; detail: string; href?: string }) {
  const className = "flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-blue-200 hover:bg-blue-50/50";
  const content = <><div><div className="font-medium text-slate-900">{label}</div><div className="text-xs text-slate-500">{detail}</div></div><div className="text-sm font-bold text-slate-950">{value}</div></>;
  if (href) return <Link to={href} className={`${className} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`}>{content}</Link>;
  return <div className={className}>{content}</div>;
}

function DataPanel({ title, empty, children }: { title: string; empty: string | null; children: ReactNode }) {
  return <section className="bt-card rounded-xl bg-white p-4"><div className="mb-3 text-sm font-semibold text-slate-950">{title}</div>{empty ? <div className="text-sm text-slate-500">{empty}</div> : <div className="space-y-2">{children}</div>}</section>;
}

function Row({ title, detail, value, href }: { title?: string | null; detail: string; value: string; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
      <div className="min-w-0">
        {href ? <Link to={href} className="block truncate font-medium text-blue-700 hover:text-blue-800">{title || "Sans numéro"}</Link> : <div className="truncate font-medium text-slate-950">{title || "Sans numéro"}</div>}
        <div className="truncate text-xs text-slate-500">{detail}</div>
      </div>
      <div className="shrink-0 font-semibold text-slate-950">{value}</div>
    </div>
  );
}
