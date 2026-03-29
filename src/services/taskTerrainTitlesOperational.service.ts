export type TerrainTaskTitleInput = {
  sourceLabel: string;
  currentTitle?: string | null;
  quantity?: number | null;
  unit?: string | null;
  lot?: string | null;
};

type ActionKind = "pose" | "depose" | "peinture" | "enduit" | "preparation" | "faience" | "reseaux";

const LOCATION_PATTERNS = [
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
  /\bdtu\b.*$/g,
  /\bel\s*0\b/g,
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
  /\bapplication\s+de\b/g,
];

const MATERIAL_RULES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\blaine\s+de\s+bois\b/, label: "laine de bois" },
  { pattern: /\blaine\s+de\s+verre\b/, label: "laine de verre" },
  { pattern: /\bplacopl(?:atre|atre)\b|\bplaco\b/, label: "placoplatre" },
  { pattern: /\bplaques?\s+de\s+platre\b/, label: "plaques de platre" },
  { pattern: /\bpvc\b/, label: "PVC" },
  { pattern: /\balu(?:minium)?\b/, label: "alu" },
  { pattern: /\bbois\b/, label: "bois" },
  { pattern: /\bstratifie\b/, label: "stratifie" },
  { pattern: /\bparquet\b/, label: "parquet" },
  { pattern: /\bfaience\b/, label: "faience" },
  { pattern: /\bcarrelage\b/, label: "carrelage" },
];

const SPEC_RULES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bossature\s+metallique\b/, label: "ossature metallique" },
  { pattern: /\bsous[- ]couche\b/, label: "sous-couche" },
  { pattern: /\bhydrofuge\b/, label: "hydrofuge" },
  { pattern: /\bdouble\s+vitrage\b/, label: "double vitrage" },
  { pattern: /\bbonde\b/, label: "bonde" },
  { pattern: /\bjoints?\b/, label: "joints" },
  { pattern: /\bisolant\b/, label: "isolant" },
  { pattern: /\bfinition\b/, label: "finition" },
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

function capitalize(value: string): string {
  const text = normalizeSpaces(value);
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function unique(parts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const cleaned = normalizeSpaces(part ?? "");
    if (!cleaned) continue;
    const key = foldText(cleaned);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function stripNoise(value: string): string {
  let text = foldText(value);
  text = text.replace(/^\d+(?:[./-]\d+)*\s+/, " ");
  text = text.replace(/\s+\d+(?:[.,]\d+)?\s*(?:m2|m3|ml|m|u|h|kg|l|forfait|pcs?)\b/g, " ");
  text = text.replace(/\s+\d+(?:[.,]\d+)?\s*(?:\u20ac|eur|ht|ttc)\b.*$/g, " ");
  text = text.replace(/\s+\d+(?:[.,]\d+)?\s*%\b.*$/g, " ");
  for (const pattern of LOCATION_PATTERNS) {
    text = text.replace(pattern, " ");
  }
  for (const pattern of NOISE_PATTERNS) {
    text = text.replace(pattern, " ");
  }
  text = text
    .replace(/\bdepose\s+et\s+evacuation\b/g, " depose ")
    .replace(/\bponcage\s*(?:\+|et)\s*epoussetage\b/g, " preparation ")
    .replace(/\bapplication\s+de\s+peinture\b/g, " peinture ")
    .replace(/\bapplication\s+d[' ]enduit\b/g, " enduit ")
    .replace(/\bfourniture\s+et\s+pose\b/g, " pose ")
    .replace(/\s*[+,;:/-]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

function detectAction(text: string): ActionKind {
  if (/\bponcage\b|\bepoussetage\b|\bpreparation\b/.test(text)) return "preparation";
  if (/\bdepose\b|\bdemolition\b|\bcurage\b/.test(text)) return "depose";
  if (/\bpeinture\b|\bpeindre\b/.test(text)) return "peinture";
  if (/\benduit\b/.test(text)) return "enduit";
  if (/\bfaience\b/.test(text)) return "faience";
  if (/\breseau[x]?\b|\balimentation\b|\bevacuation\b/.test(text)) return "reseaux";
  return "pose";
}

function detectThickness(text: string): string | null {
  const match = text.match(/\b\d+\s*mm\b/);
  return match?.[0] ?? null;
}

function detectLayers(text: string): string | null {
  const match = text.match(/\b\d+\s*couches?\b/);
  return match?.[0] ?? null;
}

function detectMaterial(text: string): string | null {
  for (const rule of MATERIAL_RULES) {
    if (rule.pattern.test(text)) return rule.label;
  }
  return null;
}

function detectSpecs(text: string): string[] {
  const specs = SPEC_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.label);
  return unique([...specs, detectThickness(text), detectLayers(text)]);
}

function detectOuvrage(text: string, action: ActionKind): string {
  if (/\bfaux\s+plafond\b/.test(text)) return "faux plafond";
  if (/\bplafond\b|\bplafonds\b/.test(text)) return "plafond";
  if (/\bcloisons?\b/.test(text)) return "cloisons";
  if (/\bdoublage\b/.test(text)) return "doublage";
  if (/\bmurs?\b/.test(text)) return "murs";
  if (/\bplinthes?\b/.test(text)) return "plinthes";
  if (/\breceveur\b/.test(text) && /\bdouche\b/.test(text)) return "receveur de douche";
  if (/\bportes?\b|\bbloc\s+porte\b/.test(text)) return "portes";
  if (/\bfenetres?\b|\bbaie\b|\bvolets?\b/.test(text)) return "fenetres";
  if (/\bcarrelage\b/.test(text)) return "carrelage";
  if (/\bfaience\b/.test(text)) return action === "faience" ? "murs" : "faience";
  if (/\bstratifie\b/.test(text)) return "revetement de sol";
  if (/\bparquet\b/.test(text)) return "parquet";
  if (/\bsols?\b/.test(text)) return "revetement de sol";
  if (/\bsanitaires?\b|\blavabo\b|\brobinetterie\b/.test(text)) return "sanitaires";
  if (/\belectricite\b|\bprises?\b|\binterrupteurs?\b|\btableau\b/.test(text)) return "electricite";
  if (/\bvmc\b|\bventilation\b/.test(text)) return "ventilation";
  if (/\bchauffage\b|\bradiateurs?\b|\bpac\b/.test(text)) return "chauffage";
  if (action === "reseaux") {
    if (/\balimentation\b/.test(text)) return "reseaux d'alimentation";
    if (/\bevacuation\b/.test(text)) return "reseaux d'evacuation";
    return "reseaux";
  }
  return "ouvrage";
}

function buildPoseTitle(ouvrage: string, material: string | null, specs: string[]): string {
  if (ouvrage === "receveur de douche") {
    return `pose d'un receveur de douche${specs.includes("bonde") ? " avec bonde" : ""}`;
  }

  if (ouvrage === "faux plafond") {
    return normalizeSpaces(`pose d'un faux plafond${material ? ` en ${material}` : ""} ${specs.join(" ")}`);
  }

  if (ouvrage === "cloisons") {
    const ossaturePart = specs.includes("ossature metallique") ? " sur ossature metallique" : "";
    const extraSpecs = specs.filter((item) => item !== "ossature metallique");
    return normalizeSpaces(`pose de cloisons${material ? ` en ${material}` : ""}${ossaturePart} ${extraSpecs.join(" ")}`);
  }

  if (ouvrage === "doublage") {
    return normalizeSpaces(`pose d'un doublage${material ? ` en ${material}` : ""} ${specs.join(" ")}`);
  }

  if (ouvrage === "revetement de sol" && material) {
    return normalizeSpaces(`pose d'un revetement de sol en ${material} ${specs.join(" ")}`);
  }

  if (ouvrage === "parquet") {
    return normalizeSpaces(`pose d'un parquet ${specs.join(" ")}`);
  }

  if (ouvrage === "carrelage") {
    return normalizeSpaces(`pose d'un carrelage ${specs.join(" ")}`);
  }

  if (ouvrage === "fenetres" && material) {
    return normalizeSpaces(`pose de fenetres en ${material} ${specs.join(" ")}`);
  }

  return normalizeSpaces(`pose de ${ouvrage}${material ? ` en ${material}` : ""} ${specs.join(" ")}`);
}

function buildTitle(text: string, action: ActionKind): string {
  const ouvrage = detectOuvrage(text, action);
  const material = detectMaterial(text);
  const specs = detectSpecs(text);

  if (action === "peinture") {
    const couche = specs.find((item) => /couches?/.test(item));
    return normalizeSpaces(`mise en peinture des ${ouvrage}${couche ? ` en ${couche}` : ""}`);
  }

  if (action === "enduit") {
    return normalizeSpaces(`application d'un enduit${specs.includes("finition") ? " de finition" : ""} sur ${ouvrage}`);
  }

  if (action === "preparation") {
    return normalizeSpaces(`preparation des ${ouvrage === "ouvrage" ? "supports" : ouvrage}`);
  }

  if (action === "depose") {
    return normalizeSpaces(`depose de ${ouvrage}`);
  }

  if (action === "faience") {
    return normalizeSpaces(`pose de faience sur ${ouvrage}${specs.includes("joints") ? " avec joints" : ""}`);
  }

  if (action === "reseaux") {
    return ouvrage === "reseaux" ? "pose de reseaux" : normalizeSpaces(`pose de ${ouvrage}`);
  }

  return buildPoseTitle(ouvrage, material, specs);
}

function avoidVagueTitle(title: string, text: string): string {
  const folded = foldText(title);
  if (!["pose de ouvrage", "pose d'un ouvrage", "depose de ouvrage"].includes(folded)) return title;

  if (/\bplaco\b|\bplaques?\s+de\s+platre\b/.test(text)) return "pose de cloisons en plaques de platre";
  if (/\bpeinture\b/.test(text)) return "mise en peinture des murs";
  if (/\benduit\b/.test(text)) return "application d'un enduit sur murs";
  return "realisation de l'ouvrage";
}

export function generateTerrainTaskTitle(input: TerrainTaskTitleInput): string {
  const source = normalizeSpaces(input.sourceLabel || input.currentTitle || "");
  const cleaned = stripNoise(source);

  if (!cleaned) return "Realisation de l'ouvrage";

  const action = detectAction(cleaned);
  return capitalize(avoidVagueTitle(buildTitle(cleaned, action), cleaned));
}
