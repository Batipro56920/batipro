import { supabase } from "../lib/supabaseClient";
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
  primary_color: string;
  secondary_color: string;
  business_profile: CompanyBusinessProfile;
  feature_mode: CompanyFeatureMode;
  mode_interface: CompanyInterfaceMode;
  enabled_modules: CompanyFeatureModuleId[];
  created_at: string;
  updated_at: string;
};

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
    primary_color: normalizeHexColor(row?.primary_color, "#2563eb"),
    secondary_color: normalizeHexColor(row?.secondary_color, "#0f172a"),
    business_profile: businessProfile,
    feature_mode: featureMode,
    mode_interface: interfaceMode,
    enabled_modules: enabledModules,
    created_at: String(row?.created_at ?? ""),
    updated_at: String(row?.updated_at ?? ""),
  };
}

export async function getCompanySettings(): Promise<CompanySettingsRow> {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    const cached = loadLatestLocalSettings();
    if (cached) {
      return withDefaults(String(cached.organization_id ?? ""), cached);
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
      return withDefaults(userId, localSettings ?? undefined);
    }
    if (localSettings) {
      return withDefaults(userId, localSettings);
    }
    const latestCached = loadLatestLocalSettings();
    if (latestCached) {
      return withDefaults(String(latestCached.organization_id ?? userId), latestCached);
    }
    throw new Error(error.message);
  }

  if (!data && localSettings) {
    return withDefaults(userId, localSettings);
  }

  const normalized = withDefaults(userId, (data ?? undefined) as Partial<CompanySettingsRow> | undefined);
  if (localSettings && getSettingsTimestamp(localSettings) > getSettingsTimestamp(normalized)) {
    return withDefaults(userId, localSettings);
  }
  saveLocalSettings(userId, normalized);
  return normalized;
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
      | "primary_color"
      | "secondary_color"
      | "business_profile"
      | "feature_mode"
      | "mode_interface"
      | "enabled_modules"
    >
  >,
): Promise<CompanySettingsRow> {
  const userId = await getCurrentUserId();
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
  };

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "organization_id" })
    .select("*")
    .single();

  if (error) {
    if (isMissingCompanySettingsTableError(error)) {
      const local = withDefaults(userId, loadLocalSettings(userId) ?? undefined);
      const fallback: Partial<CompanySettingsRow> = {
        ...local,
        ...payload,
        created_at: local.created_at || nowIso,
        updated_at: nowIso,
      };
      saveLocalSettings(userId, fallback);
      return withDefaults(userId, fallback);
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
  return localSnapshot;
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

export function getEnabledCompanyModulesFromSettings(
  settings: CompanySettingsRow,
): CompanyFeatureModuleId[] {
  return getEffectiveCompanyFeatureModules({
    businessProfile: settings.business_profile,
    featureMode: settings.feature_mode,
    featureModules: settings.enabled_modules,
  });
}
