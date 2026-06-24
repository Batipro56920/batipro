import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, Loader2, ShieldCheck } from "lucide-react";
import {
  saveCocoControlledDraft,
  type CocoControlledDraft,
  type CocoVisitQuoteDraftLine,
} from "../services/cocoDirectionAssistant.service";

type HistoricalQuoteLine = CocoVisitQuoteDraftLine;

type SaveState = "idle" | "saving" | "saved" | "local" | "error";

const SOURCE_KIND = "historical_document_import";
const MONEY_PATTERN = /(?:\d[\d\s.]*,\d{2}|\d[\d\s.]*\.\d{2}|\d{1,3}(?:\s\d{3})+)/g;
const QUANTITY_PATTERN = /(\d+(?:[,.]\d+)?)\s*(m2|m²|m3|m³|ml|u|unité|unites|h|heure|heures|forfait|ens|kg|l)\b/i;

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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
        source: `Ancien devis colle - ligne ${index + 1}`,
        confidence: amounts.length >= 2 || quantityMatch ? "moyenne" : "faible",
        assumptions: [
          "Ligne extraite automatiquement depuis un texte colle, sans validation documentaire.",
          amounts.length >= 2 ? "Le dernier montant est interprete comme total HT et l'avant-dernier comme prix unitaire." : "Montant interprete comme total HT a verifier.",
        ],
        pointsToVerify: ["Verifier designation, quantite, unite, TVA, prix et lot avant reutilisation."],
      };
    })
    .filter((line): line is HistoricalQuoteLine => Boolean(line))
    .slice(0, 80);
}

function buildHistoricalDraft(input: { title: string; pastedText: string; quoteLines: HistoricalQuoteLine[] }): CocoControlledDraft {
  const totalHt = input.quoteLines.reduce((sum, line) => sum + Number(line.totalHt ?? 0), 0);
  const hasLowConfidence = input.quoteLines.some((line) => line.confidence === "faible");
  const sourceTitle = cleanText(input.title) || "Ancien devis importe pour COCO";

  return {
    id: crypto.randomUUID(),
    kind: "quote",
    title: sourceTitle,
    generatedAt: new Date().toISOString(),
    sourceSummary: [
      "Ancien devis colle manuellement par un administrateur",
      `${input.quoteLines.length} ligne(s) detectee(s)` ,
      totalHt > 0 ? `Total detecte indicatif: ${Math.round(totalHt).toLocaleString("fr-FR")} EUR HT` : "Total non detecte",
    ],
    confidence: hasLowConfidence ? "faible" : "moyenne",
    hypotheses: [
      "Les montants detectes servent a donner du contexte historique a COCO, pas a creer un devis officiel.",
      "Le texte colle peut perdre la structure d'origine du PDF ou du document source.",
    ],
    pointsToVerify: [
      "Verifier les lignes detectees avant de s'en servir comme reference de prix.",
      "Verifier si les montants sont HT ou TTC selon le document original.",
      "Verifier les lots, unites, quantites et taux de TVA avant toute reutilisation commerciale.",
    ],
    risks: [
      "Extraction texte approximative possible selon la mise en page du devis source.",
      "Les prix historiques peuvent etre obsoletes et doivent etre reajustes avant nouveau chiffrage.",
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
        detail: "Ce brouillon alimente la memoire de travail COCO et reste distinct des devis Batipro officiels.",
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
  const [pastedText, setPastedText] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const quoteLines = useMemo(() => parseHistoricalQuoteText(pastedText), [pastedText]);
  const totalHt = useMemo(() => quoteLines.reduce((sum, line) => sum + Number(line.totalHt ?? 0), 0), [quoteLines]);
  const canSave = pastedText.trim().length >= 20 && quoteLines.length > 0 && saveState !== "saving";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    setSaveState("saving");
    setMessage(null);
    try {
      const draft = buildHistoricalDraft({ title, pastedText, quoteLines });
      const saved = await saveCocoControlledDraft({
        sourceKind: SOURCE_KIND,
        draft,
        status: "prepared",
      });
      if (saved) {
        setSaveState("saved");
        setMessage("Ancien devis ajoute aux brouillons controles COCO.");
        setTitle("");
        setPastedText("");
      } else {
        setSaveState("local");
        setMessage("Table ai_controlled_drafts absente : le brouillon n'a pas pu etre historise. Appliquer la table Supabase avant utilisation durable.");
      }
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Impossible d'ajouter cet ancien devis.");
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
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Ajouter un ancien devis</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Colle le texte d'un ancien devis pour creer une reference historique en brouillon controle. COCO pourra s'en servir comme contexte, sans creer de devis officiel.
            </p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
            <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Garde-fou</div>
            <p className="mt-1 text-xs leading-5">Aucune creation de devis, aucun envoi client, aucune modification CRM. Stockage en brouillon COCO uniquement.</p>
          </div>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.03]">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><ClipboardCheck className="h-4 w-4 text-blue-600" /> Texte source</div>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Nom de reference
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex: Devis salle de bain 2024 - Client Martin"
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Texte de l'ancien devis
            <textarea
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
              rows={18}
              placeholder="Colle ici les lignes du devis : designation, quantite, unite, prix unitaire, total..."
              className="mt-1 min-h-[360px] w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          {message ? (
            <div className={["mt-4 rounded-lg border p-3 text-sm", saveState === "error" || saveState === "local" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"].join(" ")}>{message}</div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs leading-5 text-slate-500">{quoteLines.length} ligne(s) detectee(s) - total indicatif {Math.round(totalHt).toLocaleString("fr-FR")} EUR HT</div>
            <button type="submit" disabled={!canSave} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500">
              {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Ajouter a COCO
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
            <div className="text-sm font-semibold text-slate-950">Apercu extraction</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">Verification rapide avant enregistrement. Cette extraction reste indicative.</p>
            <div className="mt-3 max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {quoteLines.length ? quoteLines.slice(0, 30).map((line, index) => (
                <div key={`${line.title}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="font-semibold text-slate-950">{line.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{line.quantity.toLocaleString("fr-FR")} {line.unit ?? "u"} - PU {line.unitPriceHt ? Math.round(line.unitPriceHt).toLocaleString("fr-FR") : "?"} EUR - Total {line.totalHt ? Math.round(line.totalHt).toLocaleString("fr-FR") : "?"} EUR</div>
                  <div className="mt-1 text-[11px] text-amber-700">{line.pointsToVerify.join(" - ")}</div>
                </div>
              )) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Aucune ligne detectee pour le moment.</div>
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
