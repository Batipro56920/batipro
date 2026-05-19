import { useEffect, useMemo, useState } from "react";
import { FileText, PackageSearch, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { SupplierRow } from "../../../services/suppliers.service";
import { listSuppliers } from "../../../services/suppliers.service";
import type { DocumentUnit } from "../../document-engine";
import type { ProductCatalogDraft, ProductCatalogItem, ProductDocumentKind, ProductSupplierPrice } from "../domain/types";
import { deleteProductCatalogItem, listProductCatalogItems, saveProductCatalogItem } from "../infrastructure/productCatalogRepository";

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
  supplierPrices: [],
  documents: [],
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
    await saveProductCatalogItem(product);
    setProducts(await listProductCatalogItems());
    setEditing(null);
  }

  async function removeProduct(id: string) {
    if (!window.confirm("Supprimer ce produit du catalogue ?")) return;
    await deleteProductCatalogItem(id);
    setProducts(await listProductCatalogItems());
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
            <button type="button" onClick={() => setEditing({ ...EMPTY_DRAFT })} className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> Nouveau produit
            </button>
          </div>
        </div>
      </header>

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
          <Select value={categoryFilter} onChange={setCategoryFilter} options={["all", ...categories]} labels={{ all: "Toutes categories" }} />
          <Select value={supplierFilter} onChange={setSupplierFilter} options={["all", ...suppliers.map((supplier) => supplier.id)]} labels={Object.fromEntries([["all", "Tous fournisseurs"], ...suppliers.map((supplier) => [supplier.id, supplier.name])])} />
          <Select value={brandFilter} onChange={setBrandFilter} options={["all", ...brands]} labels={{ all: "Toutes marques" }} />
          <Select value={priceFilter} onChange={setPriceFilter} options={["all", "low", "mid", "high"]} labels={{ all: "Tous prix", low: "< 50 EUR", mid: "50-250 EUR", high: "> 250 EUR" }} />
        </div>
      </section> : null}

      {editing ? <ProductForm product={editing} suppliers={suppliers} onCancel={() => setEditing(null)} onSave={saveProduct} /> : null}

      {!loading ? <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Categorie</th>
              <th className="px-4 py-3">Marque</th>
              <th className="px-4 py-3">Fournisseur</th>
              <th className="px-4 py-3">Unite</th>
              <th className="px-4 py-3 text-right">Achat HT</th>
              <th className="px-4 py-3 text-right">Vente conseillee</th>
              <th className="px-4 py-3 text-right">Docs</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((product) => (
              <tr key={product.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-950">{product.designation}</div>
                  <div className="text-xs text-slate-500">{product.internalReference || "-"} · Fab. {product.manufacturerReference || "-"}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{product.category || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{product.brand || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{product.mainSupplierName || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{product.unit}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(product.standardPurchasePriceHt)}</td>
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
            ))}
            {!filtered.length ? <tr><td colSpan={9} className="px-4 py-12"><EmptyCatalogState onCreate={() => setEditing({ ...EMPTY_DRAFT })} /></td></tr> : null}
          </tbody>
        </table>
      </section> : null}
    </div>
  );
}

function ProductForm({ product, suppliers, onCancel, onSave }: { product: ProductCatalogItem | ProductCatalogDraft; suppliers: SupplierRow[]; onCancel: () => void; onSave: (product: ProductCatalogItem | ProductCatalogDraft) => void | Promise<void> }) {
  const [draft, setDraft] = useState(product);

  function patch(patch: Partial<ProductCatalogItem | ProductCatalogDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function selectMainSupplier(id: string) {
    const supplier = suppliers.find((row) => row.id === id);
    patch({ mainSupplierId: supplier?.id ?? null, mainSupplierName: supplier?.name ?? null });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Fiche produit</h2>
          <p className="mt-1 text-sm text-slate-500">Informations produit, prix fournisseurs et documents techniques.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={onCancel}>Annuler</button>
          <button type="button" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800" onClick={() => onSave(draft)}>Enregistrer</button>
        </div>
      </div>

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
      </div>

      <SupplierPricesEditor prices={draft.supplierPrices} suppliers={suppliers} onChange={(supplierPrices) => patch({ supplierPrices })} />
      <ProductDocumentsEditor documents={draft.documents} onChange={(documents) => patch({ documents })} />
    </section>
  );
}

function SupplierPricesEditor({ prices, suppliers, onChange }: { prices: ProductSupplierPrice[]; suppliers: SupplierRow[]; onChange: (prices: ProductSupplierPrice[]) => void }) {
  function addPrice() {
    onChange([...prices, { id: crypto.randomUUID(), supplierId: null, supplierName: "", priceHt: 0, discountPercent: null, startDate: null, endDate: null, packaging: null, minimumQuantity: null, deliveryLeadTimeDays: null }]);
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
          <div key={price.id} className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-4 xl:grid-cols-8">
            <Select value={price.supplierId ?? ""} onChange={(supplierId) => {
              const supplier = suppliers.find((row) => row.id === supplierId);
              updatePrice(price.id, { supplierId: supplier?.id ?? null, supplierName: supplier?.name ?? "" });
            }} options={["", ...suppliers.map((supplier) => supplier.id)]} labels={Object.fromEntries([["", "Fournisseur"], ...suppliers.map((supplier) => [supplier.id, supplier.name])])} />
            <SmallNumber value={price.priceHt} onChange={(priceHt) => updatePrice(price.id, { priceHt })} placeholder="Prix HT" />
            <SmallNumber value={price.discountPercent ?? 0} onChange={(discountPercent) => updatePrice(price.id, { discountPercent })} placeholder="Remise %" />
            <input className={inputClass} type="date" value={price.startDate ?? ""} onChange={(event) => updatePrice(price.id, { startDate: event.target.value || null })} />
            <input className={inputClass} type="date" value={price.endDate ?? ""} onChange={(event) => updatePrice(price.id, { endDate: event.target.value || null })} />
            <input className={inputClass} placeholder="Conditionnement" value={price.packaging ?? ""} onChange={(event) => updatePrice(price.id, { packaging: event.target.value || null })} />
            <SmallNumber value={price.minimumQuantity ?? 0} onChange={(minimumQuantity) => updatePrice(price.id, { minimumQuantity })} placeholder="Qte min" />
            <SmallNumber value={price.deliveryLeadTimeDays ?? 0} onChange={(deliveryLeadTimeDays) => updatePrice(price.id, { deliveryLeadTimeDays })} placeholder="Delai j" />
          </div>
        ))}
        {!prices.length ? <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Aucun prix négocié pour le moment.</div> : null}
      </div>
    </div>
  );
}

function ProductDocumentsEditor({ documents, onChange }: { documents: ProductCatalogItem["documents"]; onChange: (documents: ProductCatalogItem["documents"]) => void }) {
  function addDocument(kind: ProductDocumentKind) {
    onChange([...documents, { id: crypto.randomUUID(), kind, name: documentKindLabel(kind), url: null }]);
  }

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="font-semibold text-slate-950">Documents liés</div>
        <div className="flex flex-wrap gap-2">
          {(["technical_sheet", "manual", "sds", "certification", "photo"] as const).map((kind) => (
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

function Field({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return <label className={`${labelClass} ${className}`}>{label}<input className={`${inputClass} mt-1`} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className={labelClass}>{label}<SmallNumber className="mt-1" value={value} onChange={onChange} /></label>;
}

function SmallNumber({ value, onChange, placeholder, className = "" }: { value: number; onChange: (value: number) => void; placeholder?: string; className?: string }) {
  return <input className={`${inputClass} ${className}`} type="number" placeholder={placeholder} value={value} onChange={(event) => onChange(Number(event.target.value))} />;
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
  return "Photo";
}

const labelClass = "block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400";
const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-950 outline-none focus:border-blue-300";

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}
