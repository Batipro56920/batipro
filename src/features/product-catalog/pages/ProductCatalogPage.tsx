import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FileText, PackageSearch, Plus, RefreshCw, Trash2, X } from "lucide-react";
import type { SupplierRow } from "../../../services/suppliers.service";
import { listSuppliers } from "../../../services/suppliers.service";
import type { DocumentUnit } from "../../document-engine";
import ProductQuoteReaderPanel from "../components/ProductQuoteReaderPanel";
import type { ProductCatalogDraft, ProductCatalogItem, ProductDocumentKind, ProductKnowledge, ProductSupplierPrice } from "../domain/types";
import { deleteProductCatalogItem, listProductCatalogItems, saveProductCatalogItem } from "../infrastructure/productCatalogRepository";
import { analyzeProductDocumentsWithCoco, emptyProductKnowledge } from "../services/productKnowledge.service";
import { importProductsFromQuoteText, type ProductQuoteImportResult } from "../services/productQuoteImport.service";

const EMPTY_DRAFT: ProductCatalogDraft = {
  designation: "",
  internalReference: "",
  manufacturerReference: "",
  brand: "",
  category: "",
  unit: "u",
  vatRate: 20,
  mainSupplierId: null,
  mainSupplierName: null,
  standardPurchasePriceHt: 0,
  recommendedSalePriceHt: 0,
  targetMarginRate: 30,
  isSellable: true,
  supplierPrices: [],
  documents: [],
  knowledge: null,
};

export default function ProductCatalogPage() {
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [editing, setEditing] = useState<ProductCatalogItem | ProductCatalogDraft | null>(null);
  const [quoteReaderOpen, setQuoteReaderOpen] = useState(false);
  const [quoteImporting, setQuoteImporting] = useState(false);
  const [quoteImportResult, setQuoteImportResult] = useState<ProductQuoteImportResult | null>(null);

  useEffect(() => {
    listSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
    void refreshProducts();
  }, []);

  async function refreshProducts() {
    setLoading(true);
    setError(null);
    try {
      setProducts(await listProductCatalogItems());
    } catch (err: any) {
      setError(err?.message ?? "Chargement du catalogue produits impossible.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesText = !text || [product.designation, product.internalReference, product.manufacturerReference, product.brand, product.category]
        .some((value) => String(value ?? "").toLowerCase().includes(text));
      const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
      const matchesSupplier = supplierFilter === "all" || product.mainSupplierId === supplierFilter || product.supplierPrices.some((price) => price.supplierId === supplierFilter);
      const matchesBrand = brandFilter === "all" || product.brand === brandFilter;
      const matchesPrice = priceFilter === "all"
        || (priceFilter === "low" && product.standardPurchasePriceHt < 50)
        || (priceFilter === "mid" && product.standardPurchasePriceHt >= 50 && product.standardPurchasePriceHt < 250)
        || (priceFilter === "high" && product.standardPurchasePriceHt >= 250);
      return matchesText && matchesCategory && matchesSupplier && matchesBrand && matchesPrice;
    });
  }, [brandFilter, categoryFilter, priceFilter, products, query, supplierFilter]);

  const categories = unique(products.map((product) => product.category));
  const brands = unique(products.map((product) => product.brand));
  const stats = useMemo(() => ({
    products: products.length,
    suppliers: new Set(products.map((product) => product.mainSupplierId).filter(Boolean)).size,
    documents: products.reduce((sum, product) => sum + product.documents.length, 0),
    averagePurchase: products.length ? products.reduce((sum, product) => sum + product.standardPurchasePriceHt, 0) / products.length : 0,
  }), [products]);

  async function saveProduct(product: ProductCatalogItem | ProductCatalogDraft) {
    await saveProductCatalogItem(sanitizeProductCatalogInput(product));
    setProducts(await listProductCatalogItems());
    setEditing(null);
  }

  async function removeProduct(id: string) {
    if (!window.confirm("Supprimer ce produit du catalogue ?")) return;
    await deleteProductCatalogItem(id);
    setProducts(await listProductCatalogItems());
  }

  async function importQuoteProducts(text: string) {
    setQuoteImporting(true);
    setError(null);
    setQuoteImportResult(null);
    try {
      const result = await importProductsFromQuoteText(text, suppliers, products);
      const [nextProducts, nextSuppliers] = await Promise.all([
        listProductCatalogItems(),
        listSuppliers(),
      ]);
      setProducts(nextProducts);
      setSuppliers(nextSuppliers);
      setQuoteImportResult(result);
    } catch (err: any) {
      setError(err?.message ?? "Import du devis fournisseur impossible.");
    } finally {
      setQuoteImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Ressources</div>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">Catalogue produits</h1>
            <p className="mt-1 text-sm text-slate-500">Produits, prix fournisseurs, documents techniques et future alimentation des bons de commande.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void refreshProducts()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" /> Rafraîchir
            </button>
            <button type="button" onClick={() => setQuoteReaderOpen((open) => !open)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100">
              <FileText className="h-4 w-4" /> Lecteur devis
            </button>
            <button type="button" onClick={() => setEditing({ ...EMPTY_DRAFT })} className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> Nouveau produit
            </button>
          </div>
        </div>
      </header>

      {quoteReaderOpen ? (
        <ProductQuoteReaderPanel
          busy={quoteImporting}
          result={quoteImportResult}
          onImport={importQuoteProducts}
        />
      ) : null}

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Chargement du catalogue produits...</div> : null}

      {!loading ? <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Produits" value={String(stats.products)} />
        <Metric label="Fournisseurs liés" value={String(stats.suppliers)} />
        <Metric label="Documents" value={String(stats.documents)} />
        <Metric label="Prix achat moyen" value={formatCurrency(stats.averagePurchase)} />
      </section> : null}

      {!loading ? <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px_160px]">
          <input className={inputClass} placeholder="Rechercher désignation, référence, marque..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <Select value={categoryFilter} onChange={setCategoryFilter} options={["all", ...categories]} labels={{ all: "Toutes catégories" }} />
          <Select value={supplierFilter} onChange={setSupplierFilter} options={["all", ...suppliers.map((supplier) => supplier.id)]} labels={Object.fromEntries([["all", "Tous fournisseurs"], ...suppliers.map((supplier) => [supplier.id, supplier.name])])} />
          <Select value={brandFilter} onChange={setBrandFilter} options={["all", ...brands]} labels={{ all: "Toutes marques" }} />
          <Select value={priceFilter} onChange={setPriceFilter} options={["all", "low", "mid", "high"]} labels={{ all: "Tous prix", low: "< 50 EUR", mid: "50-250 EUR", high: "> 250 EUR" }} />
        </div>
      </section> : null}

      {!loading ? <section className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1120px] divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Marque</th>
              <th className="px-4 py-3">Fournisseur</th>
              <th className="px-4 py-3">Unité</th>
              <th className="px-4 py-3">Usage</th>
              <th className="px-4 py-3 text-right">Achat HT</th>
              <th className="px-4 py-3 text-right">Prix m²</th>
              <th className="px-4 py-3 text-right">Vente conseillée</th>
              <th className="px-4 py-3 text-right">Docs</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((product) => {
              const mainPrice = getMainSupplierPrice(product);
              return (
              <tr key={product.id} className="hover:bg-slate-50">
                <td className="max-w-[340px] px-4 py-3">
                  <div className="line-clamp-2 font-semibold text-slate-950">{product.designation}</div>
                  <div className="mt-1 text-xs text-slate-500">{product.internalReference || "-"} · Fab. {product.manufacturerReference || "-"}</div>
                  {mainPrice?.packaging || mainPrice?.coverageM2 ? (
                    <div className="mt-1 text-xs text-slate-500">
                      {mainPrice.packaging ? mainPrice.packaging : "Conditionnement"}
                      {mainPrice.coverageM2 ? ` · ${formatNumber(mainPrice.coverageM2)} m²` : ""}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-slate-600">{product.category || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{product.brand || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{product.mainSupplierName || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{product.unit}</td>
                <td className="px-4 py-3 text-slate-600">{product.isSellable ? "Acheté + vendable" : "Acheté uniquement"}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(product.standardPurchasePriceHt)}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatM2Price(product)}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(product.recommendedSalePriceHt)}</td>
                <td className="px-4 py-3 text-right">{product.documents.length}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button type="button" className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50" onClick={() => setEditing(product)}>Modifier</button>
                    <button type="button" className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50" onClick={() => removeProduct(product.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
            {!filtered.length ? <tr><td colSpan={11} className="px-4 py-12"><EmptyCatalogState onCreate={() => setEditing({ ...EMPTY_DRAFT })} /></td></tr> : null}
          </tbody>
        </table>
      </section> : null}

      {editing ? (
        <ProductDrawer product={editing} suppliers={suppliers} onCancel={() => setEditing(null)} onSave={saveProduct} />
      ) : null}
    </div>
  );
}

function ProductDrawer({ product, suppliers, onCancel, onSave }: { product: ProductCatalogItem | ProductCatalogDraft; suppliers: SupplierRow[]; onCancel: () => void; onSave: (product: ProductCatalogItem | ProductCatalogDraft) => void | Promise<void> }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 p-0 backdrop-blur-[2px] sm:p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fermer la fiche produit" onClick={onCancel} />
      <aside className="relative flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600">Catalogue produits</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Fiche produit</h2>
            <p className="mt-1 text-sm text-slate-500">Modification rapide sans quitter la liste.</p>
          </div>
          <button type="button" onClick={onCancel} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ProductForm product={product} suppliers={suppliers} onCancel={onCancel} onSave={onSave} />
        </div>
      </aside>
    </div>
  );
}

function ProductForm({ product, suppliers, onCancel, onSave }: { product: ProductCatalogItem | ProductCatalogDraft; suppliers: SupplierRow[]; onCancel: () => void; onSave: (product: ProductCatalogItem | ProductCatalogDraft) => void | Promise<void> }) {
  const [draft, setDraft] = useState(product);
  const [activeTab, setActiveTab] = useState<"product" | "knowledge">("product");
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(product);
    setActiveTab("product");
    setKnowledgeLoading(false);
    setKnowledgeError(null);
  }, [product]);

  function patch(patch: Partial<ProductCatalogItem | ProductCatalogDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function selectMainSupplier(id: string) {
    const supplier = suppliers.find((row) => row.id === id);
    patch({ mainSupplierId: supplier?.id ?? null, mainSupplierName: supplier?.name ?? null });
  }

  async function analyzeKnowledge(nextDraft: ProductCatalogItem | ProductCatalogDraft) {
    setKnowledgeLoading(true);
    setKnowledgeError(null);
    try {
      const knowledge = await analyzeProductDocumentsWithCoco(nextDraft);
      setDraft((current) => ({ ...current, knowledge }));
    } catch (err: any) {
      setKnowledgeError(err?.message ?? "Analyse Coco produit impossible.");
    } finally {
      setKnowledgeLoading(false);
    }
  }

  function updateDocuments(documents: ProductCatalogItem["documents"]) {
    const nextDraft = { ...draft, documents };
    setDraft(nextDraft);
    if (documents.length !== draft.documents.length) void analyzeKnowledge(nextDraft);
  }

  return (
    <div className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">Informations produit</h3>
          <p className="mt-1 text-sm text-slate-500">Prix fournisseurs, documents techniques et usage catalogue.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={onCancel}>Annuler</button>
          <button type="button" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800" onClick={() => onSave(draft)}>Enregistrer</button>
        </div>
      </div>

      <div className="mb-4 flex gap-2 border-b border-slate-200">
        <button type="button" className={tabClass(activeTab === "product")} onClick={() => setActiveTab("product")}>Produit</button>
        <button type="button" className={tabClass(activeTab === "knowledge")} onClick={() => setActiveTab("knowledge")}>Connaissance IA</button>
      </div>

      {activeTab === "product" ? (
        <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Désignation" value={draft.designation} onChange={(designation) => patch({ designation })} className="xl:col-span-2" />
        <Field label="Référence interne" value={draft.internalReference ?? ""} onChange={(internalReference) => patch({ internalReference })} />
        <Field label="Référence fabricant" value={draft.manufacturerReference ?? ""} onChange={(manufacturerReference) => patch({ manufacturerReference })} />
        <Field label="Marque" value={draft.brand ?? ""} onChange={(brand) => patch({ brand })} />
        <Field label="Catégorie" value={draft.category ?? ""} onChange={(category) => patch({ category })} />
        <label className={labelClass}>Unité<Select className="mt-1" value={draft.unit} onChange={(unit) => patch({ unit: unit as DocumentUnit })} options={["u", "h", "ml", "m2", "m3", "forfait", "kg", "l"]} /></label>
        <NumberField label="TVA" value={draft.vatRate} onChange={(vatRate) => patch({ vatRate })} />
        <label className={labelClass}>Fournisseur principal<Select className="mt-1" value={draft.mainSupplierId ?? ""} onChange={selectMainSupplier} options={["", ...suppliers.map((supplier) => supplier.id)]} labels={Object.fromEntries([["", "Aucun"], ...suppliers.map((supplier) => [supplier.id, supplier.name])])} /></label>
        <NumberField label="Prix achat standard" value={draft.standardPurchasePriceHt} onChange={(standardPurchasePriceHt) => patch({ standardPurchasePriceHt })} />
        <NumberField label="Prix vente conseillé" value={draft.recommendedSalePriceHt} onChange={(recommendedSalePriceHt) => patch({ recommendedSalePriceHt })} />
        <NumberField label="Marge cible %" value={draft.targetMarginRate} onChange={(targetMarginRate) => patch({ targetMarginRate })} />
        <label className={`${labelClass} flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 normal-case tracking-normal text-slate-700`}>
          <input type="checkbox" checked={draft.isSellable} onChange={(event) => patch({ isSellable: event.target.checked })} />
          <span>Produit revendable / utilisable dans un ouvrage</span>
        </label>
      </div>

      <SupplierPricesEditor prices={draft.supplierPrices} suppliers={suppliers} onChange={(supplierPrices) => patch({ supplierPrices })} />
      <ProductDocumentsEditor documents={draft.documents} busy={knowledgeLoading} error={knowledgeError} onAnalyze={() => void analyzeKnowledge(draft)} onChange={updateDocuments} />
        </>
      ) : (
        <ProductKnowledgeEditor
          knowledge={draft.knowledge ?? emptyProductKnowledge(draft)}
          busy={knowledgeLoading}
          error={knowledgeError}
          onAnalyze={() => void analyzeKnowledge(draft)}
          onChange={(knowledge) => patch({ knowledge })}
        />
      )}
    </div>
  );
}

function SupplierPricesEditor({ prices, suppliers, onChange }: { prices: ProductSupplierPrice[]; suppliers: SupplierRow[]; onChange: (prices: ProductSupplierPrice[]) => void }) {
  function addPrice() {
    onChange([...prices, { id: crypto.randomUUID(), supplierId: null, supplierName: "", priceHt: 0, discountPercent: null, startDate: null, endDate: null, packaging: null, minimumQuantity: null, deliveryLeadTimeDays: null, coverageM2: null, pricePerM2Ht: null }]);
  }

  function updatePrice(id: string, patch: Partial<ProductSupplierPrice>) {
    onChange(prices.map((price) => price.id === id ? { ...price, ...patch } : price));
  }

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="font-semibold text-slate-950">Prix négociés par fournisseur</div>
        <button type="button" className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={addPrice}>Ajouter prix</button>
      </div>
      <div className="grid gap-3">
        {prices.map((price) => (
          <div key={price.id} className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-4 xl:grid-cols-10">
            <Select value={price.supplierId ?? ""} onChange={(supplierId) => {
              const supplier = suppliers.find((row) => row.id === supplierId);
              updatePrice(price.id, { supplierId: supplier?.id ?? null, supplierName: supplier?.name ?? "" });
            }} options={["", ...suppliers.map((supplier) => supplier.id)]} labels={Object.fromEntries([["", "Fournisseur"], ...suppliers.map((supplier) => [supplier.id, supplier.name])])} />
            <SmallNumber value={price.priceHt} onChange={(priceHt) => updatePrice(price.id, { priceHt, pricePerM2Ht: price.coverageM2 ? priceHt : price.pricePerM2Ht ?? null })} placeholder="Prix HT" />
            <SmallNumber value={price.coverageM2 ?? 0} onChange={(coverageM2) => updatePrice(price.id, { coverageM2, pricePerM2Ht: coverageM2 > 0 ? price.priceHt : null })} placeholder="m²/colis" />
            <SmallNumber value={price.pricePerM2Ht ?? 0} onChange={(pricePerM2Ht) => updatePrice(price.id, { pricePerM2Ht })} placeholder="Prix m²" />
            <SmallNumber value={price.discountPercent ?? 0} onChange={(discountPercent) => updatePrice(price.id, { discountPercent })} placeholder="Remise %" />
            <input className={inputClass} type="date" value={price.startDate ?? ""} onChange={(event) => updatePrice(price.id, { startDate: event.target.value || null })} />
            <input className={inputClass} type="date" value={price.endDate ?? ""} onChange={(event) => updatePrice(price.id, { endDate: event.target.value || null })} />
            <input className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-950 outline-none focus:border-blue-300 xl:col-span-2" placeholder="Conditionnement" value={price.packaging ?? ""} onChange={(event) => updatePrice(price.id, { packaging: event.target.value || null })} />
            <SmallNumber value={price.deliveryLeadTimeDays ?? 0} onChange={(deliveryLeadTimeDays) => updatePrice(price.id, { deliveryLeadTimeDays })} placeholder="Délai j" />
          </div>
        ))}
        {!prices.length ? <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Aucun prix négocié pour le moment.</div> : null}
      </div>
    </div>
  );
}

function ProductDocumentsEditor({
  documents,
  busy,
  error,
  onAnalyze,
  onChange,
}: {
  documents: ProductCatalogItem["documents"];
  busy: boolean;
  error: string | null;
  onAnalyze: () => void;
  onChange: (documents: ProductCatalogItem["documents"]) => void;
}) {
  function addDocument(kind: ProductDocumentKind) {
    onChange([...documents, { id: crypto.randomUUID(), kind, name: documentKindLabel(kind), url: null }]);
  }

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-950">Documents liés</div>
          <div className="mt-1 text-xs text-slate-500">{busy ? "Coco analyse les documents produit..." : "Chaque ajout relance l'analyse de connaissance IA."}</div>
          {error ? <div className="mt-1 text-xs font-semibold text-red-600">{error}</div> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60" onClick={onAnalyze} disabled={busy}>
            {busy ? "Analyse..." : "Analyser avec Coco"}
          </button>
          {(["technical_sheet", "manual", "sds", "certification", "photo", "other"] as const).map((kind) => (
            <button key={kind} type="button" className="rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-slate-50" onClick={() => addDocument(kind)}>
              <FileText className="mr-1 inline h-3.5 w-3.5" /> {documentKindLabel(kind)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {documents.map((document) => (
          <div key={document.id} className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{documentKindLabel(document.kind)}</div>
            <input className={`${inputClass} mt-2`} value={document.name} onChange={(event) => onChange(documents.map((row) => row.id === document.id ? { ...row, name: event.target.value } : row))} />
          </div>
        ))}
        {!documents.length ? <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Aucun document lié.</div> : null}
      </div>
    </div>
  );
}

function ProductKnowledgeEditor({
  knowledge,
  busy,
  error,
  onAnalyze,
  onChange,
}: {
  knowledge: ProductKnowledge;
  busy: boolean;
  error: string | null;
  onAnalyze: () => void;
  onChange: (knowledge: ProductKnowledge) => void;
}) {
  function updateBlock<K extends keyof ProductKnowledge>(key: K, patch: Partial<ProductKnowledge[K]>) {
    onChange({ ...knowledge, [key]: { ...knowledge[key], ...patch } });
  }

  function updateValue<K extends keyof ProductKnowledge>(key: K, value: ProductKnowledge[K]["value"]) {
    updateBlock(key, { value } as Partial<ProductKnowledge[K]>);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-950">Connaissance IA produit</div>
            <div className="mt-1 text-xs text-slate-500">Source métier persistante utilisée ensuite par les templates, sans relire les documents.</div>
          </div>
          <button type="button" className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60" onClick={onAnalyze} disabled={busy}>
            {busy ? "Coco analyse..." : "Analyser les documents"}
          </button>
        </div>
        {error ? <div className="mt-3 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600">{error}</div> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <JsonKnowledgeBlock title="Identité" block={knowledge.identity} onValueChange={(value) => updateValue("identity", value as ProductKnowledge["identity"]["value"])} onMetaChange={(patch) => updateBlock("identity", patch)} />
        <JsonKnowledgeBlock title="Fournisseur" block={knowledge.supplier} onValueChange={(value) => updateValue("supplier", value as ProductKnowledge["supplier"]["value"])} onMetaChange={(patch) => updateBlock("supplier", patch)} />
        <JsonKnowledgeBlock title="Prix" block={knowledge.pricing} onValueChange={(value) => updateValue("pricing", value as ProductKnowledge["pricing"]["value"])} onMetaChange={(patch) => updateBlock("pricing", patch)} />
        <JsonKnowledgeBlock title="Ratio / consommation" block={knowledge.materialUsage} onValueChange={(value) => updateValue("materialUsage", value as ProductKnowledge["materialUsage"]["value"])} onMetaChange={(patch) => updateBlock("materialUsage", patch)} />
        <JsonKnowledgeBlock title="Application" block={knowledge.application} onValueChange={(value) => updateValue("application", value as ProductKnowledge["application"]["value"])} onMetaChange={(patch) => updateBlock("application", patch)} />
        <JsonKnowledgeBlock title="Limites météo" block={knowledge.weatherLimits} onValueChange={(value) => updateValue("weatherLimits", value as ProductKnowledge["weatherLimits"]["value"])} onMetaChange={(patch) => updateBlock("weatherLimits", patch)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ListKnowledgeBlock title="Supports" block={knowledge.supports} onValueChange={(value) => updateValue("supports", value)} onMetaChange={(patch) => updateBlock("supports", patch)} />
        <ListKnowledgeBlock title="Supports interdits" block={knowledge.forbiddenSupports} onValueChange={(value) => updateValue("forbiddenSupports", value)} onMetaChange={(patch) => updateBlock("forbiddenSupports", patch)} />
        <ListKnowledgeBlock title="Outils" block={knowledge.tools} onValueChange={(value) => updateValue("tools", value)} onMetaChange={(patch) => updateBlock("tools", patch)} />
        <ListKnowledgeBlock title="Consommables" block={knowledge.consumables} onValueChange={(value) => updateValue("consumables", value)} onMetaChange={(patch) => updateBlock("consumables", patch)} />
        <ListKnowledgeBlock title="EPI" block={knowledge.PPE} onValueChange={(value) => updateValue("PPE", value)} onMetaChange={(patch) => updateBlock("PPE", patch)} />
        <ListKnowledgeBlock title="Temps de séchage" block={knowledge.dryingTimes} onValueChange={(value) => updateValue("dryingTimes", value)} onMetaChange={(patch) => updateBlock("dryingTimes", patch)} />
        <ListKnowledgeBlock title="Mode opératoire" block={knowledge.procedure} onValueChange={(value) => updateValue("procedure", value)} onMetaChange={(patch) => updateBlock("procedure", patch)} />
        <ListKnowledgeBlock title="Contrôles" block={knowledge.controls} onValueChange={(value) => updateValue("controls", value)} onMetaChange={(patch) => updateBlock("controls", patch)} />
        <ListKnowledgeBlock title="Erreurs à éviter" block={knowledge.commonMistakes} onValueChange={(value) => updateValue("commonMistakes", value)} onMetaChange={(patch) => updateBlock("commonMistakes", patch)} />
        <ListKnowledgeBlock title="DOE" block={knowledge.doe} onValueChange={(value) => updateValue("doe", value)} onMetaChange={(patch) => updateBlock("doe", patch)} />
        <ListKnowledgeBlock title="Retours terrain" block={knowledge.fieldExperience} onValueChange={(value) => updateValue("fieldExperience", value)} onMetaChange={(patch) => updateBlock("fieldExperience", patch)} />
        <JsonKnowledgeBlock title="Confiance globale" block={knowledge.confidence} onValueChange={(value) => updateValue("confidence", value as ProductKnowledge["confidence"]["value"])} onMetaChange={(patch) => updateBlock("confidence", patch)} />
      </div>
    </div>
  );
}

type KnowledgeBlockMeta = {
  confidence: "high" | "medium" | "low";
  reasoning: string;
  sourceDocument: string | null;
};

function JsonKnowledgeBlock({
  title,
  block,
  onValueChange,
  onMetaChange,
}: {
  title: string;
  block: KnowledgeBlockMeta & { value: unknown };
  onValueChange: (value: unknown) => void;
  onMetaChange: (patch: Partial<KnowledgeBlockMeta>) => void;
}) {
  const [parseError, setParseError] = useState<string | null>(null);
  const serializedValue = JSON.stringify(block.value, null, 2);

  return (
    <KnowledgeShell title={title} block={block} onMetaChange={onMetaChange}>
      <textarea
        key={serializedValue}
        className={`${textareaClass} font-mono text-xs`}
        rows={8}
        defaultValue={serializedValue}
        onBlur={(event) => {
          try {
            onValueChange(JSON.parse(event.currentTarget.value));
            setParseError(null);
          } catch {
            setParseError("JSON invalide : correction non enregistrée pour ce bloc.");
          }
        }}
      />
      {parseError ? <div className="mt-1 text-xs font-semibold text-red-600">{parseError}</div> : null}
    </KnowledgeShell>
  );
}

function ListKnowledgeBlock({
  title,
  block,
  onValueChange,
  onMetaChange,
}: {
  title: string;
  block: KnowledgeBlockMeta & { value: string[] };
  onValueChange: (value: string[]) => void;
  onMetaChange: (patch: Partial<KnowledgeBlockMeta>) => void;
}) {
  return (
    <KnowledgeShell title={title} block={block} onMetaChange={onMetaChange}>
      <textarea
        className={textareaClass}
        rows={7}
        value={block.value.join("\n")}
        onChange={(event) => onValueChange(splitLines(event.target.value))}
        placeholder="Une ligne par information exploitable"
      />
    </KnowledgeShell>
  );
}

function KnowledgeShell({
  title,
  block,
  children,
  onMetaChange,
}: {
  title: string;
  block: KnowledgeBlockMeta;
  children: ReactNode;
  onMetaChange: (patch: Partial<KnowledgeBlockMeta>) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 p-4">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-semibold text-slate-950">{title}</div>
          <input className={`${inputClass} mt-2`} value={block.sourceDocument ?? ""} onChange={(event) => onMetaChange({ sourceDocument: event.target.value || null })} placeholder="Document source" />
        </div>
        <select className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700" value={block.confidence} onChange={(event) => onMetaChange({ confidence: event.target.value as KnowledgeBlockMeta["confidence"] })}>
          <option value="high">Confiance haute</option>
          <option value="medium">Confiance moyenne</option>
          <option value="low">Confiance basse</option>
        </select>
      </div>
      {children}
      <textarea className={`${textareaClass} mt-2`} rows={2} value={block.reasoning} onChange={(event) => onMetaChange({ reasoning: event.target.value })} placeholder="Raisonnement / source / point à vérifier" />
    </section>
  );
}

function Field({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return <label className={`${labelClass} ${className}`}>{label}<input className={`${inputClass} mt-1`} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className={labelClass}>{label}<SmallNumber className="mt-1" value={value} onChange={onChange} /></label>;
}

function SmallNumber({ value, onChange, placeholder, className = "" }: { value: number; onChange: (value: number) => void; placeholder?: string; className?: string }) {
  const [text, setText] = useState(formatNumberInputValue(value));

  useEffect(() => {
    setText(formatNumberInputValue(value));
  }, [value]);

  return (
    <input
      className={`${inputClass} ${className}`}
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onChange={(event) => {
        const nextText = event.target.value;
        const nextValue = parseFrenchNumber(nextText);
        setText(nextText);
        if (nextValue !== null) onChange(nextValue);
      }}
      onBlur={() => {
        const nextValue = parseFrenchNumber(text);
        setText(formatNumberInputValue(nextValue ?? value));
      }}
    />
  );
}

function Select({ value, onChange, options, labels = {}, className = "" }: { value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string>; className?: string }) {
  return (
    <select className={`${inputClass} ${className}`} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option} value={option}>{labels[option] ?? option}</option>)}
    </select>
  );
}

function unique(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function documentKindLabel(kind: ProductDocumentKind) {
  if (kind === "technical_sheet") return "Fiche technique";
  if (kind === "manual") return "Notice";
  if (kind === "sds") return "FDS";
  if (kind === "certification") return "Certification";
  if (kind === "photo") return "Photo";
  return "Autre";
}

function sanitizeProductCatalogInput<T extends ProductCatalogItem | ProductCatalogDraft>(product: T): T {
  return {
    ...product,
    vatRate: nonNegativeNumber(product.vatRate, 20),
    standardPurchasePriceHt: nonNegativeNumber(product.standardPurchasePriceHt, 0),
    recommendedSalePriceHt: nonNegativeNumber(product.recommendedSalePriceHt, 0),
    targetMarginRate: nonNegativeNumber(product.targetMarginRate, 0),
    supplierPrices: product.supplierPrices.map((price) => ({
      ...price,
      priceHt: nonNegativeNumber(price.priceHt, 0),
      discountPercent: nullableNonNegativeNumber(price.discountPercent),
      minimumQuantity: nullableNonNegativeNumber(price.minimumQuantity),
      deliveryLeadTimeDays: nullableNonNegativeNumber(price.deliveryLeadTimeDays),
      coverageM2: nullableNonNegativeNumber(price.coverageM2),
      pricePerM2Ht: nullableNonNegativeNumber(price.pricePerM2Ht),
    })),
  };
}

function nonNegativeNumber(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : parseFrenchNumber(String(value ?? ""));
  return number !== null && number >= 0 ? number : fallback;
}

function nullableNonNegativeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : parseFrenchNumber(String(value));
  return number !== null && number >= 0 ? number : null;
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function tabClass(active: boolean) {
  return [
    "border-b-2 px-3 py-2 text-sm font-semibold",
    active ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-900",
  ].join(" ");
}

const labelClass = "block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400";
const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-950 outline-none focus:border-blue-300";
const textareaClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-950 outline-none focus:border-blue-300";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-2 text-xl font-bold text-slate-950">{value}</div>
    </div>
  );
}

function EmptyCatalogState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mx-auto max-w-sm text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><PackageSearch className="h-5 w-5" /></div>
      <div className="mt-3 font-semibold text-slate-950">Aucun produit trouvé</div>
      <div className="mt-1 text-sm text-slate-500">Ajustez vos filtres ou créez une fiche produit.</div>
      <button type="button" onClick={onCreate} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Nouveau produit</button>
    </div>
  );
}

function getMainSupplierPrice(product: ProductCatalogItem): ProductSupplierPrice | null {
  const mainSupplierPrice = product.mainSupplierId
    ? product.supplierPrices.find((price) => price.supplierId === product.mainSupplierId)
    : null;
  return mainSupplierPrice ?? product.supplierPrices[0] ?? null;
}

function formatM2Price(product: ProductCatalogItem) {
  const supplierPrice = getMainSupplierPrice(product);
  const pricePerM2 = supplierPrice?.pricePerM2Ht ?? (product.unit === "m2" ? product.standardPurchasePriceHt : null);
  return pricePerM2 && pricePerM2 > 0 ? `${formatCurrency(pricePerM2)}/m²` : "-";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}

function parseFrenchNumber(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  if (/[,.]$/.test(text)) return null;

  const compact = text.replace(/[\s\u00a0\u202f]/g, "");
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let normalized = compact;

  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = compact.replace(",", ".");
  } else if (lastDot >= 0 && looksLikeThousandsGroups(compact, ".")) {
    normalized = compact.replace(/\./g, "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function looksLikeThousandsGroups(value: string, separator: string): boolean {
  const parts = value.split(separator);
  if (parts.length < 2) return false;
  const [first, ...rest] = parts;
  return first.length >= 1
    && first.length <= 3
    && rest.every((part) => /^\d{3}$/.test(part));
}

function formatNumberInputValue(value: number) {
  return Number.isFinite(value) ? String(value).replace(".", ",") : "0";
}
