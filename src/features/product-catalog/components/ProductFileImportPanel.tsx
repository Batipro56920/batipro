import { useMemo, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import * as XLSX from "xlsx";
import { CheckCircle2, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import type { SupplierRow } from "../../../services/suppliers.service";
import type { DocumentUnit } from "../../document-engine";
import type { ProductCatalogDraft, ProductCatalogItem, ProductSupplierPrice } from "../domain/types";
import type { ExtractedQuoteProduct } from "../services/productQuoteImport.service";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const ACCEPTED_PRODUCT_FILES = "application/pdf,.pdf,.xlsx,.xls,.csv,.txt,text/plain,text/csv";
const SUPPORTED_FILE_LABEL = "PDF, Excel, CSV ou texte";

type ExtractProductsResponse = {
  ok?: boolean;
  error?: string;
  products?: ExtractedQuoteProduct[];
};

type ProductDraftPatch = Partial<ProductCatalogDraft | ProductCatalogItem>;

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
  const hasFiles = fileNames.length > 0;
  const label = useMemo(() => fileNames.slice(0, 3).join(", ") + (fileNames.length > 3 ? ` +${fileNames.length - 3}` : ""), [fileNames]);

  async function onFileChange(files: FileList | null) {
    setError(null);
    setResult(null);
    if (!files?.length) return;

    const selectedFiles = Array.from(files);
    const unsupported = selectedFiles.find((file) => !isSupportedProductFile(file));
    if (unsupported) {
      setFileNames([]);
      setError(`Fichier non pris en charge : ${unsupported.name}. Formats acceptés : ${SUPPORTED_FILE_LABEL}.`);
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
        throw new Error("Texte insuffisant dans ces fichiers. Vérifiez que le document contient des informations produit lisibles.");
      }

      const extractedProducts = await extractProducts(cleanedText);
      const bestProduct = chooseBestProduct(extractedProducts);
      if (!bestProduct) {
        throw new Error("Aucune information produit exploitable n'a été détectée dans ces fichiers.");
      }

      const patch = buildProductPatch(currentProduct, bestProduct, selectedFiles, suppliers);
      onApply(patch);
      setResult(`${bestProduct.designation} détecté et appliqué à la fiche.`);
    } catch (err: any) {
      setError(err?.message ?? "Analyse automatique du fichier impossible.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  function clearFiles() {
    setFileNames([]);
    setError(null);
    setResult(null);
  }

  return (
    <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-950">Import automatique depuis fichier produit</div>
          <p className="mt-1 text-sm text-slate-600">
            Importez une fiche technique, notice, tarif fournisseur ou document produit. Batipro lit le contenu et préremplit la fiche ouverte.
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

      {result ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {result}
        </div>
      ) : null}

      {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
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
): ProductDraftPatch {
  const supplierName = normalizeText(extracted.supplier_name);
  const supplier = supplierName ? suppliers.find((row) => normalizeKey(row.name) === normalizeKey(supplierName)) ?? null : null;
  const supplierNegotiatedPrice = positiveNumber(extracted.purchase_price_ht) ?? positiveNumber(extracted.package_price_ht);
  const coverageM2 = positiveNumber(extracted.coverage_m2);
  const unitPrice = computeCoverageUnitPrice(supplierNegotiatedPrice, coverageM2) ?? supplierNegotiatedPrice;
  const marginRate = positiveNumber(currentProduct.targetMarginRate) ?? 30;
  const salePrice = positiveNumber(extracted.sale_price_ht) ?? computeSalePrice(unitPrice, marginRate);
  const unit = coverageM2 && coverageM2 > 0 ? "m2" : normalizeUnit(extracted.unit);
  const supplierPrice = buildSupplierPrice(extracted, supplier, supplierNegotiatedPrice);
  const nextSupplierPrices = supplierPrice
    ? mergeSupplierPrice(currentProduct.supplierPrices, supplierPrice)
    : currentProduct.supplierPrices;
  const importedDocuments = files.map((file) => ({
    id: crypto.randomUUID(),
    kind: "technical_sheet" as const,
    name: file.name,
    url: null,
    usage: { task: true, doe: true },
    notes: "Fichier importé pour analyse automatique de la fiche produit. Stockage documentaire à raccorder au lot Supabase Storage.",
  }));

  return {
    designation: normalizeText(extracted.designation) ?? currentProduct.designation,
    manufacturerReference: normalizeText(extracted.supplier_reference) ?? currentProduct.manufacturerReference,
    brand: normalizeText(extracted.brand) ?? currentProduct.brand,
    category: normalizeText(extracted.category) ?? currentProduct.category ?? "Matériaux",
    unit,
    vatRate: positiveNumber(extracted.vat_rate) ?? currentProduct.vatRate,
    mainSupplierId: supplier?.id ?? currentProduct.mainSupplierId,
    mainSupplierName: supplier?.name ?? supplierName ?? currentProduct.mainSupplierName,
    standardPurchasePriceHt: unitPrice ?? currentProduct.standardPurchasePriceHt,
    recommendedSalePriceHt: salePrice ?? currentProduct.recommendedSalePriceHt,
    supplierPrices: nextSupplierPrices,
    documents: [...currentProduct.documents, ...importedDocuments],
  };
}

function buildSupplierPrice(
  extracted: ExtractedQuoteProduct,
  supplier: SupplierRow | null,
  supplierNegotiatedPrice: number | null,
): ProductSupplierPrice | null {
  const supplierName = normalizeText(extracted.supplier_name);
  if (supplierNegotiatedPrice === null || supplierNegotiatedPrice <= 0) return null;
  if (!supplier && !supplierName) return null;

  const coverageM2 = positiveNumber(extracted.coverage_m2);
  const pricePerM2 = computeCoverageUnitPrice(supplierNegotiatedPrice, coverageM2);

  return {
    id: crypto.randomUUID(),
    supplierId: supplier?.id ?? null,
    supplierName: supplier?.name ?? supplierName ?? "",
    priceHt: supplierNegotiatedPrice,
    discountPercent: null,
    startDate: null,
    endDate: null,
    packaging: normalizeText(extracted.packaging),
    minimumQuantity: positiveNumber(extracted.quantity) ?? positiveNumber(extracted.minimum_quantity),
    deliveryLeadTimeDays: null,
    coverageM2,
    pricePerM2Ht: pricePerM2,
  };
}

function mergeSupplierPrice(prices: ProductSupplierPrice[], candidate: ProductSupplierPrice): ProductSupplierPrice[] {
  const exists = prices.some((price) => {
    const sameSupplier = candidate.supplierId
      ? price.supplierId === candidate.supplierId
      : normalizeKey(price.supplierName) === normalizeKey(candidate.supplierName);
    return sameSupplier
      && price.priceHt === candidate.priceHt
      && normalizeKey(price.packaging) === normalizeKey(candidate.packaging)
      && (price.coverageM2 ?? null) === (candidate.coverageM2 ?? null);
  });
  return exists ? prices : [...prices, candidate];
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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeUnit(unit: unknown): DocumentUnit {
  const value = normalizeKey(unit);
  if (["m2", "m 2", "m²"].includes(value)) return "m2";
  if (["m3", "m 3"].includes(value)) return "m3";
  if (["ml", "m", "metre lineaire"].includes(value)) return "ml";
  if (["kg", "kilo"].includes(value)) return "kg";
  if (["l", "litre"].includes(value)) return "l";
  if (["h", "heure"].includes(value)) return "h";
  if (["forfait", "ens", "ensemble"].includes(value)) return "forfait";
  return "u";
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function computeCoverageUnitPrice(price: number | null, coverageM2: number | null): number | null {
  if (price === null || coverageM2 === null || coverageM2 <= 0) return null;
  return roundPrice(price / coverageM2);
}

function computeSalePrice(purchasePrice: number | null, marginRate: number): number | null {
  if (purchasePrice === null) return null;
  return roundPrice(purchasePrice * (1 + marginRate / 100));
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}
