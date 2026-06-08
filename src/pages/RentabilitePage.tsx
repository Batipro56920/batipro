import { useEffect, useMemo, useState } from "react";
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
            <Metric label="Reste à encaisser" value={formatCurrency(summary.remainingTtc)} detail={`${summary.openInvoices} facture(s) ouverte(s)`} tone={summary.remainingTtc > 0 ? "warning" : "neutral"} />
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
                <FlowBlock label="Sorties engagées" value={formatCurrency(summary.purchasesTtc)} detail="Commandes fournisseurs" />
                <FlowBlock label="Net prévisionnel" value={formatCurrency(summary.forecastNetTtc)} detail="Facturé - achats" strong />
              </div>
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Position encaissée estimée : <span className="font-semibold text-slate-950">{formatCurrency(summary.cashPositionTtc)}</span> après achats engagés.
              </div>
            </div>

            <aside className="bt-card rounded-xl bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><AlertTriangle className="h-4 w-4 text-amber-500" /> À surveiller</div>
              <div className="mt-4 space-y-3 text-sm">
                <WatchItem label="Factures ouvertes" value={String(summary.openInvoices)} detail={formatCurrency(summary.remainingTtc)} />
                <WatchItem label="Achats ouverts" value={String(summary.openPurchases)} detail={formatCurrency(summary.purchasesTtc)} />
                <WatchItem label="Marge HT" value={formatRate(summary.estimatedMarginRate)} detail={formatCurrency(summary.estimatedMarginHt)} />
              </div>
            </aside>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <DataPanel title="Dernières factures" empty={!recentInvoices.length ? "Aucune facture." : null}>
              {recentInvoices.map((invoice) => {
                const totals = invoice.document.totals ?? calculateDocumentTotals(invoice.document);
                return <Row key={invoice.id} title={invoice.document.number} detail={invoice.document.recipient.displayName || "Client à définir"} value={formatCurrency(totals.totalTtc)} />;
              })}
            </DataPanel>
            <DataPanel title="Derniers achats" empty={!recentPurchases.length ? "Aucun achat." : null}>
              {recentPurchases.map((order) => {
                const totals = order.document.totals ?? calculateDocumentTotals(order.document);
                return <Row key={order.id} title={order.document.number} detail={order.supplierName || order.document.recipient.displayName || "Fournisseur à définir"} value={formatCurrency(totals.totalTtc)} />;
              })}
            </DataPanel>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const toneClass = tone === "success" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : tone === "danger" ? "text-red-700" : "text-slate-950";
  return <div className="bt-card rounded-xl bg-white p-4"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div><div className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</div><div className="mt-1 text-xs text-slate-500">{detail}</div></div>;
}

function FlowBlock({ label, value, detail, strong = false }: { label: string; value: string; detail: string; strong?: boolean }) {
  return <div className={strong ? "rounded-lg border border-blue-200 bg-blue-50 p-4" : "rounded-lg border border-slate-200 bg-slate-50 p-4"}><div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div><div className="mt-2 text-lg font-bold text-slate-950">{value}</div><div className="mt-1 text-xs text-slate-500">{detail}</div></div>;
}

function WatchItem({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><div><div className="font-medium text-slate-900">{label}</div><div className="text-xs text-slate-500">{detail}</div></div><div className="text-sm font-bold text-slate-950">{value}</div></div>;
}

function DataPanel({ title, empty, children }: { title: string; empty: string | null; children: React.ReactNode }) {
  return <section className="bt-card rounded-xl bg-white p-4"><div className="mb-3 text-sm font-semibold text-slate-950">{title}</div>{empty ? <div className="text-sm text-slate-500">{empty}</div> : <div className="space-y-2">{children}</div>}</section>;
}

function Row({ title, detail, value }: { title: string; detail: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"><div className="min-w-0"><div className="truncate font-medium text-slate-950">{title}</div><div className="truncate text-xs text-slate-500">{detail}</div></div><div className="shrink-0 font-semibold text-slate-950">{value}</div></div>;
}
