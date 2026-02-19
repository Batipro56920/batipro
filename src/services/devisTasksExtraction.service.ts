import { supabase } from "../lib/supabaseClient";

export type ControlledLot =
  | "Démolition"
  | "Maçonnerie"
  | "Plâtrerie/Isolation"
  | "Menuiserie intérieure"
  | "Menuiserie extérieure"
  | "Électricité"
  | "Plomberie"
  | "Chauffage/Ventilation"
  | "Peinture"
  | "Sols"
  | "Façade/Toiture"
  | "Divers";

export const CONTROLLED_LOTS: ControlledLot[] = [
  "Démolition",
  "Maçonnerie",
  "Plâtrerie/Isolation",
  "Menuiserie intérieure",
  "Menuiserie extérieure",
  "Électricité",
  "Plomberie",
  "Chauffage/Ventilation",
  "Peinture",
  "Sols",
  "Façade/Toiture",
  "Divers",
];

export type TaskLine = {
  title: string;
  lot: ControlledLot | null;
  intervenant_name: string | null;
  quantity: number | null;
  unit: string | null;
  date: string | null;
  confidence: number;
  source_line: string;
};

const NOISE_PATTERNS = [
  /\b(total|sous-?total|tva|ttc|ht|remise)\b/i,
  /\b(client|adresse|devis|référence|reference|conditions|validité|validite)\b/i,
  /\b(page)\b/i,
  /\b(siret|siren|iban|bic)\b/i,
];

const LOT_PATTERNS: Array<{ lot: ControlledLot; pattern: RegExp }> = [
  { lot: "Démolition", pattern: /(démolition|demolition|dépose|depose|curage)/i },
  { lot: "Maçonnerie", pattern: /(maçonnerie|maconnerie|béton|beton|agglo|parpaing|chape)/i },
  { lot: "Plâtrerie/Isolation", pattern: /(plâtrerie|platrerie|isolation|doublage|placo)/i },
  { lot: "Menuiserie intérieure", pattern: /(menuiserie intérieure|menuiserie interieure|porte intérieure|bloc porte)/i },
  { lot: "Menuiserie extérieure", pattern: /(menuiserie extérieure|menuiserie exterieure|fenêtre|fenetre|volet|baie)/i },
  { lot: "Électricité", pattern: /(électricité|electricite|tableau électrique|prises|interrupteur|courant faible)/i },
  { lot: "Plomberie", pattern: /(plomberie|sanitaire|evacuation|évacuation|robinetterie)/i },
  { lot: "Chauffage/Ventilation", pattern: /(chauffage|ventilation|vmc|climatisation|pompe à chaleur)/i },
  { lot: "Peinture", pattern: /(peinture|enduit|ponçage|poncage)/i },
  { lot: "Sols", pattern: /(sols|carrelage|parquet|revêtement de sol|revetement de sol)/i },
  { lot: "Façade/Toiture", pattern: /(façade|facade|toiture|zinguerie|charpente)/i },
];

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizeConfidence(value: unknown): number {
  const n = parseNumber(value);
  if (n === null) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function normalizeUnit(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (["m²", "m2", "m 2", "mq"].includes(raw)) return "m2";
  if (["ml", "ml.", "mls", "mètre linéaire", "metre lineaire", "m linéaire", "m lineaire"].includes(raw)) return "ml";
  if (["u", "unité", "unite", "pièce", "piece", "pcs"].includes(raw)) return "u";
  if (["h", "heure", "heures"].includes(raw)) return "h";
  if (["forfait", "forf.", "ens", "ensemble"].includes(raw)) return "forfait";
  if (raw === "m") return "ml";
  return raw;
}

function normalizeTitle(value: string): string {
  let title = String(value ?? "").replace(/\s+/g, " ").trim();
  title = title.replace(/^\d+(?:\.\d+)*\s+/, "");
  title = title.replace(/\s+\d+(?:[.,]\d+)?\s*(m²|m2|ml|m|u|unité|unite|h|forfait)\b.*$/i, "");
  title = title.replace(/\s+/g, " ").trim();
  return title;
}

function normalizeDate(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

function normalizeLot(value: string | null | undefined): ControlledLot | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const exact = CONTROLLED_LOTS.find((lot) => lot.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;

  for (const candidate of LOT_PATTERNS) {
    if (candidate.pattern.test(raw)) return candidate.lot;
  }
  return null;
}

function isNoiseLine(line: string): boolean {
  const trimmed = String(line ?? "").trim();
  if (!trimmed) return true;
  if (trimmed.length < 4) return true;
  return NOISE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function normalizeDevisText(rawText: string): string {
  const normalized = String(rawText ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "\n");

  const lines = normalized
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  return lines.join("\n");
}

function toTaskLine(input: any): TaskLine | null {
  const sourceLine = String(input?.source_line ?? input?.sourceLine ?? "").trim();
  const title = normalizeTitle(String(input?.title ?? ""));
  if (!title || title.length < 3) return null;
  if (isNoiseLine(title)) return null;

  const quantity = parseNumber(input?.quantity);
  const unit = normalizeUnit(input?.unit ?? null);
  const lot = normalizeLot(input?.lot ?? null);
  const intervenantName = String(input?.intervenant_name ?? input?.intervenantName ?? "").trim() || null;
  const date = normalizeDate(input?.date);
  const confidence = normalizeConfidence(input?.confidence);

  return {
    title,
    lot,
    intervenant_name: intervenantName,
    quantity,
    unit,
    date,
    confidence,
    source_line: sourceLine || title,
  };
}

export function postProcessTaskLines(lines: TaskLine[]): TaskLine[] {
  const unique = new Map<string, TaskLine>();
  for (const line of lines) {
    if (!line.title || isNoiseLine(line.title)) continue;
    const key = [
      line.title.toLowerCase(),
      line.lot ?? "",
      line.quantity ?? "",
      line.unit ?? "",
      line.source_line.toLowerCase(),
    ].join("|");
    if (!unique.has(key)) unique.set(key, line);
  }
  return Array.from(unique.values());
}

export async function extractTasksFromDevisText(cleanedText: string): Promise<TaskLine[]> {
  const text = String(cleanedText ?? "").trim();
  if (!text || text.length < 20) throw new Error("Texte nettoyé trop court.");

  const { data, error } = await supabase.functions.invoke("extract-devis-tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cleaned_text: text,
      lots: CONTROLLED_LOTS,
    }),
  });

  if (error) {
    throw new Error(error.message || "Erreur extraction IA.");
  }

  const rawTasks = Array.isArray(data) ? data : data?.tasks;
  if (!Array.isArray(rawTasks)) {
    throw new Error("Réponse IA invalide (JSON attendu).");
  }

  const parsed = rawTasks.map(toTaskLine).filter(Boolean) as TaskLine[];
  const normalized = postProcessTaskLines(parsed);
  if (!normalized.length) {
    throw new Error("Aucune tâche exploitable trouvée par l'IA.");
  }
  return normalized;
}

export function extractTasksFromDevisTextSimple(cleanedText: string): TaskLine[] {
  const lines = String(cleanedText ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const unitRx = /(m²|m2|ml|m|u|unité|unite|h|forfait)\b/i;
  let currentLot: ControlledLot | null = null;
  const out: TaskLine[] = [];

  for (const line of lines) {
    if (isNoiseLine(line)) continue;

    const lotHeader = line.match(/(?:^|\b)lot\s*\d*\s*[-: ]\s*(.+)$/i);
    if (lotHeader?.[1]) {
      currentLot = normalizeLot(lotHeader[1]);
      continue;
    }

    const rx = new RegExp(`^(?:\\d+(?:\\.\\d+)*\\s+)?(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*${unitRx.source}`, "i");
    const m = line.match(rx);
    if (!m) continue;

    const title = normalizeTitle(m[1] ?? "");
    if (!title || isNoiseLine(title)) continue;

    out.push({
      title,
      lot: currentLot ?? normalizeLot(title),
      intervenant_name: null,
      quantity: parseNumber(m[2]),
      unit: normalizeUnit(m[3] ?? null),
      date: null,
      confidence: 0.55,
      source_line: line,
    });
  }

  return postProcessTaskLines(out);
}

export function summarizeExtractedTasks(lines: TaskLine[]) {
  return {
    extractedCount: lines.length,
    withLot: lines.filter((line) => !!line.lot).length,
    withQuantity: lines.filter((line) => line.quantity !== null).length,
    examples: lines.slice(0, 5),
  };
}

