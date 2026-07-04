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

type ProductTechnicalInsights = {
  consumptionRatioQuantity: number | null;
  consumptionRatioUnit: string | null;
  ratioBaseUnit: string | null;
  lossPercent: number | null;
  workMethod: string | null;
  applicationScope: string | null;
  technicalNotes: string[];
};

type ProductPriceInsights = {
  unitPurchasePrice: number | null;
  packagePurchasePrice: number | null;
  salePrice: number | null;
  notes: string[];
};

type ProductDraftPatch = Partial<ProductCatalogDraft | ProductCatalogItem>;

type ProductImportAnalysis = {
  product: ExtractedQuoteProduct;
  insights: ProductTechnicalInsights;
  priceInsights: ProductPriceInsights;
  patch: ProductDraftPatch;
  interpretation: string | null;
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

      const insights = extractProductTechnicalInsights(cleanedText, bestProduct);
      const priceInsights = extractProductPriceInsights(cleanedText, bestProduct, currentProduct);
      const patch = buildProductPatch(currentProduct, bestProduct, selectedFiles, suppliers, insights, priceInsights);
      setPendingAnalysis({
        product: bestProduct,
        insights,
        priceInsights,
        patch,
        interpretation: getBusinessInterpretation(bestProduct),
      });
      setResult("Analyse Coco prête à vérifier avant application.");
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
    const ratioLabel = pendingAnalysis.insights.consumptionRatioQuantity && pendingAnalysis.insights.consumptionRatioUnit && pendingAnalysis.insights.ratioBaseUnit
      ? ` Ratio ${formatNumber(pendingAnalysis.insights.consumptionRatioQuantity)} ${pendingAnalysis.insights.consumptionRatioUnit}/${pendingAnalysis.insights.ratioBaseUnit}.`
      : "";
    const priceLabel = pendingAnalysis.priceInsights.unitPurchasePrice || pendingAnalysis.priceInsights.packagePurchasePrice || pendingAnalysis.priceInsights.salePrice
      ? " Prix renseignés."
      : "";
    const methodLabel = pendingAnalysis.insights.workMethod ? " Mode opératoire créé." : "";
    setResult(`${pendingAnalysis.product.designation} appliqué à la fiche.${ratioLabel}${priceLabel}${methodLabel}`);
    setPendingAnalysis(null);
  }

  return (
    <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-950">Import intelligent par Coco</div>
          <p className="mt-1 text-sm text-slate-600">
            Importez une fiche technique, notice, tarif fournisseur ou document produit. Coco lit, interprète les données métier, puis vous montre ce qu'il a compris avant de remplir la fiche.
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
            {buildReadOnlyMetric("Prix achat HT", pendingAnalysis.priceInsights.unitPurchasePrice !== null ? `${formatNumber(pendingAnalysis.priceInsights.unitPurchasePrice)} EUR` : "Non trouvé")}
            {buildReadOnlyMetric("Prix vente HT", pendingAnalysis.priceInsights.salePrice !== null ? `${formatNumber(pendingAnalysis.priceInsights.salePrice)} EUR` : "Calculé après achat")}
            {buildReadOnlyMetric(
              "Ratio tâche",
              pendingAnalysis.insights.consumptionRatioQuantity && pendingAnalysis.insights.consumptionRatioUnit && pendingAnalysis.insights.ratioBaseUnit
                ? `${formatNumber(pendingAnalysis.insights.consumptionRatioQuantity)} ${pendingAnalysis.insights.consumptionRatioUnit}/${pendingAnalysis.insights.ratioBaseUnit}`
                : "Non trouvé",
            )}
            {buildReadOnlyMetric("Perte", pendingAnalysis.insights.lossPercent !== null ? `${formatNumber(pendingAnalysis.insights.lossPercent)} %` : "Non trouvée")}
          </div>

          {pendingAnalysis.interpretation ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <span className="font-medium">Interprétation métier : </span>{pendingAnalysis.interpretation}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <AnalysisTextBlock title="Domaine d'application" text={pendingAnalysis.insights.applicationScope} />
            <AnalysisTextBlock title="Mode opératoire" text={pendingAnalysis.insights.workMethod} />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => setPendingAnalysis(null)}>
              Ne pas appliquer
            </button>
            <button type="button" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800" onClick={applyPendingAnalysis}>
              Appliquer à la fiche
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

function AnalysisTextBlock({ title, text }: { title: string; text: string | null }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <div className="font-medium text-slate-900">{title}</div>
      <div className="mt-1 whitespace-pre-line text-slate-600">{text || "Non trouvé dans le document."}</div>
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
  insights: ProductTechnicalInsights,
  priceInsights: ProductPriceInsights,
): ProductDraftPatch {
  const supplierName = normalizeText(extracted.supplier_name);
  const supplier = supplierName ? suppliers.find((row) => normalizeKey(row.name) === normalizeKey(supplierName)) ?? null : null;
  const coverageM2 = positivePrice(extracted.coverage_m2);
  const supplierNegotiatedPrice = priceInsights.packagePurchasePrice
    ?? positivePrice(extracted.package_price_ht)
    ?? priceInsights.unitPurchasePrice;
  const unitPrice = priceInsights.unitPurchasePrice
    ?? computeCoverageUnitPrice(supplierNegotiatedPrice, coverageM2)
    ?? supplierNegotiatedPrice;
  const marginRate = positiveNumber(currentProduct.targetMarginRate) ?? 30;
  const salePrice = computeSalePrice(unitPrice, marginRate)
    ?? priceInsights.salePrice
    ?? positivePrice(currentProduct.recommendedSalePriceHt);
  const extractedUnit = normalizeUnit(extracted.unit);
  const currentUnit = normalizeUnit(currentProduct.unit);
  const unit = extractedUnit !== "u" ? extractedUnit : coverageM2 && coverageM2 > 0 ? "m2" : currentUnit;
  const supplierPrice = buildSupplierPrice(extracted, supplier, supplierNegotiatedPrice, unitPrice, priceInsights);
  const nextSupplierPrices = supplierPrice
    ? mergeSupplierPrice(currentProduct.supplierPrices, supplierPrice)
    : currentProduct.supplierPrices;
  const importedDocuments = buildImportedDocuments(files, extracted, insights, priceInsights);

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

function buildImportedDocuments(
  files: File[],
  extracted: ExtractedQuoteProduct,
  insights: ProductTechnicalInsights,
  priceInsights: ProductPriceInsights,
): ProductCatalogItem["documents"] {
  const businessInterpretation = getBusinessInterpretation(extracted);
  const technicalNotes = [
    businessInterpretation ? `Interprétation Coco: ${businessInterpretation}` : null,
    ...insights.technicalNotes,
    ...priceInsights.notes,
    insights.consumptionRatioQuantity && insights.consumptionRatioUnit && insights.ratioBaseUnit
      ? `Ratio matériau Batipro: ${formatNumber(insights.consumptionRatioQuantity)} ${insights.consumptionRatioUnit}/${insights.ratioBaseUnit}`
      : null,
    insights.lossPercent !== null ? `Perte préconisée: ${formatNumber(insights.lossPercent)} %` : null,
    normalizeText(extracted.packaging) ? `Conditionnement: ${normalizeText(extracted.packaging)}` : null,
    positiveNumber(extracted.coverage_m2) ? `Couverture conditionnement: ${formatNumber(positiveNumber(extracted.coverage_m2) ?? 0)} m2` : null,
  ].filter((note): note is string => Boolean(note));

  const documents: ProductCatalogItem["documents"] = files.map((file) => ({
    id: crypto.randomUUID(),
    kind: "technical_sheet" as const,
    name: file.name,
    url: null,
    usage: { task: true, doe: true },
    notes: [
      "Fichier importé pour analyse automatique de la fiche produit. Stockage documentaire à raccorder au lot Supabase Storage.",
      ...technicalNotes,
    ].join("\n"),
  }));

  if (insights.applicationScope) {
    documents.push({
      id: crypto.randomUUID(),
      kind: "application_scope",
      name: "Domaine d'application extrait",
      url: null,
      usage: { task: true, doe: false },
      notes: insights.applicationScope,
    });
  }

  if (insights.workMethod) {
    documents.push({
      id: crypto.randomUUID(),
      kind: "work_method",
      name: "Mode opératoire extrait",
      url: null,
      usage: { task: true, doe: false },
      notes: insights.workMethod,
    });
  }

  return documents;
}

function buildSupplierPrice(
  extracted: ExtractedQuoteProduct,
  supplier: SupplierRow | null,
  supplierNegotiatedPrice: number | null,
  unitPrice: number | null,
  priceInsights: ProductPriceInsights,
): ProductSupplierPrice | null {
  const supplierName = normalizeText(extracted.supplier_name);
  if (supplierNegotiatedPrice === null || supplierNegotiatedPrice <= 0) return null;
  if (!supplier && !supplierName) return null;

  const coverageM2 = positiveNumber(extracted.coverage_m2);
  const pricePerM2 = unitPrice ?? computeCoverageUnitPrice(supplierNegotiatedPrice, coverageM2) ?? priceInsights.unitPurchasePrice;

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

function extractProductTechnicalInsights(text: string, extracted: ExtractedQuoteProduct): ProductTechnicalInsights {
  const explicit = extracted as ExtractedQuoteProduct & Record<string, unknown>;
  const preferredUnit = normalizeUnit(extracted.unit);
  const localRatio = extractConsumptionRatio(text, preferredUnit);
  const explicitRatioQuantity = positiveNumber(explicit.consumption_ratio_quantity ?? explicit.material_ratio_quantity ?? explicit.ratio_quantity);
  const explicitRatioUnit = normalizeText(explicit.consumption_ratio_unit ?? explicit.material_ratio_unit ?? explicit.ratio_unit);
  const explicitBaseUnit = normalizeText(explicit.consumption_base_unit ?? explicit.ratio_base_unit);
  const ratioQuantity = explicitRatioQuantity ?? localRatio?.quantity ?? null;
  const ratioUnit = explicitRatioUnit ? normalizeRatioUnit(explicitRatioUnit) : localRatio?.unit ?? null;
  const baseUnit = explicitBaseUnit ? normalizeRatioUnit(explicitBaseUnit) : localRatio?.baseUnit ?? null;
  const lossPercent = positiveNumber(explicit.loss_percent) ?? extractLossPercent(text);
  const workMethod = cleanBusinessText(explicit.work_method, 1600) ?? cleanBusinessText(extractSection(text, [
    "mode operatoire",
    "mode opératoire",
    "mise en oeuvre",
    "mise en œuvre",
    "application",
    "preparation",
    "préparation",
    "utilisation",
  ]), 1600);
  const applicationScope = cleanBusinessText(explicit.application_scope, 1200) ?? cleanBusinessText(extractSection(text, [
    "domaine d'application",
    "domaines d'application",
    "emploi",
    "destination",
    "supports admis",
    "supports",
  ]), 1200);
  const technicalNotes = [
    cleanBusinessText(explicit.technical_notes, 900),
    ratioQuantity && ratioUnit && baseUnit ? `Consommation extraite: ${formatNumber(ratioQuantity)} ${ratioUnit}/${baseUnit}` : null,
    lossPercent !== null ? `Perte extraite: ${formatNumber(lossPercent)} %` : null,
  ].filter((note): note is string => Boolean(note));

  return {
    consumptionRatioQuantity: ratioQuantity,
    consumptionRatioUnit: ratioUnit,
    ratioBaseUnit: baseUnit,
    lossPercent,
    workMethod,
    applicationScope,
    technicalNotes,
  };
}

function extractProductPriceInsights(
  text: string,
  extracted: ExtractedQuoteProduct,
  currentProduct: ProductCatalogDraft | ProductCatalogItem,
): ProductPriceInsights {
  const explicitPurchasePrice = positivePrice(extracted.purchase_price_ht);
  const explicitSalePrice = positivePrice(extracted.sale_price_ht);
  const normalized = text.replace(/\s+/g, " ");
  const priceContext = hasExplicitPriceContext(normalized);
  const extractedPackagePrice = priceContext ? positivePrice(extracted.package_price_ht) : null;
  const purchaseFromText = extractPriceByPatterns(normalized, [
    /(?:prix\s*(?:d['’ ]achat|achat)|achat\s*ht|pa\s*ht|prix\s*fournisseur|tarif\s*fournisseur|prix\s*standard)[^0-9€]{0,80}([0-9]+(?:[\s.,][0-9]{2})?)\s*(?:€|eur)?\s*(?:ht)?\s*(?:\/|par)?\s*(m²|m2|l|litre|kg|u|unité|unite)?/i,
    /([0-9]+(?:[\s.,][0-9]{2})?)\s*(?:€|eur)\s*(?:ht)?\s*(?:\/|par)?\s*(m²|m2|l|litre|kg|u|unité|unite)?[^.]{0,80}(?:prix\s*(?:d['’ ]achat|achat)|achat\s*ht|pa\s*ht|prix\s*fournisseur|tarif\s*fournisseur)/i,
  ]);
  const saleFromText = extractPriceByPatterns(normalized, [
    /(?:prix\s*(?:de\s*)?vente|vente\s*ht|pv\s*ht|prix\s*public|vente\s*conseill[ée]e)[^0-9€]{0,80}([0-9]+(?:[\s.,][0-9]{2})?)\s*(?:€|eur)?\s*(?:ht)?\s*(?:\/|par)?\s*(m²|m2|l|litre|kg|u|unité|unite)?/i,
    /([0-9]+(?:[\s.,][0-9]{2})?)\s*(?:€|eur)\s*(?:ht)?\s*(?:\/|par)?\s*(m²|m2|l|litre|kg|u|unité|unite)?[^.]{0,80}(?:prix\s*(?:de\s*)?vente|vente\s*ht|pv\s*ht|prix\s*public|vente\s*conseill[ée]e)/i,
  ]);
  const existingSupplierUnitPrice = getBestExistingSupplierUnitPrice(currentProduct);
  const unitPurchasePrice = explicitPurchasePrice
    ?? purchaseFromText?.price
    ?? existingSupplierUnitPrice
    ?? positivePrice(currentProduct.standardPurchasePriceHt)
    ?? null;
  const packagePurchasePrice = extractedPackagePrice ?? null;
  const salePrice = explicitSalePrice
    ?? computeSalePrice(unitPurchasePrice, positiveNumber(currentProduct.targetMarginRate) ?? 30)
    ?? saleFromText?.price
    ?? positivePrice(currentProduct.recommendedSalePriceHt);
  const notes = [
    unitPurchasePrice !== null ? `Prix achat standard retenu: ${formatNumber(unitPurchasePrice)} EUR HT` : null,
    packagePurchasePrice !== null ? `Prix conditionnement retenu: ${formatNumber(packagePurchasePrice)} EUR HT` : null,
    salePrice !== null ? `Prix vente conseillé calculé: ${formatNumber(salePrice)} EUR HT` : null,
  ].filter((note): note is string => Boolean(note));

  return { unitPurchasePrice, packagePurchasePrice, salePrice, notes };
}

function hasExplicitPriceContext(text: string): boolean {
  return /(?:€|eur|prix|tarif|achat\s*ht|vente\s*ht|pa\s*ht|pv\s*ht)/i.test(text);
}

function extractPriceByPatterns(text: string, patterns: RegExp[]): { price: number; unit: string | null } | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const price = parseLooseNumber(match?.[1]);
    if (price !== null && price > 0) {
      return { price: roundPrice(price), unit: normalizeText(match?.[2]) };
    }
  }
  return null;
}

function getBestExistingSupplierUnitPrice(product: ProductCatalogDraft | ProductCatalogItem): number | null {
  const prices = product.supplierPrices
    .map((price) => {
      const explicitUnitPrice = positivePrice(price.pricePerM2Ht);
      if (explicitUnitPrice !== null) return explicitUnitPrice;

      const packagePrice = positivePrice(price.priceHt);
      const coverage = positivePrice(price.coverageM2);
      if (packagePrice !== null && coverage !== null) return computeCoverageUnitPrice(packagePrice, coverage);
      return packagePrice;
    })
    .filter((price): price is number => price !== null && price > 0)
    .sort((a, b) => a - b);
  return prices[0] ?? null;
}

function extractConsumptionRatio(text: string, preferredUnit?: DocumentUnit): { quantity: number; unit: string; baseUnit: string } | null {
  const normalized = text.replace(/\s+/g, " ");
  const candidates: Array<{ quantity: number; unit: string; baseUnit: string; priority: number }> = [];
  const directPatterns = [
    /(?:consommation|consomation|conso\.?|dosage|ratio)[^\d]{0,120}(\d+(?:[,.]\d+)?)\s*(l|litres?|kg|g|ml|m²|m2|m3|m³|u|unite|unité)\s*(?:\/|par|pour)\s*(m²|m2|m3|m³|ml|m|u|unite|unité)/gi,
    /(\d+(?:[,.]\d+)?)\s*(l|litres?|kg|g|ml)\s*(?:\/|par)\s*(m²|m2)[^.]{0,140}(?:consommation|rendement|application|appliquer|couche|classe)/gi,
    /(?:appliquer|application|couche|classe)[^.]{0,160}?(\d+(?:[,.]\d+)?)\s*(l|litres?|kg|g|ml)\s*\/\s*(m²|m2)/gi,
  ];

  for (const pattern of directPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(normalized)) !== null) {
      const candidate = buildRatioCandidate(match[1], match[2], match[3], 2);
      if (candidate) candidates.push(candidate);
    }
  }

  const anyRatioPattern = /(\d+(?:[,.]\d+)?)\s*(l|litres?|kg|g|ml)\s*\/\s*(m²|m2)/gi;
  let anyMatch: RegExpExecArray | null;
  while ((anyMatch = anyRatioPattern.exec(normalized)) !== null) {
    const context = normalized.slice(Math.max(0, anyMatch.index - 140), anyMatch.index + 180);
    if (!/(consommation|rendement|application|appliquer|couche|classe|m2|m²|pantifilm)/i.test(context)) continue;
    const candidate = buildRatioCandidate(anyMatch[1], anyMatch[2], anyMatch[3], 1);
    if (candidate) candidates.push(candidate);
  }

  const yieldPattern = /(?:rendement|couvre|couverture)[^\d]{0,80}(\d+(?:[,.]\d+)?)\s*(m²|m2)\s*(?:\/|par|pour)\s*(l|litre|litres|kg|pot|seau|sac|unite|unité|u)/i;
  const yieldMatch = normalized.match(yieldPattern);
  const yieldedSurface = parseLooseNumber(yieldMatch?.[1]);
  if (yieldedSurface !== null && yieldedSurface > 0 && yieldMatch?.[3]) {
    candidates.push({ quantity: roundPrice(1 / yieldedSurface), unit: normalizeRatioUnit(yieldMatch[3]), baseUnit: "m2", priority: 1 });
  }

  const preferredRatioUnit = normalizeRatioUnit(preferredUnit);
  const unique = candidates.filter((candidate, index) => candidates.findIndex((other) => sameRatioCandidate(candidate, other)) === index);
  unique.sort((a, b) => {
    const aPreferred = preferredRatioUnit && a.unit === preferredRatioUnit ? 1 : 0;
    const bPreferred = preferredRatioUnit && b.unit === preferredRatioUnit ? 1 : 0;
    return bPreferred - aPreferred || b.priority - a.priority;
  });

  return unique[0] ? { quantity: unique[0].quantity, unit: unique[0].unit, baseUnit: unique[0].baseUnit } : null;
}

function buildRatioCandidate(rawQuantity: unknown, rawUnit: unknown, rawBaseUnit: unknown, priority: number) {
  const quantity = parseLooseNumber(rawQuantity);
  if (quantity === null || quantity <= 0) return null;
  const unit = normalizeRatioUnit(rawUnit);
  const baseUnit = normalizeRatioUnit(rawBaseUnit);
  if (!unit || !baseUnit) return null;

  if (unit === "g") {
    return { quantity: roundPrice(quantity / 1000), unit: "kg", baseUnit, priority };
  }
  return { quantity: roundPrice(quantity), unit, baseUnit, priority };
}

function sameRatioCandidate(
  a: { quantity: number; unit: string; baseUnit: string },
  b: { quantity: number; unit: string; baseUnit: string },
) {
  return a.quantity === b.quantity && a.unit === b.unit && a.baseUnit === b.baseUnit;
}

function extractLossPercent(text: string): number | null {
  const match = text.match(/(?:perte|chute|gaspillage|majoration)[^\d]{0,60}(\d+(?:[,.]\d+)?)\s*%/i);
  const value = parseLooseNumber(match?.[1]);
  return value !== null && value >= 0 && value <= 100 ? roundPrice(value) : null;
}

function extractSection(text: string, headings: string[]): string | null {
  const lines = text
    .split(/\r?\n|(?<=\.)\s+(?=[A-ZÉÈÀÂÎÔÛÇ])/)
    .map((line) => normalizeText(line))
    .filter((line): line is string => Boolean(line));
  const normalizedHeadings = headings.map(normalizeKey);
  const startIndex = lines.findIndex((line) => normalizedHeadings.some((heading) => normalizeKey(line).includes(heading)));
  if (startIndex < 0) return null;

  const selected: string[] = [];
  for (const line of lines.slice(startIndex, startIndex + 12)) {
    const clean = line.replace(/\s+/g, " ").trim();
    if (!clean || isTechnicalSheetNoise(clean)) continue;
    selected.push(clean);
    if (selected.join(" ").length > 700) break;
  }

  return selected.join("\n").slice(0, 1200) || null;
}

function cleanBusinessText(value: unknown, maxLength: number): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  const lines = text
    .replace(/■/g, "\n")
    .split(/\r?\n|(?<=\.)\s+(?=[A-ZÉÈÀÂÎÔÛÇ])/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isTechnicalSheetNoise(line));

  const cleaned = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function isTechnicalSheetNoise(value: string): boolean {
  const key = normalizeKey(value);
  if (!key) return true;
  return [
    "il appartient a notre clientele de verifier",
    "derniere edition",
    "immeuble union square",
    "rueil malmaison",
    "www seigneurie com",
    "tel",
    "fax",
    "telephone",
    "declaration environnementale",
    "donnees environnementales",
    "certification de construction qualite",
    "production toutes nos usines",
    "fiche de donnees de securite",
    "valeur limite ue",
    "directive 2004 42 ce",
    "emissions dans l air interieur",
    "inies",
    "iso 14001",
    "ppg ac france",
  ].some((noise) => key.includes(noise));
}

function getBusinessInterpretation(product: ExtractedQuoteProduct): string | null {
  const explicit = product as ExtractedQuoteProduct & Record<string, unknown>;
  return normalizeText(explicit.business_interpretation ?? explicit.interpretation_metier);
}

function confidenceClassName(confidence: number | null | undefined) {
  const value = confidence ?? 0;
  if (value >= 0.8) return "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700";
  if (value >= 0.55) return "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700";
  return "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700";
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
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeUnit(unit: unknown): DocumentUnit {
  const value = normalizeKey(unit);
  if (["m2", "m 2", "m²"].includes(value)) return "m2";
  if (["m3", "m 3", "m³"].includes(value)) return "m3";
  if (["ml", "m", "metre lineaire"].includes(value)) return "ml";
  if (["kg", "kilo"].includes(value)) return "kg";
  if (["g", "gramme", "grammes"].includes(value)) return "kg";
  if (["l", "litre", "litres"].includes(value)) return "l";
  if (["h", "heure"].includes(value)) return "h";
  if (["forfait", "ens", "ensemble"].includes(value)) return "forfait";
  return "u";
}

function normalizeRatioUnit(unit: unknown): string {
  const value = normalizeKey(unit);
  if (["m2", "m 2", "m²"].includes(value)) return "m2";
  if (["m3", "m 3", "m³"].includes(value)) return "m3";
  if (["l", "litre", "litres", "pot", "seau"].includes(value)) return "l";
  if (["kg", "kilo", "sac"].includes(value)) return "kg";
  if (["g", "gramme", "grammes"].includes(value)) return "g";
  if (["ml", "m", "metre", "metre lineaire"].includes(value)) return "ml";
  if (["u", "unite", "unité"].includes(value)) return "u";
  return value || "u";
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function positivePrice(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseLooseNumber(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text.replace(/\s+/g, "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(value);
}
