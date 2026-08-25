import { supabase } from "../lib/supabaseClient";
import { getCurrentOrganizationId } from "./currentUserProfile.service";
import {
  COMPANY_FEATURE_MODULES,
  COMPANY_FEATURE_PILLAR_LABELS,
  type CompanyFeatureModuleId,
  type CompanyFeaturePillar,
} from "../config/companyFeatures";

export type CompanyFeatureModuleActionSuffix = "_create" | "_edit" | "_delete";
export type CompanyFeatureModuleActionKey = `${CompanyFeatureModuleId}${CompanyFeatureModuleActionSuffix}`;

export type ProfileFeaturePermissionKey =
  | CompanyFeatureModuleId
  | CompanyFeatureModuleActionKey
  | "intervenants"
  | "crm"
  | "crm_prospects"
  | "crm_clients"
  | "crm_opportunities"
  | "crm_quote_view"
  | "bibliotheque"
  | "statistiques"
  | "fournisseurs"
  | "entreprise_parametres"
  | "task_library_preparation"
  | "chatbot_raul"
  | "crm_quote_create"
  | "crm_quote_edit"
  | "crm_quote_margin"
  | "crm_quote_price_edit"
  | "crm_quote_transform"
  | "crm_quote_delete"
  | "crm_quote_send"
  | "crm_quote_accept_refuse"
  | "finance_margin_edit"
  | "finance_purchases"
  | "chantier_financier_view"
  | "chantier_financier_edit"
  | "chantier_financier_margin"
  | "chantier_financier_billing";

export type ProfileFeaturePermissions = Partial<Record<ProfileFeaturePermissionKey, boolean>>;

export type ProfileFeaturePermissionsResult = {
  role: string | null;
  /** Profil type auquel ce compte est rattaché en direct, ou null s'il est en droits personnalisés. */
  permissionPresetId: BusinessProfilePresetId | null;
  /** Droits effectifs (profil type + exceptions fusionnés). C'est ce qu'il faut utiliser pour tout contrôle d'accès. */
  permissions: ProfileFeaturePermissions;
  /** Uniquement les exceptions explicites par rapport au profil type (ou l'intégralité des droits si aucun profil type n'est rattaché). */
  overrides: ProfileFeaturePermissions;
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

export type ProfilePermissionModuleAction = "view" | "create" | "edit" | "delete";

export type ProfilePermissionModuleRow = {
  moduleId: CompanyFeatureModuleId;
  label: string;
  description: string;
  keys: Record<ProfilePermissionModuleAction, ProfileFeaturePermissionKey>;
};

export type ProfilePermissionModulePillar = {
  pillar: CompanyFeaturePillar;
  label: string;
  modules: ProfilePermissionModuleRow[];
};

export type BusinessProfilePresetId =
  | "dirigeant"
  | "commercial"
  | "chef_de_projet"
  | "conducteur_de_travaux"
  | "comptable"
  | "administratif"
  | "intervenant_terrain"
  | "sous_traitant";

export type BusinessProfilePermissionPreset = {
  id: BusinessProfilePresetId;
  label: string;
  roleLabel: string;
  description: string;
  permissions: ProfileFeaturePermissions;
};

export type BusinessProfilePermissionPresetsResult = {
  presets: BusinessProfilePermissionPreset[];
  schemaReady: boolean;
};

const PROFILE_PERMISSION_PRESETS_TABLE = "profile_permission_presets";

const MODULE_ACTION_SUFFIXES: Array<{ action: Exclude<ProfilePermissionModuleAction, "view">; suffix: CompanyFeatureModuleActionSuffix; label: string }> = [
  { action: "create", suffix: "_create", label: "Créer" },
  { action: "edit", suffix: "_edit", label: "Modifier" },
  { action: "delete", suffix: "_delete", label: "Supprimer" },
];

function moduleActionKey(moduleId: CompanyFeatureModuleId, suffix: CompanyFeatureModuleActionSuffix): CompanyFeatureModuleActionKey {
  return `${moduleId}${suffix}` as CompanyFeatureModuleActionKey;
}

const MODULE_ACTION_KEYS: CompanyFeatureModuleActionKey[] = COMPANY_FEATURE_MODULES.flatMap((module) =>
  MODULE_ACTION_SUFFIXES.map(({ suffix }) => moduleActionKey(module.id, suffix)),
);

const PROFILE_PERMISSION_KEYS: ProfileFeaturePermissionKey[] = [
  ...COMPANY_FEATURE_MODULES.map((module) => module.id),
  ...MODULE_ACTION_KEYS,
  "intervenants",
  "crm",
  "crm_prospects",
  "crm_clients",
  "crm_opportunities",
  "crm_quote_view",
  "bibliotheque",
  "statistiques",
  "fournisseurs",
  "entreprise_parametres",
  "task_library_preparation",
  "chatbot_raul",
  "crm_quote_create",
  "crm_quote_edit",
  "crm_quote_margin",
  "crm_quote_price_edit",
  "crm_quote_transform",
  "crm_quote_delete",
  "crm_quote_send",
  "crm_quote_accept_refuse",
  "finance_margin_edit",
  "finance_purchases",
  "chantier_financier_view",
  "chantier_financier_edit",
  "chantier_financier_margin",
  "chantier_financier_billing",
];

const PROFILE_PERMISSION_KEY_SET = new Set<ProfileFeaturePermissionKey>(PROFILE_PERMISSION_KEYS);

export const BUSINESS_PROFILE_PERMISSION_PRESETS: BusinessProfilePermissionPreset[] = [
  {
    id: "dirigeant",
    label: "Dirigeant / admin",
    roleLabel: "Direction",
    description: "Pilotage complet de l'entreprise, commerce, chantier, financier, ressources et paramètres.",
    permissions: Object.fromEntries(PROFILE_PERMISSION_KEYS.map((key) => [key, true])) as ProfileFeaturePermissions,
  },
  {
    id: "commercial",
    label: "Commercial",
    roleLabel: "Commerce",
    description: "Prospection, clients, projets commerciaux, RDV, devis, envoi et transformation commerciale.",
    permissions: {
      crm: true,
      crm_prospects: true,
      crm_clients: true,
      crm_opportunities: true,
      crm_quote_view: true,
      crm_quote_create: true,
      crm_quote_edit: true,
      crm_quote_send: true,
      crm_quote_accept_refuse: true,
      crm_quote_transform: true,
      crm_quote_margin: false,
      crm_quote_price_edit: true,
      crm_quote_delete: false,
      chatbot_raul: false,
      chantier_financier_view: false,
      chantier_financier_edit: false,
      chantier_financier_margin: false,
      chantier_financier_billing: false,
      finance_margin_edit: false,
      finance_purchases: false,
      fournisseurs: false,
      statistiques: false,
      entreprise_parametres: false,
      intervenants: false,
      bibliotheque: true,
    },
  },
  {
    id: "chef_de_projet",
    label: "Chef de projet",
    roleLabel: "Pilotage projet",
    description: "Accès complet à l'entreprise, au commerce et aux chantiers, à l'exception du module financier (budget, marges, facturation).",
    permissions: {
      ...(Object.fromEntries(PROFILE_PERMISSION_KEYS.map((key) => [key, true])) as ProfileFeaturePermissions),
      budget: false,
      budget_create: false,
      budget_edit: false,
      budget_delete: false,
      chantier_financier_view: false,
      chantier_financier_edit: false,
      chantier_financier_margin: false,
      chantier_financier_billing: false,
      finance_margin_edit: false,
    },
  },
  {
    id: "conducteur_de_travaux",
    label: "Conducteur de travaux",
    roleLabel: "Production chantier",
    description: "Préparation, exécution, planning, tâches, documents, retours terrain, réserves et équipe chantier.",
    permissions: {
      preparation_chantier: true,
      zones_localisation: true,
      taches: true,
      planning: true,
      photos: true,
      consignes: true,
      notes_chantier: true,
      reserves: true,
      temps: true,
      documents: true,
      journal_chantier: true,
      validation_qualite: true,
      approvisionnement: true,
      intervenants: true,
      bibliotheque: true,
      task_library_preparation: true,
      chatbot_raul: true,
      fournisseurs: true,
      chantier_financier_view: true,
      chantier_financier_edit: false,
      chantier_financier_margin: false,
      chantier_financier_billing: false,
      crm: false,
      statistiques: false,
      entreprise_parametres: false,
      finance_margin_edit: false,
      finance_purchases: true,
      // Le conducteur voit et alimente le journal chantier, mais ne purge pas l'historique.
      journal_chantier_delete: false,
      // Les réserves qu'il lève restent tracées : pas de suppression définitive côté terrain.
      reserves_delete: false,
    },
  },
  {
    id: "comptable",
    label: "Comptable",
    roleLabel: "Gestion financière",
    description: "Factures, encaissements, décaissements, TVA, export comptable, fournisseurs et lecture financière chantier.",
    permissions: {
      crm: true,
      crm_clients: true,
      crm_quote_view: true,
      crm_quote_create: false,
      crm_quote_edit: false,
      crm_quote_margin: false,
      crm_quote_price_edit: false,
      crm_quote_transform: false,
      crm_quote_delete: false,
      crm_quote_send: false,
      crm_quote_accept_refuse: false,
      chatbot_raul: false,
      fournisseurs: true,
      statistiques: true,
      rapports: true,
      budget: true,
      chantier_financier_view: true,
      chantier_financier_edit: true,
      chantier_financier_margin: false,
      chantier_financier_billing: true,
      finance_margin_edit: false,
      finance_purchases: true,
      entreprise_parametres: false,
      intervenants: false,
      bibliotheque: false,
      // Lecture financière large, mais aucune création/suppression hors facturation/achats.
      budget_create: false,
      budget_edit: false,
      budget_delete: false,
      rapports_delete: false,
    },
  },
  {
    id: "administratif",
    label: "Administratif",
    roleLabel: "Support administratif",
    description: "Clients, documents, suivi simple des devis et factures, sans réglage sensible ni marges.",
    permissions: {
      crm: true,
      crm_prospects: true,
      crm_clients: true,
      crm_opportunities: true,
      crm_quote_view: true,
      crm_quote_create: false,
      crm_quote_edit: false,
      crm_quote_margin: false,
      crm_quote_price_edit: false,
      crm_quote_transform: false,
      crm_quote_delete: false,
      crm_quote_send: true,
      crm_quote_accept_refuse: false,
      bibliotheque: true,
      documents: true,
      chatbot_raul: false,
      chantier_financier_view: false,
      chantier_financier_edit: false,
      chantier_financier_margin: false,
      chantier_financier_billing: true,
      fournisseurs: false,
      statistiques: false,
      entreprise_parametres: false,
      intervenants: false,
      documents_delete: false,
    },
  },
  {
    id: "intervenant_terrain",
    label: "Intervenant terrain",
    roleLabel: "Portail terrain",
    description: "Accès terrain piloté par l'admin : chantiers, tâches, documents et retours affectés uniquement.",
    permissions: {
      taches: true,
      planning: true,
      photos: true,
      consignes: true,
      notes_chantier: true,
      reserves: true,
      temps: true,
      documents: true,
      journal_chantier: true,
      validation_qualite: true,
      chatbot_raul: true,
      crm: false,
      intervenants: false,
      fournisseurs: false,
      statistiques: false,
      entreprise_parametres: false,
      chantier_financier_view: false,
      chantier_financier_edit: false,
      chantier_financier_margin: false,
      chantier_financier_billing: false,
      // Le terrain déclare et suit, mais ne purge rien définitivement.
      documents_delete: false,
      reserves_delete: false,
      journal_chantier_delete: false,
    },
  },
  {
    id: "sous_traitant",
    label: "Sous-traitant",
    roleLabel: "Partenaire chantier",
    description: "Accès portail limité aux chantiers, documents et tâches explicitement affectés.",
    permissions: {
      taches: true,
      planning: true,
      photos: true,
      consignes: true,
      reserves: true,
      documents: true,
      journal_chantier: true,
      validation_qualite: true,
      temps: false,
      chatbot_raul: false,
      crm: false,
      intervenants: false,
      fournisseurs: false,
      statistiques: false,
      entreprise_parametres: false,
      chantier_financier_view: false,
      chantier_financier_edit: false,
      chantier_financier_margin: false,
      chantier_financier_billing: false,
      // Un partenaire externe ne modifie ni ne supprime les tâches, seulement les exécute.
      taches_create: false,
      taches_delete: false,
      documents_delete: false,
      journal_chantier_delete: false,
    },
  },
];

const BUSINESS_PROFILE_PRESET_ID_SET = new Set<BusinessProfilePresetId>(
  BUSINESS_PROFILE_PERMISSION_PRESETS.map((preset) => preset.id),
);

const EXTRA_PERMISSION_DEFINITIONS: Record<Exclude<ProfileFeaturePermissionKey, CompanyFeatureModuleId | CompanyFeatureModuleActionKey>, ProfilePermissionDefinition> = {
  intervenants: { key: "intervenants", label: "Intervenants", description: "Accès à l’onglet intervenants dans les chantiers et à la page globale des intervenants." },
  crm: { key: "crm", label: "CRM", description: "Accès au cockpit CRM, prospects, clients, opportunités, devis, agenda et SAV." },
  crm_prospects: { key: "crm_prospects", label: "Gerer prospects", description: "Creation, modification, qualification et archivage des prospects." },
  crm_clients: { key: "crm_clients", label: "Gerer clients", description: "Gestion du referentiel client unique et de l'historique commercial." },
  crm_opportunities: { key: "crm_opportunities", label: "Gerer opportunites", description: "Gestion du pipeline commercial et des opportunites." },
  crm_quote_view: { key: "crm_quote_view", label: "Voir devis CRM", description: "Acces aux listes et fiches devis CRM." },
  bibliotheque: { key: "bibliotheque", label: "Bibliothèque", description: "Accès à la page bibliothèque et aux modèles de tâches du backoffice." },
  statistiques: { key: "statistiques", label: "Statistiques", description: "Accès à la page statistiques et aux synthèses globales de pilotage." },
  fournisseurs: { key: "fournisseurs", label: "Fournisseurs", description: "Accès à la base fournisseurs et aux réglages d’approvisionnement." },
  entreprise_parametres: { key: "entreprise_parametres", label: "Paramètres entreprise", description: "Accès aux paramètres entreprise, fonctionnalités et profils." },
  task_library_preparation: { key: "task_library_preparation", label: "Bibliothèque avancée", description: "Accès aux ratios matériaux, au matériel à prévoir et aux estimatifs avancés des modèles de tâches." },
  chatbot_raul: { key: "chatbot_raul", label: "Chatbot Raul", description: "Accès à l'assistant conversationnel Raul dans Batipro." },
  crm_quote_create: { key: "crm_quote_create", label: "Creer devis CRM", description: "Creation de devis BTP depuis le CRM et rattachement aux clients/opportunites." },
  crm_quote_edit: { key: "crm_quote_edit", label: "Modifier devis CRM", description: "Modification des lots, ouvrages, quantites, TVA et conditions des devis." },
  crm_quote_margin: { key: "crm_quote_margin", label: "Voir marges devis", description: "Affichage des debourses, marges par ligne, par lot et globales." },
  crm_quote_price_edit: { key: "crm_quote_price_edit", label: "Modifier prix devis", description: "Modification des prix, coefficients, couts et taux de marge." },
  crm_quote_transform: { key: "crm_quote_transform", label: "Transformer devis en chantier", description: "Creation d'un chantier depuis un devis accepte avec budgets et taches." },
  crm_quote_delete: { key: "crm_quote_delete", label: "Supprimer devis CRM", description: "Suppression ou archivage definitif des devis." },
  crm_quote_send: { key: "crm_quote_send", label: "Envoyer devis", description: "Envoi, relance et generation du lien client securise." },
  crm_quote_accept_refuse: { key: "crm_quote_accept_refuse", label: "Accepter / refuser devis", description: "Changement du statut commercial apres retour client." },
  finance_margin_edit: { key: "finance_margin_edit", label: "Modifier marges", description: "Modification des coefficients, marges et prix de vente." },
  finance_purchases: { key: "finance_purchases", label: "Gerer achats", description: "Gestion des achats, commandes et factures fournisseurs." },
  chantier_financier_view: { key: "chantier_financier_view", label: "Voir financier chantier", description: "Acces aux budgets, couts reels, facturation et indicateurs financiers chantier." },
  chantier_financier_edit: { key: "chantier_financier_edit", label: "Modifier financier chantier", description: "Creation et modification des depenses, budgets, facturations et avenants financiers." },
  chantier_financier_margin: { key: "chantier_financier_margin", label: "Voir marges", description: "Affichage des marges previsionnelles et reelles." },
  chantier_financier_billing: { key: "chantier_financier_billing", label: "Gerer facturation", description: "Gestion des acomptes, situations, factures finales, encaissements et impayes." },
};

let supportsProfileFeaturePermissions: boolean | null = null;
let supportsProfilePermissionPresetTemplates: boolean | null = null;

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeBusinessProfilePresetId(value: unknown): BusinessProfilePresetId | null {
  const text = String(value ?? "").trim();
  return BUSINESS_PROFILE_PRESET_ID_SET.has(text as BusinessProfilePresetId) ? (text as BusinessProfilePresetId) : null;
}

/** Normalise un jeu de droits "sparse" : ne garde que les clés explicitement true/false, ignore le reste. Sert de base aux exceptions (overrides) par utilisateur. */
function normalizePermissions(raw: unknown): ProfileFeaturePermissions {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const output: ProfileFeaturePermissions = {};
  for (const key of PROFILE_PERMISSION_KEYS) {
    if (input[key] === true) output[key] = true;
    if (input[key] === false) output[key] = false;
  }
  return output;
}

/** Pour les modules qui n'ont pas encore de créer/modifier/supprimer explicite, aligne ces 3 actions sur "voir" par défaut — l'admin peut ensuite les affiner précisément dans l'éditeur de profil type. */
function withDerivedModuleActionDefaults(base: ProfileFeaturePermissions): ProfileFeaturePermissions {
  const result: ProfileFeaturePermissions = { ...base };
  for (const module of COMPANY_FEATURE_MODULES) {
    const view = base[module.id] === true;
    for (const { suffix } of MODULE_ACTION_SUFFIXES) {
      const key = moduleActionKey(module.id, suffix);
      if (result[key] === undefined) result[key] = view;
    }
  }
  return result;
}

/** Normalise un preset de profil type : toutes les clés sont explicites (true/false), avec dérivation créer/modifier/supprimer depuis "voir" quand non précisé. */
function normalizePresetPermissions(raw: ProfileFeaturePermissions): ProfileFeaturePermissions {
  const withDefaults = withDerivedModuleActionDefaults(raw);
  const output: ProfileFeaturePermissions = {};
  for (const key of PROFILE_PERMISSION_KEYS) output[key] = withDefaults[key] === true;
  return output;
}

function isMissingFeaturePermissionsColumnError(error: unknown): boolean {
  const code = String((error as { code?: string } | null)?.code ?? "");
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  if (code === "42703") return true;
  return msg.includes("feature_permissions") && (msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("could not find"));
}

function isMissingPresetTemplatesTableError(error: unknown): boolean {
  const code = String((error as { code?: string } | null)?.code ?? "");
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  if (["42P01", "42703"].includes(code)) return true;
  return msg.includes(PROFILE_PERMISSION_PRESETS_TABLE) && (msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("could not find") || msg.includes("relation"));
}

function isAdminRole(role: string | null | undefined): boolean {
  return String(role ?? "").trim().toUpperCase() === "ADMIN";
}

async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  return data.user?.id ?? null;
}

async function assertCurrentUserCanManageProfilePermissions() {
  const current = await getCurrentProfileFeaturePermissions();
  if (!isAdminRole(current.role)) throw new Error("Seul un profil ADMIN peut modifier les permissions profil.");
  if (!current.schemaReady) throw new Error("Migration permissions profil non appliquée sur Supabase.");
}

function mergePresetTemplates(rows: Array<{ preset_id: string; permissions: unknown }> | null | undefined): BusinessProfilePermissionPreset[] {
  const byId = new Map<string, ProfileFeaturePermissions>();
  for (const row of rows ?? []) byId.set(String(row.preset_id), normalizePermissions(row.permissions));
  return BUSINESS_PROFILE_PERMISSION_PRESETS.map((preset) => {
    const defaultPermissions = normalizePresetPermissions(preset.permissions);
    const savedPermissions = byId.get(preset.id);
    return { ...preset, permissions: savedPermissions ? normalizePresetPermissions({ ...defaultPermissions, ...savedPermissions }) : defaultPermissions };
  });
}

/** Fusionne le profil type rattaché (s'il y en a un) avec les exceptions explicites de l'utilisateur pour obtenir ses droits effectifs. */
async function computeEffectivePermissions(presetId: BusinessProfilePresetId | null, overrides: ProfileFeaturePermissions): Promise<ProfileFeaturePermissions> {
  if (!presetId) return overrides;
  const { presets } = await listBusinessProfilePermissionPresets();
  const preset = presets.find((entry) => entry.id === presetId) ?? getBusinessProfilePermissionPreset(presetId);
  const base = preset ? normalizePresetPermissions(preset.permissions) : {};
  return { ...base, ...overrides };
}

export function isCompanyModulePermissionKey(key: ProfileFeaturePermissionKey): key is CompanyFeatureModuleId {
  return COMPANY_FEATURE_MODULES.some((module) => module.id === key);
}

export function getBusinessProfilePermissionPreset(presetId: BusinessProfilePresetId): BusinessProfilePermissionPreset | null {
  const preset = BUSINESS_PROFILE_PERMISSION_PRESETS.find((entry) => entry.id === presetId) ?? null;
  return preset ? { ...preset, permissions: normalizePresetPermissions(preset.permissions) } : null;
}

export async function listBusinessProfilePermissionPresets(): Promise<BusinessProfilePermissionPresetsResult> {
  let organizationId: string;
  try {
    organizationId = await getCurrentOrganizationId();
  } catch {
    return { presets: mergePresetTemplates(null), schemaReady: supportsProfilePermissionPresetTemplates !== false };
  }

  const query = await (supabase as any)
    .from(PROFILE_PERMISSION_PRESETS_TABLE)
    .select("preset_id, permissions")
    .eq("organization_id", organizationId);

  if (query.error) {
    if (isMissingPresetTemplatesTableError(query.error)) {
      supportsProfilePermissionPresetTemplates = false;
      return { presets: mergePresetTemplates(null), schemaReady: false };
    }
    throw new Error(query.error.message);
  }

  supportsProfilePermissionPresetTemplates = true;
  return { presets: mergePresetTemplates(query.data), schemaReady: true };
}

export async function saveBusinessProfilePermissionPreset(presetId: BusinessProfilePresetId, permissions: ProfileFeaturePermissions): Promise<ProfileFeaturePermissions> {
  await assertCurrentUserCanManageProfilePermissions();
  if (!getBusinessProfilePermissionPreset(presetId)) throw new Error("Profil métier inconnu.");
  const organizationId = await getCurrentOrganizationId();

  const nextPermissions = normalizePresetPermissions(permissions);
  const { data, error } = await (supabase as any)
    .from(PROFILE_PERMISSION_PRESETS_TABLE)
    .upsert(
      {
        organization_id: organizationId,
        preset_id: presetId,
        permissions: nextPermissions,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,preset_id" },
    )
    .select("permissions")
    .maybeSingle();

  if (error) {
    if (isMissingPresetTemplatesTableError(error)) {
      supportsProfilePermissionPresetTemplates = false;
      throw new Error("Migration modèles de profils types non appliquée sur Supabase.");
    }
    throw new Error(error.message);
  }

  supportsProfilePermissionPresetTemplates = true;
  return normalizePresetPermissions(normalizePermissions(data?.permissions));
}

export function getProfilePermissionSections(): ProfilePermissionSection[] {
  const chantierSections = (Object.keys(COMPANY_FEATURE_PILLAR_LABELS) as CompanyFeaturePillar[]).map((pillar) => ({
    id: pillar,
    label: COMPANY_FEATURE_PILLAR_LABELS[pillar],
    permissions: COMPANY_FEATURE_MODULES.filter((module) => module.pillar === pillar).map((module) => ({ key: module.id, label: module.label, description: module.description })),
  }));

  return [
    {
      id: "backoffice",
      label: "Backoffice",
      permissions: [
        EXTRA_PERMISSION_DEFINITIONS.intervenants,
        EXTRA_PERMISSION_DEFINITIONS.crm,
        EXTRA_PERMISSION_DEFINITIONS.crm_prospects,
        EXTRA_PERMISSION_DEFINITIONS.crm_clients,
        EXTRA_PERMISSION_DEFINITIONS.crm_opportunities,
        EXTRA_PERMISSION_DEFINITIONS.crm_quote_view,
        EXTRA_PERMISSION_DEFINITIONS.bibliotheque,
        EXTRA_PERMISSION_DEFINITIONS.statistiques,
        EXTRA_PERMISSION_DEFINITIONS.fournisseurs,
        EXTRA_PERMISSION_DEFINITIONS.entreprise_parametres,
      ],
    },
    {
      id: "assistants",
      label: "Assistants",
      permissions: [EXTRA_PERMISSION_DEFINITIONS.chatbot_raul],
    },
    ...chantierSections,
    {
      id: "avance",
      label: "Options avancées",
      permissions: [
        EXTRA_PERMISSION_DEFINITIONS.task_library_preparation,
        EXTRA_PERMISSION_DEFINITIONS.crm_quote_create,
        EXTRA_PERMISSION_DEFINITIONS.crm_quote_edit,
        EXTRA_PERMISSION_DEFINITIONS.crm_quote_margin,
        EXTRA_PERMISSION_DEFINITIONS.crm_quote_price_edit,
        EXTRA_PERMISSION_DEFINITIONS.crm_quote_transform,
        EXTRA_PERMISSION_DEFINITIONS.crm_quote_delete,
        EXTRA_PERMISSION_DEFINITIONS.crm_quote_send,
        EXTRA_PERMISSION_DEFINITIONS.crm_quote_accept_refuse,
        EXTRA_PERMISSION_DEFINITIONS.finance_margin_edit,
        EXTRA_PERMISSION_DEFINITIONS.finance_purchases,
        EXTRA_PERMISSION_DEFINITIONS.chantier_financier_view,
        EXTRA_PERMISSION_DEFINITIONS.chantier_financier_edit,
        EXTRA_PERMISSION_DEFINITIONS.chantier_financier_margin,
        EXTRA_PERMISSION_DEFINITIONS.chantier_financier_billing,
      ],
    },
  ];
}

/** Matrice Voir / Créer / Modifier / Supprimer par module chantier, groupée par pilier — pour l'éditeur de profils types. */
export function getProfilePermissionModuleMatrix(): ProfilePermissionModulePillar[] {
  return (Object.keys(COMPANY_FEATURE_PILLAR_LABELS) as CompanyFeaturePillar[]).map((pillar) => ({
    pillar,
    label: COMPANY_FEATURE_PILLAR_LABELS[pillar],
    modules: COMPANY_FEATURE_MODULES.filter((module) => module.pillar === pillar).map((module) => ({
      moduleId: module.id,
      label: module.label,
      description: module.description,
      keys: {
        view: module.id,
        create: moduleActionKey(module.id, "_create"),
        edit: moduleActionKey(module.id, "_edit"),
        delete: moduleActionKey(module.id, "_delete"),
      },
    })),
  }));
}

export const PROFILE_PERMISSION_MODULE_ACTION_LABELS: Record<ProfilePermissionModuleAction, string> = {
  view: "Voir",
  create: "Créer",
  edit: "Modifier",
  delete: "Supprimer",
};

export async function getCurrentProfileFeaturePermissions(): Promise<ProfileFeaturePermissionsResult> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { role: null, permissionPresetId: null, permissions: {}, overrides: {}, schemaReady: supportsProfileFeaturePermissions !== false };
  }
  return loadProfileFeaturePermissions(userId);
}

export async function getProfileFeaturePermissionsForUser(userId: string): Promise<ProfileFeaturePermissionsResult> {
  const targetUserId = String(userId ?? "").trim();
  if (!targetUserId) throw new Error("Utilisateur cible manquant.");
  return loadProfileFeaturePermissions(targetUserId);
}

async function loadProfileFeaturePermissions(userId: string): Promise<ProfileFeaturePermissionsResult> {
  const query = await (supabase as any)
    .from("profiles")
    .select(supportsProfileFeaturePermissions === false ? "role" : "role, feature_permissions, permission_preset_id")
    .eq("id", userId)
    .maybeSingle();

  if (query.error) {
    if (supportsProfileFeaturePermissions !== false && isMissingFeaturePermissionsColumnError(query.error)) {
      supportsProfileFeaturePermissions = false;
      const fallback = await (supabase as any).from("profiles").select("role").eq("id", userId).maybeSingle();
      if (fallback.error) throw new Error(fallback.error.message);
      return { role: normalizeText(fallback.data?.role), permissionPresetId: null, permissions: {}, overrides: {}, schemaReady: false };
    }
    throw new Error(query.error.message);
  }

  if (supportsProfileFeaturePermissions !== false) supportsProfileFeaturePermissions = true;
  const overrides = normalizePermissions(query.data?.feature_permissions);
  const permissionPresetId = normalizeBusinessProfilePresetId(query.data?.permission_preset_id);
  const permissions = await computeEffectivePermissions(permissionPresetId, overrides);
  return { role: normalizeText(query.data?.role), permissionPresetId, permissions, overrides, schemaReady: true };
}

export async function setCurrentProfileFeaturePermission(key: ProfileFeaturePermissionKey, enabled: boolean): Promise<ProfileFeaturePermissions> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Utilisateur non authentifié.");
  const result = await setProfileFeaturePermissionOverrideForUser(userId, key, enabled);
  return result.permissions;
}

export async function setCurrentProfileFeaturePermissionPreset(presetId: BusinessProfilePresetId): Promise<ProfileFeaturePermissions> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Utilisateur non authentifié.");
  const result = await setProfileFeaturePermissionPresetForUser(userId, presetId);
  return result.permissions;
}

/** Rattache un utilisateur en direct à un profil type : il suit désormais ce profil type en temps réel, sans exception. */
export async function setProfileFeaturePermissionPresetForUser(userId: string, presetId: BusinessProfilePresetId): Promise<ProfileFeaturePermissionsResult> {
  await assertCurrentUserCanManageProfilePermissions();
  const targetUserId = String(userId ?? "").trim();
  if (!targetUserId) throw new Error("Utilisateur cible manquant.");
  if (!getBusinessProfilePermissionPreset(presetId)) throw new Error("Profil métier inconnu.");

  const { error } = await (supabase as any)
    .from("profiles")
    .update({ permission_preset_id: presetId, feature_permissions: {} })
    .eq("id", targetUserId);

  if (error) {
    if (isMissingFeaturePermissionsColumnError(error)) {
      supportsProfileFeaturePermissions = false;
      throw new Error("Migration permissions profil non appliquée sur Supabase.");
    }
    throw new Error(error.message);
  }

  supportsProfileFeaturePermissions = true;
  return loadProfileFeaturePermissions(targetUserId);
}

/** Détache un utilisateur de son profil type : ses droits effectifs actuels deviennent une copie figée et personnalisée. */
export async function detachProfileFeaturePermissionPresetForUser(userId: string): Promise<ProfileFeaturePermissionsResult> {
  await assertCurrentUserCanManageProfilePermissions();
  const targetUserId = String(userId ?? "").trim();
  if (!targetUserId) throw new Error("Utilisateur cible manquant.");

  const current = await loadProfileFeaturePermissions(targetUserId);
  if (!current.permissionPresetId) return current;

  const { error } = await (supabase as any)
    .from("profiles")
    .update({ permission_preset_id: null, feature_permissions: current.permissions })
    .eq("id", targetUserId);

  if (error) throw new Error(error.message);
  return loadProfileFeaturePermissions(targetUserId);
}

/** Ajoute/modifie une exception ponctuelle pour un utilisateur (que ce dernier suive un profil type ou soit en droits personnalisés). */
export async function setProfileFeaturePermissionOverrideForUser(userId: string, key: ProfileFeaturePermissionKey, enabled: boolean): Promise<ProfileFeaturePermissionsResult> {
  await assertCurrentUserCanManageProfilePermissions();
  const targetUserId = String(userId ?? "").trim();
  if (!targetUserId) throw new Error("Utilisateur cible manquant.");
  if (!PROFILE_PERMISSION_KEY_SET.has(key)) throw new Error("Permission profil inconnue.");

  const current = await loadProfileFeaturePermissions(targetUserId);
  const nextOverrides = { ...current.overrides, [key]: enabled };
  await updateProfileFeaturePermissionsForUser(targetUserId, nextOverrides);
  return loadProfileFeaturePermissions(targetUserId);
}

/** Retire l'exception d'un utilisateur pour une permission donnée : il retrouve la valeur de son profil type (s'il en a un), ou "non accordé" sinon. */
export async function clearProfileFeaturePermissionOverrideForUser(userId: string, key: ProfileFeaturePermissionKey): Promise<ProfileFeaturePermissionsResult> {
  await assertCurrentUserCanManageProfilePermissions();
  const targetUserId = String(userId ?? "").trim();
  if (!targetUserId) throw new Error("Utilisateur cible manquant.");

  const current = await loadProfileFeaturePermissions(targetUserId);
  const nextOverrides = { ...current.overrides };
  delete nextOverrides[key];
  await updateProfileFeaturePermissionsForUser(targetUserId, nextOverrides);
  return loadProfileFeaturePermissions(targetUserId);
}

async function updateProfileFeaturePermissionsForUser(userId: string, nextOverrides: ProfileFeaturePermissions): Promise<void> {
  const { error } = await (supabase as any)
    .from("profiles")
    .update({ feature_permissions: nextOverrides })
    .eq("id", userId);

  if (error) {
    if (isMissingFeaturePermissionsColumnError(error)) {
      supportsProfileFeaturePermissions = false;
      throw new Error("Migration permissions profil non appliquée sur Supabase.");
    }
    throw new Error(error.message);
  }
  supportsProfileFeaturePermissions = true;
}

export function hasProfileFeaturePermission(permissions: ProfileFeaturePermissions | null | undefined, key: ProfileFeaturePermissionKey, role: string | null | undefined = "ADMIN"): boolean {
  const normalized = permissions ?? {};
  if (isAdminRole(role)) return normalized[key] !== false;
  return normalized[key] === true;
}
