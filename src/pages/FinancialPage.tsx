import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Banknote, FileSpreadsheet, Landmark, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { calculateDocumentTotals, type BusinessDocument } from "../features/document-engine";
import { getPaidAmount, getRemainingAmount } from "../features/invoices/application/invoicePayments";
import type { InvoiceRecord } from "../features/invoices/domain/types";
import { listInvoices } from "../features/invoices/infrastructure/invoiceRepository";
import type { PurchaseOrderRecord, PurchaseOrderStatus } from "../features/purchase-orders";
import { listPurchaseOrders } from "../features/purchase-orders";

type FinancialSection = "encaissements" | "decaissements" | "tva" | "tresorerie" | "export";

type FinancialSummary = {
  invoicedTtc: number;
  paidTtc: number;
  remainingToCollectTtc: number;
  purchasesTtc: number;
  purchasesHt: number;
  vatCollected: number;
  vatDeductible: number;
  vatBalance: number;
  cashForecast: number;
};

const SECTION_CONFIG: Record<FinancialSection, {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Banknote;
}> = {
  encaissements: {
    eyebrow: "Financier",
    title: "Encaissements",
    description: "Suivi des factures émises, des règlements reçus et du reste à encaisser.",
    icon: Banknote,
  },
  decaissements: {
    eyebrow: "Financier",
    title: "Décaissements",
    description: "Suivi des bons de commande et des dépenses fournisseurs engagées.",
    icon: Wallet,
  },
  tva: {
    eyebrow: "Financier",
    title: "TVA",
    description: "Estimation de la TVA collectée, déductible et du solde à surveiller.",
    icon: Landmark,
  },
  tresorerie: {
    eyebrow: "Financier",
    title: "Trésorerie",
    description: "Lecture rapide du cash encaissé, des sorties engagées et du solde prévisionnel.",
    icon: TrendingUp,
  },
  export: {
    eyebrow: "Financier",
    title: "Export comptable",
    description: "Préparation des données à transmettre au comptable depuis les factures et achats.",
    icon: FileSpreadsheet,
  },
};

export default function FinancialPage() {
  const location = useLocation();
  const section = getSection(location.pathname);
  const config = SECTION_CONFIG[section];
  const Icon = config.icon;
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [invoiceRows, purchaseRows] = await Promise.all([
        listInvoices(),
        listPurchaseOrders(),
      ]);
      setInvoices(invoiceRows);
      setPurchaseOrders(purchaseRows);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les données financières.");
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

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">{config.eyebrow}</div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{config.title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">{config.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" /> Rafraîchir
        </button>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Chargement du financier...</div> : null}

      {!loading ? (
        <>
          <FinancialTabs active={section} />
          {section === "encaissements" ? <EncaissementsView invoices={invoices} summary={summary} /> : null}
          {section === "decaissements" ? <DecaissementsView purchaseOrders={purchaseOrders} summary={summary} /> : null}
          {section === "tva" ? <TvaView invoices={invoices} purchaseOrders={purchaseOrders} summary={summary} /> : null}
          {section === "tresorerie" ? <TresorerieView summary={summary} /> : null}
          {section === "export" ? <ExportView invoices={invoices} purchaseOrders={purchaseOrders} summary={summary} /> : null}
        </>
      ) : null}
    </div>
  );
}

function FinancialTabs({ active }: { active: FinancialSection }) {
  const items: Array<[FinancialSection, string, string]> = [
    ["encaissements", "Encaissements", "/financier/encaissements"],
    ["decaissements", "Décaissements", "/financier/decaissements"],
    ["tva", "TVA", "/financier/tva"],
    ["tresorerie", "Trésorerie", "/financier/tresorerie"],
    ["export", "Export comptable", "/financier/export-comptable"],
  ];

  return (
    <nav className="flex w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Navigation financier">
      {items.map(([id, label, to]) => (
        <Link
          key={id}
          to={to}
          className={[
            "whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition",
            active === id ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
          ].join(" ")}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function EncaissementsView({ invoices, summary }: { invoices: InvoiceRecord[]; summary: FinancialSummary }) {
  const openInvoices = useMemo(() => invoices.filter(isOpenInvoice), [invoices]);
  const collectableInvoices = useMemo(() => invoices.filter(isCollectableInvoice), [invoices]);
  const overdueInvoices = useMemo(() => collectableInvoices.filter(isInvoiceOverdue), [collectableInvoices]);
  const priorityInvoices = useMemo(
    () => [...collectableInvoices].sort(compareInvoicePriority).slice(0, 5),
    [collectableInvoices],
  );

  return (
    <div className="space-y-5">
      <MetricGrid
        metrics={[
          ["Facturé TTC", formatCurrency(summary.invoicedTtc), "Factures émises"],
          ["Encaissé TTC", formatCurrency(summary.paidTtc), "Règlements enregistrés"],
          ["Reste à encaisser", formatCurrency(summary.remainingToCollectTtc), "À relancer ou solder"],
          ["Échéances dépassées", String(overdueInvoices.length), `${openInvoices.length} facture(s) ouverte(s)`],
        ]}
      />
      <InvoicePriorityPanel invoices={priorityInvoices} collectableCount={collectableInvoices.length} />
      <DataPanel title="Factures et règlements" description="Lecture rapide des encaissements par facture.">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <Th>Facture</Th>
              <Th>Client</Th>
              <Th>Statut</Th>
              <Th align="right">TTC</Th>
              <Th align="right">Encaissé</Th>
              <Th align="right">Reste</Th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const totals = invoice.document.totals ?? calculateDocumentTotals(invoice.document);
              return (
                <tr key={invoice.id} className="border-t border-slate-100">
                  <Td>
                    <Link to={invoiceHref(invoice.id)} className="font-semibold text-blue-700 hover:text-blue-800">
                      {invoice.document.number || "Facture sans numéro"}
                    </Link>
                  </Td>
                  <Td>{invoice.document.recipient.displayName || "Client à définir"}</Td>
                  <Td>{invoiceStatusLabel(invoice.status)}</Td>
                  <Td align="right">{formatCurrency(totals.totalTtc)}</Td>
                  <Td align="right">{formatCurrency(getPaidAmount(invoice))}</Td>
                  <Td align="right">{formatCurrency(getRemainingAmount(invoice))}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataPanel>
    </div>
  );
}

function InvoicePriorityPanel({ invoices, collectableCount }: { invoices: InvoiceRecord[]; collectableCount: number }) {
  return (
    <DataPanel title="Factures à relancer" description="Priorité aux factures émises non soldées, avec échéance dépassée ou proche.">
      {invoices.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {invoices.map((invoice) => {
            const totals = invoice.document.totals ?? calculateDocumentTotals(invoice.document);
            const dueStatus = getInvoiceDueStatus(invoice);
            return (
              <Link
                key={invoice.id}
                to={invoiceHref(invoice.id)}
                className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-blue-700">{invoice.document.number || "Facture sans numéro"}</div>
                    <div className="mt-1 truncate text-sm text-slate-600">
                      {invoice.document.recipient.displayName || "Client à définir"}
                    </div>
                  </div>
                  <div className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${dueStatus.className}`}>{dueStatus.label}</div>
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                  <PlainKpi label="Échéance" value={formatDate(invoice.document.dueDate ?? null)} />
                  <PlainKpi label="Reste" value={formatCurrency(getRemainingAmount(invoice))} />
                  <PlainKpi label="TTC" value={formatCurrency(totals.totalTtc)} />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Aucune facture émise à relancer. Les factures sont soldées, annulées, en brouillon ou inexistantes.
        </div>
      )}
      {collectableCount > invoices.length ? (
        <p className="mt-3 text-xs text-slate-500">{collectableCount - invoices.length} autre(s) facture(s) émise(s) non soldée(s) restent visibles dans le tableau complet.</p>
      ) : null}
    </DataPanel>
  );
}

function DecaissementsView({ purchaseOrders, summary }: { purchaseOrders: PurchaseOrderRecord[]; summary: FinancialSummary }) {
  const openOrders = useMemo(() => purchaseOrders.filter(isOpenPurchaseOrder), [purchaseOrders]);
  const overdueOrders = useMemo(() => openOrders.filter(isPurchaseOrderOverdue), [openOrders]);
  const priorityOrders = useMemo(
    () => [...openOrders].sort(comparePurchaseOrderPriority).slice(0, 5),
    [openOrders],
  );

  return (
    <div className="space-y-5">
      <MetricGrid
        metrics={[
          ["Commandes TTC", formatCurrency(summary.purchasesTtc), "Engagement fournisseurs"],
          ["Commandes HT", formatCurrency(summary.purchasesHt), "Base achats"],
          ["Commandes ouvertes", String(openOrders.length), "À livrer ou confirmer"],
          ["Livraisons en retard", String(overdueOrders.length), "Date prévue dépassée"],
        ]}
      />
      <PurchaseOrderPriorityPanel orders={priorityOrders} openCount={openOrders.length} />
      <DataPanel title="Décaissements fournisseurs" description="Bons de commande à suivre avant réception et paiement.">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <Th>Bon de commande</Th>
              <Th>Fournisseur</Th>
              <Th>Statut</Th>
              <Th>Livraison prévue</Th>
              <Th align="right">Montant TTC</Th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.map((order) => {
              const totals = order.document.totals ?? calculateDocumentTotals(order.document);
              return (
                <tr key={order.id} className="border-t border-slate-100">
                  <Td>
                    <Link to={purchaseOrderHref(order.id)} className="font-semibold text-blue-700 hover:text-blue-800">
                      {order.document.number || "Commande sans numéro"}
                    </Link>
                  </Td>
                  <Td>{order.supplierName || order.document.recipient.displayName || "Fournisseur à définir"}</Td>
                  <Td>{purchaseOrderStatusLabel(order.status)}</Td>
                  <Td>{formatDate(order.expectedDeliveryDate)}</Td>
                  <Td align="right">{formatCurrency(totals.totalTtc)}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataPanel>
    </div>
  );
}

function PurchaseOrderPriorityPanel({ orders, openCount }: { orders: PurchaseOrderRecord[]; openCount: number }) {
  return (
    <DataPanel title="Commandes à traiter" description="Priorité aux bons ouverts dont la livraison est en retard, proche ou non planifiée.">
      {orders.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {orders.map((order) => {
            const totals = order.document.totals ?? calculateDocumentTotals(order.document);
            const deliveryStatus = getDeliveryStatus(order);
            return (
              <Link
                key={order.id}
                to={purchaseOrderHref(order.id)}
                className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-blue-700">{order.document.number || "Commande sans numéro"}</div>
                    <div className="mt-1 truncate text-sm text-slate-600">
                      {order.supplierName || order.document.recipient.displayName || "Fournisseur à définir"}
                    </div>
                  </div>
                  <div className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${deliveryStatus.className}`}>{deliveryStatus.label}</div>
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                  <PlainKpi label="Statut" value={purchaseOrderStatusLabel(order.status)} />
                  <PlainKpi label="Livraison" value={formatDate(order.expectedDeliveryDate)} />
                  <PlainKpi label="TTC" value={formatCurrency(totals.totalTtc)} />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Aucune commande ouverte à traiter. Les bons sont livrés, annulés ou inexistants.
        </div>
      )}
      {openCount > orders.length ? (
        <p className="mt-3 text-xs text-slate-500">{openCount - orders.length} autre(s) commande(s) ouverte(s) restent visibles dans le tableau complet.</p>
      ) : null}
    </DataPanel>
  );
}

function TvaView({ invoices, purchaseOrders, summary }: { invoices: InvoiceRecord[]; purchaseOrders: PurchaseOrderRecord[]; summary: FinancialSummary }) {
  const invoiceBreakdown = buildVatRows(invoices.map((invoice) => invoice.document));
  const purchaseBreakdown = buildVatRows(purchaseOrders.map((order) => order.document));

  return (
    <div className="space-y-5">
      <MetricGrid
        metrics={[
          ["TVA collectée", formatCurrency(summary.vatCollected), "Factures clients"],
          ["TVA déductible", formatCurrency(summary.vatDeductible), "Achats fournisseurs"],
          ["Solde TVA estimé", formatCurrency(summary.vatBalance), "Collectée - déductible"],
          ["Base HT nette", formatCurrency(summary.invoicedTtc - summary.vatCollected - summary.purchasesHt), "Indicateur de marge"],
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <VatPanel title="TVA collectée" rows={invoiceBreakdown} />
        <VatPanel title="TVA déductible" rows={purchaseBreakdown} />
      </div>
    </div>
  );
}

function TresorerieView({ summary }: { summary: FinancialSummary }) {
  return (
    <div className="space-y-5">
      <MetricGrid
        metrics={[
          ["Cash encaissé", formatCurrency(summary.paidTtc), "Règlements reçus"],
          ["Décaissements engagés", formatCurrency(summary.purchasesTtc), "Commandes fournisseurs"],
          ["Solde prévisionnel", formatCurrency(summary.cashForecast), "Encaissé - commandes"],
          ["Reste à encaisser", formatCurrency(summary.remainingToCollectTtc), "Potentiel court terme"],
        ]}
      />
      <DataPanel title="Lecture trésorerie" description="Cette V1 consolide les factures et bons de commande existants. Les vrais comptes bancaires et échéanciers seront à raccorder ensuite.">
        <div className="grid gap-4 md:grid-cols-3">
          <PlainKpi label="Entrées connues" value={formatCurrency(summary.paidTtc)} />
          <PlainKpi label="Sorties engagées" value={formatCurrency(summary.purchasesTtc)} />
          <PlainKpi label="Projection simple" value={formatCurrency(summary.cashForecast)} />
        </div>
      </DataPanel>
    </div>
  );
}

function ExportView({ invoices, purchaseOrders, summary }: { invoices: InvoiceRecord[]; purchaseOrders: PurchaseOrderRecord[]; summary: FinancialSummary }) {
  return (
    <div className="space-y-5">
      <MetricGrid
        metrics={[
          ["Factures exportables", String(invoices.length), "Ventes"],
          ["Achats exportables", String(purchaseOrders.length), "Fournisseurs"],
          ["TVA nette", formatCurrency(summary.vatBalance), "Solde estimé"],
          ["Total mouvements", formatCurrency(summary.invoicedTtc + summary.purchasesTtc), "Volume TTC"],
        ]}
      />
      <DataPanel title="Préparation export comptable" description="Les fichiers d'export seront générés quand le format comptable cible sera validé.">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["Ventes", "Factures clients, avoirs, règlements et statuts."],
            ["Achats", "Bons de commande fournisseurs et montants engagés."],
            ["TVA", "Ventilation collectée et déductible par taux."],
            ["À valider", "Format d'export : FEC, CSV cabinet, Pennylane, Sage ou autre."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="font-semibold text-slate-950">{title}</div>
              <div className="mt-1 text-sm text-slate-500">{text}</div>
            </div>
          ))}
        </div>
      </DataPanel>
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: Array<[string, string, string]> }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map(([label, value, hint]) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
          <div className="mt-1 text-sm text-slate-500">{hint}</div>
        </div>
      ))}
    </section>
  );
}

function DataPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <h2 className="font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="overflow-x-auto p-4">{children}</div>
    </section>
  );
}

function VatPanel({ title, rows }: { title: string; rows: Array<{ rate: number; baseHt: number; vatAmount: number }> }) {
  return (
    <DataPanel title={title} description="Ventilation par taux de TVA.">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <Th>Taux</Th>
            <Th align="right">Base HT</Th>
            <Th align="right">TVA</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rate} className="border-t border-slate-100">
              <Td>{row.rate}%</Td>
              <Td align="right">{formatCurrency(row.baseHt)}</Td>
              <Td align="right">{formatCurrency(row.vatAmount)}</Td>
            </tr>
          ))}
          {!rows.length ? (
            <tr><Td>Aucune ligne de TVA.</Td><Td /><Td /></tr>
          ) : null}
        </tbody>
      </table>
    </DataPanel>
  );
}

function PlainKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) {
  const alignClass = align === "right" ? "text-right" : "text-left";
  return <th className={`px-4 py-3 ${alignClass} font-medium`}>{children}</th>;
}

function Td({ children, align = "left" }: { children?: ReactNode; align?: "left" | "right" }) {
  const alignClass = align === "right" ? "text-right" : "text-left";
  return <td className={`px-4 py-3 ${alignClass} text-slate-700`}>{children}</td>;
}

function buildSummary(invoices: InvoiceRecord[], purchaseOrders: PurchaseOrderRecord[]): FinancialSummary {
  const invoicedTtc = invoices.reduce((sum, invoice) => sum + getInvoiceTotals(invoice).totalTtc, 0);
  const paidTtc = invoices.reduce((sum, invoice) => sum + getPaidAmount(invoice), 0);
  const remainingToCollectTtc = invoices.reduce((sum, invoice) => sum + getRemainingAmount(invoice), 0);
  const purchases = purchaseOrders.map((order) => order.document.totals ?? calculateDocumentTotals(order.document));
  const purchasesTtc = purchases.reduce((sum, total) => sum + total.totalTtc, 0);
  const purchasesHt = purchases.reduce((sum, total) => sum + total.totalHt, 0);
  const vatCollected = invoices.reduce((sum, invoice) => sum + getInvoiceTotals(invoice).totalVat, 0);
  const vatDeductible = purchases.reduce((sum, total) => sum + total.totalVat, 0);

  return {
    invoicedTtc: roundMoney(invoicedTtc),
    paidTtc: roundMoney(paidTtc),
    remainingToCollectTtc: roundMoney(remainingToCollectTtc),
    purchasesTtc: roundMoney(purchasesTtc),
    purchasesHt: roundMoney(purchasesHt),
    vatCollected: roundMoney(vatCollected),
    vatDeductible: roundMoney(vatDeductible),
    vatBalance: roundMoney(vatCollected - vatDeductible),
    cashForecast: roundMoney(paidTtc - purchasesTtc),
  };
}

function getInvoiceTotals(invoice: InvoiceRecord) {
  return invoice.document.totals ?? calculateDocumentTotals(invoice.document);
}

function buildVatRows(documents: BusinessDocument[]) {
  const byRate = new Map<number, { rate: number; baseHt: number; vatAmount: number }>();
  documents.forEach((document) => {
    const totals = document.totals ?? calculateDocumentTotals(document);
    totals.vatBreakdown.forEach((row) => {
      const current = byRate.get(row.rate) ?? { rate: row.rate, baseHt: 0, vatAmount: 0 };
      byRate.set(row.rate, {
        rate: row.rate,
        baseHt: roundMoney(current.baseHt + row.baseHt),
        vatAmount: roundMoney(current.vatAmount + row.vatAmount),
      });
    });
  });
  return Array.from(byRate.values()).sort((left, right) => left.rate - right.rate);
}

function getSection(pathname: string): FinancialSection {
  if (pathname.endsWith("/decaissements")) return "decaissements";
  if (pathname.endsWith("/tva")) return "tva";
  if (pathname.endsWith("/tresorerie")) return "tresorerie";
  if (pathname.endsWith("/export-comptable")) return "export";
  return "encaissements";
}

function invoiceHref(invoiceId: string) {
  const params = new URLSearchParams({ invoice: invoiceId });
  return `/factures?${params.toString()}`;
}

function purchaseOrderHref(orderId: string) {
  const params = new URLSearchParams({ tab: "orders", purchaseOrderId: orderId });
  return `/fournisseurs?${params.toString()}`;
}

function isOpenInvoice(invoice: InvoiceRecord) {
  return !["paid", "cancelled"].includes(invoice.status) && getRemainingAmount(invoice) > 0;
}

function isCollectableInvoice(invoice: InvoiceRecord) {
  return isOpenInvoice(invoice) && invoice.status !== "draft";
}

function compareInvoicePriority(left: InvoiceRecord, right: InvoiceRecord) {
  const leftTime = getInvoiceDueTime(left.document.dueDate ?? null);
  const rightTime = getInvoiceDueTime(right.document.dueDate ?? null);
  if (leftTime === null && rightTime === null) return 0;
  if (leftTime === null) return 1;
  if (rightTime === null) return -1;
  return leftTime - rightTime;
}

function isInvoiceOverdue(invoice: InvoiceRecord) {
  if (!isCollectableInvoice(invoice)) return false;
  const dueTime = getInvoiceDueTime(invoice.document.dueDate ?? null);
  return dueTime !== null && dueTime < getTodayTime();
}

function getInvoiceDueStatus(invoice: InvoiceRecord) {
  const dueTime = getInvoiceDueTime(invoice.document.dueDate ?? null);
  if (dueTime === null) {
    return { label: "Sans échéance", className: "bg-slate-100 text-slate-700" };
  }
  const todayTime = getTodayTime();
  if (dueTime < todayTime) {
    return { label: "En retard", className: "bg-red-50 text-red-700" };
  }
  if (dueTime === todayTime) {
    return { label: "Aujourd'hui", className: "bg-amber-50 text-amber-700" };
  }
  return { label: "À venir", className: "bg-blue-50 text-blue-700" };
}

function getInvoiceDueTime(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day).getTime();
}

function isOpenPurchaseOrder(order: PurchaseOrderRecord) {
  return !["delivered", "cancelled"].includes(order.status);
}

function comparePurchaseOrderPriority(left: PurchaseOrderRecord, right: PurchaseOrderRecord) {
  const leftTime = getDeliveryTime(left.expectedDeliveryDate);
  const rightTime = getDeliveryTime(right.expectedDeliveryDate);
  if (leftTime === null && rightTime === null) return 0;
  if (leftTime === null) return 1;
  if (rightTime === null) return -1;
  return leftTime - rightTime;
}

function isPurchaseOrderOverdue(order: PurchaseOrderRecord) {
  if (!isOpenPurchaseOrder(order)) return false;
  const deliveryTime = getDeliveryTime(order.expectedDeliveryDate);
  return deliveryTime !== null && deliveryTime < getTodayTime();
}

function getDeliveryStatus(order: PurchaseOrderRecord) {
  const deliveryTime = getDeliveryTime(order.expectedDeliveryDate);
  if (deliveryTime === null) {
    return { label: "À planifier", className: "bg-slate-100 text-slate-700" };
  }
  const todayTime = getTodayTime();
  if (deliveryTime < todayTime) {
    return { label: "En retard", className: "bg-red-50 text-red-700" };
  }
  if (deliveryTime === todayTime) {
    return { label: "Aujourd'hui", className: "bg-amber-50 text-amber-700" };
  }
  return { label: "À venir", className: "bg-blue-50 text-blue-700" };
}

function getDeliveryTime(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day).getTime();
}

function getTodayTime() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
}

function invoiceStatusLabel(status: InvoiceRecord["status"]) {
  const labels: Record<InvoiceRecord["status"], string> = {
    draft: "Brouillon",
    sent: "Envoyée",
    partially_paid: "Payée partiellement",
    paid: "Payée",
    overdue: "En retard",
    cancelled: "Annulée",
  };
  return labels[status] ?? status;
}

function purchaseOrderStatusLabel(status: PurchaseOrderStatus) {
  const labels: Record<PurchaseOrderStatus, string> = {
    draft: "Brouillon",
    sent: "Envoyé",
    confirmed: "Confirmé",
    partially_delivered: "Livré partiellement",
    delivered: "Livré",
    cancelled: "Annulé",
  };
  return labels[status] ?? status;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-FR").format(new Date(value));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}