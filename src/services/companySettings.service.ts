import { supabase } from "../lib/supabaseClient";
import { getCurrentOrganizationId } from "./currentUserProfile.service";
import {
  getDefaultCompanyInterfaceMode,
  getEffectiveCompanyFeatureModules,
  normalizeCompanyBusinessProfile,
  normalizeCompanyFeatureMode,
  normalizeCompanyInterfaceMode,
  normalizeCompanyFeatureModules,
  type CompanyBusinessProfile,
  type CompanyFeatureMode,
  type CompanyInterfaceMode,
  type CompanyFeatureModuleId,
} from "../config/companyFeatures";

const TABLE = "company_settings";
const LOGO_BUCKET = "chantier-documents";
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const LOCAL_SETTINGS_KEY = "batipro.company_settings.v1";

export type CompanyChargeEntry = {
  id: string;
  name: string;
  category: string;
  type: "fixed" | "variable";
  amount: number;
  isTtc: boolean;
  vatRecoverable: boolean;
  frequency: "one_time" | "monthly" | "quarterly" | "annual";
  start_date: string;
  end_date: string | null;
  allocation: "general" | "project" | "chantier";
  comment: string;
  active: boolean;
};

export type CompanyChargesSettings = {
  entries: CompanyChargeEntry[];
};

export type CompanyInvestmentCategory =
  | "services"
  | "materiel"
  | "vehicules"
  | "locaux"
  | "numerique"
  | "recrutement"
  | "formation"
  | "communication"
  | "autre";

export type CompanyInvestmentEntry = {
  id: string;
  name: string;
  category: CompanyInvestmentCategory;
  targetAmountHt: number;
  durationMonths: number;
  startDate: string;
  notes: string;
  status: "planned" | "paused" | "acquired";
};

export type CompanyInvestmentSettings = {
  entries: CompanyInvestmentEntry[];
};

export function normalizeInvestmentPlan(raw: unknown): CompanyInvestmentSettings {
  const source = (raw ?? {}) as Partial<CompanyInvestmentSettings>;
  const entries = Array.isArray(source.entries) ? source.entries : [];
  return {
    entries: entries.map((entry) => ({
      id: String(entry?.id ?? ""),
      name: String(entry?.name ?? "").trim(),
      category: (entry?.category ?? "autre") as CompanyInvestmentCategory,
      targetAmountHt: Math.max(0, Number(entry?.targetAmountHt) || 0),
      durationMonths: Math.max(1, Math.round(Number(entry?.durationMonths) || 1)),
      startDate: String(entry?.startDate ?? new Date().toISOString().slice(0, 10)),
      notes: String(entry?.notes ?? ""),
      status: entry?.status === "paused" || entry?.status === "acquired" ? entry.status : "planned",
    })),
  };
}

export function investmentMonthlyContribution(entry: CompanyInvestmentEntry): number {
  if (entry.status !== "planned" || entry.durationMonths <= 0) return 0;
  return entry.targetAmountHt / entry.durationMonths;
}

export function getInvestmentMonthlyTotal(entries: CompanyInvestmentEntry[]): number {
  return entries.reduce((sum, entry) => sum + investmentMonthlyContribution(entry), 0);
}

/** Matériel amorti par l'entreprise (échafaudage, outillage, véhicule...). */
export type CompanyEquipmentAsset = {
  id: string;
  name: string;
  quantity: number;
  purchaseValueHt: number;
  amortizationYears: number;
  /** Heures pendant lesquelles une unité de ce matériel est réellement utilisée chaque année. */
  annualUsageHours: number;
  /** Entretien, réparations et consommables annuels pour une unité. */
  annualMaintenanceHt: number;
  /** Tarif facturé par heure d'utilisation. 0 = calcul automatique avec la marge de l'entreprise. */
  hourlySaleRateHt: number;
  /** Mode de chiffrage du matériel : à l'heure ou au forfait journalier. */
  billingMode: "hour" | "day";
  /** Journées d'utilisation prévues par an pour calculer le coût journalier réel. */
  annualUsageDays: number;
  /** Forfait journalier HT. 0 = tarif conseillé selon la marge. */
  dailySaleRateHt: number;
  /** general = réparti dans les charges ; task = imputé seulement aux tâches liées. */
  allocationMode: "general" | "task";
  active: boolean;
};

/**
 * Coûts indirects ramenés à un coût horaire : l'amortissement matériel et les
 * frais généraux sont divisés par les heures productives annuelles de l'équipe,
 * puis imputés au temps de main d'oeuvre de chaque tâche.
 */
export type ConsumableMode = "quantity" | "use" | "hour" | "day";
export type CompanyConsumableSupplier = {
  id: string;
  supplierId: string;
  packagePriceHt: number;
  packageQuantity: number;
  reference: string;
};
export type CompanyConsumable = {
  id: string;
  name: string;
  category: string;
  unit: string;
  mode: ConsumableMode;
  /** Number of billable uses/hours/days per package for reusable consumables. */
  usageCapacity: number;
  suppliers: CompanyConsumableSupplier[];
  active: boolean;
};
export function consumableUnitCost(item: CompanyConsumable, supplier: CompanyConsumableSupplier): number {
  const base = Number(supplier.packagePriceHt) / Number(supplier.packageQuantity);
  if (!Number.isFinite(base) || base < 0 || supplier.packageQuantity <= 0) return 0;
  return item.mode === "quantity" ? base : base / Math.max(1, item.usageCapacity);
}
export function cheapestConsumableSupplier(item: CompanyConsumable): CompanyConsumableSupplier | null {
  return [...item.suppliers].filter((row) => row.packageQuantity > 0 && row.packagePriceHt >= 0)
    .sort((left, right) => consumableUnitCost(item, left) - consumableUnitCost(item, right))[0] ?? null;
}

export type CompanyIndirectCostsSettings = {
  consumables: CompanyConsumable[];
  equipmentAssets: CompanyEquipmentAsset[];
  productiveHoursPerEmployeeYear: number;
};

export const DEFAULT_PRODUCTIVE_HOURS_PER_EMPLOYEE_YEAR = 1607;
export const DEFAULT_EQUIPMENT_ANNUAL_USAGE_HOURS = 400;

export function equipmentHourlyCost(asset: CompanyEquipmentAsset): number {
  if (asset.amortizationYears <= 0 || asset.annualUsageHours <= 0) return 0;
  const annualDepreciation = asset.purchaseValueHt / asset.amortizationYears;
  return (annualDepreciation + asset.annualMaintenanceHt) / asset.annualUsageHours;
}

export function equipmentDailyCost(asset: CompanyEquipmentAsset): number {
  if (asset.amortizationYears <= 0 || asset.annualUsageDays <= 0) return 0;
  return (asset.purchaseValueHt / asset.amortizationYears + asset.annualMaintenanceHt) / asset.annualUsageDays;
}

export function equipmentEffectiveDailySale(asset: CompanyEquipmentAsset, marginRate: number): number {
  return asset.dailySaleRateHt > 0 ? asset.dailySaleRateHt : equipmentDailyCost(asset) * (1 + Math.max(0, marginRate) / 100);
}

/** Répartition proportionnelle en chiffrage unitaire, sans arrondir chaque tâche à un jour complet. */
export function equipmentTaskAmounts(asset: CompanyEquipmentAsset, marginRate: number, hours: number): { costHt: number; saleHt: number } {
  const duration = Math.max(0, hours);
  if (asset.billingMode === "day") {
    const dailyHours = 7;
    return { costHt: equipmentDailyCost(asset) * duration / dailyHours, saleHt: equipmentEffectiveDailySale(asset, marginRate) * duration / dailyHours };
  }
  return { costHt: equipmentHourlyCost(asset) * duration, saleHt: equipmentEffectiveHourlySale(asset, marginRate) * duration };
}

export function equipmentSuggestedHourlySale(asset: CompanyEquipmentAsset, marginRate: number): number {
  return equipmentHourlyCost(asset) * (1 + Math.max(0, marginRate) / 100);
}

export function equipmentEffectiveHourlySale(asset: CompanyEquipmentAsset, marginRate: number): number {
  return asset.hourlySaleRateHt > 0 ? asset.hourlySaleRateHt : equipmentSuggestedHourlySale(asset, marginRate);
}

export function equipmentPaybackYears(asset: CompanyEquipmentAsset, marginRate: number): number | null {
  const annualContribution = equipmentEffectiveHourlySale(asset, marginRate) * asset.annualUsageHours - asset.annualMaintenanceHt;
  return annualContribution > 0 ? asset.purchaseValueHt / annualContribution : null;
}

export function normalizeIndirectCosts(raw: unknown): CompanyIndirectCostsSettings {
  const source = (raw ?? {}) as Partial<CompanyIndirectCostsSettings>;
  const assets = Array.isArray(source.equipmentAssets) ? source.equipmentAssets : [];
  const hours = Number(source.productiveHoursPerEmployeeYear);
  return {
    consumables: (Array.isArray(source.consumables) ? source.consumables : []).map((item) => ({
      id: String(item?.id ?? ""), name: String(item?.name ?? "").trim(),
      category: String(item?.category ?? ""), unit: String(item?.unit ?? "u") || "u",
      mode: item?.mode === "use" || item?.mode === "hour" || item?.mode === "day" ? item.mode : "quantity",
      usageCapacity: Math.max(1, Number(item?.usageCapacity) || 1), active: item?.active !== false,
      suppliers: (Array.isArray(item?.suppliers) ? item.suppliers : []).map((price) => ({
        id: String(price?.id ?? ""), supplierId: String(price?.supplierId ?? ""),
        packagePriceHt: Math.max(0, Number(price?.packagePriceHt) || 0),
        packageQuantity: Math.max(0.000001, Number(price?.packageQuantity) || 1),
        reference: String(price?.reference ?? ""),
      })),
    })),
    equipmentAssets: assets.map((asset) => ({
      id: String(asset?.id ?? ""),
      name: String(asset?.name ?? "").trim(),
      quantity: Math.max(1, Math.round(Number(asset?.quantity) || 1)),
      purchaseValueHt: Math.max(0, Number(asset?.purchaseValueHt) || 0),
      amortizationYears: Math.max(0, Number(asset?.amortizationYears) || 0),
      // Une ancienne fiche conserve le calcul historique à 1 607 h/an. Les
      // nouvelles fiches proposent 400 h/an, à confirmer selon l'usage réel.
      annualUsageHours: Math.max(1, Number(asset?.annualUsageHours) || DEFAULT_PRODUCTIVE_HOURS_PER_EMPLOYEE_YEAR),
      annualMaintenanceHt: Math.max(0, Number(asset?.annualMaintenanceHt) || 0),
      hourlySaleRateHt: Math.max(0, Number(asset?.hourlySaleRateHt) || 0),
      billingMode: asset?.billingMode === "day" ? "day" : "hour",
      annualUsageDays: Math.max(1, Number(asset?.annualUsageDays) || Math.ceil((Number(asset?.annualUsageHours) || DEFAULT_EQUIPMENT_ANNUAL_USAGE_HOURS) / 7)),
      dailySaleRateHt: Math.max(0, Number(asset?.dailySaleRateHt) || 0),
      // Les anciennes fiches n'avaient pas de mode : elles suivent désormais
      // le modèle demandé, c'est-à-dire un amortissement par tâche liée.
      allocationMode: asset?.allocationMode === "general" ? "general" : "task",
      active: asset?.active !== false,
    })),
    productiveHoursPerEmployeeYear:
      Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_PRODUCTIVE_HOURS_PER_EMPLOYEE_YEAR,
  };
}

export type CompanySettingsRow = {
  id: string;
  organization_id: string;
  company_name: string;
  logo_path: string | null;
  logo_url?: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  siret: string | null;
  insurance_decennale: string | null;
  default_payment_terms: string | null;
  default_legal_mentions: string | null;
  default_waste_management: string | null;
  /** Marge appliquée au déboursé faute de taux propre à la tâche ; null = 30 %. */
  default_margin_rate: number | null;
  /** Marge appliquée à la main d'œuvre. Vide : la marge générale s'applique. */
  default_labor_margin_rate: number | null;
  primary_color: string;
  secondary_color: string;
  business_profile: CompanyBusinessProfile;
  feature_mode: CompanyFeatureMode;
  mode_interface: CompanyInterfaceMode;
  enabled_modules: CompanyFeatureModuleId[];
  charges_exploitation?: CompanyChargesSettings | null;
  indirect_costs?: CompanyIndirectCostsSettings | null;
  investment_plan?: CompanyInvestmentSettings | null;
  created_at: string;
  updated_at: string;
  persistence_status?: "supabase" | "local_fallback";
};

export const DEFAULT_PURCHASE_ORDER_PAYMENT_TERMS =
  "Commande passee pour les besoins du chantier ou projet indique. Livraison a l'adresse du chantier sauf mention contraire. Paiement a 30 jours fin de mois, date de facture.";
export const DEFAULT_PURCHASE_ORDER_LEGAL_MENTIONS =
  "Le fournisseur reste proprietaire des marchandises jusqu'au paiement integral de la commande (clause de reserve de propriete). Toute non-conformite ou anomalie de livraison doit etre signalee sous 48 heures.";
export const DEFAULT_PURCHASE_ORDER_WASTE_MANAGEMENT =
  "Les emballages et dechets lies a la livraison sont repris par le fournisseur ou evacues conformement a la reglementation en vigueur sur le chantier.";

export type CompanyBrandingPdf = {
  companyName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  siret: string | null;
  insuranceDecennale: string | null;
  primaryColor: string;
  secondaryColor: string;
  logoDataUrl: string | null;
};

function sanitizeFileName(name: string): string {
  const base = (name ?? "").trim();
  if (!base) return "logo";
  const noAccents = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lower = noAccents.toLowerCase();
  const noApostrophes = lower.replace(/['\u2019]/g, "");
  const underscored = noApostrophes.replace(/\s+/g, "_");
  const safe = underscored.replace(/[^a-z0-9._-]/g, "");
  return safe || "logo";
}

/** Un taux de marge exploitable, ou null pour retomber sur la valeur par défaut. */
function normalizeMarginRate(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(String(raw).replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizeHexColor(raw: string | null | undefined, fallback: string): string {
  const value = String(raw ?? "").trim();
  return /^#([0-9A-Fa-f]{6})$/.test(value) ? value : fallback;
}

function isMissingCompanySettingsTableError(error: { message?: string } | null): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    (msg.includes("schema cache") && msg.includes("company_settings")) ||
    (msg.includes("relation") && msg.includes("company_settings")) ||
    msg.includes("does not exist")
  );
}

function isMissingCompanySettingsFieldError(error: { message?: string } | null): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("column") &&
    msg.includes("does not exist") &&
    (msg.includes("charges_exploitation") || msg.includes("indirect_costs") || msg.includes("investment_plan"))
  );
}

function loadLocalSettings(orgId: string): Partial<CompanySettingsRow> | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_SETTINGS_KEY}:${orgId}`);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<CompanySettingsRow>;
  } catch {
    return null;
  }
}

function saveLocalSettings(orgId: string, data: Partial<CompanySettingsRow>) {
  try {
    localStorage.setItem(`${LOCAL_SETTINGS_KEY}:${orgId}`, JSON.stringify(data));
  } catch {
    // ignore local persistence errors
  }
}

function getSettingsTimestamp(value: Partial<CompanySettingsRow> | null | undefined): number {
  const raw = String(value?.updated_at ?? value?.created_at ?? "").trim();
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function loadLatestLocalSettings(): Partial<CompanySettingsRow> | null {
  try {
    const latest = Object.keys(localStorage)
      .filter((key) => key.startsWith(`${LOCAL_SETTINGS_KEY}:`))
      .map((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<CompanySettingsRow>;
        return { key, value: parsed };
      })
      .filter((entry): entry is { key: string; value: Partial<CompanySettingsRow> } => Boolean(entry))
      .sort((left, right) => {
        const leftTs = Date.parse(String(left.value.updated_at ?? left.value.created_at ?? 0));
        const rightTs = Date.parse(String(right.value.updated_at ?? right.value.created_at ?? 0));
        return rightTs - leftTs;
      })[0];

    return latest?.value ?? null;
  } catch {
    return null;
  }
}

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user?.id) throw new Error("Utilisateur non authentifie.");
  return data.user.id;
}

// Utilisé pour les requêtes/écritures sur company_settings.organization_id (la
// vraie organisation, pas l'utilisateur créateur) — distinct de getCurrentUserId()
// ci-dessus, encore utilisé pour l'espace de nommage du logo dans Storage.
async function getOrganizationId(): Promise<string> {
  return await getCurrentOrganizationId();
}

function withDefaults(orgId: string, row?: Partial<CompanySettingsRow>): CompanySettingsRow {
  const rowAny = row as any;
  const logoPath = (rowAny?.logo_path ?? rowAny?.logo_url ?? null) as string | null;
  const businessProfile = normalizeCompanyBusinessProfile(rowAny?.business_profile);
  const featureMode = normalizeCompanyFeatureMode(rowAny?.feature_mode);
  const interfaceMode = normalizeCompanyInterfaceMode(rowAny?.mode_interface, businessProfile);
  const enabledModules = normalizeCompanyFeatureModules(rowAny?.enabled_modules, businessProfile);

  return {
    id: String(row?.id ?? ""),
    organization_id: String(row?.organization_id ?? orgId),
    company_name: String(row?.company_name ?? ""),
    logo_path: logoPath,
    logo_url: rowAny?.logo_url ?? null,
    address: row?.address ?? null,
    phone: row?.phone ?? null,
    email: row?.email ?? null,
    siret: row?.siret ?? null,
    insurance_decennale: row?.insurance_decennale ?? null,
    default_payment_terms: row?.default_payment_terms ?? null,
    default_legal_mentions: row?.default_legal_mentions ?? null,
    default_waste_management: row?.default_waste_management ?? null,
    default_margin_rate: normalizeMarginRate(rowAny?.default_margin_rate),
    default_labor_margin_rate: normalizeMarginRate(rowAny?.default_labor_margin_rate),
    primary_color: normalizeHexColor(row?.primary_color, "#2563eb"),
    secondary_color: normalizeHexColor(row?.secondary_color, "#0f172a"),
    business_profile: businessProfile,
    feature_mode: featureMode,
    mode_interface: interfaceMode,
    enabled_modules: enabledModules,
    charges_exploitation: row?.charges_exploitation ?? null,
    indirect_costs: normalizeIndirectCosts(row?.indirect_costs),
    investment_plan: normalizeInvestmentPlan(row?.investment_plan),
    created_at: String(row?.created_at ?? ""),
    updated_at: String(row?.updated_at ?? ""),
    persistence_status: row?.persistence_status ?? "supabase",
  };
}

function withPersistenceStatus(row: CompanySettingsRow, status: CompanySettingsRow["persistence_status"]): CompanySettingsRow {
  return { ...row, persistence_status: status };
}

export async function getCompanySettings(): Promise<CompanySettingsRow> {
  let userId: string;
  try {
    userId = await getOrganizationId();
  } catch {
    const cached = loadLatestLocalSettings();
    if (cached) {
      return withPersistenceStatus(withDefaults(String(cached.organization_id ?? ""), cached), "local_fallback");
    }
    throw new Error("Impossible de charger les réglages société.");
  }
  const localSettings = loadLocalSettings(userId);
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("organization_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingCompanySettingsTableError(error)) {
      return withPersistenceStatus(withDefaults(userId, localSettings ?? undefined), "local_fallback");
    }
    if (localSettings) {
      return withPersistenceStatus(withDefaults(userId, localSettings), "local_fallback");
    }
    const latestCached = loadLatestLocalSettings();
    if (latestCached) {
      return withPersistenceStatus(withDefaults(String(latestCached.organization_id ?? userId), latestCached), "local_fallback");
    }
    throw new Error(error.message);
  }

  if (!data && localSettings) {
    return withPersistenceStatus(withDefaults(userId, localSettings), "local_fallback");
  }

  const normalized = withDefaults(userId, (data ?? undefined) as Partial<CompanySettingsRow> | undefined);
  if (localSettings && getSettingsTimestamp(localSettings) > getSettingsTimestamp(normalized)) {
    return withPersistenceStatus(withDefaults(userId, localSettings), "local_fallback");
  }
  saveLocalSettings(userId, normalized);
  return withPersistenceStatus(normalized, "supabase");
}

export async function upsertCompanySettings(
  patch: Partial<
    Pick<
      CompanySettingsRow,
      | "company_name"
      | "logo_path"
      | "address"
      | "phone"
      | "email"
      | "siret"
      | "insurance_decennale"
      | "default_payment_terms"
      | "default_legal_mentions"
      | "default_waste_management"
      | "default_margin_rate"
      | "default_labor_margin_rate"
      | "primary_color"
      | "secondary_color"
      | "business_profile"
      | "feature_mode"
      | "mode_interface"
      | "enabled_modules"
      | "charges_exploitation"
      | "indirect_costs"
      | "investment_plan"
    >
  >,
): Promise<CompanySettingsRow> {
  const userId = await getOrganizationId();
  const nowIso = new Date().toISOString();
  const currentLocal = withDefaults(userId, loadLocalSettings(userId) ?? undefined);
  const businessProfile =
    patch.business_profile ?? currentLocal.business_profile ?? "entreprise_renovation";
  const featureMode = patch.feature_mode ?? currentLocal.feature_mode ?? "simple";
  const interfaceMode =
    patch.mode_interface ??
    currentLocal.mode_interface ??
    getDefaultCompanyInterfaceMode(businessProfile);
  const enabledModules =
    patch.enabled_modules ??
    normalizeCompanyFeatureModules(currentLocal.enabled_modules, businessProfile);

  const payload = {
    organization_id: userId,
    company_name: String(patch.company_name ?? currentLocal.company_name ?? "").trim(),
    logo_path: patch.logo_path !== undefined ? patch.logo_path : currentLocal.logo_path ?? null,
    address:
      patch.address !== undefined ? (patch.address ? patch.address.trim() : null) : currentLocal.address,
    phone:
      patch.phone !== undefined ? (patch.phone ? patch.phone.trim() : null) : currentLocal.phone,
    email:
      patch.email !== undefined ? (patch.email ? patch.email.trim() : null) : currentLocal.email,
    siret:
      patch.siret !== undefined ? (patch.siret ? patch.siret.trim() : null) : currentLocal.siret,
    insurance_decennale:
      patch.insurance_decennale !== undefined
        ? patch.insurance_decennale
          ? patch.insurance_decennale.trim()
          : null
        : currentLocal.insurance_decennale,
    default_payment_terms:
      patch.default_payment_terms !== undefined
        ? patch.default_payment_terms
          ? patch.default_payment_terms.trim()
          : null
        : currentLocal.default_payment_terms,
    default_margin_rate:
      patch.default_margin_rate !== undefined
        ? normalizeMarginRate(patch.default_margin_rate)
        : currentLocal.default_margin_rate,
    default_labor_margin_rate:
      patch.default_labor_margin_rate !== undefined
        ? normalizeMarginRate(patch.default_labor_margin_rate)
        : currentLocal.default_labor_margin_rate,
    default_legal_mentions:
      patch.default_legal_mentions !== undefined
        ? patch.default_legal_mentions
          ? patch.default_legal_mentions.trim()
          : null
        : currentLocal.default_legal_mentions,
    default_waste_management:
      patch.default_waste_management !== undefined
        ? patch.default_waste_management
          ? patch.default_waste_management.trim()
          : null
        : currentLocal.default_waste_management,
    primary_color: normalizeHexColor(
      patch.primary_color ?? currentLocal.primary_color,
      "#2563eb",
    ),
    secondary_color: normalizeHexColor(
      patch.secondary_color ?? currentLocal.secondary_color,
      "#0f172a",
    ),
    business_profile: normalizeCompanyBusinessProfile(businessProfile),
    feature_mode: normalizeCompanyFeatureMode(featureMode),
    mode_interface: normalizeCompanyInterfaceMode(interfaceMode, businessProfile),
    enabled_modules: normalizeCompanyFeatureModules(enabledModules, businessProfile),
    charges_exploitation: patch.charges_exploitation !== undefined ? patch.charges_exploitation : currentLocal.charges_exploitation ?? null,
    indirect_costs: normalizeIndirectCosts(
      patch.indirect_costs !== undefined ? patch.indirect_costs : currentLocal.indirect_costs,
    ),
    investment_plan: normalizeInvestmentPlan(
      patch.investment_plan !== undefined ? patch.investment_plan : currentLocal.investment_plan,
    ),
  };

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "organization_id" })
    .select("*")
    .single();

  if (error) {
    if (isMissingCompanySettingsTableError(error) || isMissingCompanySettingsFieldError(error)) {
      const local = withDefaults(userId, loadLocalSettings(userId) ?? undefined);
      const fallback: Partial<CompanySettingsRow> = {
        ...local,
        ...payload,
        created_at: local.created_at || nowIso,
        updated_at: nowIso,
      };
      saveLocalSettings(userId, fallback);
      return withPersistenceStatus(withDefaults(userId, fallback), "local_fallback");
    }
    throw new Error(error.message);
  }

  const localSnapshot = withDefaults(userId, {
    ...(data as Partial<CompanySettingsRow>),
    ...payload,
    updated_at: nowIso,
    created_at: (data as any)?.created_at ?? currentLocal.created_at ?? nowIso,
  });
  saveLocalSettings(userId, localSnapshot);
  return withPersistenceStatus(localSnapshot, "supabase");
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Conversion du logo impossible."));
    };
    reader.onerror = () => reject(new Error("Conversion du logo impossible."));
    reader.readAsDataURL(file);
  });
}

export async function uploadCompanyLogo(file: File, currentLogoPath?: string | null): Promise<string> {
  if (!file) throw new Error("Logo manquant.");
  if (!file.type.startsWith("image/")) throw new Error("Le logo doit etre une image.");
  if (file.size > MAX_LOGO_BYTES) throw new Error("Le logo depasse 5 Mo.");

  const userId = await getCurrentUserId();
  const safeName = sanitizeFileName(file.name || "logo");
  const storagePath = `company/${userId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(storagePath, file, {
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) {
    // Fallback local if Storage is not available yet (policies, env, migration delay, etc.)
    return fileToDataUrl(file);
  }

  if (currentLogoPath && !/^https?:\/\//i.test(currentLogoPath) && !/^data:image\//i.test(currentLogoPath)) {
    await supabase.storage.from(LOGO_BUCKET).remove([currentLogoPath]);
  }

  return storagePath;
}

export async function getCompanyLogoSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  if (/^https?:\/\//i.test(storagePath) || /^data:image\//i.test(storagePath)) {
    return storagePath;
  }
  const { data, error } = await supabase.storage.from(LOGO_BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Impossible de charger le logo.");
  return data.signedUrl;
}

export async function getCompanyBrandingForPdf(): Promise<CompanyBrandingPdf> {
  try {
    const settings = await getCompanySettings();
    let logoDataUrl: string | null = null;

    if (settings.logo_path) {
      try {
        const logoRef = settings.logo_path;
        if (/^data:image\//i.test(logoRef)) {
          logoDataUrl = logoRef;
        } else {
          const signedOrDirectUrl =
            /^https?:\/\//i.test(logoRef) ? logoRef : await getCompanyLogoSignedUrl(logoRef, 600);
          const response = await fetch(signedOrDirectUrl);
          if (response.ok) {
            const blob = await response.blob();
            logoDataUrl = await fileToDataUrl(blob);
          }
        }
      } catch {
        logoDataUrl = null;
      }
    }

    return {
      companyName: settings.company_name.trim() || "Batipro",
      address: settings.address,
      phone: settings.phone,
      email: settings.email,
      siret: settings.siret,
      insuranceDecennale: settings.insurance_decennale,
      primaryColor: settings.primary_color,
      secondaryColor: settings.secondary_color,
      logoDataUrl,
    };
  } catch {
    return {
      companyName: "Batipro",
      address: null,
      phone: null,
      email: null,
      siret: null,
      insuranceDecennale: null,
      primaryColor: "#2563eb",
      secondaryColor: "#0f172a",
      logoDataUrl: null,
    };
  }
}

export async function getPurchaseOrderDefaultTerms(): Promise<{
  paymentTerms: string;
  legalMentions: string;
  wasteManagement: string;
}> {
  try {
    const settings = await getCompanySettings();
    return {
      paymentTerms: settings.default_payment_terms?.trim() || DEFAULT_PURCHASE_ORDER_PAYMENT_TERMS,
      legalMentions: settings.default_legal_mentions?.trim() || DEFAULT_PURCHASE_ORDER_LEGAL_MENTIONS,
      wasteManagement: settings.default_waste_management?.trim() || DEFAULT_PURCHASE_ORDER_WASTE_MANAGEMENT,
    };
  } catch {
    return {
      paymentTerms: DEFAULT_PURCHASE_ORDER_PAYMENT_TERMS,
      legalMentions: DEFAULT_PURCHASE_ORDER_LEGAL_MENTIONS,
      wasteManagement: DEFAULT_PURCHASE_ORDER_WASTE_MANAGEMENT,
    };
  }
}

export function getEnabledCompanyModulesFromSettings(
  settings: CompanySettingsRow,
): CompanyFeatureModuleId[] {
  return getEffectiveCompanyFeatureModules({
    businessProfile: settings.business_profile,
    featureMode: settings.feature_mode,
    featureModules: settings.enabled_modules,
  });
}
