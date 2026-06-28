import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Boxes, RefreshCw, Search } from "lucide-react";
import { flattenDocumentNodes, type BusinessDocumentNode, type DocumentItemNode } from "../../document-engine";
import { supabase } from "../../../lib/supabaseClient";
import type { SupplierRow } from "../../../services/suppliers.service";
import { listPurchaseOrders } from "../infrastructure/purchaseOrderRepository";
import type { PurchaseOrderRecord, PurchaseOrderStatus } from "../domain/types";

type MaterialDemandRow = {
  id: string;
  chantier_id: string;
  fournisseur_id: string | null;
  order_id: string | null;
  designation: string;
  quantite: number;
  unite: string | null;
  date_besoin: string | null;
  date_livraison: string | null;
  statut: string | null;
  status: string | null;
  titre: string | null;
  created_at: string;
};

type ChantierOption = {
  id: string;
  nom: string;
  client: string | null;
  adresse: string | null;
};

type StockRow = {
  id: string;
  source: "order" | "demand";
  designation: string;
  quantity: number;
  unit: string;
  supplierName: string;
  chantierId: string | null;
  chantierName: string;
  orderId: string | null;
  orderNumber: string | null;
  stockState: string;
  dueDate: string | null;
  updatedAt: string;
};

export function StockTrackingPanel({ suppliers }: { suppliers: SupplierRow[] }) {
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>([]);
  const [demands, setDemands] = useState<MaterialDemandRow[]>([]);
  const [chantiers, setChantiers] = useState<ChantierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [chantierFilter, setChantierFilter] = useState("all");

  const chantierById = useMemo(() => new Map(chantiers.map((chantier) => [chantier.id, chantier])), [chantiers]);
  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers]);
  const orderById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);

  const rows = useMemo(() => {
    const orderRows = orders.flatMap((order) => buildOrderStockRows(order, chantierById));
    const demandRows = demands.map((demand) => buildDemandStockRow(demand, supplierById, chantierById, orderById));
    return [...demandRows, ...orderRows].sort((a, b) => String(b.dueDate ?? b.updatedAt).localeCompare(String(a.dueDate ?? a.updatedAt)));
  }, [chantierById, demands, orderById, orders, supplierById]);

  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesText = !text || [row.designation, row.supplierName, row.chantierName, row.orderNumber, row.stockState]
        .some((value) => String(value ?? "").toLowerCase().includes(text));
      const matchesState = stateFilter === "all" || row.stockState === stateFilter;
      const matchesChantier = chantierFilter === "all" || row.chantierId === chantierFilter;
      return matchesText && matchesState && matchesChantier;
    });
  }, [chantierFilter, query, rows, stateFilter]);

  const stats = useMemo(() => {
    const linkedChantiers = new Set(rows.map((row) => row.chantierId).filter(Boolean));
    return {
      lines: rows.length,
      ordered: rows.filter((row) => ["Commande confirmee", "Livraison partielle"].includes(row.stockState)).length,
      delivered: rows.filter((row) => row.stockState === "Livre").length,
      chantiers: linkedChantiers.size,
    };
  }, [rows]);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [nextOrders, nextDemands] = await Promise.all([listPurchaseOrders(), listMaterialDemands()]);
      const chantierIds = Array.from(new Set([
        ...nextOrders.map((order) => order.chantierId),
        ...nextDemands.map((demand) => demand.chantier_id),
      ].filter((id): id is string => Boolean(id))));
      setOrders(nextOrders);
      setDemands(nextDemands);
      setChantiers(await listChantiersByIds(chantierIds));
    } catch (err: any) {
      setError(err?.message ?? "Chargement du stock impossible.");
      setOrders([]);
      setDemands([]);
      setChantiers([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Approvisionnement chantier</div>
            <h2 className="mt-2 text-xl font-bold text-slate-950">Stock</h2>
            <p className="mt-1 text-sm text-slate-500">Suivi des fournitures issues des demandes terrain et des bons de commande, avec rattachement chantier.</p>
          </div>
          <button type="button" onClick={() => void refresh()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> Rafraichir
          </button>
        </div>
        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {loading ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Chargement du suivi stock...</div> : null}
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Metric label="Lignes suivies" value={`${stats.lines}`} />
          <Metric label="Commandees" value={`${stats.ordered}`} />
          <Metric label="Livrees" value={`${stats.delivered}`} />
          <Metric label="Chantiers lies" value={`${stats.chantiers}`} />
        </div>
      </div>

      {!loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={inputClassWithIcon} placeholder="Rechercher produit, fournisseur, chantier, commande..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <select className={selectClass} value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
              <option value="all">Tous etats</option>
              {STOCK_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
            <select className={selectClass} value={chantierFilter} onChange={(event) => setChantierFilter(event.target.value)}>
              <option value="all">Tous chantiers</option>
              {chantiers.map((chantier) => <option key={chantier.id} value={chantier.id}>{chantier.nom}</option>)}
            </select>
          </div>
        </div>
      ) : null}

      {!loading ? <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Quantite</th>
              <th className="px-4 py-3">Fournisseur</th>
              <th className="px-4 py-3">Chantier</th>
              <th className="px-4 py-3">Bon / demande</th>
              <th className="px-4 py-3">Echeance</th>
              <th className="px-4 py-3">Etat stock</th>
              <th className="px-4 py-3 text-right">Acces</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length ? filteredRows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-950">{row.designation}</td>
                <td className="px-4 py-3 text-slate-600">{formatQuantity(row.quantity)} {row.unit}</td>
                <td className="px-4 py-3 text-slate-600">{row.supplierName}</td>
                <td className="px-4 py-3 text-slate-600">{row.chantierName}</td>
                <td className="px-4 py-3 text-slate-500">{row.orderNumber ?? (row.source === "demand" ? "Demande materiel" : "-")}</td>
                <td className="px-4 py-3 text-slate-500">{row.dueDate ? formatDate(row.dueDate) : "-"}</td>
                <td className="px-4 py-3"><StockStateBadge state={row.stockState} /></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    {row.chantierId ? <Link className="font-semibold text-blue-700 hover:text-blue-800" to={`/chantiers/${row.chantierId}`}>Chantier</Link> : null}
                    {row.orderId ? <Link className="font-semibold text-blue-700 hover:text-blue-800" to="/bons-commande">BC</Link> : null}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="px-4 py-12">
                  <div className="mx-auto max-w-sm text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Boxes className="h-5 w-5" /></div>
                    <div className="mt-3 font-semibold text-slate-950">Aucun stock a suivre</div>
                    <div className="mt-1 text-sm text-slate-500">Ajoutez des lignes dans les bons de commande ou traitez les demandes materiel chantier.</div>
                    <Link to="/bons-commande" className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Ouvrir les bons de commande</Link>
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

async function listMaterialDemands(): Promise<MaterialDemandRow[]> {
  const { data, error } = await supabase
    .from("materiel_demandes" as any)
    .select("id,chantier_id,fournisseur_id,order_id,designation,quantite,unite,date_besoin,date_livraison,statut,status,titre,created_at")
    .order("created_at", { ascending: false })
    .limit(200)
    .overrideTypes<MaterialDemandRow[]>();

  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (String(error.code ?? "") === "42P01" || message.includes("does not exist") || message.includes("schema cache")) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}

async function listChantiersByIds(ids: string[]): Promise<ChantierOption[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("chantiers")
    .select("id,nom,client,adresse")
    .in("id", ids)
    .overrideTypes<ChantierOption[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

function buildOrderStockRows(order: PurchaseOrderRecord, chantierById: Map<string, ChantierOption>): StockRow[] {
  const rows = flattenDocumentNodes(order.document.nodes)
    .filter((row) => isItem(row.node))
    .map((row) => row.node as DocumentItemNode)
    .filter((node) => node.quantity > 0);
  const chantier = order.chantierId ? chantierById.get(order.chantierId) : null;
  return rows.map((node) => ({
    id: `${order.id}-${node.id}`,
    source: "order" as const,
    designation: node.title || "Produit commande",
    quantity: node.quantity,
    unit: node.unit || "u",
    supplierName: order.supplierName || order.document.recipient.displayName || "Fournisseur non renseigne",
    chantierId: order.chantierId,
    chantierName: chantier?.nom ?? order.chantierId ?? "Non affecte",
    orderId: order.id,
    orderNumber: order.document.number,
    stockState: stockStateFromOrderStatus(order.status),
    dueDate: order.expectedDeliveryDate,
    updatedAt: order.updatedAt,
  }));
}

function buildDemandStockRow(
  demand: MaterialDemandRow,
  supplierById: Map<string, SupplierRow>,
  chantierById: Map<string, ChantierOption>,
  orderById: Map<string, PurchaseOrderRecord>,
): StockRow {
  const order = demand.order_id ? orderById.get(demand.order_id) : null;
  const chantier = chantierById.get(demand.chantier_id);
  const supplier = demand.fournisseur_id ? supplierById.get(demand.fournisseur_id) : null;
  return {
    id: `demand-${demand.id}`,
    source: "demand",
    designation: demand.titre || demand.designation || "Demande materiel",
    quantity: Number(demand.quantite) || 0,
    unit: demand.unite || "u",
    supplierName: supplier?.name || order?.supplierName || "Fournisseur a confirmer",
    chantierId: demand.chantier_id,
    chantierName: chantier?.nom ?? demand.chantier_id,
    orderId: demand.order_id,
    orderNumber: order?.document.number ?? null,
    stockState: stockStateFromDemandStatus(demand.statut || demand.status),
    dueDate: demand.date_livraison || demand.date_besoin,
    updatedAt: demand.created_at,
  };
}

function isItem(node: BusinessDocumentNode): node is DocumentItemNode {
  return node.type === "line" || node.type === "composite";
}

function stockStateFromOrderStatus(status: PurchaseOrderStatus) {
  if (status === "delivered") return "Livre";
  if (status === "partially_delivered") return "Livraison partielle";
  if (status === "confirmed") return "Commande confirmee";
  if (status === "sent") return "Commande envoyee";
  if (status === "cancelled") return "Annule";
  return "A commander";
}

function stockStateFromDemandStatus(status: string | null) {
  const value = String(status ?? "").toLowerCase();
  if (["livre", "livree", "delivered"].includes(value)) return "Livre";
  if (["partially_delivered", "livre_partiellement", "partiel"].includes(value)) return "Livraison partielle";
  if (["commande", "commandee", "ordered", "confirmed"].includes(value)) return "Commande confirmee";
  if (["annule", "cancelled"].includes(value)) return "Annule";
  return "A commander";
}

function StockStateBadge({ state }: { state: string }) {
  const classes = state === "Livre"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : state === "Livraison partielle"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : state === "Annule"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-blue-200 bg-blue-50 text-blue-700";
  return <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${classes}`}>{state}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-2 text-xl font-bold text-slate-950">{value}</div>
    </div>
  );
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}

const STOCK_STATES = ["A commander", "Commande envoyee", "Commande confirmee", "Livraison partielle", "Livre", "Annule"];
const selectClass = "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300";
const inputClassWithIcon = "h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-300";
