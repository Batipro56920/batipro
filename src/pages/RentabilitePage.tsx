import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, RefreshCw, TrendingUp } from "lucide-react";
import { calculateDocumentTotals } from "../features/document-engine";
import type { InvoiceRecord } from "../features/invoices/domain/types";
import { listInvoices } from "../features/invoices/infrastructure/invoiceRepository";
import type { PurchaseOrderRecord } from "../features/purchase-orders";
import { listPurchaseOrders } from "../features/purchase-orders";
import {
  buildFinancialDocumentMetrics,
  getBreakEvenMonthly,
  getInvoiceSign,
  getOperatingChargeMetrics,
  isCommittedPurchaseOrder,
  isIssuedInvoice,
  isOpenPurchaseOrderStatus,
} from "../features/financial/application/financialMetrics";
import {
  isInFinancialPeriod,
  parseFinancialPeriod,
  type FinancialPeriod,
} from "../features/financial/application/financialPeriod";
import {
  FinancialNavigation,
  FinancialPeriodSelector,
} from "../features/financial/components/FinancialNavigation";
import {
  getCompanySettings,
  type CompanyChargeEntry,
} from "../services/companySettings.service";

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value || 0);
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
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>([]);
  const [charges, setCharges] = useState<CompanyChargeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [invoiceRows, purchaseRows, settings] = await Promise.all([
        listInvoices(),
        listPurchaseOrders(),
        getCompanySettings(),
      ]);
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

  useEffect(() => {
    void refresh();
  }, []);

  const scopedInvoices = useMemo(
    () => invoices.filter((invoice) => isInFinancialPeriod(invoice.document.issueDate, period)),
    [invoices, period],
  );
  const scopedPurchaseOrders = useMemo(
    () => purchaseOrders.filter((order) => isInFinancialPeriod(order.document.issueDate || order.createdAt, period)),
    [period, purchaseOrders],
  );
  const summary = useMemo(
    () => buildSummary(scopedInvoices, scopedPurchaseOrders, charges),
    [charges, scopedInvoices, scopedPurchaseOrders],
  );
  const recentInvoices = scopedInvoices.filter(isIssuedInvoice).slice(0, 6);
  const recentPurchases = scopedPurchaseOrders.filter(isCommittedPurchaseOrder).slice(0, 6);

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
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Pilotage financier</div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Rentabilité</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Marge brute documentée, encaissements et charges d'exploitation actuellement connues.
            </p>
          </div>
        </div>
        <button type="button" onClick={() => void refresh()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Rafraîchir
        </button>
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
            <Metric label="Marge brute documentée" value={formatCurrency(summary.estimatedMarginHt)} detail={`${formatRate(summary.estimatedMarginRate)} sur HT, avant charges d\'exploitation`} tone={summary.estimatedMarginHt < 0 ? "danger" : "success"} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="bt-card rounded-xl bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700"><TrendingUp className="h-5 w-5" /></div>
                <div>
                  <div className="text-sm font-semibold text-slate-950">Lecture documentaire</div>
                  <div className="text-xs text-slate-500">Ventes émises, achats engagés et écart brut.</div>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <FlowBlock label="Ventes émises" value={formatCurrency(summary.invoicedTtc)} detail="Factures hors brouillons, avoirs déduits" />
                <FlowBlock label="Achats engagés" value={formatCurrency(summary.purchasesTtc)} detail="Commandes hors brouillons et annulations" href={purchaseOrdersHref()} />
                <FlowBlock label="Écart documentaire" value={formatCurrency(summary.forecastNetTtc)} detail="Ventes TTC - achats TTC" strong />
              </div>
              <SimpleFinancialChart summary={summary} />
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Position simplifiée sur flux connus : <span className="font-semibold text-slate-950">{formatCurrency(summary.cashPositionTtc)}</span>. Elle ne constitue pas un solde bancaire.
              </div>
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

  if (href) {
    return <Link to={href} className={`${className} block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`}>{content}</Link>;
  }

  return <div className={className}>{content}</div>;
}

function FlowBlock({ label, value, detail, strong = false, href }: { label: string; value: string; detail: string; strong?: boolean; href?: string }) {
  const className = strong ? "rounded-lg border border-blue-200 bg-blue-50 p-4" : "rounded-lg border border-slate-200 bg-slate-50 p-4";
  const content = <><div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div><div className="mt-2 text-lg font-bold text-slate-950">{value}</div><div className="mt-1 text-xs text-slate-500">{detail}</div></>;

  if (href) {
    return <Link to={href} className={`${className} block transition hover:border-blue-200 hover:bg-blue-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`}>{content}</Link>;
  }

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
        <div>
          <div className="text-sm font-semibold text-slate-950">Équilibre documentaire</div>
          <div className="text-xs text-slate-500">Lecture limitée aux factures, encaissements et commandes enregistrés.</div>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${health.className}`}>{health.label}</div>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_100px] sm:items-center">
            <div className="text-xs font-medium text-slate-600">{row.label}</div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${row.className}`} style={{ width: `${chartPercent(row.value, maxValue)}%` }} />
            </div>
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

  if (href) {
    return <Link to={href} className={`${className} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`}>{content}</Link>;
  }

  return <div className={className}>{content}</div>;
}

function DataPanel({ title, empty, children }: { title: string; empty: string | null; children: ReactNode }) {
  return <section className="bt-card rounded-xl bg-white p-4"><div className="mb-3 text-sm font-semibold text-slate-950">{title}</div>{empty ? <div className="text-sm text-slate-500">{empty}</div> : <div className="space-y-2">{children}</div>}</section>;
}

function Row({ title, detail, value, href }: { title?: string | null; detail: string; value: string; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
      <div className="min-w-0">
        {href ? (
          <Link to={href} className="block truncate font-medium text-blue-700 hover:text-blue-800">
            {title || "Sans numéro"}
          </Link>
        ) : (
          <div className="truncate font-medium text-slate-950">{title || "Sans numéro"}</div>
        )}
        <div className="truncate text-xs text-slate-500">{detail}</div>
      </div>
      <div className="shrink-0 font-semibold text-slate-950">{value}</div>
    </div>
  );
}