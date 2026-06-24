import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, FileText, Loader2, ShieldCheck, Upload, X } from "lucide-react";
import {
  saveCocoControlledDraft,
  type CocoControlledDraft,
  type CocoVisitQuoteDraftLine,
} from "../services/cocoDirectionAssistant.service";

type HistoricalQuoteLine = CocoVisitQuoteDraftLine;
type SaveState = "idle" | "saving" | "saved" | "local" | "error";
type ImportStatus = "ready" | "warning" | "error";
type ImportedHistoricalFile = {
  id: string;
  name: string;
  extension: string;
  size: number;
  status: ImportStatus;
  extractedText: string;
  message: string;
};

const SOURCE_KIND = "historical_document_import";
const ACCEPTED_IMPORTS = ".pdf,.xlsx,.xls,.csv,.txt,.doc,.docx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MONEY_PATTERN = /(?:\d{1,3}(?:[\s.]\d{3})+(?:,\d{2})?|\d[\d\s]*,\d{2}|\d+\.\d{2})/g;
const QUANTITY_PATTERN = /(\d+(?:[,.]\d+)?)\s*(m2|m²|m3|m³|ml|u|unité|unites|h|heure|heures|forfait|ens|kg|l)\b/i;
const MAX_SOURCE_EXCERPTS = 36;

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function extensionOf(fileName: string) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function formatBytes(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
  if (value >= 1_000) return `${Math.round(value / 1_000).toLocaleString("fr-FR")} Ko`;
  return `${value.toLocaleString("fr-FR")} o`;
}

function parseFrenchNumber(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const withoutSpaces = raw.replace(/[\s\u00a0]/g, "");
  const normalized = withoutSpaces.includes(",")
    ? withoutSpaces.replace(/\./g, "").replace(",", ".")
    : withoutSpaces;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeUnit(value: string | null) {
  if (!value) return "u";
  const unit = value.toLowerCase();
  if (unit === "unité" || unit === "unites") return "u";
  if (unit === "heure" || unit === "heures") return "h";
  return unit;
}

function lineTitleFromText(line: string, firstMoneyIndex: number) {
  const beforeAmount = firstMoneyIndex > 0 ? line.slice(0, firstMoneyIndex) : line;
  return cleanText(beforeAmount.replace(/^[-•\d.\s]+/, "").replace(QUANTITY_PATTERN, ""));
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\u0000/g, " ")
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter(Boolean)
    .join("\n");
}

function containsMoney(value: string) {
  MONEY_PATTERN.lastIndex = 0;
  return MONEY_PATTERN.test(value);
}

function parseHistoricalQuoteText(rawText: string): HistoricalQuoteLine[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8)
    .map((line, index): HistoricalQuoteLine | null => {
      const moneyMatches = Array.from(line.matchAll(MONEY_PATTERN));
      if (!moneyMatches.length) return null;
      const firstMoneyIndex = moneyMatches[0].index ?? -1;
      const title = lineTitleFromText(line, firstMoneyIndex);
      if (!title || title.length < 3) return null;

      const amounts = moneyMatches.map((match) => parseFrenchNumber(match[0])).filter((value) => value > 0);
      if (!amounts.length) return null;
      const quantityMatch = line.match(QUANTITY_PATTERN);
      const quantity = quantityMatch ? parseFrenchNumber(quantityMatch[1]) || 1 : 1;
      const unit = normalizeUnit(quantityMatch?.[2] ?? null);
      const totalHt = amounts[amounts.length - 1] ?? null;
      const unitPriceHt = amounts.length >= 2 ? amounts[amounts.length - 2] : totalHt && quantity ? totalHt / quantity : null;

      return {
        title,
        lot: null,
        unit,
        quantity,
        estimatedHours: unit === "h" ? quantity : null,
        unitPriceHt,
        totalHt,
        templateId: null,
        templateTitle: null,
        source: `Import Obat - ligne ${index + 1}`,
        confidence: amounts.length >= 2 || quantityMatch ? "moyenne" : "faible",
        assumptions: [
          "Ligne extraite automatiquement depuis un document historique Obat, sans validation documentaire.",
          amounts.length >= 2 ? "Le dernier montant est interprete comme total HT et l'avant-dernier comme prix unitaire." : "Montant interprete comme total HT a verifier.",
        ],
        pointsToVerify: ["Verifier designation, quantite, unite, TVA, prix et lot avant reutilisation."],
      };
    })
    .filter((line): line is HistoricalQuoteLine => Boolean(line))
    .slice(0, 120);
}

async function extractPdfText(file: File) {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
  (pdfjs.GlobalWorkerOptions as { workerSrc?: string }).workerSrc = workerUrl;
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item: any) => String(item.str ?? "")).join(" "));
  }
  return normalizeExtractedText(pages.join("\n"));
}

async function extractSpreadsheetText(file: File) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: " ; " });
    return `Feuille ${sheetName}\n${csv}`;
  }).join("\n");
}

function printableFallbackFromBuffer(buffer: ArrayBuffer) {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const utf16 = new TextDecoder("utf-16le", { fatal: false }).decode(buffer);
  const combined = `${utf8}\n${utf16}`;
  const chunks = combined.match(/[A-Za-zÀ-ÿ0-9€%.,;:()'"/\-\s]{12,}/g) ?? [];
  return normalizeExtractedText(chunks.join("\n"));
}

async function extractTextFromFile(file: File): Promise<ImportedHistoricalFile> {
  const extension = extensionOf(file.name);
  try {
    let extractedText = "";
    let warning: string | null = null;

    if (extension === "pdf") {
      extractedText = await extractPdfText(file);
    } else if (["xlsx", "xls", "csv"].includes(extension)) {
      extractedText = await extractSpreadsheetText(file);
    } else if (["txt", "md", "json", "xml", "html", "htm"].includes(extension) || file.type.startsWith("text/")) {
      extractedText = normalizeExtractedText(await file.text());
    } else if (["doc", "docx"].includes(extension)) {
      extractedText = printableFallbackFromBuffer(await file.arrayBuffer());
      warning = extension === "docx"
        ? "Word DOCX reconnu. Extraction V1 limitee : si peu de texte remonte, exporter le devis Obat en PDF ou Excel pour une lecture fiable."
        : "Word DOC reconnu. Extraction V1 par texte brut : verifier les lignes detectees avant usage COCO.";
    } else {
      extractedText = printableFallbackFromBuffer(await file.arrayBuffer());
      warning = "Format non specialise : extraction texte brute a verifier.";
    }

    if (extractedText.length < 20) {
      return {
        id: crypto.randomUUID(),
        name: file.name,
        extension,
        size: file.size,
        status: "warning",
        extractedText,
        message: warning ?? "Aucun texte exploitable detecte. Essayer un export PDF texte, Excel ou CSV depuis Obat.",
      };
    }

    return {
      id: crypto.randomUUID(),
      name: file.name,
      extension,
      size: file.size,
      status: warning ? "warning" : "ready",
      extractedText,
      message: warning ?? `${extractedText.length.toLocaleString("fr-FR")} caracteres extraits.`,
    };
  } catch (error) {
    return {
      id: crypto.randomUUID(),
      name: file.name,
      extension,
      size: file.size,
      status: "error",
      extractedText: "",
      message: error instanceof Error ? error.message : "Extraction impossible pour ce fichier.",
    };
  }
}

function buildSourceExcerpts(importedFiles: ImportedHistoricalFile[], fallbackText: string) {
  const lines = importedFiles
    .flatMap((file) => file.extractedText.split(/\r?\n/).map((line) => ({ fileName: file.name, line: cleanText(line) })))
    .filter((entry) => entry.line.length >= 12)
    .filter((entry) => containsMoney(entry.line) || /devis|facture|total|ht|ttc|tva|acompte|main d.?oeuvre|fourniture/i.test(entry.line))
    .slice(0, MAX_SOURCE_EXCERPTS)
    .map((entry) => `${entry.fileName}: ${entry.line.slice(0, 220)}`);

  if (lines.length) return lines;
  return fallbackText
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter((line) => line.length >= 12)
    .slice(0, 12)
    .map((line) => `Extrait manuel: ${line.slice(0, 220)}`);
}

function buildHistoricalDraft(input: { title: string; sourceText: string; quoteLines: HistoricalQuoteLine[]; importedFiles: ImportedHistoricalFile[] }): CocoControlledDraft {
  const totalHt = input.quoteLines.reduce((sum, line) => sum + Number(line.totalHt ?? 0), 0);
  const hasLowConfidence = input.quoteLines.some((line) => line.confidence === "faible");
  const sourceTitle = cleanText(input.title) || "Import historique Obat pour COCO";
  const fileSummaries = input.importedFiles.map((file) => `${file.name} (${file.extension || "format inconnu"}, ${formatBytes(file.size)}) - ${file.message}`);
  const sourceExcerpts = buildSourceExcerpts(input.importedFiles, input.sourceText);

  return {
    id: crypto.randomUUID(),
    kind: "quote",
    title: sourceTitle,
    generatedAt: new Date().toISOString(),
    sourceSummary: [
      "Documents historiques Obat importes par un administrateur",
      ...fileSummaries,
      `${input.quoteLines.length} ligne(s) detectee(s)`,
      totalHt > 0 ? `Total detecte indicatif: ${Math.round(totalHt).toLocaleString("fr-FR")} EUR HT` : "Total non detecte",
      ...sourceExcerpts,
    ],
    confidence: hasLowConfidence || input.importedFiles.some((file) => file.status === "warning") ? "faible" : "moyenne",
    hypotheses: [
      "Les montants detectes servent a donner du contexte historique a COCO, pas a creer un devis officiel.",
      "Les exports Obat peuvent contenir des colonnes, totaux TTC ou lignes de facture a distinguer manuellement.",
      "Les documents Word DOCX sont acceptes, mais l'extraction fiable depend du contenu accessible cote navigateur.",
    ],
    pointsToVerify: [
      "Verifier les lignes detectees avant de s'en servir comme reference de prix.",
      "Verifier si les montants sont HT ou TTC selon le document original.",
      "Verifier les lots, unites, quantites, TVA et dates avant toute reutilisation commerciale.",
    ],
    risks: [
      "Extraction automatique approximative possible selon la mise en page Obat et le format du fichier.",
      "Les prix historiques peuvent etre obsoletes et doivent etre reajustes avant nouveau chiffrage.",
      "Un fichier scanne image sans texte OCR ne donnera pas de donnees fiables en V1.",
    ],
    quoteLines: input.quoteLines,
    materialNeeds: [],
    chantierTasks: [],
    purchaseOrders: [],
    proposedActions: [
      {
        label: "Utiliser comme reference historique COCO",
        module: "Assistant Direction COCO",
        actionType: "review",
        requiresAdminValidation: true,
        detail: "Ce brouillon alimente la memoire de travail COCO et reste distinct des devis/factures Batipro officiels.",
      },
      {
        label: "Rechiffrer dans le quote builder si besoin",
        module: "Devis",
        actionType: "prepare",
        requiresAdminValidation: true,
        detail: "La creation d'un vrai devis doit rester manuelle dans le module Devis/Projet commercial.",
      },
    ],
    adminValidationRequired: true,
    finalWriteBlocked: true,
  };
}

export default function CocoHistoricalQuotesPage() {
  const [title, setTitle] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [importedFiles, setImportedFiles] = useState<ImportedHistoricalFile[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [readingFiles, setReadingFiles] = useState(false);

  const sourceText = useMemo(() => normalizeExtractedText([...importedFiles.map((file) => file.extractedText), manualNote].join("\n")), [importedFiles, manualNote]);
  const quoteLines = useMemo(() => parseHistoricalQuoteText(sourceText), [sourceText]);
  const totalHt = useMemo(() => quoteLines.reduce((sum, line) => sum + Number(line.totalHt ?? 0), 0), [quoteLines]);
  const readableFiles = importedFiles.filter((file) => file.status === "ready" || file.status === "warning");
  const canSave = readableFiles.length > 0 && sourceText.length >= 20 && saveState !== "saving" && !readingFiles;

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setReadingFiles(true);
    setSaveState("idle");
    setMessage(null);
    try {
      const nextFiles = await Promise.all(files.map(extractTextFromFile));
      setImportedFiles((current) => [...current, ...nextFiles]);
    } finally {
      setReadingFiles(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    setSaveState("saving");
    setMessage(null);
    try {
      const draft = buildHistoricalDraft({ title, sourceText, quoteLines, importedFiles: readableFiles });
      const saved = await saveCocoControlledDraft({
        sourceKind: SOURCE_KIND,
        draft,
        status: "prepared",
      });
      if (saved) {
        setSaveState("saved");
        setMessage("Documents Obat ajoutes aux brouillons controles COCO.");
        setTitle("");
        setManualNote("");
        setImportedFiles([]);
      } else {
        setSaveState("local");
        setMessage("Table ai_controlled_drafts absente : le brouillon n'a pas pu etre historise. Appliquer la table Supabase avant utilisation durable.");
      }
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Impossible d'ajouter ces documents Obat.");
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.03]">
        <Link to="/assistant-direction" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Retour Assistant COCO
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Collecte historique COCO</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Importer les anciens devis Obat</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Importe tes anciens devis, factures ou exports Obat en PDF, Excel, CSV, texte ou Word. COCO les transforme en references historiques controlees, sans creer de devis ou facture Batipro.
            </p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
            <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Garde-fou</div>
            <p className="mt-1 text-xs leading-5">Lecture et brouillon COCO uniquement. Aucune creation de devis, facture, chantier, commande ou modification CRM.</p>
          </div>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.03]">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Upload className="h-4 w-4 text-blue-600" /> Documents Obat</div>
          <label className="mt-4 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-blue-300 hover:bg-blue-50/60">
            <input type="file" multiple accept={ACCEPTED_IMPORTS} onChange={(event) => void handleFileSelection(event)} className="sr-only" />
            {readingFiles ? <Loader2 className="h-7 w-7 animate-spin text-blue-600" /> : <Upload className="h-7 w-7 text-blue-600" />}
            <span className="mt-3 text-sm font-semibold text-slate-950">Importer PDF, Word, Excel, CSV ou texte</span>
            <span className="mt-1 text-xs leading-5 text-slate-500">Exports Obat devis/factures. Plusieurs fichiers possibles.</span>
          </label>

          {importedFiles.length ? (
            <div className="mt-4 space-y-2">
              {importedFiles.map((file) => (
                <div key={file.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="mt-0.5 text-slate-500">{["xlsx", "xls", "csv"].includes(file.extension) ? <FileSpreadsheet className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-950">{file.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatBytes(file.size)} - {file.message}</div>
                    {file.status === "error" ? <div className="mt-1 text-xs font-medium text-red-700">Fichier ignore pour l'enregistrement.</div> : null}
                    {file.status === "warning" ? <div className="mt-1 text-xs font-medium text-amber-700">A verifier avant usage COCO.</div> : null}
                  </div>
                  <button type="button" onClick={() => setImportedFiles((current) => current.filter((entry) => entry.id !== file.id))} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100" aria-label={`Retirer ${file.name}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Nom de reference
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex: Imports Obat 2023-2024"
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Note admin optionnelle
            <textarea
              value={manualNote}
              onChange={(event) => setManualNote(event.target.value)}
              rows={4}
              placeholder="Contexte utile : Obat, annee, type de chantier, client, remarques de prix..."
              className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          {message ? (
            <div className={["mt-4 rounded-lg border p-3 text-sm", saveState === "error" || saveState === "local" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"].join(" ")}>{message}</div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs leading-5 text-slate-500">{readableFiles.length} fichier(s) lisible(s) - {quoteLines.length} ligne(s) detectee(s) - total indicatif {Math.round(totalHt).toLocaleString("fr-FR")} EUR HT</div>
            <button type="submit" disabled={!canSave} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500">
              {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Ajouter a COCO
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
            <div className="text-sm font-semibold text-slate-950">Apercu extraction</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">Verification rapide avant enregistrement. Les imports Obat restent des references historiques, pas des prix valides automatiquement.</p>
            <div className="mt-3 max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {quoteLines.length ? quoteLines.slice(0, 40).map((line, index) => (
                <div key={`${line.title}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="font-semibold text-slate-950">{line.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{line.quantity.toLocaleString("fr-FR")} {line.unit ?? "u"} - PU {line.unitPriceHt ? Math.round(line.unitPriceHt).toLocaleString("fr-FR") : "?"} EUR - Total {line.totalHt ? Math.round(line.totalHt).toLocaleString("fr-FR") : "?"} EUR</div>
                  <div className="mt-1 text-[11px] text-amber-700">{line.pointsToVerify.join(" - ")}</div>
                </div>
              )) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Importe un fichier Obat pour voir les lignes detectees. Un PDF scanne sans OCR ou un DOCX complexe peut necessiter un export PDF texte ou Excel.</div>
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
