export type TaskTemplateLotProfile = {
  id: string;
  label: string;
  keywords: string[];
  laborMarginRate: number;
  defaultUnit: string;
  defaultUsage: {
    quoteVisible: boolean;
    chantierVisible: boolean;
  };
  fieldGuidance: string;
};

const STORAGE_KEY = "batipro.task-template-lot-profiles.v1";
export const TASK_TEMPLATE_LOT_PROFILES_CHANGED = "batipro:task-template-lot-profiles-changed";

export const DEFAULT_TASK_TEMPLATE_LOT_PROFILES: TaskTemplateLotProfile[] = [
  {
    id: "electricite",
    label: "Électricité",
    keywords: ["electricite", "elec", "courant fort", "courant faible"],
    laborMarginRate: 55,
    defaultUnit: "u",
    defaultUsage: { quoteVisible: true, chantierVisible: true },
    fieldGuidance: "Vérifier repérage, continuité, protections, essais et conformité avant fermeture.",
  },
  {
    id: "platrerie",
    label: "Plâtrerie",
    keywords: ["platrerie", "placo", "cloison", "doublage", "isolation"],
    laborMarginRate: 30,
    defaultUnit: "m2",
    defaultUsage: { quoteVisible: true, chantierVisible: true },
    fieldGuidance: "Vérifier planéité, aplomb, fixation, traitement des joints et réservations avant finition.",
  },
  {
    id: "peinture",
    label: "Peinture",
    keywords: ["peinture", "revetement mural", "papier peint"],
    laborMarginRate: 30,
    defaultUnit: "m2",
    defaultUsage: { quoteVisible: true, chantierVisible: true },
    fieldGuidance: "Vérifier préparation support, teinte, nombre de couches, séchage et aspect final à la lumière.",
  },
  {
    id: "plomberie",
    label: "Plomberie",
    keywords: ["plomberie", "sanitaire", "chauffage", "cvc"],
    laborMarginRate: 45,
    defaultUnit: "u",
    defaultUsage: { quoteVisible: true, chantierVisible: true },
    fieldGuidance: "Vérifier étanchéité, raccordements, essais, accessibilité et réservations avant fermeture.",
  },
  {
    id: "menuiserie",
    label: "Menuiserie",
    keywords: ["menuiserie", "agencement"],
    laborMarginRate: 35,
    defaultUnit: "u",
    defaultUsage: { quoteVisible: true, chantierVisible: true },
    fieldGuidance: "Vérifier côtes, niveau, aplomb, fixations, jeux et protections avant réception.",
  },
  {
    id: "sols-carrelage",
    label: "Sols / carrelage",
    keywords: ["sol", "carrelage", "parquet", "faience", "faïence"],
    laborMarginRate: 35,
    defaultUnit: "m2",
    defaultUsage: { quoteVisible: true, chantierVisible: true },
    fieldGuidance: "Vérifier support, calepinage, joints, planéité, coupes et temps de séchage.",
  },
  {
    id: "facade",
    label: "Façade",
    keywords: ["facade", "façade", "ite", "ravalement"],
    laborMarginRate: 35,
    defaultUnit: "m2",
    defaultUsage: { quoteVisible: true, chantierVisible: true },
    fieldGuidance: "Vérifier support, météo, protection des abords, consommation, séchage et aspect final.",
  },
];

export function getTaskTemplateLotProfiles(): TaskTemplateLotProfile[] {
  if (typeof window === "undefined") return DEFAULT_TASK_TEMPLATE_LOT_PROFILES;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_TASK_TEMPLATE_LOT_PROFILES;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_TASK_TEMPLATE_LOT_PROFILES;
    const normalized = parsed.map(normalizeProfile).filter((profile): profile is TaskTemplateLotProfile => Boolean(profile));
    return normalized.length ? normalized : DEFAULT_TASK_TEMPLATE_LOT_PROFILES;
  } catch {
    return DEFAULT_TASK_TEMPLATE_LOT_PROFILES;
  }
}

export function saveTaskTemplateLotProfiles(profiles: TaskTemplateLotProfile[]) {
  if (typeof window === "undefined") return;
  const normalized = profiles.map(normalizeProfile).filter((profile): profile is TaskTemplateLotProfile => Boolean(profile));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized.length ? normalized : DEFAULT_TASK_TEMPLATE_LOT_PROFILES));
  window.dispatchEvent(new CustomEvent(TASK_TEMPLATE_LOT_PROFILES_CHANGED));
}

export function resetTaskTemplateLotProfiles() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(TASK_TEMPLATE_LOT_PROFILES_CHANGED));
}

export function matchTaskTemplateLotProfile(lot: string): TaskTemplateLotProfile {
  const key = normalizeKey(lot);
  return getTaskTemplateLotProfiles().find((profile) => {
    const labelMatches = normalizeKey(profile.label) === key || key.includes(normalizeKey(profile.label));
    const keywordMatches = profile.keywords.some((keyword) => key.includes(normalizeKey(keyword)));
    return labelMatches || keywordMatches;
  }) ?? {
    id: "standard",
    label: lot.trim() || "Lot standard",
    keywords: [],
    laborMarginRate: 30,
    defaultUnit: "u",
    defaultUsage: { quoteVisible: true, chantierVisible: true },
    fieldGuidance: "Vérifier les quantités, temps passés, écarts chantier et réserves éventuelles avant clôture.",
  };
}

function normalizeProfile(value: unknown): TaskTemplateLotProfile | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<TaskTemplateLotProfile>;
  const label = String(source.label ?? "").trim();
  if (!label) return null;
  const laborMarginRate = Number(source.laborMarginRate);
  return {
    id: String(source.id ?? slugify(label) ?? crypto.randomUUID()),
    label,
    keywords: Array.isArray(source.keywords)
      ? source.keywords.map((keyword) => String(keyword).trim()).filter(Boolean)
      : [],
    laborMarginRate: Number.isFinite(laborMarginRate) && laborMarginRate >= 0 ? laborMarginRate : 30,
    defaultUnit: String(source.defaultUnit ?? "u").trim() || "u",
    defaultUsage: {
      quoteVisible: source.defaultUsage?.quoteVisible !== false,
      chantierVisible: source.defaultUsage?.chantierVisible !== false,
    },
    fieldGuidance: String(source.fieldGuidance ?? "").trim(),
  };
}

function slugify(value: string) {
  const slug = normalizeKey(value).replace(/\s+/g, "-");
  return slug || null;
}

function normalizeKey(value: unknown) {
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
