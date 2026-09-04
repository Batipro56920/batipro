import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, RefreshCw, Search, ShoppingCart } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { loadCrmDataset } from "../../../services/crm.service";
import { calculateDocumentTotals } from "../../document-engine";
import { buildProjects } from "../../projects/utils/projectMappers";
import type { SupplierRow } from "../../../services/suppliers.service";
import { createAndSavePurchaseOrder, listPurchaseOrders, savePurchaseOrder } from "../infrastructure/purchaseOrderRepository";
import { getPurchaseOrderDefaultTerms } from "../../../services/companySettings.service";
import type { PurchaseOrderRecord, PurchaseOrderStatus } from "../domain/types";
import { PurchaseOrderEditor } from "./PurchaseOrderEditor";
import { PurchaseOrderStatusBadge } from "./PurchaseOrderStatusBadge";

type PurchaseOrderStatusFilter = "all" | "open" | PurchaseOrderStatus;

type EmptyStateCopy = {
  title: string;
  description: string;
  showCreate: boolean;
  showReset: boolean;
};

type ChantierListOption = {
  id: string;
  nom: string;
  client: string | null;
  adresse: string | null;
};

type ProjectListOption = {
  id: string;
  sourceId: string;
  name: string;
  clientName: string;
  address: string | null;
  projectType: string | null;
};

type CreateOrderOptions = {
  chantierId?: string | null;
  clearNewOrderParam?: boolean;
  projectId?: string | null;
  supplierId?: string | null;
};

const PURCHASE_ORDER_STATUS_FILTERS: PurchaseOrderStatusFilter[] = [
  "all",
  "open",
  "draft",
  "sent",
  "confirmed",
  "partially_delivered",
  "delivered",
  "cancelled",
];
const OPEN_PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = ["draft", "sent", "confirmed", "partially_delivered"];

function isPurchaseOrderStatusFilter(value: string): value is PurchaseOrderStatusFilter {
  return PURCHASE_ORDER_STATUS_FILTERS.includes(value as PurchaseOrderStatusFilter);
}

function matchesStatusFilter(order: PurchaseOrderRecord, filter: PurchaseOrderStatusFilter) {
  if (filter === "all") return true;
  if (filter === "open") return OPEN_PURCHASE_ORDER_STATUSES.includes(order.status);
  return order.status === filter;
}

export function PurchaseOrdersPanel({
  suppliers,
  chantierId: lockedChantierId = "",
}: {
  suppliers: SupplierRow[];
  chantierId?: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPurchaseOrderId = searchParams.get("purchaseOrderId") ?? "";
  const urlSupplierId = searchParams.get("supplierId") ?? "";
  const urlChantierId = lockedChantierId || searchParams.get("chantierId") || "";
  const urlProjectId = searchParams.get("projectId") ?? "";
  const urlNewOrder = searchParams.get("newOrder") === "1";
  const statusQueryParam = searchParams.get("status") ?? "";
  const initialStatusFilter = isPurchaseOrderStatusFilter(statusQueryParam) ? statusQueryParam : "all";
  const openedOrderFromUrlRef = useRef("");
  const openedNewOrderFromUrlRef = useRef("");
  const targetedOrderRowRef = useRef<HTMLTableRowElement | null>(null);
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatusFilter>(initialStatusFilter);
  const [supplierFilter, setSupplierFilter] = useState(urlSupplierId || "all");
  const [chantierFilter, setChantierFilter] = useState(lockedChantierId || urlChantierId || "all");
  const [projectFilter, setProjectFilter] = useState(urlProjectId || "all");
  const [chantierOptions, setChantierOptions] = useState<ChantierListOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectListOption[]>([]);
  const [chantierOptionsLoaded, setChantierOptionsLoaded] = useState(false);
  const chantierById = useMemo(
    () => new Map(chantierOptions.map((chantier) => [chantier.id, chantier])),
    [chantierOptions],
  );
  const projectById = useMemo(() => {
    const map = new Map<string, ProjectListOption>();
    projectOptions.forEach((project) => {
      map.set(project.id, project);
      map.set(project.sourceId, project);
    });
    return map;
  }, [projectOptions]);
  const targetedOrder = useMemo(
    () => (urlPurchaseOrderId
      ? orders.find((order) => order.id === urlPurchaseOrderId && (!lockedChantierId || order.chantierId === lockedChantierId)) ?? null
      : null),
    [lockedChantierId, orders, urlPurchaseOrderId],
  );
  const targetedOrderMissing = Boolean(urlPurchaseOrderId && !loading && !targetedOrder);

  const filteredOrders = useMemo(() => {
    const text = query.trim().toLowerCase();
    return orders.filter((order) => {
      const chantier = order.chantierId ? chantierById.get(order.chantierId) ?? null : null;
      const project = order.projectId ? projectById.get(order.projectId) ?? null : null;
      const matchesText = !text || [
        order.document.number,
        order.supplierName,
        order.document.recipient.displayName,
        order.deliveryAddress,
        order.supplierReference,
        project?.name,
        project?.clientName,
        project?.address,
        project?.projectType,
        chantier?.nom,
        chantier?.client,
        chantier?.adresse,
      ].some((value) => String(value ?? "").toLowerCase().includes(text));
      const matchesStatus = matchesStatusFilter(order, statusFilter);
      const matchesSupplier = supplierFilter === "all" || order.supplierId === supplierFilter;
      const matchesChantier = chantierFilter === "all" || order.chantierId === chantierFilter;
      const matchesProject = projectFilter === "all" || orderMatchesProjectFilter(order, projectFilter, projectById);
      return matchesText && matchesStatus && matchesSupplier && matchesChantier && matchesProject;
    });
  }, [chantierById, chantierFilter, orders, projectById, projectFilter, query, statusFilter, supplierFilter]);
  const totals = useMemo(() => buildTotals(filteredOrders), [filteredOrders]);
  const targetedOrderVisible = useMemo(
    () => Boolean(urlPurchaseOrderId && filteredOrders.some((order) => order.id === urlPurchaseOrderId)),
    [filteredOrders, urlPurchaseOrderId],
  );
  const activeSupplierName = useMemo(() => {
    if (supplierFilter === "all") return "";
    return suppliers.find((supplier) => supplier.id === supplierFilter)?.name ?? "fournisseur sélectionné";
  }, [supplierFilter, suppliers]);
  const activeChantierName = useMemo(() => {
    if (chantierFilter === "all") return "";
    const chantier = chantierById.get(chantierFilter) ?? null;
    return chantier ? formatChantierDisplayName(chantier) : "chantier sélectionné";
  }, [chantierById, chantierFilter]);
  const activeProjectName = useMemo(() => {
    if (projectFilter === "all") return "";
    const project = projectById.get(projectFilter) ?? null;
    return project ? formatProjectDisplayName(project) : "projet sélectionné";
  }, [projectById, projectFilter]);
  const hasActiveListFilters = Boolean(query.trim()) || statusFilter !== "all" || supplierFilter !== "all" || (!lockedChantierId && chantierFilter !== "all") || projectFilter !== "all";
  const emptyStateCopy = useMemo(
    () => buildEmptyStateCopy({
      chantierName: activeChantierName,
      hasActiveListFilters,
      projectName: activeProjectName,
      query,
      statusFilter,
      supplierName: activeSupplierName,
      totalOrders: orders.length,
    }),
    [activeChantierName, activeProjectName, activeSupplierName, hasActiveListFilters, orders.length, query, statusFilter],
  );
  const newOrderContextKey = [urlSupplierId, urlProjectId, urlChantierId].join("|");

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setChantierOptionsLoaded(false);
    listChantierOptions()
      .then((options) => {
        if (!cancelled) setChantierOptions(options);
      })
      .catch(() => {
        if (!cancelled) setChantierOptions([]);
      })
      .finally(() => {
        if (!cancelled) setChantierOptionsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    listProjectOptions().then(setProjectOptions).catch(() => setProjectOptions([]));
  }, []);

  useEffect(() => {
    const nextStatus = isPurchaseOrderStatusFilter(statusQueryParam) ? statusQueryParam : "all";
    setStatusFilter((current) => current === nextStatus ? current : nextStatus);

    if (statusQueryParam && !isPurchaseOrderStatusFilter(statusQueryParam)) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("status");
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams, statusQueryParam]);

  useEffect(() => {
    const nextSupplier = urlSupplierId || "all";
    setSupplierFilter((current) => current === nextSupplier ? current : nextSupplier);
  }, [urlSupplierId]);

  useEffect(() => {
    if (!lockedChantierId) return;
    setChantierFilter(lockedChantierId);
  }, [lockedChantierId]);

  useEffect(() => {
    const nextChantier = urlChantierId || "all";
    setChantierFilter((current) => current === nextChantier ? current : nextChantier);
  }, [urlChantierId]);

  useEffect(() => {
    const nextProject = urlProjectId || "all";
    setProjectFilter((current) => current === nextProject ? current : nextProject);
  }, [urlProjectId]);

  useEffect(() => {
    if (!urlPurchaseOrderId) {
      openedOrderFromUrlRef.current = "";
      return;
    }
    if (loading || openedOrderFromUrlRef.current === urlPurchaseOrderId) return;
    if (!targetedOrder) return;

    const requestedStatusFilter = isPurchaseOrderStatusFilter(statusQueryParam) ? statusQueryParam : "all";
    const requestedSupplierFilter = urlSupplierId && targetedOrder.supplierId === urlSupplierId ? urlSupplierId : "all";
    const requestedChantierFilter = lockedChantierId || (urlChantierId && targetedOrder.chantierId === urlChantierId ? urlChantierId : "all");
    const requestedProjectFilter = urlProjectId && orderMatchesProjectFilter(targetedOrder, urlProjectId, projectById) ? urlProjectId : "all";
    setSelectedOrder(targetedOrder);
    setQuery("");
    setStatusFilter(matchesStatusFilter(targetedOrder, requestedStatusFilter) ? requestedStatusFilter : "all");
    setSupplierFilter(requestedSupplierFilter);
    setChantierFilter(requestedChantierFilter);
    setProjectFilter(requestedProjectFilter);
    setError(null);
    openedOrderFromUrlRef.current = urlPurchaseOrderId;
  }, [loading, lockedChantierId, projectById, statusQueryParam, targetedOrder, urlChantierId, urlProjectId, urlPurchaseOrderId, urlSupplierId]);

  useEffect(() => {
    if (!urlPurchaseOrderId || !targetedOrder || loading || !targetedOrderVisible) return;
    const frame = window.requestAnimationFrame(() => {
      targetedOrderRowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, targetedOrder, targetedOrderVisible, urlPurchaseOrderId]);

  useEffect(() => {
    if (!urlNewOrder) {
      openedNewOrderFromUrlRef.current = "";
      return;
    }
    if (loading || selectedOrder || openedNewOrderFromUrlRef.current === newOrderContextKey) return;
    if (urlChantierId && !chantierOptionsLoaded) return;

    openedNewOrderFromUrlRef.current = newOrderContextKey;
    void createOrder({
      chantierId: urlChantierId || null,
      clearNewOrderParam: true,
      projectId: urlProjectId || null,
      supplierId: urlSupplierId || null,
    }).catch((err: any) => {
      setError(err?.message ?? "Création du bon de commande impossible.");
      clearNewOrderParam();
    });
  }, [chantierOptionsLoaded, loading, newOrderContextKey, selectedOrder, urlChantierId, urlNewOrder, urlProjectId, urlSupplierId]);

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

  function clearActivePurchaseOrderParam() {
    if (!urlPurchaseOrderId) return;
    openedOrderFromUrlRef.current = "";
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("purchaseOrderId");
    setSearchParams(nextParams, { replace: true });
  }

  function clearNewOrderParam() {
    if (!urlNewOrder) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("newOrder");
    setSearchParams(nextParams, { replace: true });
  }

  function updateStatusFilter(nextStatus: PurchaseOrderStatusFilter) {
    setStatusFilter(nextStatus);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("purchaseOrderId");
    nextParams.delete("newOrder");
    if (nextStatus === "all") {
      nextParams.delete("status");
    } else {
      nextParams.set("status", nextStatus);
    }
    setSearchParams(nextParams, { replace: true });
  }

  function updateSupplierFilter(nextSupplierId: string) {
    setSupplierFilter(nextSupplierId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("purchaseOrderId");
    nextParams.delete("newOrder");
    if (nextSupplierId === "all") {
      nextParams.delete("supplierId");
    } else {
      nextParams.set("supplierId", nextSupplierId);
    }
    setSearchParams(nextParams, { replace: true });
  }

  function updateChantierFilter(nextChantierId: string) {
    if (lockedChantierId) return;
    setChantierFilter(nextChantierId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("purchaseOrderId");
    nextParams.delete("newOrder");
    if (nextChantierId === "all") {
      nextParams.delete("chantierId");
    } else {
      nextParams.set("chantierId", nextChantierId);
    }
    setSearchParams(nextParams, { replace: true });
  }

  function updateProjectFilter(nextProjectId: string) {
    setProjectFilter(nextProjectId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("purchaseOrderId");
    nextParams.delete("newOrder");
    if (nextProjectId === "all") {
      nextParams.delete("projectId");
    } else {
      nextParams.set("projectId", nextProjectId);
    }
    setSearchParams(nextParams, { replace: true });
  }

  function clearOpenStatusFilter() {
    updateStatusFilter("all");
  }

  function resetListFilters() {
    setQuery("");
    setStatusFilter("all");
    setSupplierFilter("all");
    setChantierFilter(lockedChantierId || "all");
    setProjectFilter("all");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("purchaseOrderId");
    nextParams.delete("newOrder");
    nextParams.delete("status");
    nextParams.delete("supplierId");
    if (!lockedChantierId) nextParams.delete("chantierId");
    nextParams.delete("projectId");
    setSearchParams(nextParams, { replace: true });
  }

  function openOrder(order: PurchaseOrderRecord) {
    if (urlPurchaseOrderId && urlPurchaseOrderId !== order.id) clearActivePurchaseOrderParam();
    clearNewOrderParam();
    setSelectedOrder(order);
  }

  function closeOrder() {
    setSelectedOrder(null);
    clearActivePurchaseOrderParam();
    clearNewOrderParam();
  }

  async function createOrder(options: CreateOrderOptions = {}) {
    const effectiveSupplierId = options.supplierId ?? (supplierFilter !== "all" ? supplierFilter : null);
    const effectiveProjectId = options.projectId ?? (projectFilter !== "all" ? projectFilter : null);
    const effectiveChantierId = options.chantierId ?? (chantierFilter !== "all" ? chantierFilter : null);
    const contextualSupplier = effectiveSupplierId
      ? suppliers.find((supplier) => supplier.id === effectiveSupplierId) ?? null
      : suppliers[0] ?? null;
    const contextualChantier = effectiveChantierId ? chantierById.get(effectiveChantierId) ?? null : null;
    const terms = await getPurchaseOrderDefaultTerms();
    const order = await createAndSavePurchaseOrder({
      supplierId: contextualSupplier?.id ?? null,
      supplierName: contextualSupplier?.name ?? null,
      projectId: effectiveProjectId,
      chantierId: effectiveChantierId,
      terms,
    });
    const savedOrder = contextualChantier?.adresse
      ? await savePurchaseOrder({
        ...order,
        deliveryAddress: contextualChantier.adresse,
        document: {
          ...order.document,
          siteAddress: contextualChantier.adresse,
        },
      })
      : order;
    setOrders(await listPurchaseOrders());
    setSelectedOrder(savedOrder);
    if (options.clearNewOrderParam) clearNewOrderParam();
    else clearActivePurchaseOrderParam();
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
            <p className="mt-1 text-sm text-slate-500">
              {lockedChantierId
                ? "Commandes, livraisons et achats rattachés uniquement à ce chantier."
                : "Commandes liées aux fournisseurs, projets, chantiers et à la rentabilité."}
            </p>
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
          <Metric label="Commandes" value={`${filteredOrders.length}`} />
          <Metric label="Achats HT" value={formatCurrency(totals.ht)} />
          <Metric label="Achats TTC" value={formatCurrency(totals.ttc)} />
        </div>
      </div>

      {urlPurchaseOrderId ? (
        <div className={[
          "rounded-2xl border p-4 text-sm",
          targetedOrderMissing ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900",
        ].join(" ")}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">
                {targetedOrderMissing ? "Bon de commande introuvable" : "Bon de commande ouvert depuis la recherche globale"}
              </div>
              <p className={targetedOrderMissing ? "mt-1 text-amber-800" : "mt-1 text-blue-800"}>
                {targetedOrderMissing
                  ? "Le lien pointe vers une commande supprimée ou non accessible avec les droits actuels."
                  : `${targetedOrder?.document.number ?? "Commande"} est sélectionné et prêt à être contrôlé ou mis à jour.`}
              </p>
            </div>
            <button
              type="button"
              onClick={clearActivePurchaseOrderParam}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              Retirer le ciblage
            </button>
          </div>
        </div>
      ) : null}

      {!urlPurchaseOrderId && statusFilter === "open" ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">Commandes ouvertes à traiter</div>
              <p className="mt-1 text-blue-800">
                Liste limitée aux brouillons, bons envoyés, confirmés ou livrés partiellement.
              </p>
            </div>
            <button
              type="button"
              onClick={clearOpenStatusFilter}
              className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Afficher toutes les commandes
            </button>
          </div>
        </div>
      ) : null}

      {!urlPurchaseOrderId && supplierFilter !== "all" ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">Commandes du fournisseur</div>
              <p className="mt-1 text-blue-800">
                Liste filtrée sur {activeSupplierName} pour contrôler ses bons de commande et livraisons.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateSupplierFilter("all")}
              className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Afficher tous les fournisseurs
            </button>
          </div>
        </div>
      ) : null}

      {!urlPurchaseOrderId && projectFilter !== "all" ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">Commandes du projet</div>
              <p className="mt-1 text-blue-800">
                Liste filtrée sur {activeProjectName} pour suivre les achats liés au dossier commercial.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateProjectFilter("all")}
              className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Afficher tous les projets
            </button>
          </div>
        </div>
      ) : null}

      {!urlPurchaseOrderId && chantierFilter !== "all" ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">Commandes du chantier</div>
              <p className="mt-1 text-blue-800">
                Liste filtrée sur {activeChantierName} pour suivre les achats et livraisons liés au chantier.
              </p>
            </div>
            {!lockedChantierId ? (
              <button
                type="button"
                onClick={() => updateChantierFilter("all")}
                className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
              >
                Afficher tous les chantiers
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_160px_200px_200px_200px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={inputClassWithIcon} placeholder="Rechercher commande, fournisseur, projet, chantier..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <select className={selectClass} value={statusFilter} onChange={(event) => updateStatusFilter(event.target.value as PurchaseOrderStatusFilter)}>
              <option value="all">Tous statuts</option>
              <option value="open">Ouverts à traiter</option>
              <option value="draft">Brouillon</option>
              <option value="sent">Envoyé</option>
              <option value="confirmed">Confirmé</option>
              <option value="partially_delivered">Livré partiellement</option>
              <option value="delivered">Livré</option>
              <option value="cancelled">Annulé</option>
            </select>
            <select className={selectClass} value={supplierFilter} onChange={(event) => updateSupplierFilter(event.target.value)}>
              <option value="all">Tous fournisseurs</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
            <select className={selectClass} value={projectFilter} onChange={(event) => updateProjectFilter(event.target.value)}>
              <option value="all">Tous projets</option>
              {projectOptions.map((project) => <option key={project.id} value={project.id}>{formatProjectOptionLabel(project)}</option>)}
            </select>
            {!lockedChantierId ? (
              <select className={selectClass} value={chantierFilter} onChange={(event) => updateChantierFilter(event.target.value)}>
                <option value="all">Tous chantiers</option>
                {chantierOptions.map((chantier) => (
                  <option key={chantier.id} value={chantier.id}>{formatChantierDisplayName(chantier)}</option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedOrder ? (
        <PurchaseOrderEditor
          order={selectedOrder}
          suppliers={suppliers}
          onChange={setSelectedOrder}
          onSave={save}
          onClose={closeOrder}
        />
      ) : null}

      {!loading ? <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] divide-y divide-slate-100 text-sm">
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
              const chantier = order.chantierId ? chantierById.get(order.chantierId) ?? null : null;
              const project = order.projectId ? projectById.get(order.projectId) ?? null : null;
              const isTargetedOrder = order.id === urlPurchaseOrderId;
              return (
                <tr
                  key={order.id}
                  ref={(node) => {
                    if (isTargetedOrder) targetedOrderRowRef.current = node;
                  }}
                  className={["hover:bg-slate-50", isTargetedOrder ? "bg-blue-50/70 ring-1 ring-inset ring-blue-200" : ""].join(" ")}
                >
                  <td className="px-4 py-3 font-semibold text-slate-950">{order.document.number}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {order.supplierId ? (
                      <Link
                        to={`/fournisseurs?supplierId=${encodeURIComponent(order.supplierId)}`}
                        className="font-semibold text-blue-700 hover:text-blue-800"
                      >
                        {order.supplierName || order.document.recipient.displayName || "Ouvrir fournisseur"}
                      </Link>
                    ) : (
                      order.supplierName || order.document.recipient.displayName || "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {order.projectId ? (
                      <div className="min-w-44">
                        {project ? (
                          <Link
                            to={`/projets/${encodeURIComponent(project.id)}`}
                            className="font-semibold text-blue-700 hover:text-blue-800"
                          >
                            {formatProjectDisplayName(project)}
                          </Link>
                        ) : (
                          <span className="font-medium text-slate-600">Projet non accessible</span>
                        )}
                        {project?.clientName ? (
                          <div className="mt-0.5 max-w-64 truncate text-xs text-slate-400">{project.clientName}</div>
                        ) : !project ? (
                          <div className="mt-0.5 text-xs text-amber-600">ID {formatShortIdentifier(order.projectId)}</div>
                        ) : null}
                      </div>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {order.chantierId ? (
                      <div className="min-w-44">
                        <Link
                          to={`/chantiers/${encodeURIComponent(order.chantierId)}`}
                          className="font-semibold text-blue-700 hover:text-blue-800"
                        >
                          {chantier ? formatChantierDisplayName(chantier) : "Ouvrir chantier"}
                        </Link>
                        {chantier?.adresse ? (
                          <div className="mt-0.5 max-w-64 truncate text-xs text-slate-400">{chantier.adresse}</div>
                        ) : !chantier ? (
                          <div className="mt-0.5 text-xs text-amber-600">Chantier non accessible</div>
                        ) : null}
                      </div>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate) : "-"}</td>
                  <td className="px-4 py-3"><PurchaseOrderStatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(orderTotals.totalTtc)}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="font-semibold text-blue-700 hover:text-blue-800" onClick={() => openOrder(order)}>
                      Ouvrir
                    </button>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={8} className="px-4 py-12">
                  <div className="mx-auto max-w-md text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><ShoppingCart className="h-5 w-5" /></div>
                    <div className="mt-3 font-semibold text-slate-950">{emptyStateCopy.title}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-500">{emptyStateCopy.description}</div>
                    <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                      {emptyStateCopy.showReset ? (
                        <button
                          type="button"
                          onClick={resetListFilters}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          Réinitialiser les filtres
                        </button>
                      ) : null}
                      {emptyStateCopy.showCreate ? (
                        <button type="button" onClick={() => void createOrder()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                          Nouveau bon de commande
                        </button>
                      ) : null}
                    </div>
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

function buildEmptyStateCopy({
  chantierName,
  hasActiveListFilters,
  projectName,
  query,
  statusFilter,
  supplierName,
  totalOrders,
}: {
  chantierName: string;
  hasActiveListFilters: boolean;
  projectName: string;
  query: string;
  statusFilter: PurchaseOrderStatusFilter;
  supplierName: string;
  totalOrders: number;
}): EmptyStateCopy {
  if (!totalOrders) {
    return {
      title: "Aucun bon de commande",
      description: "Créez le premier bon fournisseur pour suivre les achats engagés, les livraisons et les sorties à venir.",
      showCreate: true,
      showReset: false,
    };
  }

  if (!hasActiveListFilters) {
    return {
      title: "Aucun bon de commande visible",
      description: "Les commandes existent peut-être dans un autre contexte ou ne sont pas accessibles avec les droits actuels.",
      showCreate: true,
      showReset: false,
    };
  }

  const details = [
    statusFilter !== "all" ? `statut ${purchaseOrderStatusFilterLabel(statusFilter).toLowerCase()}` : "",
    supplierName ? `fournisseur ${supplierName}` : "",
    projectName ? `projet ${projectName}` : "",
    chantierName ? `chantier ${chantierName}` : "",
    query.trim() ? `recherche "${query.trim()}"` : "",
  ].filter(Boolean);

  return {
    title: statusFilter === "open" ? "Aucune commande ouverte à traiter" : "Aucune commande ne correspond aux filtres",
    description: details.length
      ? `Aucun bon ne correspond à ce contexte : ${details.join(", ")}. Réinitialisez les filtres pour revenir à la liste complète.`
      : "Aucun bon ne correspond à ce contexte. Réinitialisez les filtres pour revenir à la liste complète.",
    showCreate: true,
    showReset: true,
  };
}

function purchaseOrderStatusFilterLabel(status: PurchaseOrderStatusFilter) {
  switch (status) {
    case "open":
      return "Ouverts à traiter";
    case "draft":
      return "Brouillon";
    case "sent":
      return "Envoyé";
    case "confirmed":
      return "Confirmé";
    case "partially_delivered":
      return "Livré partiellement";
    case "delivered":
      return "Livré";
    case "cancelled":
      return "Annulé";
    default:
      return "Tous statuts";
  }
}

async function listChantierOptions(): Promise<ChantierListOption[]> {
  const { data, error } = await supabase
    .from("chantiers" as any)
    .select("id, nom, client, adresse")
    .order("nom", { ascending: true })
    .overrideTypes<ChantierListOption[]>();

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function listProjectOptions(): Promise<ProjectListOption[]> {
  const dataset = await loadCrmDataset();
  return buildProjects(dataset).map((project) => ({
    id: project.id,
    sourceId: project.sourceId,
    name: project.name,
    clientName: project.clientName,
    address: project.address,
    projectType: project.projectType,
  }));
}

function orderMatchesProjectFilter(
  order: PurchaseOrderRecord,
  projectFilter: string,
  projectById: Map<string, ProjectListOption>,
) {
  if (!order.projectId) return false;
  if (order.projectId === projectFilter) return true;
  const project = projectById.get(order.projectId);
  return project?.id === projectFilter || project?.sourceId === projectFilter;
}

function formatChantierDisplayName(chantier: ChantierListOption) {
  return [chantier.nom, chantier.client].filter(Boolean).join(" - ");
}

function formatProjectDisplayName(project: ProjectListOption) {
  return project.name || project.clientName || "Ouvrir projet";
}

function formatProjectOptionLabel(project: ProjectListOption) {
  return [formatProjectDisplayName(project), project.clientName].filter(Boolean).join(" - ");
}

function formatShortIdentifier(value: string) {
  return value.length > 8 ? `${value.slice(0, 8)}...` : value;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}

const selectClass = "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300";
const inputClassWithIcon = "h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-300";
