import { useMemo, useState } from "react";
import { CheckCircle2, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import type { SupplierRow } from "../../../services/suppliers.service";
import type { DocumentUnit } from "../../document-engine";
import type { ProductCatalogDraft, ProductCatalogItem, ProductDocument, ProductSupplierPrice } from "../domain/types";
import type { ExtractedQuoteProduct } from "../services/productQuoteImport.service";

const ACCEPTED_PRODUCT_FILES = "application/pdf,.pdf,.xlsx,.xls,.csv,.txt,text/plain,text/csv";
const SUPPORTED_FILE_LABEL = "PDF, Excel, CSV ou texte";

type ExtractProductsResponse = {
  ok?: boolean;
  error?: string;
  products?: ExtractedQuoteProduct[];
};

type ProductDraftPatch = Partial<ProductCatalogDraft | ProductCatalogItem>;

type ProductImportAnalysis = {
  product: ExtractedQuoteProduct;
  patch: ProductDraftPatch;
  notes: string[];
};

export default function ProductFileImportPanel({
  currentProduct,
  suppliers,
  onApply,
}: {
  currentProduct: ProductCatalogDraft | ProductCatalogItem;
  suppliers: SupplierRow[];
  onApply: (patch: ProductDraftPatch) => void;
}) {
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState<ProductImportAnalysis | null>(null);
  const hasFiles = fileNames.length > 0;
  const label = useMemo(() => fileNames.slice(0, 3).join(", ") + (fileNames.length > 3 ? ` +${fileNames.length - 3}` : ""), [fileNames]);

  async function onFileChange(files: FileList | null) {
    setError(null);
    setResult(null);
    setPendingAnalysis(null);
    if (!files?.length) return;

    const selectedFiles = Array.from(files);
    const unsupported = selectedFiles.find((file) => !isSupportedProductFile(file));
    if (unsupported) {
      setFileNames([]);
      setError(`Fichier non pris en charge : ${unsupported.name}. Formats acceptes : ${SUPPORTED_FILE_LABEL}.`);
      return;
    }

    setBusy(true);
    setFileNames(selectedFiles.map((file) => file.name));
    try {
      const textBlocks = await Promise.all(selectedFiles.map(async (file) => {
        const text = await extractProductFileText(file);
        return `Fichier: ${file.name}\n${text}`;
      }));
      const cleanedText = textBlocks.join("\n\n---\n\n").trim();
      if (cleanedText.length < 20) {
        throw new Error("Texte insuffisant dans ces fichiers. Verifiez que le document contient des informations produit lisibles.");
      }

      const extractedProducts = await extractProducts(cleanedText);
      const bestProduct = chooseBestProduct(extractedProducts);
      if (!bestProduct) {
        throw new Error("Aucune information produit exploitable n'a ete detectee dans ces fichiers.");
      }

      const patch = buildProductPatch(currentProduct, bestProduct, selectedFiles, suppliers, cleanedText);
      const notes = buildAnalysisNotes(bestProduct, patch);
      setPendingAnalysis({ product: bestProduct, patch, notes });
      setResult("Analyse Coco prete a verifier avant application.");
    } catch (err: any) {
      setError(err?.message ?? "Analyse automatique du fichier impossible.");
      setResult(null);
      setPendingAnalysis(null);
    } finally {
      setBusy(false);
    }
  }

  function clearFiles() {
    setFileNames([]);
    setError(null);
    setResult(null);
    setPendingAnalysis(null);
  }

  function applyPendingAnalysis() {
    if (!pendingAnalysis) return;
    onApply(pendingAnalysis.patch);
    setResult(`${pendingAnalysis.product.designation} applique a la fiche.`);
    setPendingAnalysis(null);
  }

  return (
    <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-950">Import intelligent par Coco</div>
          <p className="mt-1 text-sm text-slate-600">
            Importez une fiche technique, notice, tarif fournisseur ou document produit. Coco lit le fichier puis vous montre ce qu'il a compris avant de remplir la fiche.
          </p>
        </div>
        <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 has-[:disabled]:cursor-not-allowed has-[:disabled]:bg-blue-300">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {busy ? "Analyse..." : "Importer fichier(s)"}
          <input
            type="file"
            multiple
            accept={ACCEPTED_PRODUCT_FILES}
            disabled={busy}
            className="sr-only"
            onChange={(event) => void onFileChange(event.target.files)}
          />
        </label>
      </div>

      {hasFiles ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm text-blue-800">
          <span className="truncate"><FileText className="mr-2 inline h-4 w-4" />{label}</span>
          <button type="button" disabled={busy} onClick={clearFiles} className="rounded-lg p-1 hover:bg-blue-50 disabled:opacity-50" aria-label="Retirer les fichiers">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {pendingAnalysis ? (
        <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">Coco a compris</div>
              <div className="mt-1 text-sm text-slate-600">{pendingAnalysis.product.designation}</div>
            </div>
            <span className={confidenceClassName(pendingAnalysis.product.confidence)}>
              Confiance {Math.round((pendingAnalysis.product.confidence ?? 0) * 100)} %
            </span>
          </div>

          <div className="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
            {buildReadOnlyMetric("Designation", pendingAnalysis.patch.designation || "Non trouvee")}
            {buildReadOnlyMetric("Marque", pendingAnalysis.patch.brand || "Non trouvee")}
            {buildReadOnlyMetric("Categorie", pendingAnalysis.patch.category || "Non trouvee")}
            {buildReadOnlyMetric("Prix achat", formatMaybeCurrency(pendingAnalysis.patch.standardPurchasePriceHt))}
          </div>

          {pendingAnalysis.notes.length ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              {pendingAnalysis.notes.map((note) => <div key={note}>{note}</div>)}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => setPendingAnalysis(null)}>
              Ne pas appliquer
            </button>
            <button type="button" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800" onClick={applyPendingAnalysis}>
              Appliquer a la fiche
            </button>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {result}
        </div>
      ) : null}

      {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
    </div>
  );
}

function buildReadOnlyMetric(label: string, value: string) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold text-slate-950">{value}</div>
    </div>
  );
}

async function extractProducts(cleanedText: string): Promise<ExtractedQuoteProduct[]> {
  const { data, error } = await supabase.functions.invoke<ExtractProductsResponse>("extract-devis-products", {
    body: { cleaned_text: cleanedText },
  });

  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "Lecture automatique du document impossible.");
  return (data.products ?? []).filter((product) => Boolean(normalizeText(product.designation)));
}

function chooseBestProduct(products: ExtractedQuoteProduct[]): ExtractedQuoteProduct | null {
  return [...products].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0] ?? null;
}

function buildProductPatch(
  currentProduct: ProductCatalogDraft | ProductCatalogItem,
  extracted: ExtractedQuoteProduct,
  files: File[],
  suppliers: SupplierRow[],
  text: string,
): ProductDraftPatch {
  const supplierName = normalizeText(extracted.supplier_name);
  const supplier = supplierName ? suppliers.find((row) => normalizeKey(row.name) === normalizeKey(supplierName)) ?? null : null;
  const purchasePrice = positivePrice(extracted.purchase_price_ht) ?? extractPrice(text) ?? positivePrice(currentProduct.standardPurchasePriceHt);
  const packagePrice = positivePrice(extracted.package_price_ht);
  const coverageM2 = positiveNumber(extracted.coverage_m2);
  const unitPrice = purchasePrice ?? computeCoverageUnitPrice(packagePrice, coverageM2);
  const marginRate = positiveNumber(currentProduct.targetMarginRate) ?? 30;
  const salePrice = positivePrice(extracted.sale_price_ht) ?? computeSalePrice(unitPrice, marginRate) ?? positivePrice(currentProduct.recommendedSalePriceHt);
  const unit = normalizeUnit(extracted.unit) || currentProduct.unit;
  const supplierPrice = buildSupplierPrice(extracted, supplier, packagePrice ?? purchasePrice, unitPrice);
  const importedDocuments = buildImportedDocuments(files, extracted, text);

  return {
    designation: normalizeText(extracted.designation) ?? currentProduct.designation,
    manufacturerReference: normalizeText(extracted.supplier_reference) ?? currentProduct.manufacturerReference,
    brand: normalizeText(extracted.brand) ?? currentProduct.brand,
    category: normalizeText(extracted.category) ?? currentProduct.category ?? "Materiaux",
    unit,
    vatRate: positiveNumber(extracted.vat_rate) ?? currentProduct.vatRate,
    mainSupplierId: supplier?.id ?? currentProduct.mainSupplierId,
    mainSupplierName: supplier?.name ?? supplierName ?? currentProduct.mainSupplierName,
    standardPurchasePriceHt: unitPrice ?? currentProduct.standardPurchasePriceHt,
    recommendedSalePriceHt: salePrice ?? currentProduct.recommendedSalePriceHt,
    supplierPrices: supplierPrice ? mergeSupplierPrice(currentProduct.supplierPrices, supplierPrice) : currentProduct.supplierPrices,
    documents: [...currentProduct.documents, ...importedDocuments],
  };
}

function buildSupplierPrice(
  extracted: ExtractedQuoteProduct,
  supplier: SupplierRow | null,
  packagePrice: number | null,
  unitPrice: number | null,
): ProductSupplierPrice | null {
  const supplierName = normalizeText(extracted.supplier_name);
  if (packagePrice === null || packagePrice <= 0) return null;
  if (!supplier && !supplierName) return null;

  return {
    id: crypto.randomUUID(),
    supplierId: supplier?.id ?? null,
    supplierName: supplier?.name ?? supplierName ?? "",
    priceHt: packagePrice,
    discountPercent: null,
    startDate: null,
    endDate: null,
    packaging: normalizeText(extracted.packaging),
    minimumQuantity: positiveNumber(extracted.quantity) ?? positiveNumber(extracted.minimum_quantity),
    deliveryLeadTimeDays: null,
    coverageM2: positiveNumber(extracted.coverage_m2),
    pricePerM2Ht: unitPrice,
  };
}

function buildImportedDocuments(files: File[], extracted: ExtractedQuoteProduct, text: string): ProductDocument[] {
  const notes = [
    "Fichier importe pour analyse automatique de la fiche produit.",
    normalizeText((extracted as ExtractedQuoteProduct & Record<string, unknown>).business_interpretation),
    extractShortTechnicalNote(text),
  ].filter((note): note is string => Boolean(note));

  return files.map((file) => ({
    id: crypto.randomUUID(),
    kind: "technical_sheet",
    name: file.name,
    url: null,
    usage: { task: true, doe: true },
    notes: notes.join("\n"),
    analysis: null,
  }));
}

function mergeSupplierPrice(prices: ProductSupplierPrice[], candidate: ProductSupplierPrice): ProductSupplierPrice[] {
  const exists = prices.some((price) => {
    const sameSupplier = candidate.supplierId
      ? price.supplierId === candidate.supplierId
      : normalizeKey(price.supplierName) === normalizeKey(candidate.supplierName);
    return sameSupplier && price.priceHt === candidate.priceHt && normalizeKey(price.packaging) === normalizeKey(candidate.packaging);
  });
  return exists ? prices : [...prices, candidate];
}

function buildAnalysisNotes(extracted: ExtractedQuoteProduct, patch: ProductDraftPatch) {
  return [
    normalizeText((extracted as ExtractedQuoteProduct & Record<string, unknown>).business_interpretation),
    patch.mainSupplierName ? `Fournisseur detecte : ${patch.mainSupplierName}` : null,
    patch.recommendedSalePriceHt ? `Prix vente estime : ${formatMaybeCurrency(patch.recommendedSalePriceHt)}` : null,
  ].filter((note): note is string => Boolean(note));
}

function isSupportedProductFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return [".pdf", ".xlsx", ".xls", ".csv", ".txt"].some((extension) => name.endsWith(extension))
    || ["application/pdf", "text/plain", "text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(file.type);
}

async function extractProductFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdfText(file);
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls") || file.type.includes("spreadsheet") || file.type === "application/vnd.ms-excel") {
    return extractSpreadsheetText(file);
  }

  return file.text();
}

async function extractPdfText(file: File): Promise<string> {
  const [{ default: pdfWorkerUrl }, pdfjsLib] = await Promise.all([
    import("pdfjs-dist/build/pdf.worker.mjs?url"),
    import("pdfjs-dist"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => String(item?.str ?? "").trim())
      .filter(Boolean)
      .join(" ");
    if (pageText) pages.push(pageText);
  }

  await pdf.destroy();
  return pages.join("\n");
}

async function extractSpreadsheetText(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheets = workbook.SheetNames
    .map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return "";
      const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ";" }).trim();
      return csv ? `Feuille ${sheetName}\n${csv}` : "";
    })
    .filter(Boolean);

  return sheets.join("\n\n");
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text : null;
}

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeUnit(unit: unknown): DocumentUnit {
  const value = normalizeKey(unit);
  if (["m2", "m 2"].includes(value)) return "m2";
  if (["m3", "m 3"].includes(value)) return "m3";
  if (["ml", "m", "metre lineaire"].includes(value)) return "ml";
  if (["kg", "kilo", "g", "gramme", "grammes"].includes(value)) return "kg";
  if (["l", "litre", "litres"].includes(value)) return "l";
  if (["h", "heure"].includes(value)) return "h";
  if (["forfait", "ens", "ensemble"].includes(value)) return "forfait";
  return "u";
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function positivePrice(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function extractPrice(text: string): number | null {
  const match = text.match(/(?:prix|achat|tarif)[^0-9]{0,80}([0-9]+(?:[\s.,][0-9]{2})?)/i);
  return parseLooseNumber(match?.[1]);
}

function parseLooseNumber(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text.replace(/\s+/g, "").replace(",", "."));
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}

function computeCoverageUnitPrice(price: number | null, coverageM2: number | null): number | null {
  if (price === null || coverageM2 === null || coverageM2 <= 0) return null;
  return Math.round((price / coverageM2) * 100) / 100;
}

function computeSalePrice(purchasePrice: number | null, marginRate: number): number | null {
  if (purchasePrice === null) return null;
  return Math.round(purchasePrice * (1 + marginRate / 100) * 100) / 100;
}

function extractShortTechnicalNote(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 700) : null;
}

function formatMaybeCurrency(value: unknown): string {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "Non trouve";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(number);
}

function confidenceClassName(confidence: number | null | undefined) {
  const value = confidence ?? 0;
  if (value >= 0.8) return "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700";
  if (value >= 0.55) return "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700";
  return "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700";
}
