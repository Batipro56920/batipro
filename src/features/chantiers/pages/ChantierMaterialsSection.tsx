import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";
import { getTasksByChantierIdDetailed, type ChantierTaskRow } from "../../../services/chantierTasks.service";
import {
  estimateTaskTemplatePreparation,
  listTaskTemplatePreparationByTemplateIds,
} from "../../../services/taskTemplatePreparation.service";
import { listProductCatalogItems, type ProductCatalogItem } from "../../product-catalog";
import {
  calculateDocumentTotals,
  flattenDocumentNodes,
  type DocumentItemNode,
  type DocumentSectionNode,
  type DocumentUnit,
} from "../../document-engine";
import { createPurchaseOrder } from "../../purchase-orders/application/purchaseOrderFactory";
import { listPurchaseOrders, savePurchaseOrder } from "../../purchase-orders/infrastructure/purchaseOrderRepository";
import type { PurchaseOrderRecord } from "../../purchase-orders/domain/types";

type MaterialLineDraft = {
  id: string;
  material_name: string;
  quantity: number;
  unit: string;
  estimated_cost_ht: number | null;
  source: "auto" | "manual";
  taskCount: number;
  productId: string | null;
  supplierId: string | null;
  supplierName: string | null;
};

type OrderStatus = { orderedQuantity: number; pos: Array<{ id: string; number: string }> };

const DOCUMENT_UNITS: DocumentUnit[] = ["u", "h", "ml", "m2", "m3", "forfait", "kg", "l"];

function toDocumentUnit(unit: string): DocumentUnit {
  const normalized = unit.trim().toLowerCase() as DocumentUnit;
  return DOCUMENT_UNITS.includes(normalized) ? normalized : "u";
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function toNumberOrNull(value: string) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ChantierMaterialsSection({ chantierId }: { chantierId: string }) {
  const [tasks, setTasks] = useState<ChantierTaskRow[]>([]);
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [existingOrders, setExistingOrders] = useState<PurchaseOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [materialLines, setMaterialLines] = useState<MaterialLineDraft[]>([]);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdOrders, setCreatedOrders] = useState<Array<{ id: string; number: string; supplierName: string | null }>>([]);
  const [manualName, setManualName] = useState("");
  const [manualQuantity, setManualQuantity] = useState("1");
  const [manualUnit, setManualUnit] = useState("");

  async function refreshBase() {
    setLoading(true);
    try {
      const [taskResult, productRows, orderRows] = await Promise.all([
        getTasksByChantierIdDetailed(chantierId),
        listProductCatalogItems().catch(() => []),
        listPurchaseOrders().catch(() => []),
      ]);
      setTasks(taskResult.tasks);
      setProducts(productRows);
      setExistingOrders(orderRows.filter((order) => order.chantierId === chantierId));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chantierId]);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  // Quantite deja presente sur des bons de commande existants de ce chantier, par nom de materiau normalise.
  const orderedByName = useMemo(() => {
    const map = new Map<string, OrderStatus>();
    for (const order of existingOrders) {
      const rows = flattenDocumentNodes(order.document.nodes);
      for (const row of rows) {
        if (row.node.type !== "line" && row.node.type !== "composite") continue;
        const key = normalizeName(row.node.title);
        if (!key) continue;
        const current = map.get(key) ?? { orderedQuantity: 0, pos: [] };
        current.orderedQuantity += Number((row.node as DocumentItemNode).quantity) || 0;
        if (!current.pos.some((entry) => entry.id === order.id)) {
          current.pos.push({ id: order.id, number: order.document.number });
        }
        map.set(key, current);
      }
    }
    return map;
  }, [existingOrders]);

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

      const aggregated = new Map<string, MaterialLineDraft>();
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
            existing.estimated_cost_ht = (existing.estimated_cost_ht ?? 0) + (material.estimated_purchase_cost_ht ?? 0);
            existing.taskCount += 1;
          } else {
            aggregated.set(key, {
              id: key,
              material_name: material.material_name,
              quantity: material.estimated_quantity,
              unit: material.ratio_unit,
              estimated_cost_ht: material.estimated_purchase_cost_ht,
              source: "auto",
              taskCount: 1,
              productId: material.product_id,
              supplierId,
              supplierName,
            });
          }
        }
      }

      setMaterialLines((current) => [
        ...Array.from(aggregated.values()).sort((a, b) => a.material_name.localeCompare(b.material_name, "fr")),
        ...current.filter((line) => line.source === "manual"),
      ]);

      if (aggregated.size === 0) {
        setError("Aucun ratio materiau compatible trouve sur les taches de ce chantier.");
      }
    } catch (err: any) {
      setError(err?.message ?? "Erreur generation liste materiaux.");
    } finally {
      setGenerating(false);
    }
  }

  function addManualLine() {
    const name = manualName.trim();
    if (!name) return;
    const quantity = toNumberOrNull(manualQuantity) ?? 1;
    setMaterialLines((current) => [
      ...current,
      {
        id: `manual-${Date.now()}`,
        material_name: name,
        quantity,
        unit: manualUnit.trim(),
        estimated_cost_ht: null,
        source: "manual",
        taskCount: 0,
        productId: null,
        supplierId: null,
        supplierName: null,
      },
    ]);
    setManualName("");
    setManualQuantity("1");
    setManualUnit("");
  }

  function removeLine(id: string) {
    setMaterialLines((current) => current.filter((line) => line.id !== id));
  }

  function updateLineQuantity(id: string, value: string) {
    const quantity = toNumberOrNull(value) ?? 0;
    setMaterialLines((current) => current.map((line) => (line.id === id ? { ...line, quantity } : line)));
  }

  async function createOrdersBySupplier() {
    if (materialLines.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const groups = new Map<string, { supplierId: string | null; supplierName: string | null; lines: MaterialLineDraft[] }>();
      for (const line of materialLines) {
        const key = line.supplierId ?? "__NONE__";
        const group = groups.get(key) ?? { supplierId: line.supplierId, supplierName: line.supplierName, lines: [] };
        group.lines.push(line);
        groups.set(key, group);
      }

      const created: Array<{ id: string; number: string; supplierName: string | null }> = [];
      for (const group of groups.values()) {
        const order = createPurchaseOrder({ chantierId, supplierId: group.supplierId, supplierName: group.supplierName });
        const lineNodes: DocumentItemNode[] = group.lines.map((line, index) => ({
          id: crypto.randomUUID(),
          type: "line",
          parentId: null,
          order: index,
          title: line.material_name,
          kind: "fourniture",
          quantity: line.quantity,
          unit: toDocumentUnit(line.unit),
          unitPriceHt:
            line.estimated_cost_ht !== null && line.quantity > 0
              ? Math.round((line.estimated_cost_ht / line.quantity) * 100) / 100
              : 0,
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
        created.push({ id: saved.id, number: saved.document.number, supplierName: saved.supplierName });
      }

      setCreatedOrders(created);
      setMaterialLines([]);
      setNotice(`${created.length} bon(s) de commande cree(s).`);
      await refreshBase();
    } catch (err: any) {
      setError(err?.message ?? "Erreur creation des bons de commande.");
    } finally {
      setCreating(false);
    }
  }

  const previewList = materialLines.length ? materialLines : null;

  const preview = (
    <div className="space-y-2">
      {loading ? (
        <div className="text-sm text-slate-500">Chargement...</div>
      ) : previewList ? (
        previewList.map((line) => <MaterialLineRow key={line.id} line={line} orderedByName={orderedByName} compact />)
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Aucune ligne calculee. Ouvre "Gerer les materiaux" pour lancer le calcul depuis les taches.
        </div>
      )}
    </div>
  );

  return (
    <ChantierChapterDrawer
      eyebrow="Preparation chantier"
      title="Materiaux"
      subtitle="Calcules a partir des ratios materiaux (bibliotheque de taches) x quantites des taches, ou ajoutes a la main."
      actionLabel="Gerer les materiaux"
      preview={preview}
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-slate-700">
            Chaque materiau relie a un produit catalogue est rattache a son fournisseur principal : "Creer les bons de
            commande" cree un bon par fournisseur.
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

        {materialLines.length > 0 ? (
          <div className="space-y-2">
            {materialLines.map((line) => (
              <MaterialLineRow
                key={line.id}
                line={line}
                orderedByName={orderedByName}
                onQuantityChange={(value) => updateLineQuantity(line.id, value)}
                onRemove={() => removeLine(line.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            Aucune ligne pour l'instant. Calcule depuis les taches ou ajoute une ligne manuellement.
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4">
          <label className="space-y-1 text-xs text-slate-600">
            <div>Ajouter manuellement</div>
            <input
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              placeholder="Designation"
              className="w-48 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <div>Qte</div>
            <input
              value={manualQuantity}
              onChange={(event) => setManualQuantity(event.target.value)}
              inputMode="decimal"
              className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <div>Unite</div>
            <input
              value={manualUnit}
              onChange={(event) => setManualUnit(event.target.value)}
              placeholder="u, m2, ml..."
              className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <button
            type="button"
            onClick={addManualLine}
            disabled={!manualName.trim()}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            + Ajouter la ligne
          </button>
          <button
            type="button"
            onClick={() => void createOrdersBySupplier()}
            disabled={materialLines.length === 0 || creating}
            className={[
              "ml-auto rounded-2xl px-5 py-3 text-sm font-semibold",
              materialLines.length === 0 || creating ? "bg-slate-200 text-slate-500" : "bg-emerald-600 text-white hover:bg-emerald-700",
            ].join(" ")}
          >
            {creating ? "Creation..." : "Creer les bons de commande"}
          </button>
        </div>
      </div>
    </ChantierChapterDrawer>
  );
}

function MaterialLineRow({
  line,
  orderedByName,
  onQuantityChange,
  onRemove,
  compact,
}: {
  line: MaterialLineDraft;
  orderedByName: Map<string, OrderStatus>;
  onQuantityChange?: (value: string) => void;
  onRemove?: () => void;
  compact?: boolean;
}) {
  const status = orderedByName.get(normalizeName(line.material_name));
  const orderedQuantity = status?.orderedQuantity ?? 0;
  const badge =
    orderedQuantity <= 0
      ? { label: "Pas commande", className: "border-slate-200 bg-slate-100 text-slate-600" }
      : orderedQuantity >= line.quantity
        ? { label: "Commande", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
        : { label: `Partiel (${orderedQuantity}/${line.quantity})`, className: "border-amber-200 bg-amber-50 text-amber-700" };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="min-w-[160px] flex-1">
        <div className="font-medium text-slate-950">{line.material_name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>
            {line.source === "auto" ? `Auto - ${line.taskCount} tache(s)` : "Ajout manuel"}
            {line.supplierName ? ` - ${line.supplierName}` : line.productId ? " - fournisseur non defini" : ""}
          </span>
          <span className={["rounded-full border px-2 py-0.5 font-semibold", badge.className].join(" ")}>{badge.label}</span>
        </div>
      </div>
      {onQuantityChange ? (
        <input
          value={line.quantity}
          onChange={(event) => onQuantityChange(event.target.value)}
          inputMode="decimal"
          className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
        />
      ) : (
        <span className="text-sm font-semibold text-slate-900">{line.quantity}</span>
      )}
      <span className="w-14 text-sm text-slate-500">{line.unit || "u"}</span>
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
  );
}
