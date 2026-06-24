import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Archive, ClipboardCheck, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import {
  isCurrentUserCocoAdmin,
  listCocoControlledDrafts,
  saveCocoControlledDraft,
  type CocoControlledDraft,
  type CocoControlledDraftRecord,
  type CocoDraftConfidence,
} from "../services/cocoDirectionAssistant.service";

const HISTORICAL_IMPORT_SOURCE_KIND = "historical_document_import";

type HistoricalDocumentKind = "quote" | "invoice";

type ParsedHistoricalLine = {
  title: string;
  lot: string | null;
  quantity: number;
  unit: string | null;
  unitPriceHt: number | null;
  totalHt: number | null;
  source: string;
};

function parseFrenchNumber(value: unknown): number | null {
  const raw = String(value ?? "").replace(/\u00A0/g, " ").trim();
  if (!raw) return null;
  const normalized = raw.replace(/\s/g, "").replace(/,/g, ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function normalizeLine(value: string) {
  return value.replace(/\u00A0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function isIgnoredHistoricalLine(line: string) {
  const lowered = line.toLowerCase();
  return [
    "siret",
    "siren",
    "tva intracom",
    "conditions",
    "validite",
    "validité",
    "total ht",
    "total ttc",
    "net a payer",
    "page ",
    "adresse",
    "telephone",
    "téléphone",
    "email",
  ].some((needle) => lowered.includes(needle));
}

function detectLot(line: string) {
  const normalized = normalizeLine(line);
  if (normalized.length < 4 || normalized.length > 90) return null;
  if (/\d+[\s.,]+(?:m²|m2|ml|m|u|unité|unite|forfait|h|heure|lot)\b/i.test(normalized)) return null;
  const header = normalized.replace(/^\d+(?:\.\d+)*\s+/, "").trim();
  if (!header || isIgnoredHistoricalLine(header)) return null;
  if (/^[A-ZÀ-Ÿ0-9 .'/&-]+$/.test(header) || /^\d+(?:\.\d+)*\s+.+/.test(normalized)) return header;
  return null;
}

function parseHistoricalLines(rawText: string): ParsedHistoricalLine[] {
  const lines = rawText.split(/\r?\n/).map(normalizeLine).filter(Boolean);
  const parsed: ParsedHistoricalLine[] = [];
  let currentLot: string | null = null;

  for (const line of lines) {
    const nextLot = detectLot(line);
    if (nextLot) {
      currentLot = nextLot;
      continue;
    }

    if (isIgnoredHistoricalLine(line)) continue;

    const match = line.match(/^(.{4,}?)\s+([0-9]+(?:[.,][0-9]+)?)\s*(m²|m2|ml|m|u|unité|unite|forfait|h|heure|lot)\s+([0-9][0-9\s.,]*)(?:\s+([0-9][0-9\s.,]*))?/i);
    if (!match) continue;

    const title = match[1].replace(/^\d+(?:\.\d+)*\s+/, "").trim();
    const quantity = parseFrenchNumber(match[2]) ?? 1;
    const unit = match[3]?.trim() ?? null;
    const unitPriceHt = parseFrenchNumber(match[4]);
    const totalFromText = parseFrenchNumber(match[5]);
    const totalHt = totalFromText ?? (unitPriceHt !== null ? unitPriceHt * quantity : null);

    if (!title || title.length < 4) continue;

    parsed.push({
      title,
      lot: currentLot,
      quantity,
      unit,
      unitPriceHt,
      totalHt,
      source: line,
    });

    if (parsed.length >= 30) break;
  }

  return parsed;
}

function documentKindLabel(kind: HistoricalDocumentKind) {
  return kind === "invoice" ? "facture historique" : "devis historique";
}

function confidenceFromLines(lines: ParsedHistoricalLine[]): CocoDraftConfidence {
  if (!lines.length) return "faible";
  if (lines.some((line) => line.totalHt === null || line.unitPriceHt === null)) return "moyenne";
  return "moyenne";
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "A verifier";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} EUR HT`;
}

function buildHistoricalDraft(input: { rawText: string; sourceName: string; documentKind: HistoricalDocumentKind }): CocoControlledDraft {
  const lines = parseHistoricalLines(input.rawText);
  const label = documentKindLabel(input.documentKind);
  const sourceName = input.sourceName.trim() || label;
  const confidence = confidenceFromLines(lines);

  return {
    id: crypto.randomUUID(),
    kind: "quote",
    title: `Brouillon collecte historique - ${sourceName}`,
    generatedAt: new Date().toISOString(),
    sourceSummary: [
      `Texte colle depuis un ancien ${label}`,
      `Source declaree: ${sourceName}`,
      "Extraction locale gratuite sans appel IA externe",
    ],
    confidence,
    hypotheses: [
      "Les lignes sont detectees par analyse locale du texte colle, sans lecture PDF native ni verification IA.",
      "Les prix, unites et totaux peuvent etre incomplets selon la qualite du texte source.",
      "Ce brouillon sert a collecter l'historique avant validation admin, pas a creer un devis ou une facture definitive.",
    ],
    pointsToVerify: [
      "Verifier client, adresse, date, TVA et totaux dans le document original.",
      "Verifier chaque designation, quantite, unite et prix avant integration dans une bibliotheque ou un devis Batipro.",
      lines.length ? `${lines.length} ligne(s) detectee(s) a revoir.` : "Aucune ligne exploitable detectee automatiquement : coller un texte plus structure ou saisir manuellement.",
    ],
    risks: [
      "Extraction locale volontairement prudente : certains libelles ou totaux peuvent etre mal separes.",
      "Aucune donnee finale Batipro n'est modifiee par cette collecte.",
    ],
    quoteLines: lines.map((line) => ({
      title: line.title,
      lot: line.lot,
      unit: line.unit,
      quantity: line.quantity,
      estimatedHours: null,
      unitPriceHt: line.unitPriceHt,
      totalHt: line.totalHt,
      templateId: null,
      templateTitle: null,
      source: line.source,
      confidence,
      assumptions: ["Ligne reconstruite depuis texte historique colle."],
      pointsToVerify: ["Comparer avec le PDF/devis/facture original avant validation."],
    })),
    materialNeeds: [],
    chantierTasks: [],
    purchaseOrders: [],
    proposedActions: [
      {
        label: "Revoir l'import historique",
        module: "Assistant Direction COCO",
        actionType: "review",
        requiresAdminValidation: true,
        detail: "Controler les lignes detectees avant toute reutilisation dans Batipro.",
      },
      {
        label: "Capitaliser plus tard dans la bibliotheque",
        module: "Bibliotheque / Chiffrage",
        actionType: "validate",
        requiresAdminValidation: true,
        detail: "L'enrichissement prix ou bibliotheque devra etre un flux separe avec validation admin.",
      },
    ],
    adminValidationRequired: true,
    finalWriteBlocked: true,
  };
}

export default function CocoHistoricalImportPanel() {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [documentKind, setDocumentKind] = useState<HistoricalDocumentKind>("quote");
  const [sourceName, setSourceName] = useState("");
  const [rawText, setRawText] = useState("");
  const [draft, setDraft] = useState<CocoControlledDraft | null>(null);
  const [recentDrafts, setRecentDrafts] = useState<CocoControlledDraftRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    isCurrentUserCocoAdmin()
      .then((result) => {
        if (!alive) return;
        setAllowed(result);
        if (result) void refreshRecentDrafts();
      })
      .catch(() => {
        if (alive) setAllowed(false);
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const detectedLines = useMemo(() => parseHistoricalLines(rawText), [rawText]);

  async function refreshRecentDrafts() {
    setLoadingRecent(true);
    try {
      setRecentDrafts(await listCocoControlledDrafts({ sourceKind: HISTORICAL_IMPORT_SOURCE_KIND, limit: 4 }));
    } catch {
      setRecentDrafts([]);
    } finally {
      setLoadingRecent(false);
    }
  }

  function prepareDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const cleanText = rawText.trim();
    if (cleanText.length < 40) {
      setError("Colle au moins quelques lignes exploitables depuis un ancien devis ou une facture.");
      return;
    }
    setDraft(buildHistoricalDraft({ rawText: cleanText, sourceName, documentKind }));
  }

  async function saveDraft() {
    if (!draft || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveCocoControlledDraft({
        sourceKind: HISTORICAL_IMPORT_SOURCE_KIND,
        draft,
        status: "prepared",
      });
      if (saved) {
        setNotice("Brouillon historique enregistre dans le suivi COCO. Aucune donnee metier finale n'a ete modifiee.");
        await refreshRecentDrafts();
      } else {
        setNotice("Table d'historique COCO indisponible : le brouillon reste affiche localement sur cette page.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement du brouillon historique impossible.");
    } finally {
      setSaving(false);
    }
  }

  if (checking || !allowed) return null;

  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-slate-950 p-2 text-white"><Archive className="h-5 w-5" /></div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Collecte historique gratuite</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Anciens devis et factures sans abonnement IA</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Colle le texte d'un ancien devis ou d'une facture. COCO prepare un brouillon de collecte local, sans appel OpenAI, sans stockage de fichier et sans creation definitive dans Batipro.
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          <ShieldCheck className="h-4 w-4" /> Brouillon uniquement
        </span>
      </div>

      <form onSubmit={prepareDraft} className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-600">
            Type
            <select value={documentKind} onChange={(event) => setDocumentKind(event.target.value as HistoricalDocumentKind)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="quote">Ancien devis</option>
              <option value="invoice">Ancienne facture</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Nom source
            <input value={sourceName} onChange={(event) => setSourceName(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Ex: Devis cuisine 2024" />
          </label>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
            {detectedLines.length} ligne(s) detectee(s). La detection reste volontairement prudente : validation admin obligatoire avant capitalisation.
          </div>
          <button type="submit" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
            <Sparkles className="h-4 w-4" /> Preparer brouillon
          </button>
        </div>

        <label className="block text-xs font-semibold text-slate-600">
          Texte copie depuis le document
          <textarea value={rawText} onChange={(event) => setRawText(event.target.value)} rows={10} className="mt-1 min-h-64 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Coller ici le texte d'un ancien devis ou d'une facture..." />
        </label>
      </form>

      {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{notice}</div> : null}

      {draft ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-950">{draft.title}</div>
              <div className="mt-1 text-xs text-slate-500">Confiance {draft.confidence} - {draft.quoteLines.length} ligne(s) proposee(s)</div>
            </div>
            <button type="button" onClick={() => void saveDraft()} disabled={saving} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
              Enregistrer brouillon
            </button>
          </div>
          {draft.quoteLines.length ? (
            <div className="divide-y divide-slate-100">
              {draft.quoteLines.slice(0, 12).map((line, index) => (
                <div key={`${line.title}-${index}`} className="grid gap-2 p-4 text-sm md:grid-cols-[minmax(0,1fr)_100px_130px_130px]">
                  <div>
                    <div className="font-semibold text-slate-950">{line.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{line.lot ?? "Lot a confirmer"}</div>
                  </div>
                  <div className="text-slate-600">{line.quantity.toLocaleString("fr-FR")} {line.unit ?? "u"}</div>
                  <div className="text-slate-600">{formatCurrency(line.unitPriceHt)}</div>
                  <div className="font-semibold text-slate-950">{formatCurrency(line.totalHt)}</div>
                </div>
              ))}
            </div>
          ) : <div className="p-4 text-sm text-slate-500">Aucune ligne detectee. Le brouillon reste utile pour tracer la source, mais il faudra completer manuellement.</div>}
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-950">Imports historiques recents</div>
          {loadingRecent ? <div className="text-xs text-slate-500">Chargement...</div> : null}
        </div>
        <div className="mt-2 space-y-2">
          {recentDrafts.length ? recentDrafts.map((record) => (
            <div key={record.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
              <div className="font-semibold text-slate-950">{record.draft.title}</div>
              <div className="mt-1">{record.draft.quoteLines.length} ligne(s) - {new Date(record.createdAt).toLocaleString("fr-FR")}</div>
            </div>
          )) : <div className="text-xs leading-5 text-slate-500">Aucun import historique persistant charge pour le moment.</div>}
        </div>
      </div>
    </section>
  );
}
