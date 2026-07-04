let installed = false;
let observer: MutationObserver | null = null;

const SECTION_DEFINITIONS = [
  {
    title: "Préparer le support",
    patterns: ["support", "égrenage", "egrenage", "brossage", "époussetage", "epoussetage", "lavage", "dépoussetage", "depoussetage", "séchage complet", "sechage complet", "impression", "primaire"],
  },
  {
    title: "Appliquer le produit",
    patterns: ["appliquer", "application", "couche", "rouleau", "brosse", "pistolet", "dilution", "diluer", "mélange", "melange", "recouvrir"],
  },
  {
    title: "Contrôler avant de continuer",
    patterns: ["séchage", "sechage", "recouvrement", "résistance", "resistance", "consommation", "rendement", "g/m", "l/m", "épaisseur", "epaisseur"],
  },
];

export function installProductProcedureDisplayBridge() {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  installed = true;
  observer = new MutationObserver(() => enhanceProcedureBlocks());
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(enhanceProcedureBlocks, 0);
}

function enhanceProcedureBlocks() {
  const headings = Array.from(document.querySelectorAll("div, h1, h2, h3, h4, strong"))
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .filter((element) => normalizeText(element.textContent) === "mode operatoire");

  for (const heading of headings) {
    const card = heading.parentElement;
    if (!card || card.dataset.batiproProcedureEnhanced === "true") continue;
    const rawText = extractProcedureText(card, heading);
    if (rawText.length < 80) continue;

    const procedure = buildProcedure(rawText);
    if (procedure.steps.length === 0 && procedure.controls.length === 0) continue;

    card.dataset.batiproProcedureEnhanced = "true";
    card.innerHTML = "";
    card.append(heading, renderProcedure(procedure));
  }
}

function extractProcedureText(card: HTMLElement, heading: HTMLElement) {
  return Array.from(card.childNodes)
    .filter((node) => node !== heading)
    .map((node) => node.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildProcedure(rawText: string) {
  const sentences = splitSentences(rawText)
    .map(cleanSentence)
    .filter((sentence) => sentence.length > 0)
    .filter((sentence, index, list) => list.findIndex((other) => normalizeText(other) === normalizeText(sentence)) === index);

  const buckets = SECTION_DEFINITIONS.map((section) => ({
    title: section.title,
    items: sentences.filter((sentence) => matchesAny(sentence, section.patterns)).slice(0, 5),
  })).filter((section) => section.items.length > 0);

  const used = new Set(buckets.flatMap((section) => section.items.map(normalizeText)));
  const remaining = sentences.filter((sentence) => !used.has(normalizeText(sentence))).slice(0, 5);
  const controls = buildControls(sentences);
  const mistakes = buildMistakes(sentences);

  return {
    steps: buckets.length > 0 ? buckets : [{ title: "Étapes à suivre", items: remaining }],
    controls,
    mistakes,
  };
}

function renderProcedure(procedure: ReturnType<typeof buildProcedure>) {
  const wrapper = document.createElement("div");
  wrapper.dataset.batiproProcedure = "true";
  wrapper.className = "mt-3 space-y-3 text-sm text-slate-700";

  for (const section of procedure.steps) {
    if (section.items.length === 0) continue;
    wrapper.append(buildSection(section.title, section.items, true));
  }

  if (procedure.controls.length > 0) {
    wrapper.append(buildSection("Points de contrôle", procedure.controls, false));
  }

  if (procedure.mistakes.length > 0) {
    wrapper.append(buildSection("Erreurs à éviter", procedure.mistakes, false, "text-amber-900", "border-amber-300"));
  }

  return wrapper;
}

function buildSection(title: string, items: string[], ordered: boolean, titleClass = "text-slate-900", borderClass = "border-blue-300") {
  const section = document.createElement("div");
  section.className = `border-l-4 ${borderClass} pl-3`;

  const heading = document.createElement("div");
  heading.className = `text-xs font-semibold uppercase ${titleClass}`;
  heading.textContent = title;
  section.append(heading);

  const list = document.createElement(ordered ? "ol" : "ul");
  list.className = ordered ? "mt-1 list-decimal space-y-1 pl-4" : "mt-1 list-disc space-y-1 pl-4";
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    list.append(li);
  }
  section.append(list);
  return section;
}

function buildControls(sentences: string[]) {
  const controls = sentences.filter((sentence) => matchesAny(sentence, [
    "sec", "sain", "propre", "cohérent", "coherent", "adhérent", "adherent", "consommation", "rendement", "séchage", "sechage", "recouvrement", "résistance", "resistance",
  ])).slice(0, 4);

  if (controls.length > 0) return controls;
  return [
    "Vérifier que le support est propre, sain et compatible avec le produit.",
    "Respecter les consommations, couches et temps d'attente indiqués sur la fiche produit.",
  ];
}

function buildMistakes(sentences: string[]) {
  const explicit = sentences.filter((sentence) => matchesAny(sentence, [
    "ne pas", "éviter", "eviter", "interdit", "sans", "hors", "limite", "attention", "incompatible",
  ])).slice(0, 4);

  if (explicit.length > 0) return explicit;
  return [
    "Ne pas appliquer sur un support humide, sale ou non préparé.",
    "Ne pas dépasser les limites d'emploi, de consommation ou de recouvrement du produit.",
  ];
}

function splitSentences(text: string) {
  return text
    .replace(/\b(Processus|Support|Préparation|Preparation|Application|Séchage|Sechage|Classe|Couche|Résistance|Resistance)\b/g, ". $1")
    .split(/(?:\s*[.;]\s+)|(?:\s+\-\s+)|(?:\n+)/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function cleanSentence(value: string) {
  return value
    .replace(/^(mise en oeuvre|mise en œuvre|processus|support|préparation|preparation|application)\s*:?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(value: string, patterns: string[]) {
  const key = normalizeText(value);
  return patterns.some((pattern) => key.includes(normalizeText(pattern)));
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
