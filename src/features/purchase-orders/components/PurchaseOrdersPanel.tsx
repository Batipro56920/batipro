import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Search, ShoppingCart } from "lucide-react";
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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const totals = useMemo(() => buildTotals(orders), [orders]);

  const filteredOrders = useMemo(() => {
    const text = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesText = !text || [
        order.document.number,
        order.supplierName,
        order.document.recipient.displayName,
        order.deliveryAddress,
        order.supplierReference,
      ].some((value) => String(value ?? "").toLowerCase().includes(text));
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesSupplier = supplierFilter === "all" || order.supplierId === supplierFilter;
      return matchesText && matchesStatus && matchesSupplier;
    });
  }, [orders, query, statusFilter, supplierFilter]);

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
            <p className="mt-1 text-sm text-slate-500">Commandes liées aux fournisseurs, projets, chantiers et à la rentabilité.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void refresh()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Rafraîchir</button>
            <button type="button" onClick={() => void createOrder()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Nouveau bon de commande
            </button>
          </div>
        </div>
        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {loading ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Chargement des bons de commande...</div> : null}
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Metric label="Commandes" value={`${orders.length}`} />
          <Metric label="Achats HT" value={formatCurrency(totals.ht)} />
          <Metric label="Achats TTC" value={formatCurrency(totals.ttc)} />
        </div>
      </div>

      {!loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={inputClassWithIcon} placeholder="Rechercher commande, fournisseur, référence..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <select className={selectClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Tous statuts</option>
              <option value="draft">Brouillon</option>
              <option value="sent">Envoyé</option>
              <option value="confirmed">Confirmé</option>
              <option value="partially_delivered">Livré partiellement</option>
              <option value="delivered">Livré</option>
              <option value="cancelled">Annulé</option>
            </select>
            <select className={selectClass} value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}>
              <option value="all">Tous fournisseurs</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </div>
        </div>
      ) : null}

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
            {filteredOrders.length ? filteredOrders.map((order) => {
              const orderTotals = order.document.totals ?? calculateDocumentTotals(order.document);
              return (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-950">{order.document.number}</td>
                  <td className="px-4 py-3 text-slate-600">{order.supplierName || order.document.recipient.displayName || "-"}</td>
                  <td className="px-4 py-3 text-slate-500">{order.projectId || "-"}</td>
                  <td className="px-4 py-3 text-slate-500">{order.chantierId || "-"}</td>
                  <td className="px-4 py-3 text-slate-500">{order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate) : "-"}</td>
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
                <td colSpan={8} className="px-4 py-12">
                  <div className="mx-auto max-w-sm text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><ShoppingCart className="h-5 w-5" /></div>
                    <div className="mt-3 font-semibold text-slate-950">Aucun bon de commande</div>
                    <div className="mt-1 text-sm text-slate-500">Créez une commande fournisseur ou ajustez vos filtres.</div>
                    <button type="button" onClick={() => void createOrder()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Nouveau bon de commande</button>
                  </div>
                </td>
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}

const selectClass = "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300";
const inputClassWithIcon = "h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-300";
