export type TerrainTaskTitleInput = {
  sourceLabel: string;
  currentTitle?: string | null;
  quantity?: number | null;
  unit?: string | null;
  lot?: string | null;
};

const ROOM_ALIASES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bbuanderie\b/i, label: "buanderie" },
  { pattern: /\bsalle\s*(?:de\s*bain|d[' ]eau)|\bsdb\b/i, label: "salle de bain" },
  { pattern: /\bcuisine\b/i, label: "cuisine" },
  { pattern: /\bchambre\b/i, label: "chambre" },
  { pattern: /\bsalon\b|\bsejour\b/i, label: "salon" },
  { pattern: /\bentree\b/i, label: "entree" },
  { pattern: /\bcouloir\b/i, label: "couloir" },
  { pattern: /\bwc\b|\btoilettes?\b/i, label: "wc" },
  { pattern: /\bgarage\b/i, label: "garage" },
  { pattern: /\bcellier\b/i, label: "cellier" },
  { pattern: /\bterrasse\b/i, label: "terrasse" },
  { pattern: /\bfacade\b/i, label: "facade" },
  { pattern: /\btoiture\b/i, label: "toiture" },
  { pattern: /\bcombles?\b/i, label: "combles" },
];

const CHARACTERISTIC_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bpvc\b/i, label: "PVC" },
  { pattern: /\balu(?:minium)?\b/i, label: "alu" },
  { pattern: /\bbois\b/i, label: "bois" },
  { pattern: /\bdouble vitrage\b/i, label: "double vitrage" },
  { pattern: /\bhydrofuge\b/i, label: "hydrofuge" },
  { pattern: /\bba13\b/i, label: "BA13" },
  { pattern: /\bbonde\b/i, label: "bonde" },
  { pattern: /\bjoints?\b/i, label: "joints" },
  { pattern: /\bsiphon\b/i, label: "siphon" },
];

const STOP_PREFIXES = [
  /\bfourniture\s+et\s+pose\s+d['e]\s*/gi,
  /\bfourniture\s+pose\s+et\s+mise\s+en\s+service\s+d['e]\s*/gi,
  /\bfourniture\s+d['e]\s*/gi,
  /\bpose\s+et\s+fourniture\s+d['e]\s*/gi,
  /\bmise\s+en\s+oeuvre\s+d['e]\s*/gi,
  /\bmise\s+en\s+place\s+d['e]\s*/gi,
  /\btravaux\s+de\s*/gi,
];

const LEGAL_SUFFIXES = [
  /\bconformement\s+a\b.*$/i,
  /\bselon\b.*$/i,
  /\bsuivant\b.*$/i,
  /\bavec\s+toutes?\s+sujetions?\b.*$/i,
  /\btoutes?\s+sujetions?\b.*$/i,
  /\by\s+compris\s+la\s+main\s+d['e]oeuvre\b.*$/i,
];

function normalizeSpaces(value: string): string {
  return String(value ?? "")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function foldText(value: string): string {
  return normalizeSpaces(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function trimPunctuation(value: string): string {
  return normalizeSpaces(value)
    .replace(/^[,;:+\-/. ]+/, "")
    .replace(/[,;:+\-/. ]+$/, "")
    .trim();
}

function titleCaseFirst(value: string): string {
  const text = trimPunctuation(value);
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function formatQuantity(quantity: number | null | undefined, unit: string | null | undefined): string {
  if (quantity === null || quantity === undefined || !Number.isFinite(quantity)) return "";
  const normalizedUnit = String(unit ?? "").trim().toLowerCase();
  const quantityLabel = Number.isInteger(quantity) ? String(quantity) : String(quantity).replace(".", ",");
  if (!normalizedUnit || normalizedUnit === "u") return quantityLabel;
  return `${quantityLabel} ${normalizedUnit}`;
}

function detectLocation(sourceLabel: string): string {
  const folded = foldText(sourceLabel);
  for (const entry of ROOM_ALIASES) {
    if (entry.pattern.test(folded)) return entry.label;
  }
  return "";
}

function detectLayerCount(sourceLabel: string): string {
  const match = foldText(sourceLabel).match(/\b(1|2|3|4)\s*couches?\b/);
  return match ? `${match[1]} couche${match[1] === "1" ? "" : "s"}` : "";
}

function cleanSourceLabel(sourceLabel: string): string {
  let cleaned = normalizeSpaces(sourceLabel)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  cleaned = cleaned.replace(/^\d+(?:[./-]\d+)*\s+/, "");
  cleaned = cleaned.replace(/\s+\d+(?:[.,]\d+)?\s*(?:\u20ac|eur|ht|ttc)\b.*$/i, "");
  cleaned = cleaned.replace(/\s+\d+(?:[.,]\d+)?\s*%\b.*$/i, "");
  cleaned = cleaned.replace(/\by\s+compris\b/gi, "+ ");
  cleaned = cleaned.replace(/\bcomprenant\b/gi, "+ ");
  cleaned = cleaned.replace(/\bcompris(?:e|es)?\b/gi, "+ ");
  cleaned = cleaned.replace(/\bet\/ou\b/gi, "+");
  cleaned = cleaned.replace(/\s*[;,]\s*/g, " + ");
  for (const pattern of STOP_PREFIXES) {
    cleaned = cleaned.replace(pattern, "");
  }
  cleaned = cleaned.replace(/\bpose\b\s+de\b/gi, "pose ");
  cleaned = cleaned.replace(/\bdepose\b/gi, "depose");
  for (const pattern of LEGAL_SUFFIXES) {
    cleaned = cleaned.replace(pattern, "");
  }
  cleaned = cleaned.replace(/\b(?:dans|en|au|aux)\s+la\b/gi, "");
  cleaned = cleaned.replace(/\b(?:dans|en|au|aux)\s+le\b/gi, "");
  cleaned = cleaned.replace(/\b(?:dans|en|au|aux)\s+les\b/gi, "");
  cleaned = cleaned.replace(/\s+\+\s+\+/g, " + ");
  cleaned = cleaned.replace(/\s+-\s+/g, " - ");
  return trimPunctuation(cleaned);
}

function inferHead(sourceLabel: string, currentTitle: string, lot: string | null | undefined): string {
  const text = `${foldText(sourceLabel)} ${foldText(currentTitle)} ${foldText(lot ?? "")}`;
  if (/\bpeinture\b/.test(text)) return "Peinture";
  if (/\bfaience\b|\bcarrelage\b.*\bmur/.test(text)) return "Faience";
  if (/\breseau[x]?\b/.test(text) || (/\balimentation\b/.test(text) && /\bevacuation\b/.test(text))) {
    return "Reseaux";
  }
  if (/\bdepose\b|\bdemolition\b|\bcurage\b/.test(text)) return "Depose";
  if (/\braccordement\b/.test(text)) return "Raccordement";
  if (/\bpose\b|\binstallation\b|\binstaller\b|\bmise en place\b/.test(text)) return "Pose";
  return "";
}

function removeQuantityFromText(value: string, quantity: number | null | undefined, unit: string | null | undefined): string {
  if (quantity === null || quantity === undefined || !Number.isFinite(quantity)) return value;
  const quantityLabel = Number.isInteger(quantity) ? String(quantity) : String(quantity).replace(".", "[,.]");
  const unitLabel = String(unit ?? "").trim().toLowerCase();
  const quantityPattern =
    unitLabel && unitLabel !== "u"
      ? new RegExp(`\\b${quantityLabel}\\s*${unitLabel}\\b`, "i")
      : new RegExp(`\\b${quantityLabel}\\b`, "i");
  return trimPunctuation(value.replace(quantityPattern, ""));
}

function removeLocationFromText(value: string, location: string): string {
  if (!location) return value;
  const normalizedLocation = location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return trimPunctuation(
    value.replace(new RegExp(`\\b(?:dans|en|au|aux|sur)?\\s*${normalizedLocation}\\b`, "i"), ""),
  );
}

function removeHeadFromText(value: string, head: string): string {
  if (!head) return value;
  const headPattern =
    head === "Reseaux"
      ? /^\s*reseau[x]?\b/i
      : head === "Faience"
        ? /^\s*faience\b/i
        : head === "Depose"
          ? /^\s*depose\b/i
          : head === "Raccordement"
            ? /^\s*raccordement\b/i
            : new RegExp(`^${head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return trimPunctuation(value.replace(headPattern, ""));
}

function cleanupElement(value: string): string {
  let cleaned = normalizeSpaces(value);
  cleaned = cleaned.replace(/\bde\s+douche\b/gi, " douche");
  cleaned = cleaned.replace(/\bmurs?\s+de\s+douche\b/gi, "murs douche");
  cleaned = cleaned.replace(/\bparois?\s+de\s+douche\b/gi, "parois douche");
  cleaned = cleaned.replace(/\bde\s+la\s+salle\s+de\s+bain\b/gi, "");
  cleaned = cleaned.replace(/\bde\s+la\s+buanderie\b/gi, "");
  cleaned = cleaned.replace(/\bde\s+la\s+cuisine\b/gi, "");
  cleaned = cleaned.replace(/\bde\s+la\s+chambre\b/gi, "");
  cleaned = cleaned.replace(/\bavec\b/gi, "+");
  cleaned = cleaned.replace(/\s*\+\s*/g, " + ");
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  return trimPunctuation(cleaned);
}

function dedupeSegments(parts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const cleaned = trimPunctuation(part);
    if (!cleaned) continue;
    const key = foldText(cleaned);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function shortenTitle(value: string, maxLength = 78): string {
  const cleaned = normalizeSpaces(value);
  if (cleaned.length <= maxLength) return cleaned;

  const [basePart, suffixPart] = cleaned.split(/\s-\s/, 2);
  if (suffixPart) {
    const reserved = suffixPart.length + 3;
    const baseMax = Math.max(24, maxLength - reserved);
    if (basePart.length > baseMax) {
      return `${basePart.slice(0, baseMax).trim()} - ${suffixPart}`.trim();
    }
  }

  return `${cleaned.slice(0, maxLength - 3).trim()}...`;
}

function isTooVague(value: string): boolean {
  const folded = foldText(value);
  return !folded || ["pose", "travaux", "installation", "divers"].includes(folded);
}

export function generateTerrainTaskTitle(input: TerrainTaskTitleInput): string {
  const sourceLabel = normalizeSpaces(input.sourceLabel);
  const currentTitle = normalizeSpaces(input.currentTitle ?? "");
  const cleanedSource = cleanSourceLabel(sourceLabel || currentTitle);
  const quantityLabel = formatQuantity(input.quantity, input.unit);
  const location = detectLocation(sourceLabel || currentTitle);
  const layers = detectLayerCount(sourceLabel || currentTitle);
  const head = inferHead(cleanedSource, currentTitle, input.lot);

  let base = cleanedSource || currentTitle;
  base = removeHeadFromText(base, head);
  base = removeQuantityFromText(base, input.quantity, input.unit);
  base = removeLocationFromText(base, location);
  base = cleanupElement(base);

  if (!base) {
    base = cleanupElement(currentTitle || sourceLabel);
  }

  const characteristics = dedupeSegments(
    CHARACTERISTIC_PATTERNS
      .filter((entry) => entry.pattern.test(foldText(sourceLabel)))
      .map((entry) => entry.label),
  ).filter((part) => !foldText(base).includes(foldText(part)));

  if (head === "Reseaux" && /\balimentation\b/.test(foldText(sourceLabel)) && /\bevacuation\b/.test(foldText(sourceLabel))) {
    base = "alimentation + evacuation";
  }

  const titleParts = dedupeSegments([quantityLabel, base]);
  let title = head ? [head, ...titleParts].filter(Boolean).join(" ") : titleParts.join(" ");

  if (!title) {
    title = currentTitle || sourceLabel;
  }

  if (characteristics.length > 0 && ["Pose", "Raccordement", "Depose"].includes(head)) {
    const inlineCharacteristic = characteristics.filter((part) => ["PVC", "alu", "bois", "double vitrage"].includes(part));
    if (inlineCharacteristic.length > 0) {
      title = dedupeSegments([title, ...inlineCharacteristic]).join(" ");
    }
  }

  const suffixParts = dedupeSegments([
    !foldText(title).includes(foldText(location)) ? location : "",
    layers && !foldText(title).includes(foldText(layers)) ? layers : "",
    ...characteristics.filter((part) => !["PVC", "alu", "bois", "double vitrage"].includes(part)),
  ]);

  if (suffixParts.length > 0) {
    title = `${title} - ${suffixParts.join(" + ")}`;
  }

  title = title
    .replace(/\s+\+\s+\+/g, " + ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+-\s+-/g, " - ")
    .trim();

  title = titleCaseFirst(title);
  if (isTooVague(title)) {
    title = titleCaseFirst(cleanupElement(currentTitle || cleanedSource || sourceLabel));
  }

  return shortenTitle(title);
}
