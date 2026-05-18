import { useEffect, useMemo, useState } from "react";
import { calculateDocumentTotals } from "../../document-engine";
import type { SupplierRow } from "../../../services/suppliers.service";
import { createAndSavePurchaseOrder, listPurchaseOrders, savePurchaseOrder } from "../infrastructure/purchaseOrderRepository";
import type { PurchaseOrderRecord } from "../domain/types";
import { PurchaseOrderEditor } from "./PurchaseOrderEditor";
import { PurchaseOrderStatusBadge } from "./PurchaseOrderStatusBadge";

export function PurchaseOrdersPanel({ suppliers }: { suppliers: SupplierRow[] }) {
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const totals = useMemo(() => buildTotals(orders), [orders]);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setOrders(await listPurchaseOrders());
    } catch (err: any) {
      setError(err?.message ?? "Chargement des bons de commande impossible.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function createOrder() {
    const firstSupplier = suppliers[0] ?? null;
    const order = await createAndSavePurchaseOrder({ supplierId: firstSupplier?.id ?? null, supplierName: firstSupplier?.name ?? null });
    setOrders(await listPurchaseOrders());
    setSelectedOrder(order);
  }

  async function save(order: PurchaseOrderRecord) {
    const saved = await savePurchaseOrder(order);
    setOrders(await listPurchaseOrders());
    setSelectedOrder(saved);
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Achats fournisseurs</div>
            <h2 className="mt-2 text-xl font-bold text-slate-950">Bons de commande</h2>
            <p className="mt-1 text-sm text-slate-500">Commandes liees aux fournisseurs, projets, chantiers et a la rentabilite.</p>
          </div>
          <button type="button" onClick={createOrder} className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
            Nouveau bon de commande
          </button>
        </div>
        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {loading ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Chargement des bons de commande...</div> : null}
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Metric label="Commandes" value={`${orders.length}`} />
          <Metric label="Achats HT" value={formatCurrency(totals.ht)} />
          <Metric label="Achats TTC" value={formatCurrency(totals.ttc)} />
        </div>
      </div>

      {selectedOrder ? (
        <PurchaseOrderEditor
          order={selectedOrder}
          suppliers={suppliers}
          onChange={setSelectedOrder}
          onSave={save}
          onClose={() => setSelectedOrder(null)}
        />
      ) : null}

      {!loading ? <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Numero</th>
              <th className="px-4 py-3">Fournisseur</th>
              <th className="px-4 py-3">Projet</th>
              <th className="px-4 py-3">Chantier</th>
              <th className="px-4 py-3">Livraison prevue</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3 text-right">TTC</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.length ? orders.map((order) => {
              const orderTotals = order.document.totals ?? calculateDocumentTotals(order.document);
              return (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-950">{order.document.number}</td>
                  <td className="px-4 py-3 text-slate-600">{order.supplierName || order.document.recipient.displayName || "-"}</td>
                  <td className="px-4 py-3 text-slate-500">{order.projectId || "-"}</td>
                  <td className="px-4 py-3 text-slate-500">{order.chantierId || "-"}</td>
                  <td className="px-4 py-3 text-slate-500">{order.expectedDeliveryDate || "-"}</td>
                  <td className="px-4 py-3"><PurchaseOrderStatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(orderTotals.totalTtc)}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="font-semibold text-blue-700 hover:text-blue-800" onClick={() => setSelectedOrder(order)}>
                      Ouvrir
                    </button>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">Aucun bon de commande fournisseur pour le moment.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div> : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-2 text-xl font-bold text-slate-950">{value}</div>
    </div>
  );
}

function buildTotals(orders: PurchaseOrderRecord[]) {
  return orders.reduce((sum, order) => {
    const totals = order.document.totals ?? calculateDocumentTotals(order.document);
    return { ht: sum.ht + totals.totalHt, ttc: sum.ttc + totals.totalTtc };
  }, { ht: 0, ttc: 0 });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}
