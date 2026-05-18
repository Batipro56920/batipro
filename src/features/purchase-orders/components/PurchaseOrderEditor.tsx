import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Save, Send } from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
  calculateDocumentTotals,
  createDocumentLine,
  createDocumentSection,
  DocumentPreview,
  DocumentSendDialog,
  DocumentTotalsCard,
  downloadBusinessDocumentPdf,
  flattenDocumentNodes,
  validateBusinessDocument,
  type BusinessDocument,
  type DocumentItemNode,
  type BusinessDocumentNode,
  type DocumentItemKind,
} from "../../document-engine";
import type { SupplierRow } from "../../../services/suppliers.service";
import type { ProductCatalogItem } from "../../product-catalog";
import { getBestSupplierPrice, listProductCatalogItems } from "../../product-catalog";
import type { PurchaseOrderRecord, PurchaseOrderStatus } from "../domain/types";
import { PurchaseOrderStatusBadge } from "./PurchaseOrderStatusBadge";

export function PurchaseOrderEditor({
  order,
  suppliers,
  onChange,
  onSave,
  onClose,
}: {
  order: PurchaseOrderRecord;
  suppliers: SupplierRow[];
  onChange: (order: PurchaseOrderRecord) => void;
  onSave: (order: PurchaseOrderRecord) => void | Promise<void>;
  onClose: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const document = order.document;
  const totals = document.totals ?? calculateDocumentTotals(document);
  const rows = useMemo(() => flattenDocumentNodes(document.nodes), [document.nodes]);
  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    return products
      .filter((product) => !query || [product.designation, product.internalReference, product.brand, product.category].some((value) => String(value ?? "").toLowerCase().includes(query)))
      .slice(0, 6);
  }, [productQuery, products]);

  useEffect(() => {
    listProductCatalogItems().then(setProducts).catch(() => setProducts([]));
  }, []);

  function updateOrder(patch: Partial<PurchaseOrderRecord>) {
    onChange({ ...order, ...patch, updatedAt: new Date().toISOString() });
  }

  function updateDocument(patch: Partial<BusinessDocument>) {
    const nextDocument = { ...document, ...patch };
    updateOrder({ document: { ...nextDocument, totals: calculateDocumentTotals(nextDocument) } });
  }

  function updateNode(nodeId: string, patch: Partial<BusinessDocumentNode>) {
    updateDocument({ nodes: updateNodeTree(document.nodes, nodeId, patch) });
  }

  function addSection() {
    updateDocument({ nodes: [...document.nodes, createDocumentSection("Nouveau lot", document.nodes.length)] });
  }

  function addLine(kind: DocumentItemKind) {
    const section = document.nodes.find((node) => node.type === "section");
    const nextSection = section ?? createDocumentSection("Produits / prestations", 0);
    const line = createDocumentLine(nextSection.id, kind, nextSection.type === "section" ? nextSection.children.length : 0);
    const nodes = section ? appendChild(document.nodes, section.id, line) : [{ ...nextSection, children: [line] }];
    updateDocument({ nodes });
  }

  function addCatalogProduct(product: ProductCatalogItem) {
    const supplierId = order.supplierId ?? product.mainSupplierId;
    const supplier = supplierId ? suppliers.find((row) => row.id === supplierId) : null;
    const negotiated = getBestSupplierPrice(product, supplierId);
    const section = document.nodes.find((node) => node.type === "section");
    const nextSection = section ?? createDocumentSection("Produits catalogue", 0);
    const line = {
      ...createDocumentLine(nextSection.id, "fourniture", nextSection.type === "section" ? nextSection.children.length : 0),
      title: product.designation,
      description: product.internalReference ?? undefined,
      quantity: 1,
      unit: product.unit,
      unitPriceHt: negotiated?.priceHt ?? product.standardPurchasePriceHt,
      vatRate: product.vatRate,
      costPriceHt: negotiated?.priceHt ?? product.standardPurchasePriceHt,
      internalNotes: [
        product.internalReference ? `Ref interne: ${product.internalReference}` : null,
        product.manufacturerReference ? `Ref fabricant: ${product.manufacturerReference}` : null,
        product.brand ? `Marque: ${product.brand}` : null,
      ].filter(Boolean).join(" - "),
    } as BusinessDocumentNode;
    const nodes = section ? appendChild(document.nodes, section.id, line) : [{ ...nextSection, children: [line] }];
    const recipient = supplier ?? (product.mainSupplierName ? { id: product.mainSupplierId, name: product.mainSupplierName, email: null, phone: null, address: null } : null);
    const nextDocument = {
      ...document,
      nodes,
      recipient: recipient
        ? { ...document.recipient, id: recipient.id ?? null, displayName: recipient.name, email: recipient.email ?? null, phone: recipient.phone ?? null, address: recipient.address ?? null }
        : document.recipient,
    };
    updateOrder({
      supplierId: recipient?.id ?? order.supplierId ?? null,
      supplierName: recipient?.name ?? order.supplierName ?? null,
      document: { ...nextDocument, totals: calculateDocumentTotals(nextDocument) },
    });
  }

  function selectSupplier(supplierId: string) {
    const supplier = suppliers.find((row) => row.id === supplierId);
    updateOrder({
      supplierId: supplier?.id ?? null,
      supplierName: supplier?.name ?? null,
      document: {
        ...document,
        recipient: {
          ...document.recipient,
          id: supplier?.id ?? null,
          displayName: supplier?.name ?? "",
          email: supplier?.email ?? null,
          phone: supplier?.phone ?? null,
          address: supplier?.address ?? null,
        },
      },
    });
  }

  function save() {
    const validation = validateBusinessDocument(document);
    if (!validation.success) throw new Error(validation.error.issues.map((issue) => issue.message).join(", "));
    onSave(order);
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Commande fournisseur</div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input className="rounded-xl border border-transparent text-2xl font-bold text-slate-950 outline-none hover:border-slate-200 focus:border-blue-300" value={document.number} onChange={(event) => updateDocument({ number: event.target.value })} />
            <PurchaseOrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">Document-engine · achat lie projet / chantier.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setPreviewOpen((open) => !open)}>Preview</Button>
          <Button variant="secondary" onClick={() => downloadBusinessDocumentPdf(document)}><Download className="h-4 w-4" /> PDF</Button>
          <Button variant="secondary" onClick={() => setSendOpen(true)}><Send className="h-4 w-4" /> Envoyer</Button>
          <Button variant="primary" onClick={save}><Save className="h-4 w-4" /> Enregistrer</Button>
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
        </div>
      </header>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">Catalogue produits</div>
                <div className="text-xs text-slate-500">Insertion rapide avec prix, TVA, unite et fournisseur.</div>
              </div>
              <a href="/catalogue-produits" className="text-xs font-semibold text-blue-700 hover:text-blue-800">Ouvrir catalogue</a>
            </div>
            <input className={inputClass} placeholder="Rechercher produit, reference, marque..." value={productQuery} onChange={(event) => setProductQuery(event.target.value)} />
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {filteredProducts.map((product) => (
                <button key={product.id} type="button" onClick={() => addCatalogProduct(product)} className="rounded-xl border border-slate-200 bg-white p-3 text-left text-sm hover:border-blue-200 hover:bg-blue-50">
                  <div className="font-semibold text-slate-950">{product.designation}</div>
                  <div className="mt-1 text-xs text-slate-500">{product.category || "Sans categorie"} - {product.unit} - {formatCurrency(getBestSupplierPrice(product, order.supplierId)?.priceHt ?? product.standardPurchasePriceHt)} HT</div>
                </button>
              ))}
              {!filteredProducts.length ? <div className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500">Aucun produit trouve.</div> : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className={labelClass}>
              Fournisseur
              <select className={inputClass} value={order.supplierId ?? ""} onChange={(event) => selectSupplier(event.target.value)}>
                <option value="">Selectionner</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>
            <Field label="Projet ID" value={order.projectId ?? ""} onChange={(projectId) => updateOrder({ projectId: projectId || null, document: { ...document, projectId: projectId || null } })} />
            <Field label="Chantier ID" value={order.chantierId ?? ""} onChange={(chantierId) => updateOrder({ chantierId: chantierId || null, document: { ...document, chantierId: chantierId || null } })} />
            <Field label="Lot / prestation" value={order.lot ?? ""} onChange={(lot) => updateOrder({ lot: lot || null })} />
            <Field label="Reference fournisseur" value={order.supplierReference ?? ""} onChange={(supplierReference) => updateOrder({ supplierReference: supplierReference || null })} />
            <Field label="Livraison prevue" type="date" value={order.expectedDeliveryDate ?? ""} onChange={(expectedDeliveryDate) => updateOrder({ expectedDeliveryDate: expectedDeliveryDate || null })} />
            <label className={`${labelClass} md:col-span-2 xl:col-span-3`}>
              Adresse livraison chantier
              <input className={inputClass} value={order.deliveryAddress ?? ""} onChange={(event) => updateOrder({ deliveryAddress: event.target.value || null, document: { ...document, siteAddress: event.target.value } })} />
            </label>
          </div>

          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <Button variant="secondary" onClick={addSection}><Plus className="h-4 w-4" /> Lot</Button>
            <Button variant="secondary" onClick={() => addLine("fourniture")}><Plus className="h-4 w-4" /> Produit</Button>
            <Button variant="secondary" onClick={() => addLine("sous_traitance")}><Plus className="h-4 w-4" /> Prestation</Button>
            <Button variant="secondary" onClick={() => addLine("materiel")}><Plus className="h-4 w-4" /> Materiel</Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[70px_1fr_90px_90px_110px_90px_120px] bg-blue-600 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white">
              <span>N</span><span>Designation</span><span>Qte</span><span>Unite</span><span>Prix achat HT</span><span>TVA</span><span className="text-right">Total TTC</span>
            </div>
            {rows.length ? rows.map((row) => (
              <div key={row.id} className={`grid grid-cols-[70px_1fr_90px_90px_110px_90px_120px] items-center gap-2 border-t border-slate-100 px-3 py-2 text-sm ${row.node.type === "section" ? "bg-blue-50 font-bold" : row.node.type === "subsection" ? "bg-slate-50 font-semibold" : ""}`}>
                <span className="font-mono text-xs text-slate-500">{row.number}</span>
                <input className={cellClass} value={row.node.title} onChange={(event) => updateNode(row.id, { title: event.target.value })} />
                {isItem(row.node) ? <NumberCell value={row.node.quantity} onChange={(quantity) => updateNode(row.id, { quantity } as Partial<BusinessDocumentNode>)} /> : <span />}
                {isItem(row.node) ? <input className={cellClass} value={row.node.unit} onChange={(event) => updateNode(row.id, { unit: event.target.value } as Partial<BusinessDocumentNode>)} /> : <span />}
                {isItem(row.node) ? <NumberCell value={row.node.unitPriceHt} onChange={(unitPriceHt) => updateNode(row.id, { unitPriceHt } as Partial<BusinessDocumentNode>)} /> : <span />}
                {isItem(row.node) ? <NumberCell value={row.node.vatRate} onChange={(vatRate) => updateNode(row.id, { vatRate } as Partial<BusinessDocumentNode>)} /> : <span />}
                <span className="text-right font-semibold">{isItem(row.node) ? formatCurrency(row.node.quantity * row.node.unitPriceHt * (1 + row.node.vatRate / 100)) : ""}</span>
              </div>
            )) : <div className="p-8 text-center text-sm text-slate-500">Ajoutez un lot puis des produits ou prestations fournisseur.</div>}
          </div>
        </div>

        <aside className="space-y-4">
          <DocumentTotalsCard document={document} totals={totals} />
          <StatusPanel status={order.status} onChange={(status) => updateOrder({ status })} />
        </aside>
      </section>

      {previewOpen ? <DocumentPreview document={document} /> : null}
      {sendOpen ? <DocumentSendDialog document={document} onClose={() => setSendOpen(false)} onDownload={() => downloadBusinessDocumentPdf(document)} /> : null}
    </div>
  );
}

function StatusPanel({ status, onChange }: { status: PurchaseOrderStatus; onChange: (status: PurchaseOrderStatus) => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <div className="font-semibold text-slate-950">Statut commande</div>
      <select className={`${inputClass} mt-3`} value={status} onChange={(event) => onChange(event.target.value as PurchaseOrderStatus)}>
        <option value="draft">Brouillon</option>
        <option value="sent">Envoye</option>
        <option value="confirmed">Confirme</option>
        <option value="partially_delivered">Livre partiellement</option>
        <option value="delivered">Livre</option>
        <option value="cancelled">Annule</option>
      </select>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className={labelClass}>{label}<input className={inputClass} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function NumberCell({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <input className={`${cellClass} text-right`} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />;
}

function isItem(node: BusinessDocumentNode): node is DocumentItemNode {
  return node.type === "line" || node.type === "composite";
}

function updateNodeTree(nodes: BusinessDocumentNode[], nodeId: string, patch: Partial<BusinessDocumentNode>): BusinessDocumentNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) return { ...node, ...patch } as BusinessDocumentNode;
    if (node.type === "section" || node.type === "subsection") return { ...node, children: updateNodeTree(node.children, nodeId, patch) };
    return node;
  });
}

function appendChild(nodes: BusinessDocumentNode[], parentId: string, child: BusinessDocumentNode): BusinessDocumentNode[] {
  return nodes.map((node) => {
    if ((node.type === "section" || node.type === "subsection") && node.id === parentId) return { ...node, children: [...node.children, child] };
    if (node.type === "section" || node.type === "subsection") return { ...node, children: appendChild(node.children, parentId, child) };
    return node;
  });
}

const labelClass = "block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400";
const inputClass = "mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-950 outline-none focus:border-blue-300";
const cellClass = "h-9 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm font-normal outline-none hover:border-slate-200 focus:border-blue-300";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
