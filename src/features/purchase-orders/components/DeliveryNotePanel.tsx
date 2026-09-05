import { useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { listPurchaseOrders } from "../infrastructure/purchaseOrderRepository";
import type { PurchaseOrderRecord } from "../domain/types";
import { listProductCatalogItems, saveProductCatalogItem, type ProductCatalogItem } from "../../product-catalog";
import { ProductQuickCreateModal, buildProductDraftFromQuickCreate } from "../../product-catalog/components/ProductQuickCreateModal";
import type { SupplierRow } from "../../../services/suppliers.service";
import {
  confirmDeliveryNote,
  extractDeliverySlip,
  listDeliveryNotes,
  type DeliveryNoteRecord,
  type DeliverySlipExtraction,
} from "../../../services/deliveryNotes.service";

function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const OPEN_STATUSES = new Set(["sent", "confirmed", "partially_delivered"]);

type ReviewLine = { designation: string; quantity: number; unit: string; productId: string | null };

export function DeliveryNotePanel({ suppliers }: { suppliers: SupplierRow[] }) {
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>([]);
  const [history, setHistory] = useState<DeliveryNoteRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<DeliverySlipExtraction | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [documentReference, setDocumentReference] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [lines, setLines] = useState<ReviewLine[]>([]);
  const [gapLine, setGapLine] = useState<{ index: number; materialName: string; unit: string } | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [productRows, orderRows, historyRows] = await Promise.all([
        listProductCatalogItems().catch(() => []),
        listPurchaseOrders().catch(() => []),
        listDeliveryNotes().catch(() => []),
      ]);
      setProducts(productRows);
      setOrders(orderRows);
      setHistory(historyRows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const productByNormalizedName = useMemo(() => {
    const map = new Map<string, ProductCatalogItem>();
    for (const product of products) map.set(normalizeName(product.designation), product);
    return map;
  }, [products]);

  const candidateOrders = useMemo(() => {
    const open = orders.filter((order) => OPEN_STATUSES.has(order.status));
    return open.sort((a, b) => {
      const aMatch = supplierId && a.supplierId === supplierId ? 0 : 1;
      const bMatch = supplierId && b.supplierId === supplierId ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
  }, [orders, supplierId]);

  async function onFileChange(nextFile: File | null) {
    setFile(nextFile);
    setExtraction(null);
    setError(null);
    setNotice(null);
    if (!nextFile) return;

    setExtracting(true);
    try {
      const result = await extractDeliverySlip(nextFile);
      setExtraction(result);

      const matchedSupplier = result.supplierName
        ? suppliers.find((supplier) => normalizeName(supplier.name).includes(normalizeName(result.supplierName!)) || normalizeName(result.supplierName!).includes(normalizeName(supplier.name)))
        : null;
      setSupplierId(matchedSupplier?.id ?? "");
      setDocumentReference(result.documentReference ?? "");
      setLines(
        result.lines.map((line) => ({
          designation: line.designation,
          quantity: line.quantity,
          unit: line.unit,
          productId: productByNormalizedName.get(normalizeName(line.designation))?.id ?? null,
        })),
      );

      const matchingOrders = orders.filter((order) => OPEN_STATUSES.has(order.status) && matchedSupplier && order.supplierId === matchedSupplier.id);
      setPurchaseOrderId(matchingOrders.length === 1 ? matchingOrders[0].id : "");

      if (!result.lines.length) {
        setError("Aucune ligne de materiau reconnue sur ce document. Verifie la photo ou saisis manuellement.");
      }
    } catch (err: any) {
      setError(err?.message ?? "Erreur lecture du document.");
    } finally {
      setExtracting(false);
    }
  }

  function updateLine(index: number, patch: Partial<ReviewLine>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function submitProductForLine(values: { designation: string; unit: string; supplierId: string; priceHt: number }) {
    if (!gapLine) return;
    setSavingProduct(true);
    setError(null);
    try {
      const draft = await buildProductDraftFromQuickCreate(values as any, suppliers);
      const saved = await saveProductCatalogItem(draft, "creation rapide bon de livraison");
      setProducts((current) => [...current, saved]);
      updateLine(gapLine.index, { productId: saved.id });
      setGapLine(null);
    } catch (err: any) {
      setError(err?.message ?? "Erreur creation produit.");
    } finally {
      setSavingProduct(false);
    }
  }

  function resetForm() {
    setFile(null);
    setExtraction(null);
    setSupplierId("");
    setDocumentReference("");
    setPurchaseOrderId("");
    setLines([]);
  }

  async function submitReception() {
    if (!lines.some((line) => line.productId)) {
      setError("Resous au moins un materiau avec un produit catalogue avant de valider.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const matchedOrder = purchaseOrderId ? orders.find((order) => order.id === purchaseOrderId) ?? null : null;
      const supplier = suppliers.find((row) => row.id === supplierId) ?? null;
      await confirmDeliveryNote({
        supplierId: supplier?.id ?? matchedOrder?.supplierId ?? null,
        supplierName: supplier?.name ?? matchedOrder?.supplierName ?? extraction?.supplierName ?? null,
        documentReference: documentReference.trim() || null,
        purchaseOrderId: matchedOrder?.id ?? null,
        chantierId: matchedOrder?.chantierId ?? null,
        storagePath: extraction?.storagePath ?? null,
        storageBucket: extraction?.storageBucket ?? null,
        lines,
      });
      setNotice(
        matchedOrder
          ? `Reception enregistree. ${matchedOrder.document.number} passe "Livre" et le stock est mis a jour.`
          : "Reception enregistree en stock (sans bon de commande rapproche).",
      );
      resetForm();
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? "Erreur enregistrement reception.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Achats fournisseurs</div>
        <h2 className="mt-1 text-lg font-bold text-slate-950">Bon de livraison</h2>
        <p className="mt-1 text-sm text-slate-500">
          Prends en photo ou uploade le bon de livraison recu : l'IA lit les lignes, propose le bon de commande
          correspondant, puis met a jour le stock et le statut de la commande une fois valide.
        </p>

        <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 px-4 py-8 text-sm font-medium text-blue-800 hover:bg-blue-50">
          <Upload className="h-5 w-5" />
          {file ? file.name : "Choisir une photo ou un PDF de bon de livraison"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(event) => void onFileChange(event.target.files?.[0] ?? null)}
          />
        </label>
        {extracting ? <div className="mt-3 text-sm text-slate-500">Lecture IA du document en cours...</div> : null}
      </div>

      {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}

      {extraction && lines.length ? (
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-xs text-slate-600">
              <div>Fournisseur</div>
              <select
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Non identifie</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
              {extraction.supplierName ? <div className="text-[11px] text-slate-400">Lu sur le document : {extraction.supplierName}</div> : null}
            </label>
            <label className="space-y-1 text-xs text-slate-600">
              <div>Reference document</div>
              <input
                value={documentReference}
                onChange={(event) => setDocumentReference(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-600">
              <div>Bon de commande a rapprocher</div>
              <select
                value={purchaseOrderId}
                onChange={(event) => setPurchaseOrderId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Sans bon de commande (imprevu)</option>
                {candidateOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.document.number} - {order.supplierName ?? "fournisseur ?"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={index} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  value={line.designation}
                  onChange={(event) => updateLine(index, { designation: event.target.value })}
                  className="min-w-[160px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
                <input
                  value={line.quantity}
                  onChange={(event) => updateLine(index, { quantity: Number(event.target.value.replace(",", ".")) || 0 })}
                  inputMode="decimal"
                  className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
                <span className="w-12 text-sm text-slate-500">{line.unit}</span>
                {line.productId ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    Produit resolu
                  </span>
                ) : (
                  <>
                    <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                      Produit non resolu
                    </span>
                    <button
                      type="button"
                      onClick={() => setGapLine({ index, materialName: line.designation, unit: line.unit })}
                      className="rounded-xl border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
                    >
                      Creer le produit
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Annuler
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void submitReception()}
              className={["rounded-2xl px-5 py-3 text-sm font-semibold", saving ? "bg-slate-200 text-slate-500" : "bg-emerald-600 text-white hover:bg-emerald-700"].join(" ")}
            >
              {saving ? "Enregistrement..." : "Valider la reception"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-950">Historique des receptions</div>
        {loading ? (
          <div className="mt-3 text-sm text-slate-500">Chargement...</div>
        ) : history.length ? (
          <div className="mt-3 space-y-2">
            {history.map((note) => (
              <div key={note.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-900">{note.supplierName ?? "Fournisseur non identifie"}</span>
                  {note.documentReference ? <span className="text-slate-500"> - {note.documentReference}</span> : null}
                  <span className="ml-2 text-xs text-slate-400">{note.lines.length} ligne(s)</span>
                </div>
                <span
                  className={[
                    "rounded-full border px-2 py-0.5 text-xs font-semibold",
                    note.status === "matched" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700",
                  ].join(" ")}
                >
                  {note.status === "matched" ? "Rapproche" : "Sans bon de commande"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-500">Aucune reception enregistree pour le moment.</div>
        )}
      </div>

      {gapLine ? (
        <ProductQuickCreateModal
          initial={gapLine}
          suppliers={suppliers}
          saving={savingProduct}
          onCancel={() => setGapLine(null)}
          onSubmit={(values) => void submitProductForLine(values)}
        />
      ) : null}
    </div>
  );
}
