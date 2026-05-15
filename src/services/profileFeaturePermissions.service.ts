import { supabase } from "../lib/supabaseClient";
import {
  COMPANY_FEATURE_MODULES,
  COMPANY_FEATURE_PILLAR_LABELS,
  type CompanyFeatureModuleId,
  type CompanyFeaturePillar,
} from "../config/companyFeatures";

export type ProfileFeaturePermissionKey =
  | CompanyFeatureModuleId
  | "intervenants"
  | "crm"
  | "bibliotheque"
  | "statistiques"
  | "fournisseurs"
  | "entreprise_parametres"
  | "task_library_preparation"
  | "chantier_financier_view"
  | "chantier_financier_edit"
  | "chantier_financier_margin"
  | "chantier_financier_billing";

export type ProfileFeaturePermissions = Partial<Record<ProfileFeaturePermissionKey, boolean>>;

export type ProfileFeaturePermissionsResult = {
  role: string | null;
  permissions: ProfileFeaturePermissions;
  schemaReady: boolean;
};

export type ProfilePermissionDefinition = {
  key: ProfileFeaturePermissionKey;
  label: string;
  description: string;
};

export type ProfilePermissionSection = {
  id: string;
  label: string;
  permissions: ProfilePermissionDefinition[];
};

const PROFILE_PERMISSION_KEYS: ProfileFeaturePermissionKey[] = [
  ...COMPANY_FEATURE_MODULES.map((module) => module.id),
  "intervenants",
  "crm",
  "bibliotheque",
  "statistiques",
  "fournisseurs",
  "entreprise_parametres",
  "task_library_preparation",
  "chantier_financier_view",
  "chantier_financier_edit",
  "chantier_financier_margin",
  "chantier_financier_billing",
];

const PROFILE_PERMISSION_KEY_SET = new Set<ProfileFeaturePermissionKey>(PROFILE_PERMISSION_KEYS);

const EXTRA_PERMISSION_DEFINITIONS: Record<
  Exclude<
    ProfileFeaturePermissionKey,
    CompanyFeatureModuleId
  >,
  ProfilePermissionDefinition
> = {
  intervenants: {
    key: "intervenants",
    label: "Intervenants",
    description:
      "Accès à l’onglet intervenants dans les chantiers et à la page globale des intervenants.",
  },
  crm: {
    key: "crm",
    label: "CRM",
    description: "Accès au cockpit CRM, prospects, clients, opportunités, devis, agenda et SAV.",
  },
  bibliotheque: {
    key: "bibliotheque",
    label: "Bibliothèque",
    description: "Accès à la page bibliothèque et aux modèles de tâches du backoffice.",
  },
  statistiques: {
    key: "statistiques",
    label: "Statistiques",
    description: "Accès à la page statistiques et aux synthèses globales de pilotage.",
  },
  fournisseurs: {
    key: "fournisseurs",
    label: "Fournisseurs",
    description: "Accès à la base fournisseurs et aux réglages d’approvisionnement.",
  },
  entreprise_parametres: {
    key: "entreprise_parametres",
    label: "Paramètres entreprise",
    description: "Accès aux paramètres entreprise, fonctionnalités et profils.",
  },
  task_library_preparation: {
    key: "task_library_preparation",
    label: "Bibliothèque avancée",
    description:
      "Accès aux ratios matériaux, au matériel à prévoir et aux estimatifs avancés des modèles de tâches.",
  },
  chantier_financier_view: {
    key: "chantier_financier_view",
    label: "Voir financier chantier",
    description: "Acces aux budgets, couts reels, facturation et indicateurs financiers chantier.",
  },
  chantier_financier_edit: {
    key: "chantier_financier_edit",
    label: "Modifier financier chantier",
    description: "Creation et modification des depenses, budgets, facturations et avenants financiers.",
  },
  chantier_financier_margin: {
    key: "chantier_financier_margin",
    label: "Voir marges",
    description: "Affichage des marges previsionnelles et reelles.",
  },
  chantier_financier_billing: {
    key: "chantier_financier_billing",
    label: "Gerer facturation",
    description: "Gestion des acomptes, situations, factures finales, encaissements et impayes.",
  },
};

let supportsProfileFeaturePermissions: boolean | null = null;

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizePermissions(raw: unknown): ProfileFeaturePermissions {
  const input =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const output: ProfileFeaturePermissions = {};

  for (const key of PROFILE_PERMISSION_KEYS) {
    if (input[key] === true) output[key] = true;
    if (input[key] === false) output[key] = false;
  }

  return output;
}

function isMissingFeaturePermissionsColumnError(error: unknown): boolean {
  const code = String((error as { code?: string } | null)?.code ?? "");
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  if (code === "42703") return true;
  return (
    msg.includes("feature_permissions") &&
    (msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("could not find"))
  );
}

function isAdminRole(role: string | null | undefined): boolean {
  return String(role ?? "").trim().toUpperCase() === "ADMIN";
}

async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  return data.user?.id ?? null;
}

export function isCompanyModulePermissionKey(
  key: ProfileFeaturePermissionKey,
): key is CompanyFeatureModuleId {
  return COMPANY_FEATURE_MODULES.some((module) => module.id === key);
}

export function getProfilePermissionSections(): ProfilePermissionSection[] {
  const chantierSections = (Object.keys(COMPANY_FEATURE_PILLAR_LABELS) as CompanyFeaturePillar[]).map(
    (pillar) => ({
      id: pillar,
      label: COMPANY_FEATURE_PILLAR_LABELS[pillar],
      permissions: COMPANY_FEATURE_MODULES.filter((module) => module.pillar === pillar).map((module) => ({
        key: module.id,
        label: module.label,
        description: module.description,
      })),
    }),
  );

  return [
    {
      id: "backoffice",
      label: "Backoffice",
      permissions: [
        EXTRA_PERMISSION_DEFINITIONS.intervenants,
        EXTRA_PERMISSION_DEFINITIONS.crm,
        EXTRA_PERMISSION_DEFINITIONS.bibliotheque,
        EXTRA_PERMISSION_DEFINITIONS.statistiques,
        EXTRA_PERMISSION_DEFINITIONS.fournisseurs,
        EXTRA_PERMISSION_DEFINITIONS.entreprise_parametres,
      ],
    },
    ...chantierSections,
    {
      id: "avance",
      label: "Options avancées",
      permissions: [
        EXTRA_PERMISSION_DEFINITIONS.task_library_preparation,
        EXTRA_PERMISSION_DEFINITIONS.chantier_financier_view,
        EXTRA_PERMISSION_DEFINITIONS.chantier_financier_edit,
        EXTRA_PERMISSION_DEFINITIONS.chantier_financier_margin,
        EXTRA_PERMISSION_DEFINITIONS.chantier_financier_billing,
      ],
    },
  ];
}

export async function getCurrentProfileFeaturePermissions(): Promise<ProfileFeaturePermissionsResult> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return {
      role: null,
      permissions: {},
      schemaReady: supportsProfileFeaturePermissions !== false,
    };
  }

  const query = await (supabase as any)
    .from("profiles")
    .select(supportsProfileFeaturePermissions === false ? "role" : "role, feature_permissions")
    .eq("id", userId)
    .maybeSingle();

  if (query.error) {
    if (supportsProfileFeaturePermissions !== false && isMissingFeaturePermissionsColumnError(query.error)) {
      supportsProfileFeaturePermissions = false;
      const fallback = await (supabase as any)
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (fallback.error) throw new Error(fallback.error.message);
      return {
        role: normalizeText(fallback.data?.role),
        permissions: {},
        schemaReady: false,
      };
    }

    throw new Error(query.error.message);
  }

  if (supportsProfileFeaturePermissions !== false) {
    supportsProfileFeaturePermissions = true;
  }

  return {
    role: normalizeText(query.data?.role),
    permissions: normalizePermissions(query.data?.feature_permissions),
    schemaReady: true,
  };
}

export async function setCurrentProfileFeaturePermission(
  key: ProfileFeaturePermissionKey,
  enabled: boolean,
): Promise<ProfileFeaturePermissions> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Utilisateur non authentifié.");
  if (!PROFILE_PERMISSION_KEY_SET.has(key)) throw new Error("Permission profil inconnue.");

  const current = await getCurrentProfileFeaturePermissions();
  if (!isAdminRole(current.role)) {
    throw new Error("Seul un profil ADMIN peut activer cette permission.");
  }
  if (!current.schemaReady) {
    throw new Error("Migration permissions profil non appliquée sur Supabase.");
  }

  const nextPermissions: ProfileFeaturePermissions = {
    ...current.permissions,
    [key]: enabled,
  };

  const { data, error } = await (supabase as any)
    .from("profiles")
    .update({ feature_permissions: nextPermissions })
    .eq("id", userId)
    .select("feature_permissions")
    .maybeSingle();

  if (error) {
    if (isMissingFeaturePermissionsColumnError(error)) {
      supportsProfileFeaturePermissions = false;
      throw new Error("Migration permissions profil non appliquée sur Supabase.");
    }
    throw new Error(error.message);
  }

  supportsProfileFeaturePermissions = true;
  return normalizePermissions(data?.feature_permissions);
}

export function hasProfileFeaturePermission(
  permissions: ProfileFeaturePermissions | null | undefined,
  key: ProfileFeaturePermissionKey,
  role: string | null | undefined = "ADMIN",
): boolean {
  const normalized = permissions ?? {};
  if (isAdminRole(role)) {
    return normalized[key] !== false;
  }
  return normalized[key] === true;
}
