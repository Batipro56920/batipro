import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FileText, PackageSearch, Plus, RefreshCw, Trash2, X } from "lucide-react";
import type { SupplierRow } from "../../../services/suppliers.service";
import { listSuppliers } from "../../../services/suppliers.service";
import type { DocumentUnit } from "../../document-engine";
import ProductFileImportPanel from "../components/ProductFileImportPanel";
import ProductQuoteReaderPanel from "../components/ProductQuoteReaderPanel";
import type {
  ProductCatalogDraft,
  ProductCatalogItem,
  ProductDocumentKind,
  ProductDocumentUsage,
  ProductKnowledge,
  ProductSupplierPrice,
} from "../domain/types";
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

const PRODUCT_DOCUMENT_KINDS: ProductDocumentKind[] = [
  "technical_sheet",
  "manual",
  "application_scope",
  "work_method",
  "sds",
  "certification",
  "photo",
  "other",
];

export default function ProductCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const catalogQueryParam = searchParams.get("q") ?? "";
  const catalogSupplierIdParam = searchParams.get("supplierId") ?? "";
  const activeProductId = searchParams.get("productId") ?? "";
  const openedProductFromUrlRef = useRef("");
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(catalogQueryParam);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState(catalogSupplierIdParam || "all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [editing, setEditing] = useState<ProductCatalogItem | ProductCatalogDraft | null>(null);
  const [quoteReaderOpen, setQuoteReaderOpen] = useState(false);
  const [quoteImporting, setQuoteImporting] = useState(false);
  const [quoteImportResult, setQuoteImportResult] = useState<ProductQuoteImportResult | null>(null);
  const activeProduct = useMemo(
    () => (activeProductId ? products.find((row) => row.id === activeProductId) ?? null : null),
    [activeProductId, products],
  );
  const activeProductMissing = Boolean(activeProductId && !loading && !activeProduct);
  const activeSupplier = useMemo(
    () => (catalogSupplierIdParam ? suppliers.find((row) => row.id === catalogSupplierIdParam) ?? null : null),
    [catalogSupplierIdParam, suppliers],
  );
  const activeCatalogFilters = Boolean(query.trim() || catalogSupplierIdParam);

  useEffect(() => {
    listSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
    void refreshProducts();
  }, []);

  useEffect(() => {
    setQuery((current) => current === catalogQueryParam ? current : catalogQueryParam);
  }, [catalogQueryParam]);

  useEffect(() => {
    setSupplierFilter((current) => {
      const nextSupplierFilter = catalogSupplierIdParam || "all";
      return current === nextSupplierFilter ? current : nextSupplierFilter;
    });
  }, [catalogSupplierIdParam]);

  useEffect(() => {
    if (!catalogSupplierIdParam || !suppliers.length) return;
    if (suppliers.some((supplier) => supplier.id === catalogSupplierIdParam)) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("supplierId");
    setSearchParams(nextParams, { replace: true });
  }, [catalogSupplierIdParam, searchParams, setSearchParams, suppliers]);

  useEffect(() => {
    if (!activeProductId) {
      openedProductFromUrlRef.current = "";
      return;
    }
    if (loading || openedProductFromUrlRef.current === activeProductId) return;
    if (!activeProduct) return;

    setCategoryFilter("all");
    setSupplierFilter("all");
    setBrandFilter("all");
    setPriceFilter("all");
    setEditing(activeProduct);
    openedProductFromUrlRef.current = activeProductId;
  }, [activeProduct, activeProductId, loading]);

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
    const text = query.trim().toLocaleLowerCase("fr-FR");
    return products.filter((product) => {
      const matchesText = !text || [
        product.designation,
        product.internalReference,
        product.manufacturerReference,
        product.brand,
        product.category,
        product.mainSupplierName,
        ...product.supplierPrices.map((price) => price.supplierName),
      ].some((value) => String(value ?? "").toLocaleLowerCase("fr-FR").includes(text));
      const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
      const matchesSupplier = supplierFilter === "all" || product.mainSupplierId === supplierFilter || product.supplierPrices.some((price) => price.supplierId === supplierFilter);
      const matchesBrand = brandFilter === "all" || product.brand === brandFilter;
      const purchasePrice = getPurchasePackagePrice(product, supplierFilter);
      const matchesPrice = priceFilter === "all"
        || (priceFilter === "low" && purchasePrice < 50)
        || (priceFilter === "mid" && purchasePrice >= 50 && purchasePrice < 250)
        || (priceFilter === "high" && purchasePrice >= 250);
      return matchesText && matchesCategory && matchesSupplier && matchesBrand && matchesPrice;
    });
  }, [brandFilter, categoryFilter, priceFilter, products, query, supplierFilter]);

  const categories = unique(products.map((product) => product.category));
  const brands = unique(products.map((product) => product.brand));

  async function saveProduct(product: ProductCatalogItem | ProductCatalogDraft) {
    await saveProductCatalogItem(sanitizeProductCatalogInput(product));
    setProducts(await listProductCatalogItems());
    closeProductDrawer();
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

  function clearActiveProductParam() {
    if (!activeProductId) return;
    openedProductFromUrlRef.current = "";
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("productId");
    setSearchParams(nextParams, { replace: true });
  }

  function openProductDrawer(product: ProductCatalogItem | ProductCatalogDraft) {
    setEditing(product);
    clearActiveProductParam();
  }

  function closeProductDrawer() {
    setEditing(null);
    clearActiveProductParam();
  }

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    const nextParams = new URLSearchParams(searchParams);
    const trimmed = nextQuery.trim();
    nextParams.delete("productId");
    if (trimmed) {
      nextParams.set("q", trimmed);
    } else {
      nextParams.delete("q");
    }
    setSearchParams(nextParams, { replace: true });
  }

  function updateSupplierFilter(nextSupplierId: string) {
    setSupplierFilter(nextSupplierId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("productId");
    if (nextSupplierId && nextSupplierId !== "all") {
      nextParams.set("supplierId", nextSupplierId);
    } else {
      nextParams.delete("supplierId");
    }
    setSearchParams(nextParams, { replace: true });
  }

  function resetCatalogUrlFilters() {
    setQuery("");
    setSupplierFilter("all");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("q");
    nextParams.delete("supplierId");
    nextParams.delete("productId");
    setSearchParams(nextParams, { replace: true });
  }

  function describeActiveCatalogFilters() {
    const trimmedQuery = query.trim();
    if (trimmedQuery && activeSupplier) return `Catalogue filtré sur « ${trimmedQuery} » et le fournisseur ${activeSupplier.name}.`;
    if (activeSupplier) return `Catalogue filtré sur le fournisseur ${activeSupplier.name}.`;
    if (trimmedQuery) return `Catalogue filtré sur « ${trimmedQuery} »${activeProductId ? " depuis la recherche globale" : ""}.`;
    return "Catalogue filtré par fournisseur.";
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
            <button type="button" onClick={() => openProductDrawer({ ...EMPTY_DRAFT })} className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
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

      {!loading ? <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px_160px]">
          <input className={inputClass} placeholder="Rechercher désignation, référence, marque..." value={query} onChange={(event) => updateQuery(event.target.value)} />
          <Select value={categoryFilter} onChange={setCategoryFilter} options={["all", ...categories]} labels={{ all: "Toutes catégories" }} />
          <Select value={supplierFilter} onChange={updateSupplierFilter} options={["all", ...suppliers.map((supplier) => supplier.id)]} labels={Object.fromEntries([["all", "Tous fournisseurs"], ...suppliers.map((supplier) => [supplier.id, supplier.name])])} />
          <Select value={brandFilter} onChange={setBrandFilter} options={["all", ...brands]} labels={{ all: "Toutes marques" }} />
          <Select value={priceFilter} onChange={setPriceFilter} options={["all", "low", "mid", "high"]} labels={{ all: "Tous prix colis", low: "< 50 EUR", mid: "50-250 EUR", high: "> 250 EUR" }} />
        </div>
        {activeCatalogFilters ? (
          <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800 sm:flex-row sm:items-center sm:justify-between">
            <span>{describeActiveCatalogFilters()}</span>
            <button type="button" className="self-start rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 sm:self-auto" onClick={resetCatalogUrlFilters}>Réinitialiser</button>
          </div>
        ) : null}
      </section> : null}

      {!loading && activeProductId ? (
        <div className={[
          "rounded-2xl border p-4 text-sm",
          activeProductMissing ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900",
        ].join(" ")}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">
                {activeProductMissing ? "Produit introuvable" : "Produit ouvert depuis la recherche globale"}
              </div>
              <p className={activeProductMissing ? "mt-1 text-amber-800" : "mt-1 text-blue-800"}>
                {activeProductMissing
                  ? "Le lien pointe vers une fiche supprimée ou non accessible avec les droits actuels."
                  : `${activeProduct?.designation ?? "Le produit"} est sélectionné et prêt à être contrôlé ou mis à jour.`}
              </p>
            </div>
            <button
              type="button"
              onClick={clearActiveProductParam}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              Retirer le ciblage
            </button>
          </div>
        </div>
      ) : null}

      {!loading ? <section className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1040px] divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Marque</th>
              <th className="px-4 py-3">Fournisseur</th>
              <th className="px-4 py-3">Unité</th>
              <th className="px-4 py-3 text-right">Achat colis HT</th>
              <th className="px-4 py-3 text-right">Prix à l'unité</th>
              <th className="px-4 py-3 text-right">Vente conseillée</th>
              <th className="px-4 py-3 text-right">Docs</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((product) => {
              const orderSupplierId = getOrderSupplierId(product, supplierFilter);
              const displayedSupplierPrice = getDisplayedSupplierPrice(product, supplierFilter);
              const usesFilteredSupplierPrice = supplierFilter !== "all" && displayedSupplierPrice?.supplierId === supplierFilter && product.mainSupplierId !== supplierFilter;
              return (
              <tr key={product.id} className={product.id === activeProductId ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : "hover:bg-slate-50"}>
                <td className="max-w-[440px] whitespace-normal px-4 py-3 align-top">
                  <div className="font-semibold leading-snug text-slate-950">{product.designation}</div>
                </td>
                <td className="px-4 py-3 align-top text-slate-600">{product.category || "-"}</td>
                <td className="px-4 py-3 align-top text-slate-600">{product.brand || "-"}</td>
                <td className="px-4 py-3 align-top text-slate-600">
                  <div className="space-y-1">
                    {product.mainSupplierId && product.mainSupplierName ? (
                      <Link
                        to={`/fournisseurs?supplierId=${encodeURIComponent(product.mainSupplierId)}`}
                        className="font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        {product.mainSupplierName}
                      </Link>
                    ) : product.mainSupplierName || "-"}
                    {usesFilteredSupplierPrice ? (
                      <div className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        Prix négocié {displayedSupplierPrice?.supplierName || activeSupplier?.name || "fournisseur"}
                      </div>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 align-top text-slate-600">{product.unit}</td>
                <td className="px-4 py-3 text-right align-top font-semibold">{formatCurrency(getPurchasePackagePrice(product, supplierFilter))}</td>
                <td className="px-4 py-3 text-right align-top font-semibold">{formatUnitPurchasePrice(product, supplierFilter)}</td>
                <td className="px-4 py-3 text-right align-top font-semibold">{formatCurrency(getRecommendedSalePrice(product, supplierFilter))}</td>
                <td className="px-4 py-3 text-right align-top">{product.documents.length}</td>
                <td className="px-4 py-3 align-top">
                  <div className="flex justify-end gap-2">
                    {orderSupplierId ? (
                      <Link
                        to={`/bons-commande?supplierId=${encodeURIComponent(orderSupplierId)}&productId=${encodeURIComponent(product.id)}&newOrder=1`}
                        className="rounded-lg border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        Commander
                      </Link>
                    ) : null}
                    <button type="button" className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50" onClick={() => openProductDrawer(product)}>Modifier</button>
                    <button type="button" className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50" onClick={() => removeProduct(product.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
            {!filtered.length ? <tr><td colSpan={10} className="px-4 py-12"><EmptyCatalogState onCreate={() => openProductDrawer({ ...EMPTY_DRAFT })} /></td></tr> : null}
          </tbody>
        </table>
      </section> : null}

      {editing ? (
        <ProductDrawer product={editing} suppliers={suppliers} onCancel={closeProductDrawer} onSave={saveProduct} />
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

  /**
   * Recalcule le prix de vente conseille depuis le prix d'achat et la marge
   * cible. Remplace `productDrawerPricingBridge.updateSalePrice`, qui pilotait
   * les inputs via des setters natifs HTMLInputElement.
   */
  function changePurchasePrice(standardPurchasePriceHt: number) {
    patch({
      standardPurchasePriceHt,
      recommendedSalePriceHt: computeSalePrice(standardPurchasePriceHt, draft.targetMarginRate),
    });
  }

  function changeTargetMargin(targetMarginRate: number) {
    patch({
      targetMarginRate,
      recommendedSalePriceHt: computeSalePrice(draft.standardPurchasePriceHt, targetMarginRate),
    });
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

      <ProductFileImportPanel
        currentProduct={draft}
        suppliers={suppliers}
        onApply={patch}
      />

      <div className="mb-4 mt-5 flex gap-2 border-b border-slate-200">
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
        <NumberField label="Prix achat standard" value={draft.standardPurchasePriceHt} onChange={changePurchasePrice} />
        <NumberField label="Prix vente conseillé" value={draft.recommendedSalePriceHt} onChange={(recommendedSalePriceHt) => patch({ recommendedSalePriceHt })} />
        <NumberField label="Marge cible %" value={draft.targetMarginRate} onChange={changeTargetMargin} />
        <label className={`${labelClass} flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 normal-case tracking-normal text-slate-700`}>
          <input type="checkbox" checked={draft.isSellable} onChange={(event) => patch({ isSellable: event.target.checked })} />
          <span>Produit revendable / utilisable dans un ouvrage</span>
        </label>
      </div>

          <ProductPricingSummary draft={draft} />
          <SupplierPricesEditor unit={draft.unit} prices={draft.supplierPrices} suppliers={suppliers} onChange={(supplierPrices) => patch({ supplierPrices })} />
          <ProductDocumentsEditor
            documents={draft.documents}
            busy={knowledgeLoading}
            error={knowledgeError}
            onAnalyze={() => void analyzeKnowledge(draft)}
            onChange={updateDocuments}
          />
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

function computeSalePrice(purchasePrice: number, marginRate: number) {
  const purchase = Number(purchasePrice) || 0;
  const margin = Number(marginRate) || 0;
  return Math.round(purchase * (1 + margin / 100) * 100) / 100;
}

/**
 * Synthese de prix du produit, remplacant `productDrawerPricingBridge`.
 * Le bridge injectait ces metriques en DOM (`data-batipro-product-pricing-summary`)
 * et lisait le ratio par regex sur les valeurs des inputs. Ici le ratio vient
 * directement de la connaissance IA produit ou de l'analyse par document.
 */
function resolveProductRatio(draft: ProductCatalogItem | ProductCatalogDraft): { quantity: number; baseUnit: string } | null {
  const knowledgeUsage = draft.knowledge?.materialUsage?.value;
  if (knowledgeUsage?.ratioQuantity && knowledgeUsage.ratioQuantity > 0 && knowledgeUsage.sourceUnit) {
    return { quantity: knowledgeUsage.ratioQuantity, baseUnit: knowledgeUsage.sourceUnit };
  }
  for (const document of draft.documents) {
    const usage = document.analysis?.materialUsage;
    if (usage && usage.ratioQuantity > 0 && usage.sourceUnit) {
      return { quantity: usage.ratioQuantity, baseUnit: usage.sourceUnit };
    }
  }
  return null;
}

function ProductPricingSummary({ draft }: { draft: ProductCatalogItem | ProductCatalogDraft }) {
  const ratio = resolveProductRatio(draft);

  const purchase = Number(draft.standardPurchasePriceHt) || 0;
  const sale = Number(draft.recommendedSalePriceHt) || 0;
  const purchasePerBaseUnit = ratio ? Math.round(purchase * ratio.quantity * 100) / 100 : null;
  const salePerBaseUnit = ratio ? Math.round(sale * ratio.quantity * 100) / 100 : null;
  const baseUnitLabel = ratio?.baseUnit ?? "m2";

  return (
    <div className="mt-4 grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm md:grid-cols-4">
      <PricingMetric label="Prix achat HT" value={purchase > 0 ? formatCurrency(purchase) : "A renseigner"} />
      <PricingMetric label="Prix vente HT" value={sale > 0 ? formatCurrency(sale) : `achat + ${draft.targetMarginRate} %`} />
      <PricingMetric
        label={`Prix achat HT / ${baseUnitLabel}`}
        value={purchasePerBaseUnit !== null ? formatCurrency(purchasePerBaseUnit) : "Ratio produit manquant"}
      />
      <PricingMetric
        label={`Prix vente HT / ${baseUnitLabel}`}
        value={salePerBaseUnit !== null ? formatCurrency(salePerBaseUnit) : "Ratio produit manquant"}
      />
    </div>
  );
}

function PricingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">{label}</div>
      <div className="mt-1 font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function SupplierPricesEditor({ unit, prices, suppliers, onChange }: { unit: DocumentUnit; prices: ProductSupplierPrice[]; suppliers: SupplierRow[]; onChange: (prices: ProductSupplierPrice[]) => void }) {
  function addPrice() {
    onChange([...prices, { id: crypto.randomUUID(), supplierId: null, supplierName: "", priceHt: 0, discountPercent: null, startDate: null, endDate: null, packaging: null, minimumQuantity: null, deliveryLeadTimeDays: null, coverageM2: null, pricePerM2Ht: null }]);
  }

  function updatePrice(id: string, patch: Partial<ProductSupplierPrice>) {
    onChange(prices.map((price) => price.id === id ? { ...price, ...patch } : price));
  }

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-950">Prix négociés par fournisseur</div>
          <p className="mt-1 text-sm text-slate-500">Renseignez le prix d'achat du colis ou de la botte, la quantité couverte et le prix exploitable à l'unité pour les devis.</p>
        </div>
        <button type="button" className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={addPrice}>Ajouter prix</button>
      </div>
      <div className="grid gap-3">
        {prices.map((price) => {
          const displayedUnitPrice = getSupplierUnitPrice(price);
          return (
          <div key={price.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-3 grid gap-2 md:grid-cols-3">
              <div className="rounded-xl bg-white px-3 py-2 text-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Prix colis HT</div>
                <div className="mt-1 font-semibold text-slate-950">{formatCurrency(price.priceHt)}</div>
              </div>
              <div className="rounded-xl bg-white px-3 py-2 text-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Quantité par colis</div>
                <div className="mt-1 font-semibold text-slate-950">{price.coverageM2 ? `${formatNumber(price.coverageM2)} ${unit}` : "Non renseignée"}</div>
              </div>
              <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-500">Prix achat unité HT</div>
                <div className="mt-1 font-semibold">{displayedUnitPrice > 0 ? `${formatCurrency(displayedUnitPrice)}/${unit}` : "À renseigner"}</div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FieldShell label="Fournisseur">
                <Select value={price.supplierId ?? ""} onChange={(supplierId) => {
                  const supplier = suppliers.find((row) => row.id === supplierId);
                  updatePrice(price.id, { supplierId: supplier?.id ?? null, supplierName: supplier?.name ?? "" });
                }} options={["", ...suppliers.map((supplier) => supplier.id)]} labels={Object.fromEntries([["", "Fournisseur"], ...suppliers.map((supplier) => [supplier.id, supplier.name])])} />
              </FieldShell>
              <FieldShell label="Prix colis HT">
                <SmallNumber value={price.priceHt} onChange={(priceHt) => updatePrice(price.id, { priceHt, pricePerM2Ht: price.coverageM2 ? priceHt / price.coverageM2 : price.pricePerM2Ht ?? null })} placeholder="Prix colis HT" />
              </FieldShell>
              <FieldShell label={`Quantité par colis (${unit})`}>
                <SmallNumber value={price.coverageM2 ?? 0} onChange={(coverageM2) => updatePrice(price.id, { coverageM2, pricePerM2Ht: coverageM2 > 0 ? price.priceHt / coverageM2 : null })} placeholder={`Quantité ${unit}`} />
              </FieldShell>
              <FieldShell label={`Prix achat unité HT (${unit})`}>
                <SmallNumber value={getSupplierUnitPrice(price)} onChange={(pricePerM2Ht) => updatePrice(price.id, { pricePerM2Ht })} placeholder={`Prix/${unit}`} />
              </FieldShell>
              <FieldShell label="Remise %">
                <SmallNumber value={price.discountPercent ?? 0} onChange={(discountPercent) => updatePrice(price.id, { discountPercent })} placeholder="Remise %" />
              </FieldShell>
              <FieldShell label="Début validité">
                <input className={inputClass} type="date" value={price.startDate ?? ""} onChange={(event) => updatePrice(price.id, { startDate: event.target.value || null })} />
              </FieldShell>
              <FieldShell label="Fin validité">
                <input className={inputClass} type="date" value={price.endDate ?? ""} onChange={(event) => updatePrice(price.id, { endDate: event.target.value || null })} />
              </FieldShell>
              <FieldShell label="Délai livraison j">
                <SmallNumber value={price.deliveryLeadTimeDays ?? 0} onChange={(deliveryLeadTimeDays) => updatePrice(price.id, { deliveryLeadTimeDays })} placeholder="Délai j" />
              </FieldShell>
              <FieldShell label="Conditionnement" className="md:col-span-2 xl:col-span-4">
                <input className={inputClass} placeholder="Ex : colis de 10 panneaux soit 6,48 m² ou botte de 30 ml" value={price.packaging ?? ""} onChange={(event) => updatePrice(price.id, { packaging: event.target.value || null })} />
              </FieldShell>
            </div>
          </div>
          );
        })}
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
    onChange([
      ...documents,
      {
        id: crypto.randomUUID(),
        kind,
        name: documentKindLabel(kind),
        url: "",
        usage: defaultDocumentUsage(kind),
        notes: null,
      },
    ]);
  }

  function updateDocument(id: string, patch: Partial<ProductCatalogItem["documents"][number]>) {
    onChange(documents.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  function removeDocument(id: string) {
    onChange(documents.filter((row) => row.id !== id));
  }

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-950">Documents liés</div>
          <p className="mt-1 text-sm text-slate-500">Ces documents servent ensuite aux tâches terrain et au DOE selon l'usage coché.</p>
          <div className="mt-1 text-xs text-slate-500">{busy ? "Coco analyse les documents produit..." : "Chaque ajout relance l'analyse de connaissance IA."}</div>
          {error ? <div className="mt-1 text-xs font-semibold text-red-600">{error}</div> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60" onClick={onAnalyze} disabled={busy}>
            {busy ? "Analyse..." : "Analyser avec Coco"}
          </button>
          {PRODUCT_DOCUMENT_KINDS.map((kind) => (
            <button key={kind} type="button" className="rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-slate-50" onClick={() => addDocument(kind)}>
              <FileText className="mr-1 inline h-3.5 w-3.5" /> {documentKindLabel(kind)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3">
        {documents.map((document) => {
          const usage = document.usage ?? defaultDocumentUsage(document.kind);
          return (
            <div key={document.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                <FieldShell label="Type">
                  <Select
                    value={document.kind}
                    onChange={(kind) => updateDocument(document.id, {
                      kind: kind as ProductDocumentKind,
                      usage: document.usage ?? defaultDocumentUsage(kind as ProductDocumentKind),
                    })}
                    options={PRODUCT_DOCUMENT_KINDS}
                    labels={Object.fromEntries(PRODUCT_DOCUMENT_KINDS.map((kind) => [kind, documentKindLabel(kind)]))}
                  />
                </FieldShell>
                <FieldShell label="Nom du document">
                  <input
                    className={inputClass}
                    placeholder="Ex : FT Mapelastic, notice de pose, domaine d'application..."
                    value={document.name}
                    onChange={(event) => updateDocument(document.id, { name: event.target.value })}
                  />
                </FieldShell>
                <FieldShell label="Lien ou chemin fichier" className="md:col-span-2">
                  <input
                    className={inputClass}
                    placeholder="URL fournisseur, chemin Supabase ou référence documentaire"
                    value={document.url ?? ""}
                    onChange={(event) => updateDocument(document.id, { url: event.target.value })}
                  />
                </FieldShell>
                <FieldShell label="Notes d'exploitation" className="md:col-span-2">
                  <textarea
                    className={`${inputClass} min-h-[78px] py-2`}
                    placeholder="Consommation, précautions, support compatible, limites d'emploi..."
                    value={document.notes ?? ""}
                    onChange={(event) => updateDocument(document.id, { notes: event.target.value })}
                  />
                </FieldShell>
              </div>
              <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={usage.task}
                      onChange={(event) => updateDocument(document.id, { usage: { ...usage, task: event.target.checked } })}
                    />
                    <span>Visible dans la tâche terrain</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={usage.doe}
                      onChange={(event) => updateDocument(document.id, { usage: { ...usage, doe: event.target.checked } })}
                    />
                    <span>À reprendre dans le DOE</span>
                  </label>
                </div>
                <button type="button" className="self-start rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 sm:self-auto" onClick={() => removeDocument(document.id)}>
                  Supprimer
                </button>
              </div>
            </div>
          );
        })}
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

function FieldShell({ children, className = "", label }: { children: React.ReactNode; className?: string; label: string }) {
  return <label className={`${labelClass} ${className}`}>{label}<div className="mt-1">{children}</div></label>;
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
  if (kind === "application_scope") return "Domaine d'application";
  if (kind === "work_method") return "Mode opératoire";
  if (kind === "sds") return "FDS";
  if (kind === "certification") return "Certification";
  if (kind === "photo") return "Photo";
  return "Autre";
}

function defaultDocumentUsage(kind: ProductDocumentKind): ProductDocumentUsage {
  if (kind === "technical_sheet" || kind === "sds") return { task: true, doe: true };
  if (kind === "manual" || kind === "application_scope" || kind === "work_method") return { task: true, doe: false };
  if (kind === "certification") return { task: false, doe: true };
  return { task: false, doe: false };
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
    documents: product.documents
      .map((document) => {
        const kind = PRODUCT_DOCUMENT_KINDS.includes(document.kind) ? document.kind : "other";
        return {
          ...document,
          kind,
          name: document.name?.trim() || documentKindLabel(kind),
          url: document.url?.trim() || null,
          notes: document.notes?.trim() || null,
          usage: document.usage ?? defaultDocumentUsage(kind),
        };
      })
      .filter((document) => Boolean(document.name || document.url || document.notes)),
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

function getOrderSupplierId(product: ProductCatalogItem, supplierFilter: string) {
  if (supplierFilter !== "all" && product.supplierPrices.some((price) => price.supplierId === supplierFilter)) return supplierFilter;
  return product.mainSupplierId;
}

function getDisplayedSupplierPrice(product: ProductCatalogItem, supplierFilter: string): ProductSupplierPrice | null {
  if (supplierFilter !== "all") {
    const filteredSupplierPrice = product.supplierPrices.find((price) => price.supplierId === supplierFilter);
    if (filteredSupplierPrice) return filteredSupplierPrice;
  }
  return getMainSupplierPrice(product);
}

function getMainSupplierPrice(product: ProductCatalogItem): ProductSupplierPrice | null {
  const mainSupplierPrice = product.mainSupplierId
    ? product.supplierPrices.find((price) => price.supplierId === product.mainSupplierId)
    : null;
  return mainSupplierPrice ?? product.supplierPrices[0] ?? null;
}

function getPurchasePackagePrice(product: ProductCatalogItem, supplierFilter = "all") {
  const supplierPrice = getDisplayedSupplierPrice(product, supplierFilter);
  return positiveNumber(supplierPrice?.priceHt) ?? positiveNumber(product.standardPurchasePriceHt) ?? 0;
}

function getUnitPurchasePrice(product: ProductCatalogItem, supplierFilter = "all") {
  const supplierPrice = getDisplayedSupplierPrice(product, supplierFilter);
  const packagePrice = positiveNumber(supplierPrice?.priceHt) ?? positiveNumber(product.standardPurchasePriceHt);
  const coveredQuantity = positiveNumber(supplierPrice?.coverageM2);
  if (packagePrice !== null && coveredQuantity !== null) return packagePrice / coveredQuantity;

  return positiveNumber(supplierPrice?.pricePerM2Ht) ?? packagePrice;
}

function getSupplierUnitPrice(price: ProductSupplierPrice) {
  const packagePrice = positiveNumber(price.priceHt);
  const coveredQuantity = positiveNumber(price.coverageM2);
  if (packagePrice !== null && coveredQuantity !== null) return packagePrice / coveredQuantity;
  return positiveNumber(price.pricePerM2Ht) ?? 0;
}

function getRecommendedSalePrice(product: ProductCatalogItem, supplierFilter = "all") {
  const savedSalePrice = positiveNumber(product.recommendedSalePriceHt);
  if (savedSalePrice !== null) return savedSalePrice;

  const unitPurchasePrice = getUnitPurchasePrice(product, supplierFilter);
  const marginRate = positiveNumber(product.targetMarginRate) ?? 0;
  return unitPurchasePrice ? unitPurchasePrice * (1 + marginRate / 100) : 0;
}

function formatUnitPurchasePrice(product: ProductCatalogItem, supplierFilter = "all") {
  const unitPrice = getUnitPurchasePrice(product, supplierFilter);
  if (!unitPrice) return "-";
  const unit = product.unit || "u";
  return `${formatCurrency(unitPrice)}/${unit}`;
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
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
