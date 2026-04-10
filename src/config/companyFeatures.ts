export type CompanyBusinessProfile =
  | "entreprise_renovation"
  | "maitre_oeuvre"
  | "architecte"
  | "artisan"
  | "sous_traitant";

export type CompanyFeatureMode = "simple" | "avance";
export type CompanyInterfaceMode = "pilotage" | "terrain";

export type CompanyFeaturePillar =
  | "organisation"
  | "production"
  | "ressources"
  | "controle"
  | "pilotage";

export type CompanyUserRole = "ADMIN" | "INTERVENANT";

export type CompanyFeatureModuleId =
  | "preparation_chantier"
  | "zones_localisation"
  | "approvisionnement"
  | "documents"
  | "taches"
  | "planning"
  | "photos"
  | "consignes"
  | "messagerie"
  | "notes_chantier"
  | "reserves"
  | "validation_qualite"
  | "journal_chantier"
  | "doe"
  | "temps"
  | "budget"
  | "ecarts"
  | "rapports";

export type CompanyFeatureModule = {
  id: CompanyFeatureModuleId;
  pillar: CompanyFeaturePillar;
  label: string;
  description: string;
  simpleMode: boolean;
  roles: CompanyUserRole[];
};

export type CompanyInterfaceSection = {
  id: string;
  label: string;
  moduleIds: CompanyFeatureModuleId[];
};

export const COMPANY_BUSINESS_PROFILE_OPTIONS: Array<{
  id: CompanyBusinessProfile;
  label: string;
  description: string;
}> = [
  {
    id: "entreprise_renovation",
    label: "Entreprise de rénovation",
    description: "Pilotage complet chantier, achats, qualité, budget et rapports.",
  },
  {
    id: "maitre_oeuvre",
    label: "Maître d'œuvre",
    description: "Coordination planning, contrôle, journal, réserves et reporting.",
  },
  {
    id: "architecte",
    label: "Architecte",
    description: "Suivi documentaire, photos, réserves, DOE et validation qualité.",
  },
  {
    id: "artisan",
    label: "Artisan",
    description: "Tâches, planning, photos, consignes, temps, réserves et documents.",
  },
  {
    id: "sous_traitant",
    label: "Sous-traitant",
    description: "Portail terrain centré sur tâches, planning, consignes, temps et messages.",
  },
];

export const COMPANY_FEATURE_MODE_OPTIONS: Array<{
  id: CompanyFeatureMode;
  label: string;
  description: string;
}> = [
  {
    id: "simple",
    label: "Simple",
    description: "Affiche uniquement les modules principaux pour garder une interface légère.",
  },
  {
    id: "avance",
    label: "Avancé",
    description: "Affiche tous les modules et permet une configuration complète.",
  },
];

export const COMPANY_INTERFACE_MODE_OPTIONS: Array<{
  id: CompanyInterfaceMode;
  label: string;
  description: string;
}> = [
  {
    id: "pilotage",
    label: "Pilotage",
    description: "Navigation orientee coordination, controle et suivi global du chantier.",
  },
  {
    id: "terrain",
    label: "Terrain",
    description: "Navigation orientee preparation, execution quotidienne et fin de chantier.",
  },
];

export const COMPANY_FEATURE_PILLAR_LABELS: Record<CompanyFeaturePillar, string> = {
  organisation: "Organisation",
  production: "Production",
  ressources: "Ressources",
  controle: "Contrôle",
  pilotage: "Pilotage",
};

export const COMPANY_FEATURE_MODULES: CompanyFeatureModule[] = [
  {
    id: "preparation_chantier",
    pillar: "organisation",
    label: "Préparer",
    description: "Checklist de cadrage avant démarrage et validation des prérequis chantier.",
    simpleMode: true,
    roles: ["ADMIN"],
  },
  {
    id: "zones_localisation",
    pillar: "organisation",
    label: "Arborescence chantier",
    description: "Structure du chantier par bâtiments, niveaux, pièces et zones d’intervention.",
    simpleMode: false,
    roles: ["ADMIN", "INTERVENANT"],
  },
  {
    id: "approvisionnement",
    pillar: "ressources",
    label: "Approvisionnement",
    description: "Demandes d’achat, fournisseurs et suivi des livraisons.",
    simpleMode: true,
    roles: ["ADMIN", "INTERVENANT"],
  },
  {
    id: "documents",
    pillar: "organisation",
    label: "Documents",
    description: "Plans, pièces chantier, bibliothèque et documents partagés.",
    simpleMode: true,
    roles: ["ADMIN", "INTERVENANT"],
  },
  {
    id: "taches",
    pillar: "organisation",
    label: "Tâches",
    description: "Création, affectation et suivi opérationnel des tâches.",
    simpleMode: true,
    roles: ["ADMIN", "INTERVENANT"],
  },
  {
    id: "planning",
    pillar: "production",
    label: "Planning",
    description: "Vue planning chantier, dates, séquencement et charge.",
    simpleMode: true,
    roles: ["ADMIN", "INTERVENANT"],
  },
  {
    id: "photos",
    pillar: "production",
    label: "Photos",
    description: "Photos avant, pendant, après et suivi visuel du terrain.",
    simpleMode: true,
    roles: ["ADMIN", "INTERVENANT"],
  },
  {
    id: "consignes",
    pillar: "production",
    label: "Consignes",
    description: "Diffusion et suivi des consignes opérationnelles.",
    simpleMode: true,
    roles: ["ADMIN", "INTERVENANT"],
  },
  {
    id: "messagerie",
    pillar: "production",
    label: "Messagerie",
    description: "Demandes d’information et échanges entre bureau et terrain.",
    simpleMode: true,
    roles: ["ADMIN", "INTERVENANT"],
  },
  {
    id: "notes_chantier",
    pillar: "production",
    label: "Notes",
    description: "Notes terrain liées aux tâches, zones, documents et imprévus.",
    simpleMode: true,
    roles: ["ADMIN", "INTERVENANT"],
  },
  {
    id: "reserves",
    pillar: "controle",
    label: "Réserves",
    description: "Déclaration, suivi, correction et levée des réserves.",
    simpleMode: true,
    roles: ["ADMIN", "INTERVENANT"],
  },
  {
    id: "validation_qualite",
    pillar: "controle",
    label: "Visites",
    description: "Visites de contrôle, validation et demandes de reprise.",
    simpleMode: true,
    roles: ["ADMIN", "INTERVENANT"],
  },
  {
    id: "journal_chantier",
    pillar: "production",
    label: "Journal chantier",
    description: "Historique des actions, retours terrain et traçabilité.",
    simpleMode: false,
    roles: ["ADMIN"],
  },
  {
    id: "doe",
    pillar: "controle",
    label: "DOE",
    description: "Suivi des pièces et préparation du dossier des ouvrages exécutés.",
    simpleMode: false,
    roles: ["ADMIN"],
  },
  {
    id: "temps",
    pillar: "pilotage",
    label: "Temps",
    description: "Saisie, consolidation et comparaison des temps prévus / réels.",
    simpleMode: true,
    roles: ["ADMIN", "INTERVENANT"],
  },
  {
    id: "budget",
    pillar: "pilotage",
    label: "Budget",
    description: "Budget chantier, marge, coût main-d'œuvre et coûts réels.",
    simpleMode: true,
    roles: ["ADMIN"],
  },
  {
    id: "ecarts",
    pillar: "pilotage",
    label: "Imprévus / Travaux supplémentaires",
    description: "Pertes chantier internes, TS client, avenants devis et impacts budgétaires.",
    simpleMode: false,
    roles: ["ADMIN"],
  },
  {
    id: "rapports",
    pillar: "pilotage",
    label: "Rapports",
    description: "Exports PDF client, rapports internes et archivage.",
    simpleMode: true,
    roles: ["ADMIN"],
  },
];

const PROFILE_PRESETS: Record<CompanyBusinessProfile, CompanyFeatureModuleId[]> = {
  entreprise_renovation: COMPANY_FEATURE_MODULES.map((module) => module.id),
  maitre_oeuvre: [
    "preparation_chantier",
    "zones_localisation",
    "documents",
    "taches",
    "planning",
    "photos",
    "consignes",
    "messagerie",
    "notes_chantier",
    "reserves",
    "validation_qualite",
    "journal_chantier",
    "doe",
    "temps",
    "budget",
    "ecarts",
    "rapports",
  ],
  architecte: [
    "preparation_chantier",
    "zones_localisation",
    "documents",
    "planning",
    "photos",
    "consignes",
    "messagerie",
    "notes_chantier",
    "reserves",
    "validation_qualite",
    "journal_chantier",
    "doe",
    "rapports",
  ],
  artisan: [
    "preparation_chantier",
    "zones_localisation",
    "approvisionnement",
    "documents",
    "taches",
    "planning",
    "photos",
    "consignes",
    "messagerie",
    "notes_chantier",
    "reserves",
    "validation_qualite",
    "temps",
    "rapports",
  ],
  sous_traitant: [
    "documents",
    "taches",
    "planning",
    "photos",
    "consignes",
    "messagerie",
    "reserves",
    "temps",
  ],
};

const COMPANY_FEATURE_IDS = new Set(COMPANY_FEATURE_MODULES.map((module) => module.id));

const COMPANY_INTERFACE_MODULE_LAYOUTS: Record<CompanyInterfaceMode, CompanyInterfaceSection[]> = {
  pilotage: [
    {
      id: "organisation",
      label: "Organisation",
      moduleIds: ["zones_localisation", "taches", "documents"],
    },
    {
      id: "production",
      label: "Production",
      moduleIds: ["planning", "photos", "consignes", "journal_chantier", "messagerie", "notes_chantier"],
    },
    {
      id: "ressources",
      label: "Ressources",
      moduleIds: ["approvisionnement"],
    },
    {
      id: "controle",
      label: "Contrôle",
      moduleIds: ["reserves", "doe", "validation_qualite"],
    },
    {
      id: "pilotage",
      label: "Pilotage",
      moduleIds: ["temps", "budget", "rapports", "ecarts"],
    },
  ],
  terrain: [
    {
      id: "preparer",
      label: "Préparer",
      moduleIds: [
        "preparation_chantier",
        "approvisionnement",
        "documents",
        "zones_localisation",
      ],
    },
    {
      id: "executer",
      label: "Exécuter",
      moduleIds: ["taches", "planning", "photos", "consignes", "messagerie", "notes_chantier"],
    },
    {
      id: "controler",
      label: "Contrôler",
      moduleIds: ["reserves", "journal_chantier", "doe", "validation_qualite"],
    },
    {
      id: "piloter",
      label: "Piloter",
      moduleIds: ["temps", "budget", "rapports", "ecarts"],
    },
  ],
};

export const CHANTIER_TAB_FEATURES: Partial<Record<string, CompanyFeatureModuleId>> = {
  preparer: "preparation_chantier",
  localisation: "zones_localisation",
  "devis-taches": "taches",
  photos: "photos",
  documents: "documents",
  planning: "planning",
  temps: "temps",
  budget: "budget",
  pilotage: "ecarts",
  notes: "notes_chantier",
  reserves: "reserves",
  achats: "approvisionnement",
  materiel: "approvisionnement",
  consignes: "consignes",
  journal: "journal_chantier",
  messagerie: "messagerie",
  rapports: "rapports",
  doe: "doe",
  visite: "validation_qualite",
};

export function normalizeCompanyBusinessProfile(
  value: string | null | undefined,
): CompanyBusinessProfile {
  const normalized = String(value ?? "").trim();
  const option = COMPANY_BUSINESS_PROFILE_OPTIONS.find((entry) => entry.id === normalized);
  return option?.id ?? "entreprise_renovation";
}

export function normalizeCompanyFeatureMode(value: string | null | undefined): CompanyFeatureMode {
  return value === "avance" ? "avance" : "simple";
}

export function getDefaultCompanyInterfaceMode(
  businessProfile: CompanyBusinessProfile,
): CompanyInterfaceMode {
  return businessProfile === "architecte" || businessProfile === "maitre_oeuvre"
    ? "pilotage"
    : "terrain";
}

export function normalizeCompanyInterfaceMode(
  value: string | null | undefined,
  businessProfile: CompanyBusinessProfile,
): CompanyInterfaceMode {
  return value === "pilotage" || value === "terrain"
    ? value
    : getDefaultCompanyInterfaceMode(businessProfile);
}

export function getPresetFeatureModules(
  businessProfile: CompanyBusinessProfile,
): CompanyFeatureModuleId[] {
  return [...(PROFILE_PRESETS[businessProfile] ?? PROFILE_PRESETS.entreprise_renovation)];
}

export function normalizeCompanyFeatureModules(
  raw: unknown,
  businessProfile: CompanyBusinessProfile,
): CompanyFeatureModuleId[] {
  if (!Array.isArray(raw)) {
    return getPresetFeatureModules(businessProfile);
  }

  const candidate = raw;
  const valid = candidate
    .map((value) => String(value ?? "").trim())
    .filter((value): value is CompanyFeatureModuleId =>
      COMPANY_FEATURE_IDS.has(value as CompanyFeatureModuleId),
    );

  return Array.from(new Set(valid));
}

export function getEffectiveCompanyFeatureModules(params: {
  businessProfile: CompanyBusinessProfile;
  featureMode: CompanyFeatureMode;
  featureModules: unknown;
}): CompanyFeatureModuleId[] {
  const selected = new Set(
    normalizeCompanyFeatureModules(params.featureModules, params.businessProfile),
  );

  if (params.featureMode === "avance") {
    return COMPANY_FEATURE_MODULES.filter((module) => selected.has(module.id)).map(
      (module) => module.id,
    );
  }

  return COMPANY_FEATURE_MODULES.filter(
    (module) => module.simpleMode && selected.has(module.id),
  ).map((module) => module.id);
}

export function isCompanyFeatureEnabled(
  enabledModules: Iterable<CompanyFeatureModuleId> | null | undefined,
  moduleId: CompanyFeatureModuleId,
) {
  if (!enabledModules) return true;
  const modulesSet =
    enabledModules instanceof Set ? enabledModules : new Set(Array.from(enabledModules ?? []));
  return modulesSet.has(moduleId);
}

export function getVisibleCompanyModules(featureMode: CompanyFeatureMode): CompanyFeatureModule[] {
  if (featureMode === "avance") return COMPANY_FEATURE_MODULES;
  return COMPANY_FEATURE_MODULES.filter((module) => module.simpleMode);
}

export function getModulesByPillar(modules: CompanyFeatureModule[]) {
  return (Object.keys(COMPANY_FEATURE_PILLAR_LABELS) as CompanyFeaturePillar[]).map((pillar) => ({
    pillar,
    label: COMPANY_FEATURE_PILLAR_LABELS[pillar],
    modules: modules.filter((module) => module.pillar === pillar),
  }));
}

export function getModulesByInterfaceMode(
  modules: CompanyFeatureModule[],
  interfaceMode: CompanyInterfaceMode,
) {
  const modulesById = new Map(modules.map((module) => [module.id, module]));

  return COMPANY_INTERFACE_MODULE_LAYOUTS[interfaceMode].map((section) => ({
    id: section.id,
    label: section.label,
    modules: section.moduleIds
      .map((moduleId) => modulesById.get(moduleId))
      .filter((module): module is CompanyFeatureModule => Boolean(module)),
  }));
}
