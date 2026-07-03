import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, RefreshCw, TrendingUp } from "lucide-react";
import { calculateDocumentTotals } from "../features/document-engine";
import { getPaidAmount, getRemainingAmount } from "../features/invoices/application/invoicePayments";
import type { InvoiceRecord } from "../features/invoices/domain/types";
import { listInvoices } from "../features/invoices/infrastructure/invoiceRepository";
import type { PurchaseOrderRecord } from "../features/purchase-orders";
import { listPurchaseOrders } from "../features/purchase-orders";

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

function purchaseOrderHref(orderId: string) {
  const params = new URLSearchParams({ tab: "orders", purchaseOrderId: orderId });
  return `/fournisseurs?${params.toString()}`;
}

function buildSummary(invoices: InvoiceRecord[], purchaseOrders: PurchaseOrderRecord[]): ProfitabilitySummary {
  const invoiceTotals = invoices.map((invoice) => invoice.document.totals ?? calculateDocumentTotals(invoice.document));
  const purchaseTotals = purchaseOrders.map((order) => order.document.totals ?? calculateDocumentTotals(order.document));
  const invoicedHt = invoiceTotals.reduce((sum, total) => sum + Number(total.totalHt ?? 0), 0);
  const invoicedTtc = invoiceTotals.reduce((sum, total) => sum + Number(total.totalTtc ?? 0), 0);
  const paidTtc = invoices.reduce((sum, invoice) => sum + getPaidAmount(invoice), 0);
  const remainingTtc = invoices.reduce((sum, invoice) => sum + getRemainingAmount(invoice), 0);
  const purchasesHt = purchaseTotals.reduce((sum, total) => sum + Number(total.totalHt ?? 0), 0);
  const purchasesTtc = purchaseTotals.reduce((sum, total) => sum + Number(total.totalTtc ?? 0), 0);
  const estimatedMarginHt = invoicedHt - purchasesHt;
  return {
    invoicedHt,
    invoicedTtc,
    paidTtc,
    remainingTtc,
    purchasesHt,
    purchasesTtc,
    estimatedMarginHt,
    estimatedMarginRate: invoicedHt > 0 ? (estimatedMarginHt / invoicedHt) * 100 : 0,
    cashPositionTtc: paidTtc - purchasesTtc,
    forecastNetTtc: invoicedTtc - purchasesTtc,
    openInvoices: invoices.filter((row) => !["paid", "cancelled"].includes(row.status)).length,
    openPurchases: purchaseOrders.filter((row) => !["delivered", "cancelled"].includes(row.status)).length,
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
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [invoiceRows, purchaseRows] = await Promise.all([listInvoices(), listPurchaseOrders()]);
      setInvoices(invoiceRows);
      setPurchaseOrders(purchaseRows);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger la rentabilité.");
      setInvoices([]);
      setPurchaseOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const summary = useMemo(() => buildSummary(invoices, purchaseOrders), [invoices, purchaseOrders]);
  const recentInvoices = invoices.slice(0, 6);
  const recentPurchases = purchaseOrders.slice(0, 6);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-title text-xs font-semibold uppercase tracking-[0.16em]">Pilotage financier</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Rentabilité</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Vue simple : ce qui est facturé, encaissé, dépensé, et la marge estimée.
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Rafraîchir
        </button>
      </header>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="bt-card rounded-xl bg-white p-8 text-center text-sm text-slate-500">Chargement de la rentabilité...</div> : null}

      {!loading ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Facturé" value={formatCurrency(summary.invoicedTtc)} detail="Chiffre d'affaires TTC" />
            <Metric label="Encaissé" value={formatCurrency(summary.paidTtc)} detail="Cash réellement reçu" />
            <Metric label="Reste à encaisser" value={formatCurrency(summary.remainingTtc)} detail={`${summary.openInvoices} facture(s) ouverte(s) · Voir les encaissements`} tone={summary.remainingTtc > 0 ? "warning" : "neutral"} href="/financier/encaissements" />
            <Metric label="Marge estimée" value={formatCurrency(summary.estimatedMarginHt)} detail={`${formatRate(summary.estimatedMarginRate)} sur HT`} tone={summary.estimatedMarginHt < 0 ? "danger" : "success"} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="bt-card rounded-xl bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700"><TrendingUp className="h-5 w-5" /></div>
                <div>
                  <div className="text-sm font-semibold text-slate-950">Lecture financière</div>
                  <div className="text-xs text-slate-500">Entrées, sorties et solde prévisionnel.</div>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <FlowBlock label="Entrées prévues" value={formatCurrency(summary.invoicedTtc)} detail="Factures émises" />
                <FlowBlock label="Sorties engagées" value={formatCurrency(summary.purchasesTtc)} detail="Commandes fournisseurs · Voir les décaissements" href="/financier/decaissements" />
                <FlowBlock label="Net prévisionnel" value={formatCurrency(summary.forecastNetTtc)} detail="Facturé - achats" strong />
              </div>
              <SimpleFinancialChart summary={summary} />
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Position encaissée estimée : <span className="font-semibold text-slate-950">{formatCurrency(summary.cashPositionTtc)}</span> après achats engagés.
              </div>
            </div>

            <aside className="bt-card rounded-xl bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><AlertTriangle className="h-4 w-4 text-amber-500" /> À surveiller</div>
              <div className="mt-4 space-y-3 text-sm">
                <WatchItem label="Factures ouvertes" value={String(summary.openInvoices)} detail={formatCurrency(summary.remainingTtc)} href="/financier/encaissements" />
                <WatchItem label="Achats ouverts" value={String(summary.openPurchases)} detail={formatCurrency(summary.purchasesTtc)} href="/financier/decaissements" />
                <WatchItem label="Marge HT" value={formatRate(summary.estimatedMarginRate)} detail={formatCurrency(summary.estimatedMarginHt)} />
              </div>
            </aside>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <DataPanel title="Dernières factures" empty={!recentInvoices.length ? "Aucune facture." : null}>
              {recentInvoices.map((invoice) => {
                const totals = invoice.document.totals ?? calculateDocumentTotals(invoice.document);
                return <Row key={invoice.id} title={invoice.document.number || "Facture sans numéro"} detail={invoice.document.recipient.displayName || "Client à définir"} value={formatCurrency(totals.totalTtc)} href={invoiceHref(invoice.id)} />;
              })}
            </DataPanel>
            <DataPanel title="Derniers achats" empty={!recentPurchases.length ? "Aucun achat." : null}>
              {recentPurchases.map((order) => {
                const totals = order.document.totals ?? calculateDocumentTotals(order.document);
                return <Row key={order.id} title={order.document.number} detail={order.supplierName || order.document.recipient.displayName || "Fournisseur à définir"} value={formatCurrency(totals.totalTtc)} href={purchaseOrderHref(order.id)} />;
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
          <div className="text-sm font-semibold text-slate-950">Santé de l’entreprise</div>
          <div className="text-xs text-slate-500">Lecture rapide des rentrées, restes à encaisser et achats.</div>
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
