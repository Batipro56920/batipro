export type TerrainTaskTitleInput = {
  sourceLabel: string;
  currentTitle?: string | null;
  quantity?: number | null;
  unit?: string | null;
  lot?: string | null;
};

const ROOM_PATTERNS = [
  /\bbuanderie\b/g,
  /\bsalle\s*(?:de\s*bain|d[' ]eau)\b/g,
  /\bsdb\b/g,
  /\bcuisine\b/g,
  /\bchambre\b/g,
  /\bsalon\b/g,
  /\bsejour\b/g,
  /\bentree\b/g,
  /\bcouloir\b/g,
  /\bwc\b/g,
  /\btoilettes?\b/g,
  /\bgarage\b/g,
  /\bcellier\b/g,
  /\bterrasse\b/g,
  /\bfacade\b/g,
  /\btoiture\b/g,
  /\bcombles?\b/g,
];

const NOISE_PATTERNS = [
  /\bclasse\s*\d+\b/g,
  /\bel\s*0\b/g,
  /\bdtu\b.*$/g,
  /\bnorme[s]?\b.*$/g,
  /\bconformement\s+a\b.*$/g,
  /\bselon\b.*$/g,
  /\bsuivant\b.*$/g,
  /\bcomprenant\b.*$/g,
  /\by\s+compris\b.*$/g,
  /\bavec\s+toutes?\s+sujetions?\b.*$/g,
  /\btoutes?\s+sujetions?\b.*$/g,
  /\bfourniture\b/g,
  /\bmise\s+en\s+oeuvre\b/g,
  /\bmise\s+en\s+place\b/g,
  /\bmise\s+en\s+service\b/g,
  /\bpose\s+et\s+fourniture\b/g,
  /\bfourniture\s+et\s+pose\b/g,
  /\bapplication\s+de\b/g,
];

const ACTION_RULES: Array<{ label: string; patterns: RegExp[] }> = [
  { label: "Preparation", patterns: [/\bponcage\b/, /\bepoussetage\b/, /\bpreparation\b/, /\bsous[- ]couche\b/] },
  { label: "Depose", patterns: [/\bdepose\b/, /\bdemolition\b/, /\bcurage\b/, /\bevacu(?:ation|er)\b/] },
  { label: "Peinture", patterns: [/\bpeinture\b/, /\bpeindre\b/] },
  { label: "Enduit", patterns: [/\benduit\b/] },
  { label: "Faience", patterns: [/\bfaience\b/] },
  { label: "Reseaux", patterns: [/\breseau[x]?\b/, /\balimentation\b/, /\bevacuation\b/] },
  { label: "Pose", patterns: [/\bpose\b/, /\bposer\b/, /\binstallation\b/, /\binstaller\b/, /\braccordement\b/] },
];

const ELEMENT_RULES: Array<{ label: string; patterns: RegExp[] }> = [
  { label: "stratifie", patterns: [/\bstratifie\b/] },
  { label: "plinthes", patterns: [/\bplinthes?\b/] },
  { label: "murs", patterns: [/\bmurs?\b/] },
  { label: "plafond", patterns: [/\bplafonds?\b/] },
  { label: "receveur douche", patterns: [/\breceveur\b/, /\bdouche\b/] },
  { label: "carrelage", patterns: [/\bcarrelage\b/] },
  { label: "parquet", patterns: [/\bparquet\b/] },
  { label: "sol", patterns: [/\bsol\b/, /\bsols\b/] },
  { label: "cloisons", patterns: [/\bcloisons?\b/, /\bplaco\b/] },
  { label: "isolation", patterns: [/\bisolation\b/, /\bdoublage\b/] },
  { label: "portes", patterns: [/\bportes?\b/, /\bbloc\s+porte\b/] },
  { label: "fenetres", patterns: [/\bfenetres?\b/, /\bbaie\b/, /\bvolets?\b/] },
  { label: "alimentation", patterns: [/\balimentation\b/] },
  { label: "evacuation", patterns: [/\bevacuation\b/] },
  { label: "robinetterie", patterns: [/\brobinetterie\b/] },
  { label: "sanitaires", patterns: [/\bsanitaires?\b/, /\blavabo\b/, /\bwc\b/] },
  { label: "electricite", patterns: [/\belectricite\b/, /\bprises?\b/, /\binterrupteurs?\b/, /\btableau\b/] },
  { label: "vmc", patterns: [/\bvmc\b/, /\bventilation\b/] },
  { label: "chauffage", patterns: [/\bchauffage\b/, /\bradiateurs?\b/, /\bpac\b/] },
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

function titleCase(value: string): string {
  const text = normalizeSpaces(value);
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function stripQuantities(value: string): string {
  return value
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:m2|m3|ml|m|u|h|kg|l|forfait|pcs?)\b/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\b/g, " ");
}

function stripNoise(value: string): string {
  let text = foldText(value);
  text = text.replace(/^\d+(?:[./-]\d+)*\s+/, " ");
  text = text.replace(/\s+\d+(?:[.,]\d+)?\s*(?:\u20ac|eur|ht|ttc)\b.*$/g, " ");
  text = text.replace(/\s+\d+(?:[.,]\d+)?\s*%\b.*$/g, " ");
  text = stripQuantities(text);
  for (const pattern of ROOM_PATTERNS) {
    text = text.replace(pattern, " ");
  }
  for (const pattern of NOISE_PATTERNS) {
    text = text.replace(pattern, " ");
  }
  text = text
    .replace(/\bdepose\s+et\s+evacuation\b/g, " depose ")
    .replace(/\bponcage\s*\+\s*epoussetage\b/g, " preparation ")
    .replace(/\bapplication\s+de\s+peinture\b/g, " peinture ")
    .replace(/\bapplication\s+d[' ]enduit\b/g, " enduit ")
    .replace(/\bfourniture\s+et\s+pose\b/g, " pose ")
    .replace(/\s*[+,;:/-]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

function detectAction(text: string): string {
  for (const rule of ACTION_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) return rule.label;
  }
  return "Pose";
}

function detectElement(text: string, action: string): string {
  if (action === "Reseaux") {
    if (/\balimentation\b/.test(text)) return "alimentation";
    if (/\bevacuation\b/.test(text)) return "evacuation";
  }
  if ((action === "Peinture" || action === "Enduit" || action === "Faience") && /\bmurs?\b/.test(text)) {
    return "murs";
  }
  if ((action === "Peinture" || action === "Enduit") && /\bplafonds?\b/.test(text)) {
    return "plafond";
  }
  for (const rule of ELEMENT_RULES) {
    if (rule.patterns.every((pattern) => pattern.test(text))) return rule.label;
  }
  for (const rule of ELEMENT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) return rule.label;
  }
  if (action === "Preparation") return "support";
  return "ouvrage";
}

function simplifyTitle(action: string, element: string): string {
  if (action === "Peinture" && element === "ouvrage") return "Peinture murs";
  if (action === "Enduit" && element === "ouvrage") return "Enduit murs";
  if (action === "Faience" && element === "ouvrage") return "Faience murs";
  if (action === "Pose" && element === "receveur douche") return "Pose receveur douche";
  if (action === "Pose" && element === "stratifie") return "Pose stratifie";
  if (action === "Depose" && element === "plinthes") return "Depose plinthes";
  return normalizeSpaces(`${action} ${element}`);
}

function enforceWordLimit(value: string): string {
  return normalizeSpaces(value).split(" ").filter(Boolean).slice(0, 5).join(" ");
}

export function generateTerrainTaskTitle(input: TerrainTaskTitleInput): string {
  const source = normalizeSpaces(input.sourceLabel || input.currentTitle || "");
  const cleaned = stripNoise(source);

  if (!cleaned) return "Pose ouvrage";

  const action = detectAction(cleaned);
  const element = detectElement(cleaned, action);
  return titleCase(enforceWordLimit(simplifyTitle(action, element)));
}
