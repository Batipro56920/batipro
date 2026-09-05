import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";
import { getTasksByChantierIdDetailed, type ChantierTaskRow } from "../../../services/chantierTasks.service";
import {
  estimateTaskTemplatePreparation,
  listTaskTemplatePreparationByTemplateIds,
} from "../../../services/taskTemplatePreparation.service";
import { listProductCatalogItems, saveProductCatalogItem, type ProductCatalogItem } from "../../product-catalog";
import { listSuppliers, type SupplierRow } from "../../../services/suppliers.service";
import {
  buildProductDraftFromQuickCreate,
  ProductQuickCreateModal,
  toDocumentUnit,
} from "../../product-catalog/components/ProductQuickCreateModal";
import {
  calculateDocumentTotals,
  type DocumentItemNode,
  type DocumentSectionNode,
} from "../../document-engine";
import { createPurchaseOrder } from "../../purchase-orders/application/purchaseOrderFactory";
import { generateSequentialPurchaseOrderNumbers, listPurchaseOrders, savePurchaseOrder } from "../../purchase-orders/infrastructure/purchaseOrderRepository";
import type { PurchaseOrderRecord } from "../../purchase-orders/domain/types";
import { getPurchaseOrderDefaultTerms } from "../../../services/companySettings.service";
import {
  addManualMaterialPreparation,
  linkMaterialPreparationsToPurchaseOrder,
  listChantierMaterialPreparations,
  removeMaterialPreparation,
  updateMaterialPreparation,
  upsertComputedMaterialPreparations,
  type ChantierMaterialPreparationRow,
  type MaterialPreparationComputedLine,
} from "../../../services/chantierMaterialPreparation.service";

function toNumberOrNull(value: string) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

type PreparationStatus = { key: "non_commande" | "en_commande" | "en_stock"; label: string; className: string };

function deriveStatus(prep: ChantierMaterialPreparationRow, purchaseOrderById: Map<string, PurchaseOrderRecord>): PreparationStatus {
  const po = prep.purchaseOrderId ? purchaseOrderById.get(prep.purchaseOrderId) ?? null : null;
  if (!po || po.status === "draft" || po.status === "cancelled") {
    return { key: "non_commande", label: "Non commande", className: "border-slate-200 bg-slate-100 text-slate-600" };
  }
  if (po.status === "delivered") {
    return { key: "en_stock", label: "En stock", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  return { key: "en_commande", label: "En commande", className: "border-amber-200 bg-amber-50 text-amber-700" };
}

type GapModalState = { prepId: string | null; materialName: string; unit: string };

export default function ChantierMaterialsSection({ chantierId }: { chantierId: string }) {
  const [tasks, setTasks] = useState<ChantierTaskRow[]>([]);
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [existingOrders, setExistingOrders] = useState<PurchaseOrderRecord[]>([]);
  const [preparations, setPreparations] = useState<ChantierMaterialPreparationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdOrders, setCreatedOrders] = useState<Array<{ id: string; number: string; supplierName: string | null }>>([]);
  const [productQuery, setProductQuery] = useState("");
  const [gapModal, setGapModal] = useState<GapModalState | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  async function refreshBase() {
    setLoading(true);
    try {
      const [taskResult, productRows, supplierRows, orderRows, preparationRows] = await Promise.all([
        getTasksByChantierIdDetailed(chantierId),
        listProductCatalogItems().catch(() => []),
        listSuppliers().catch(() => []),
        listPurchaseOrders().catch(() => []),
        listChantierMaterialPreparations(chantierId).catch(() => []),
      ]);
      setTasks(taskResult.tasks);
      setProducts(productRows);
      setSuppliers(supplierRows);
      setExistingOrders(orderRows.filter((order) => order.chantierId === chantierId));
      setPreparations(preparationRows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chantierId]);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const purchaseOrderById = useMemo(() => new Map(existingOrders.map((order) => [order.id, order])), [existingOrders]);
  const filteredCatalog = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return [];
    return products.filter((product) => product.designation.toLowerCase().includes(query)).slice(0, 6);
  }, [productQuery, products]);

  async function generateFromTasks() {
    setGenerating(true);
    setError(null);
    setCreatedOrders([]);
    try {
      const templateIds = Array.from(
        new Set(tasks.map((task) => task.task_template_id).filter((value): value is string => Boolean(value))),
      );
      const preparation = await listTaskTemplatePreparationByTemplateIds(templateIds);
      if (!preparation.schemaReady) {
        setError("Migration preparation avancee non appliquee sur Supabase.");
        return;
      }

      const aggregated = new Map<string, MaterialPreparationComputedLine>();
      for (const task of tasks) {
        if (!task.task_template_id) continue;
        const estimate = estimateTaskTemplatePreparation(
          task,
          preparation.materialsByTemplateId[task.task_template_id] ?? [],
          preparation.equipmentByTemplateId[task.task_template_id] ?? [],
        );
        for (const material of estimate.materials) {
          const product = material.product_id ? productById.get(material.product_id) ?? null : null;
          const supplierId = product?.mainSupplierId ?? material.supplier_id ?? null;
          const supplierName = product?.mainSupplierName ?? null;
          const key = material.product_id ?? `${material.material_name.trim().toLowerCase()}__${material.ratio_unit.trim().toLowerCase()}`;
          const existing = aggregated.get(key);
          if (existing) {
            existing.quantity = Math.round((existing.quantity + material.estimated_quantity) * 1000) / 1000;
            existing.unitCostHt = (existing.unitCostHt ?? 0) + (material.estimated_purchase_cost_ht ?? 0);
          } else {
            aggregated.set(key, {
              aggregationKey: key,
              materialName: material.material_name,
              quantity: material.estimated_quantity,
              unit: material.ratio_unit,
              unitCostHt: material.estimated_purchase_cost_ht,
              productId: material.product_id,
              supplierId,
              supplierName,
            });
          }
        }
      }

      const computed = Array.from(aggregated.values());
      const nextPreparations = await upsertComputedMaterialPreparations(chantierId, computed);
      setPreparations(nextPreparations);

      if (computed.length === 0) {
        setError("Aucun ratio materiau compatible trouve sur les taches de ce chantier.");
      }
    } catch (err: any) {
      setError(err?.message ?? "Erreur generation liste materiaux.");
    } finally {
      setGenerating(false);
    }
  }

  async function addFromCatalog(product: ProductCatalogItem) {
    try {
      const row = await addManualMaterialPreparation(chantierId, {
        materialName: product.designation,
        quantity: 1,
        unit: product.unit,
        productId: product.id,
        supplierId: product.mainSupplierId,
        supplierName: product.mainSupplierName,
        unitCostHt: product.standardPurchasePriceHt,
      });
      setPreparations((current) => [...current, row].sort((a, b) => a.materialName.localeCompare(b.materialName, "fr")));
      setProductQuery("");
    } catch (err: any) {
      setError(err?.message ?? "Erreur ajout materiau.");
    }
  }

  async function updateLineQuantity(id: string, value: string) {
    const quantity = toNumberOrNull(value) ?? 0;
    setPreparations((current) => current.map((row) => (row.id === id ? { ...row, quantity } : row)));
    try {
      await updateMaterialPreparation(id, { quantity });
    } catch (err: any) {
      setError(err?.message ?? "Erreur mise a jour quantite.");
    }
  }

  async function removeLine(id: string) {
    setPreparations((current) => current.filter((row) => row.id !== id));
    try {
      await removeMaterialPreparation(id);
    } catch (err: any) {
      setError(err?.message ?? "Erreur suppression ligne.");
    }
  }

  async function relinkLineProduct(id: string, product: ProductCatalogItem) {
    try {
      const updated = await updateMaterialPreparation(id, {
        productId: product.id,
        supplierId: product.mainSupplierId,
        supplierName: product.mainSupplierName,
        unitCostHt: product.standardPurchasePriceHt,
      });
      setPreparations((current) => current.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err: any) {
      setError(err?.message ?? "Erreur liaison produit.");
    }
  }

  async function submitProductQuickCreate(values: { designation: string; unit: ReturnType<typeof toDocumentUnit>; supplierId: string; priceHt: number }) {
    setSavingProduct(true);
    setError(null);
    try {
      const draft = await buildProductDraftFromQuickCreate(values, suppliers);
      const saved = await saveProductCatalogItem(draft, "creation rapide preparation chantier");
      setProducts((current) => [...current, saved]);

      if (gapModal?.prepId) {
        const updated = await updateMaterialPreparation(gapModal.prepId, {
          productId: saved.id,
          supplierId: saved.mainSupplierId,
          supplierName: saved.mainSupplierName,
          unitCostHt: saved.standardPurchasePriceHt,
        });
        setPreparations((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      } else {
        const row = await addManualMaterialPreparation(chantierId, {
          materialName: saved.designation,
          quantity: 1,
          unit: saved.unit,
          productId: saved.id,
          supplierId: saved.mainSupplierId,
          supplierName: saved.mainSupplierName,
          unitCostHt: saved.standardPurchasePriceHt,
        });
        setPreparations((current) => [...current, row]);
      }
      setGapModal(null);
      setProductQuery("");
    } catch (err: any) {
      setError(err?.message ?? "Erreur creation produit.");
    } finally {
      setSavingProduct(false);
    }
  }

  async function createOrdersBySupplier() {
    const orderableLines = preparations.filter((row) => !row.purchaseOrderId);
    if (orderableLines.length === 0) return;
    const blockedLines = orderableLines.filter((row) => !row.productId || (!row.supplierId && !row.supplierName));
    const readyLines = orderableLines.filter((row) => row.productId && (row.supplierId || row.supplierName));

    if (readyLines.length === 0) {
      setError("Tous les materiaux restants n'ont pas de produit catalogue / fournisseur resolu. Cree le produit avant de commander.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const groups = new Map<string, { supplierId: string | null; supplierName: string | null; lines: ChantierMaterialPreparationRow[] }>();
      for (const line of readyLines) {
        const key = line.supplierId ?? line.supplierName ?? "__unknown__";
        const group = groups.get(key) ?? { supplierId: line.supplierId, supplierName: line.supplierName, lines: [] };
        group.lines.push(line);
        groups.set(key, group);
      }

      const terms = await getPurchaseOrderDefaultTerms();
      const groupList = Array.from(groups.values());
      const numbers = await generateSequentialPurchaseOrderNumbers(groupList.length);
      const created: Array<{ id: string; number: string; supplierName: string | null }> = [];
      for (const [index, group] of groupList.entries()) {
        const order = createPurchaseOrder({ number: numbers[index], chantierId, supplierId: group.supplierId, supplierName: group.supplierName, terms });
        const lineNodes: DocumentItemNode[] = group.lines.map((line, index) => ({
          id: crypto.randomUUID(),
          type: "line",
          parentId: null,
          order: index,
          title: line.materialName,
          kind: "fourniture",
          quantity: line.quantity,
          unit: toDocumentUnit(line.unit),
          unitPriceHt:
            line.unitCostHt !== null && line.quantity > 0 ? Math.round((line.unitCostHt / line.quantity) * 100) / 100 : 0,
          vatRate: 20,
        }));
        const section: DocumentSectionNode = {
          id: crypto.randomUUID(),
          type: "section",
          parentId: null,
          order: 0,
          title: "Materiaux (calcule depuis les taches du chantier)",
          children: lineNodes.map((line, index) => ({ ...line, parentId: null, order: index })),
        };
        const nextDocument = { ...order.document, nodes: [section] };
        const saved = await savePurchaseOrder({
          ...order,
          document: { ...nextDocument, totals: calculateDocumentTotals(nextDocument) },
        });
        await linkMaterialPreparationsToPurchaseOrder(group.lines.map((line) => line.id), saved.id);
        created.push({ id: saved.id, number: saved.document.number, supplierName: saved.supplierName });
      }

      setCreatedOrders(created);
      setNotice(
        blockedLines.length
          ? `${created.length} bon(s) de commande cree(s). ${blockedLines.length} materiau(x) sans produit catalogue reste(nt) a resoudre.`
          : `${created.length} bon(s) de commande cree(s).`,
      );
      await refreshBase();
    } catch (err: any) {
      setError(err?.message ?? "Erreur creation des bons de commande.");
    } finally {
      setCreating(false);
    }
  }

  const previewList = preparations.length ? preparations : null;

  const preview = loading ? (
    <div className="text-sm text-slate-500">Chargement...</div>
  ) : previewList ? (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <div className="divide-y divide-slate-100">
        {previewList.map((row) => (
          <MaterialLineRow
            key={row.id}
            row={row}
            status={deriveStatus(row, purchaseOrderById)}
            purchaseOrderNumber={row.purchaseOrderId ? purchaseOrderById.get(row.purchaseOrderId)?.document.number ?? null : null}
            compact
          />
        ))}
      </div>
    </div>
  ) : (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
      Aucune ligne calculee. Ouvre "Gerer les materiaux" pour lancer le calcul depuis les taches.
    </div>
  );

  return (
    <ChantierChapterDrawer
      eyebrow="Preparation chantier"
      title="Materiaux"
      subtitle="Calcules a partir des ratios materiaux (bibliotheque de taches) x quantites des taches, tous rattaches au catalogue produits."
      actionLabel="Gerer les materiaux"
      previewClassName="batipro-chapter-preview--materials"
      preview={preview}
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-slate-700">
            Chaque materiau doit etre rattache a un produit du catalogue (et son fournisseur) : "Creer les bons de
            commande" cree un bon par fournisseur. Sans produit resolu, la ligne reste bloquee tant que le produit
            n'est pas cree.
          </div>
          <button
            type="button"
            onClick={() => void generateFromTasks()}
            disabled={generating}
            className="shrink-0 rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-60"
          >
            {generating ? "Calcul..." : "Calculer depuis les taches"}
          </button>
        </div>

        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
        ) : null}
        {notice ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {notice}
          </div>
        ) : null}

        {createdOrders.length ? (
          <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {createdOrders.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {order.number} {order.supplierName ? `- ${order.supplierName}` : "- sans fournisseur assigne"}
                </span>
                <Link
                  to={`/bons-commande?purchaseOrderId=${order.id}`}
                  className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  Ouvrir
                </Link>
              </div>
            ))}
          </div>
        ) : null}

        {preparations.length > 0 ? (
          <div className="space-y-2">
            {preparations.map((row) => (
              <MaterialLineRow
                key={row.id}
                row={row}
                status={deriveStatus(row, purchaseOrderById)}
                products={products}
                onQuantityChange={(value) => updateLineQuantity(row.id, value)}
                onRemove={row.purchaseOrderId ? undefined : () => removeLine(row.id)}
                onCreateProduct={() => setGapModal({ prepId: row.id, materialName: row.materialName, unit: row.unit })}
                onRelink={(product) => void relinkLineProduct(row.id, product)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            Aucune ligne pour l'instant. Calcule depuis les taches ou ajoute un produit du catalogue ci-dessous.
          </div>
        )}

        <div className="space-y-2 border-t border-slate-200 pt-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Ajouter un materiau depuis le catalogue produits</div>
          <input
            value={productQuery}
            onChange={(event) => setProductQuery(event.target.value)}
            placeholder="Rechercher un produit du catalogue..."
            className="w-full max-w-md rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
          {filteredCatalog.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredCatalog.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => void addFromCatalog(product)}
                  className="rounded-xl border border-slate-200 bg-white p-3 text-left text-sm hover:border-blue-200 hover:bg-blue-50"
                >
                  <div className="font-semibold text-slate-950">{product.designation}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {product.unit} - {product.mainSupplierName ?? "fournisseur non defini"}
                  </div>
                </button>
              ))}
            </div>
          ) : productQuery.trim() ? (
            <div className="text-xs text-slate-400">Aucun produit catalogue ne correspond a "{productQuery.trim()}".</div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setGapModal({ prepId: null, materialName: productQuery.trim(), unit: "u" })}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Produit introuvable ? Creer un produit
            </button>
            <button
              type="button"
              onClick={() => void createOrdersBySupplier()}
              disabled={preparations.filter((row) => !row.purchaseOrderId).length === 0 || creating}
              className={[
                "ml-auto rounded-2xl px-5 py-3 text-sm font-semibold",
                preparations.filter((row) => !row.purchaseOrderId).length === 0 || creating
                  ? "bg-slate-200 text-slate-500"
                  : "bg-emerald-600 text-white hover:bg-emerald-700",
              ].join(" ")}
            >
              {creating ? "Creation..." : "Creer les bons de commande"}
            </button>
          </div>
        </div>
      </div>

      {gapModal ? (
        <ProductQuickCreateModal
          initial={gapModal}
          suppliers={suppliers}
          saving={savingProduct}
          onCancel={() => setGapModal(null)}
          onSubmit={(values) => void submitProductQuickCreate(values)}
        />
      ) : null}
    </ChantierChapterDrawer>
  );
}

function MaterialLineRow({
  row,
  status,
  products,
  purchaseOrderNumber,
  onQuantityChange,
  onRemove,
  onCreateProduct,
  onRelink,
  compact,
}: {
  row: ChantierMaterialPreparationRow;
  status: PreparationStatus;
  products?: ProductCatalogItem[];
  purchaseOrderNumber?: string | null;
  onQuantityChange?: (value: string) => void;
  onRemove?: () => void;
  onCreateProduct?: () => void;
  onRelink?: (product: ProductCatalogItem) => void;
  compact?: boolean;
}) {
  const [relinkOpen, setRelinkOpen] = useState(false);
  const [relinkQuery, setRelinkQuery] = useState("");

  const relinkResults = useMemo(() => {
    const query = relinkQuery.trim().toLowerCase();
    if (!query || !products) return [];
    return products.filter((product) => product.designation.toLowerCase().includes(query)).slice(0, 6);
  }, [relinkQuery, products]);

  if (compact) {
    return (
      <div className="grid min-w-[520px] grid-cols-[1fr_50px_44px_120px_100px_110px] items-center gap-2 px-3 py-2 text-sm">
        <span className="min-w-0 truncate text-slate-800">{row.materialName}</span>
        <span className="text-right text-xs text-slate-500">{row.quantity}</span>
        <span className="text-xs text-slate-500">{row.unit || "u"}</span>
        <span className="min-w-0 truncate text-xs text-slate-500">{row.supplierName ?? "—"}</span>
        <span className="min-w-0 truncate text-xs text-slate-500">{purchaseOrderNumber ?? "—"}</span>
        <span className={["w-fit shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold", status.className].join(" ")}>
          {status.label}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[160px] flex-1">
          <div className="font-medium text-slate-950">{row.materialName}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>
              {row.source === "auto" ? "Auto - depuis les taches" : "Ajout manuel"}
              {row.supplierName ? ` - ${row.supplierName}` : ""}
            </span>
            <span className={["rounded-full border px-2 py-0.5 font-semibold", status.className].join(" ")}>{status.label}</span>
            {!row.productId ? (
              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-semibold text-red-700">Produit a creer</span>
            ) : null}
          </div>
        </div>
        {onQuantityChange ? (
          <input
            value={row.quantity}
            onChange={(event) => onQuantityChange(event.target.value)}
            inputMode="decimal"
            className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        ) : (
          <span className="text-sm font-semibold text-slate-900">{row.quantity}</span>
        )}
        <span className="w-14 text-sm text-slate-500">{row.unit || "u"}</span>
        {!compact && onRelink ? (
          <button
            type="button"
            onClick={() => setRelinkOpen((open) => !open)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {row.productId ? "Changer de produit" : "Lier un produit existant"}
          </button>
        ) : null}
        {!compact && !row.productId && onCreateProduct ? (
          <button
            type="button"
            onClick={onCreateProduct}
            className="rounded-xl border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
          >
            Creer le produit
          </button>
        ) : null}
        {!compact && onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Retirer
          </button>
        ) : null}
      </div>

      {relinkOpen && onRelink ? (
        <div className="mt-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <input
            autoFocus
            value={relinkQuery}
            onChange={(event) => setRelinkQuery(event.target.value)}
            placeholder="Rechercher un produit du catalogue..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
          {relinkResults.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {relinkResults.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    onRelink(product);
                    setRelinkOpen(false);
                    setRelinkQuery("");
                  }}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-left text-sm hover:border-blue-200 hover:bg-blue-50"
                >
                  <div className="font-semibold text-slate-950">{product.designation}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {product.unit} - {product.mainSupplierName ?? "fournisseur non defini"}
                  </div>
                </button>
              ))}
            </div>
          ) : relinkQuery.trim() ? (
            <div className="text-xs text-slate-400">Aucun produit ne correspond.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

