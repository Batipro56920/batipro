import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChartColumnBig, RefreshCw } from "lucide-react";
import { calculateDocumentTotals } from "../features/document-engine";
import type { PurchaseOrderRecord } from "../features/purchase-orders";
import { listPurchaseOrders } from "../features/purchase-orders";

export default function SupplierOutstandingPage() {
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setOrders(await listPurchaseOrders());
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les encours fournisseurs.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const openOrders = useMemo(
    () => orders.filter((order) => !["delivered", "cancelled"].includes(order.status)),
    [orders],
  );
  const stats = useMemo(() => {
    const totals = openOrders.reduce(
      (sum, order) => {
        const documentTotals = order.document.totals ?? calculateDocumentTotals(order.document);
        return {
          ht: sum.ht + documentTotals.totalHt,
          ttc: sum.ttc + documentTotals.totalTtc,
          late: sum.late + (isLate(order.expectedDeliveryDate) ? 1 : 0),
        };
      },
      { ht: 0, ttc: 0, late: 0 },
    );
    return {
      ...totals,
      suppliers: new Set(openOrders.map((order) => order.supplierName).filter(Boolean)).size,
      nextDelivery: openOrders
        .map((order) => order.expectedDeliveryDate)
        .filter(Boolean)
        .sort()[0] ?? null,
    };
  }, [openOrders]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white">
            <ChartColumnBig className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Achats</div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Encours fournisseurs</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Commandes ouvertes, livraisons à venir et engagements fournisseurs restant à piloter.
            </p>
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
      {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Chargement des encours fournisseurs...</div> : null}

      {!loading ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Encours TTC" value={formatCurrency(stats.ttc)} hint="Commandes non clôturées" />
            <Metric label="Encours HT" value={formatCurrency(stats.ht)} hint="Base achats engagée" />
            <Metric label="En retard" value={String(stats.late)} hint="Livraisons dépassées" />
            <Metric label="Prochaine livraison" value={formatDate(stats.nextDelivery)} hint={`${stats.suppliers} fournisseur(s)`} />
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-semibold text-slate-950">Commandes fournisseurs ouvertes</h2>
              <p className="mt-1 text-sm text-slate-500">Vue dirigeant des engagements fournisseurs encore actifs.</p>
            </div>
            <div className="overflow-x-auto p-4">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <Th>Commande</Th>
                    <Th>Fournisseur</Th>
                    <Th>Statut</Th>
                    <Th>Livraison prévue</Th>
                    <Th align="right">HT</Th>
                    <Th align="right">TTC</Th>
                  </tr>
                </thead>
                <tbody>
                  {openOrders.map((order) => {
                    const totals = order.document.totals ?? calculateDocumentTotals(order.document);
                    return (
                      <tr key={order.id} className="border-t border-slate-100">
                        <Td>{order.document.number}</Td>
                        <Td>{order.supplierName || order.document.recipient.displayName || "Fournisseur à définir"}</Td>
                        <Td>{order.status}</Td>
                        <Td>{formatDate(order.expectedDeliveryDate)}</Td>
                        <Td align="right">{formatCurrency(totals.totalHt)}</Td>
                        <Td align="right">{formatCurrency(totals.totalTtc)}</Td>
                      </tr>
                    );
                  })}
                  {!openOrders.length ? (
                    <tr>
                      <Td>Aucune commande fournisseur ouverte.</Td>
                      <Td />
                      <Td />
                      <Td />
                      <Td />
                      <Td />
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{hint}</div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) {
  return <th className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"} font-medium`}>{children}</th>;
}

function Td({ children, align = "left" }: { children?: ReactNode; align?: "left" | "right" }) {
  return <td className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"} text-slate-700`}>{children}</td>;
}

function isLate(value: string | null) {
  if (!value) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(value) < today;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-FR").format(new Date(value));
}
