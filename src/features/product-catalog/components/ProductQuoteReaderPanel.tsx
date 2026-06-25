import { useMemo, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { CheckCircle2, FileText, Loader2, UploadCloud, X } from "lucide-react";
import type { ProductQuoteImportResult } from "../services/productQuoteImport.service";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export default function ProductQuoteReaderPanel({
  busy,
  result,
  onImport,
}: {
  busy: boolean;
  result: ProductQuoteImportResult | null;
  onImport: (text: string) => Promise<void> | void;
}) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const isWorking = busy || extracting;
  const canImport = useMemo(() => text.trim().length >= 20 && !isWorking, [isWorking, text]);

  async function submit() {
    if (!canImport) return;
    await onImport(text);
  }

  async function onFileChange(file: File | null) {
    setFileError(null);
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setFileError("Le lecteur produits accepte uniquement les devis PDF.");
      setFileName(null);
      return;
    }

    setExtracting(true);
    setFileName(file.name);
    try {
      const extractedText = await extractPdfText(file);
      if (extractedText.trim().length < 20) {
        throw new Error("Texte insuffisant dans ce PDF. Vérifiez que le devis n'est pas uniquement une image scannée.");
      }
      setText(extractedText);
    } catch (err: any) {
      setFileError(err?.message ?? "Lecture du PDF impossible.");
      setFileName(null);
    } finally {
      setExtracting(false);
    }
  }

  function clearFile() {
    setFileName(null);
    setFileError(null);
    setText("");
  }

  return (
    <section className="rounded-3xl border border-blue-100 bg-blue-50/60 p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
            <UploadCloud className="h-3.5 w-3.5" /> Lecteur de devis IA
          </div>
          <h2 className="mt-3 text-base font-semibold text-slate-950">Créer automatiquement des produits depuis un devis fournisseur</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Importez un PDF fournisseur. Le lecteur extrait le texte, l'envoie à l'IA, rattache le fournisseur détecté, crée le fournisseur s'il manque, puis remplit prix, unité, TVA, marque, catégorie et référence quand l'information est présente.
          </p>
        </div>
        <button
          type="button"
          disabled={!canImport}
          onClick={() => void submit()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {extracting ? "Lecture PDF..." : busy ? "Création en cours..." : "Créer les produits"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-blue-100 bg-white p-3">
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-blue-200 bg-blue-50/50 px-4 py-6 text-center hover:bg-blue-50">
            <FileText className="h-8 w-8 text-blue-600" />
            <span className="mt-3 text-sm font-semibold text-slate-950">Importer un PDF devis</span>
            <span className="mt-1 text-xs text-slate-500">PDF fournisseur ou grille tarifaire</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              disabled={isWorking}
              className="sr-only"
              onChange={(event) => void onFileChange(event.target.files?.[0] ?? null)}
            />
          </label>

          {fileName ? (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              <span className="truncate">{fileName}</span>
              <button type="button" disabled={isWorking} onClick={clearFile} className="rounded-lg p-1 hover:bg-white disabled:opacity-50" aria-label="Retirer le PDF">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {fileError ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{fileError}</div> : null}
        </div>

        <textarea
          className="min-h-44 w-full rounded-2xl border border-blue-100 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-300"
          placeholder="Le texte extrait du PDF apparaît ici. Vous pouvez aussi coller le texte d'un devis fournisseur avant de créer les produits."
          value={text}
          disabled={isWorking}
          onChange={(event) => {
            setText(event.target.value);
            if (fileName) setFileName(null);
          }}
        />
      </div>

      {result ? (
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-5">
          <ImportMetric label="Lignes détectées" value={result.extracted} />
          <ImportMetric label="Produits créés" value={result.createdProducts} />
          <ImportMetric label="Produits mis à jour" value={result.updatedProducts} />
          <ImportMetric label="Fournisseurs créés" value={result.createdSuppliers} />
          <ImportMetric label="Doublons ignorés" value={result.skippedProducts} />
          {result.products.length ? (
            <div className="rounded-2xl border border-emerald-100 bg-white p-3 text-emerald-700 md:col-span-5">
              <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" /> Import terminé</div>
              <div className="mt-1 text-xs text-emerald-700/80">
                Derniers produits traités : {result.products.slice(0, 5).map((product) => product.designation).join(", ")}
                {result.products.length > 5 ? "..." : ""}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
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

function ImportMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-950">{value}</div>
    </div>
  );
}
