import { useMemo, useState } from "react";
import { CheckCircle2, FileText, Loader2, UploadCloud, X } from "lucide-react";
import type { SupplierRow } from "../../../services/suppliers.service";
import type { ProductCatalogDraft, ProductCatalogItem, ProductKnowledge } from "../domain/types";
import { analyzeProductTextWithCoco } from "../services/productKnowledge.service";
import {
  buildProductPatch,
  storeProductFiles,
  type ProductDraftPatch,
} from "../services/productImportMapper";
import {
  ACCEPTED_PRODUCT_FILES,
  SUPPORTED_PRODUCT_FILE_LABEL,
  isSupportedProductFile,
  readProductFilesForAnalysis,
} from "../services/productFileReader";

type ProductImportAnalysis = {
  knowledge: ProductKnowledge;
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
      setError(`Fichier non pris en charge : ${unsupported.name}. Formats acceptes : ${SUPPORTED_PRODUCT_FILE_LABEL}.`);
      return;
    }

    setBusy(true);
    setFileNames(selectedFiles.map((file) => file.name));
    try {
      const { text: cleanedText, images } = await readProductFilesForAnalysis(selectedFiles);

      if (cleanedText.length < 20 && images.length === 0) {
        throw new Error("Texte insuffisant dans ces fichiers. Verifiez que le document contient des informations produit lisibles.");
      }

      const knowledge = await analyzeProductTextWithCoco(currentProduct, cleanedText, images);
      const productId = "id" in currentProduct ? currentProduct.id : "";
      const stored = await storeProductFiles(productId, selectedFiles);
      const patch = buildProductPatch(currentProduct, knowledge, stored.documents, suppliers, cleanedText);
      const notes = [...buildAnalysisNotes(knowledge, patch), ...stored.notes];
      setPendingAnalysis({ knowledge, patch, notes });
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
    setResult(`${pendingAnalysis.patch.designation ?? "Produit"} applique a la fiche.`);
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
              <div className="mt-1 text-sm text-slate-600">{pendingAnalysis.patch.designation}</div>
            </div>
            <span className={confidenceClassName(pendingAnalysis.knowledge.confidence.value.global)}>
              Confiance {confidenceLabel(pendingAnalysis.knowledge.confidence.value.global)}
            </span>
          </div>

          <div className="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
            {buildReadOnlyMetric("Designation", pendingAnalysis.patch.designation || "Non trouvee")}
            {buildReadOnlyMetric("Marque", pendingAnalysis.patch.brand || "Non trouvee")}
            {buildReadOnlyMetric("Prix achat", formatMaybeCurrency(pendingAnalysis.patch.standardPurchasePriceHt))}
            {buildReadOnlyMetric("Ratio / consommation", formatRatio(pendingAnalysis.knowledge.materialUsage.value))}
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

function buildAnalysisNotes(knowledge: ProductKnowledge, patch: ProductDraftPatch) {
  const usage = knowledge.materialUsage.value;
  return [
    patch.mainSupplierName ? `Fournisseur detecte : ${patch.mainSupplierName}` : null,
    patch.recommendedSalePriceHt ? `Prix vente estime : ${formatMaybeCurrency(patch.recommendedSalePriceHt)}` : null,
    usage.ratioQuantity ? `Ratio detecte : ${formatRatio(usage)}` : null,
    knowledge.confidence.value.missingInformation.length
      ? `Informations manquantes : ${knowledge.confidence.value.missingInformation.slice(0, 3).join(", ")}`
      : null,
  ].filter((note): note is string => Boolean(note));
}

function formatMaybeCurrency(value: unknown): string {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "Non trouve";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(number);
}

function formatRatio(usage: ProductKnowledge["materialUsage"]["value"]): string {
  if (!usage.ratioQuantity || !usage.sourceUnit) return "Non trouve";
  return `${usage.ratioQuantity} ${usage.ratioUnit ?? ""} / ${usage.sourceUnit}`.replace(/\s+/g, " ").trim();
}

function confidenceClassName(level: "high" | "medium" | "low") {
  if (level === "high") return "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700";
  if (level === "medium") return "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700";
  return "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700";
}

function confidenceLabel(level: "high" | "medium" | "low") {
  if (level === "high") return "Haute";
  if (level === "medium") return "Moyenne";
  return "Faible";
}
