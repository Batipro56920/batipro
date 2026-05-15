import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  COMPANY_BUSINESS_PROFILE_OPTIONS,
  COMPANY_FEATURE_MODE_OPTIONS,
  COMPANY_INTERFACE_MODE_OPTIONS,
  getDefaultCompanyInterfaceMode,
  getModulesByInterfaceMode,
  getPresetFeatureModules,
  getVisibleCompanyModules,
  type CompanyBusinessProfile,
  type CompanyFeatureMode,
  type CompanyFeatureModuleId,
  type CompanyInterfaceMode,
} from "../config/companyFeatures";
import {
  getCompanyLogoSignedUrl,
  getCompanySettings,
  upsertCompanySettings,
  uploadCompanyLogo,
  type CompanySettingsRow,
} from "../services/companySettings.service";
import {
  getCurrentProfileFeaturePermissions,
  getProfilePermissionSections,
  hasProfileFeaturePermission,
  isCompanyModulePermissionKey,
  setCurrentProfileFeaturePermission,
  type ProfileFeaturePermissionKey,
  type ProfileFeaturePermissions,
} from "../services/profileFeaturePermissions.service";
import { useI18n } from "../i18n";

type CompanySection = "identite" | "fonctionnalites" | "profils";

type CompanyFormState = {
  company_name: string;
  address: string;
  phone: string;
  email: string;
  siret: string;
  insurance_decennale: string;
  primary_color: string;
  secondary_color: string;
};

type CompanyFeaturesFormState = {
  business_profile: CompanyBusinessProfile;
  feature_mode: CompanyFeatureMode;
  mode_interface: CompanyInterfaceMode;
  enabled_modules: CompanyFeatureModuleId[];
};

function toCompanyForm(settings: CompanySettingsRow): CompanyFormState {
  return {
    company_name: settings.company_name ?? "",
    address: settings.address ?? "",
    phone: settings.phone ?? "",
    email: settings.email ?? "",
    siret: settings.siret ?? "",
    insurance_decennale: settings.insurance_decennale ?? "",
    primary_color: settings.primary_color ?? "#2563eb",
    secondary_color: settings.secondary_color ?? "#0f172a",
  };
}

function toCompanyFeaturesForm(settings: CompanySettingsRow): CompanyFeaturesFormState {
  return {
    business_profile: settings.business_profile,
    feature_mode: settings.feature_mode,
    mode_interface: settings.mode_interface,
    enabled_modules: [...settings.enabled_modules],
  };
}

function getActiveSection(pathname: string): CompanySection {
  if (pathname.endsWith("/fonctionnalites")) return "fonctionnalites";
  if (pathname.endsWith("/profils")) return "profils";
  return "identite";
}

export default function MonEntreprisePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();

  const activeSection = getActiveSection(location.pathname);

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingProfilePermission, setSavingProfilePermission] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

  const [companySettings, setCompanySettings] = useState<CompanySettingsRow | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanyFormState>({
    company_name: "",
    address: "",
    phone: "",
    email: "",
    siret: "",
    insurance_decennale: "",
    primary_color: "#2563eb",
    secondary_color: "#0f172a",
  });
  const [featuresForm, setFeaturesForm] = useState<CompanyFeaturesFormState>({
    business_profile: "entreprise_renovation",
    feature_mode: "simple",
    mode_interface: getDefaultCompanyInterfaceMode("entreprise_renovation"),
    enabled_modules: getPresetFeatureModules("entreprise_renovation"),
  });

  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [selectedLogoPreviewUrl, setSelectedLogoPreviewUrl] = useState<string | null>(null);

  const [profilePermissionSchemaReady, setProfilePermissionSchemaReady] = useState(true);
  const [currentProfileRole, setCurrentProfileRole] = useState<string | null>(null);
  const [currentProfilePermissions, setCurrentProfilePermissions] =
    useState<ProfileFeaturePermissions>({});

  const profilePermissionSections = useMemo(() => getProfilePermissionSections(), []);
  const modulesBySection = useMemo(
    () => getModulesByInterfaceMode(getVisibleCompanyModules(featuresForm.feature_mode), featuresForm.mode_interface),
    [featuresForm.feature_mode, featuresForm.mode_interface],
  );
  const selectedProfileMeta = useMemo(
    () =>
      COMPANY_BUSINESS_PROFILE_OPTIONS.find((entry) => entry.id === featuresForm.business_profile) ??
      COMPANY_BUSINESS_PROFILE_OPTIONS[0],
    [featuresForm.business_profile],
  );
  const activeModuleCount = useMemo(() => {
    const visibleIds = new Set(modulesBySection.flatMap((section) => section.modules.map((module) => module.id)));
    return featuresForm.enabled_modules.filter((moduleId) => visibleIds.has(moduleId)).length;
  }, [featuresForm.enabled_modules, modulesBySection]);
  const advancedPreparationEnabled = useMemo(
    () =>
      hasProfileFeaturePermission(
        currentProfilePermissions,
        "task_library_preparation",
        currentProfileRole,
      ),
    [currentProfilePermissions, currentProfileRole],
  );

  const effectiveLogoPreviewUrl = selectedLogoPreviewUrl || logoPreviewUrl;

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    if (!logoFile) {
      setSelectedLogoPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(logoFile);
    setSelectedLogoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile]);

  async function loadSettings() {
    setLoadingSettings(true);
    setSettingsError(null);
    try {
      const settings = await getCompanySettings();
      setCompanySettings(settings);
      setCompanyForm(toCompanyForm(settings));
      setFeaturesForm(toCompanyFeaturesForm(settings));

      if (settings.logo_path) {
        try {
          setLogoPreviewUrl(await getCompanyLogoSignedUrl(settings.logo_path, 600));
        } catch {
          setLogoPreviewUrl(null);
        }
      } else {
        setLogoPreviewUrl(null);
      }

      try {
        const profilePermissions = await getCurrentProfileFeaturePermissions();
        setCurrentProfileRole(profilePermissions.role);
        setCurrentProfilePermissions(profilePermissions.permissions);
        setProfilePermissionSchemaReady(profilePermissions.schemaReady);
      } catch {
        setCurrentProfileRole("ADMIN");
        setCurrentProfilePermissions({});
        setProfilePermissionSchemaReady(false);
      }
    } catch (err: any) {
      setSettingsError(err?.message ?? t("monEntreprise.loadError"));
    } finally {
      setLoadingSettings(false);
    }
  }

  async function onSaveCompanySettings() {
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsNotice(null);
    try {
      let nextLogoPath = companySettings?.logo_path ?? null;
      if (logoFile) {
        nextLogoPath = await uploadCompanyLogo(logoFile, companySettings?.logo_path ?? null);
      }
      const saved = await upsertCompanySettings({ ...companyForm, logo_path: nextLogoPath });
      setCompanySettings(saved);
      setCompanyForm(toCompanyForm(saved));
      setLogoFile(null);
      if (saved.logo_path) {
        try {
          setLogoPreviewUrl(await getCompanyLogoSignedUrl(saved.logo_path, 600));
        } catch {
          setLogoPreviewUrl(null);
        }
      } else {
        setLogoPreviewUrl(null);
      }
      setSettingsNotice(t("monEntreprise.saveSuccess"));
    } catch (err: any) {
      setSettingsError(err?.message ?? t("monEntreprise.saveError"));
    } finally {
      setSavingSettings(false);
    }
  }

  async function onSaveFeatureSettings() {
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsNotice(null);
    try {
      const saved = await upsertCompanySettings({
        business_profile: featuresForm.business_profile,
        feature_mode: featuresForm.feature_mode,
        mode_interface: featuresForm.mode_interface,
        enabled_modules: featuresForm.enabled_modules,
      });
      setCompanySettings(saved);
      setCompanyForm(toCompanyForm(saved));
      setFeaturesForm(toCompanyFeaturesForm(saved));
      setSettingsNotice("Configuration des fonctionnalites enregistree.");
    } catch (err: any) {
      setSettingsError(err?.message ?? "Erreur enregistrement des fonctionnalites.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function onToggleCurrentProfilePermission(key: ProfileFeaturePermissionKey) {
    setSavingProfilePermission(true);
    setSettingsError(null);
    setSettingsNotice(null);
    try {
      const next = !hasProfileFeaturePermission(currentProfilePermissions, key, currentProfileRole);
      const permissions = await setCurrentProfileFeaturePermission(key, next);
      setCurrentProfilePermissions(permissions);
      setSettingsNotice(next ? "Permission profil activee." : "Permission profil desactivee.");
    } catch (err: any) {
      setSettingsError(err?.message ?? "Erreur mise a jour permission profil.");
    } finally {
      setSavingProfilePermission(false);
    }
  }

  function onChangeBusinessProfile(nextProfile: CompanyBusinessProfile) {
    setFeaturesForm((prev) => ({
      ...prev,
      business_profile: nextProfile,
      mode_interface: getDefaultCompanyInterfaceMode(nextProfile),
      enabled_modules: getPresetFeatureModules(nextProfile),
    }));
  }

  function onToggleModule(moduleId: CompanyFeatureModuleId) {
    setFeaturesForm((prev) => {
      const next = new Set(prev.enabled_modules);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return { ...prev, enabled_modules: Array.from(next) };
    });
  }

  if (loadingSettings) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{t("monEntreprise.title")}</h1>
          <p className="text-slate-500">{t("monEntreprise.subtitle")}</p>
        </div>
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
          {t("monEntreprise.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("monEntreprise.title")}</h1>
        <p className="text-slate-500">{t("monEntreprise.subtitle")}</p>
      </div>

      {settingsError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {settingsError}
        </div>
      ) : null}
      {settingsNotice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {settingsNotice}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-2">
        <div className="grid gap-2 md:grid-cols-3">
          {[
            { key: "identite" as const, path: "/entreprise", eyebrow: "Mon entreprise", label: "Identite" },
            { key: "fonctionnalites" as const, path: "/entreprise/fonctionnalites", eyebrow: "Reglages", label: "Fonctionnalites" },
            { key: "profils" as const, path: "/entreprise/profils", eyebrow: "Profils", label: "Permissions" },
          ].map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => navigate(section.path)}
              className={[
                "rounded-xl px-4 py-3 text-left transition",
                activeSection === section.key
                  ? "bg-slate-900 text-white"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100",
              ].join(" ")}
            >
              <div className="text-xs uppercase tracking-[0.2em] opacity-70">{section.eyebrow}</div>
              <div className="text-sm font-semibold">{section.label}</div>
            </button>
          ))}
        </div>
      </div>

      {activeSection === "identite" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <section className="rounded-2xl border bg-white p-4 space-y-4">
            <div className="font-semibold section-title">{t("monEntreprise.sectionTitle")}</div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm md:col-span-2">
                <div className="text-xs text-slate-600">{t("monEntreprise.fields.companyName")}</div>
                <input className="w-full rounded-xl border px-3 py-2 text-sm" value={companyForm.company_name} onChange={(e) => setCompanyForm((prev) => ({ ...prev, company_name: e.target.value }))} />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <div className="text-xs text-slate-600">{t("monEntreprise.fields.address")}</div>
                <textarea className="min-h-20 w-full rounded-xl border px-3 py-2 text-sm" value={companyForm.address} onChange={(e) => setCompanyForm((prev) => ({ ...prev, address: e.target.value }))} />
              </label>
              <label className="space-y-1 text-sm">
                <div className="text-xs text-slate-600">{t("monEntreprise.fields.phone")}</div>
                <input className="w-full rounded-xl border px-3 py-2 text-sm" value={companyForm.phone} onChange={(e) => setCompanyForm((prev) => ({ ...prev, phone: e.target.value }))} />
              </label>
              <label className="space-y-1 text-sm">
                <div className="text-xs text-slate-600">{t("monEntreprise.fields.email")}</div>
                <input className="w-full rounded-xl border px-3 py-2 text-sm" value={companyForm.email} onChange={(e) => setCompanyForm((prev) => ({ ...prev, email: e.target.value }))} />
              </label>
              <label className="space-y-1 text-sm">
                <div className="text-xs text-slate-600">{t("monEntreprise.fields.siret")}</div>
                <input className="w-full rounded-xl border px-3 py-2 text-sm" value={companyForm.siret} onChange={(e) => setCompanyForm((prev) => ({ ...prev, siret: e.target.value }))} />
              </label>
              <label className="space-y-1 text-sm">
                <div className="text-xs text-slate-600">{t("monEntreprise.fields.insurance")}</div>
                <input className="w-full rounded-xl border px-3 py-2 text-sm" value={companyForm.insurance_decennale} onChange={(e) => setCompanyForm((prev) => ({ ...prev, insurance_decennale: e.target.value }))} />
              </label>
              <label className="space-y-1 text-sm">
                <div className="text-xs text-slate-600">{t("monEntreprise.fields.primaryColor")}</div>
                <div className="flex items-center gap-2">
                  <input type="color" className="h-10 w-14 rounded border bg-white" value={companyForm.primary_color} onChange={(e) => setCompanyForm((prev) => ({ ...prev, primary_color: e.target.value }))} />
                  <input className="w-full rounded-xl border px-3 py-2 text-sm" value={companyForm.primary_color} onChange={(e) => setCompanyForm((prev) => ({ ...prev, primary_color: e.target.value }))} />
                </div>
              </label>
              <label className="space-y-1 text-sm">
                <div className="text-xs text-slate-600">{t("monEntreprise.fields.secondaryColor")}</div>
                <div className="flex items-center gap-2">
                  <input type="color" className="h-10 w-14 rounded border bg-white" value={companyForm.secondary_color} onChange={(e) => setCompanyForm((prev) => ({ ...prev, secondary_color: e.target.value }))} />
                  <input className="w-full rounded-xl border px-3 py-2 text-sm" value={companyForm.secondary_color} onChange={(e) => setCompanyForm((prev) => ({ ...prev, secondary_color: e.target.value }))} />
                </div>
              </label>
            </div>

            <div className="rounded-xl border p-3 space-y-2">
              <div className="text-sm font-medium">{t("monEntreprise.logoTitle")}</div>
              <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
              <div className="text-xs text-slate-500">{t("monEntreprise.logoHint")}</div>
            </div>

            <div className="flex justify-end">
              <button type="button" disabled={savingSettings} onClick={() => void onSaveCompanySettings()} className={["rounded-xl px-4 py-2 text-sm", savingSettings ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800"].join(" ")}>
                {savingSettings ? t("common.states.saving") : t("common.actions.save")}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-4 space-y-4">
            <div className="font-semibold">{t("monEntreprise.previewTitle")}</div>
            <div className="rounded-xl border p-4 space-y-3">
              <div className="rounded-lg px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: companyForm.primary_color || "#2563eb" }}>
                {t("monEntreprise.previewHeader")}
              </div>
              <div className="flex items-center gap-3">
                {effectiveLogoPreviewUrl ? (
                  <img src={effectiveLogoPreviewUrl} alt={t("monEntreprise.altLogo")} className="h-16 w-16 rounded-lg border bg-white object-contain" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg border px-1 text-center text-xs text-white" style={{ backgroundColor: companyForm.secondary_color || "#0f172a" }}>
                    {companyForm.company_name || t("monEntreprise.title")}
                  </div>
                )}
                <div className="text-sm">
                  <div className="font-semibold">{companyForm.company_name || t("monEntreprise.title")}</div>
                  <div className="text-slate-600">{companyForm.email || t("monEntreprise.fallbackEmail")}</div>
                  <div className="text-slate-600">{companyForm.phone || t("monEntreprise.fallbackPhone")}</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : activeSection === "fonctionnalites" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
          <section className="rounded-2xl border bg-white p-4 space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Profil metier</div>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Modules actives par defaut</h2>
              <p className="mt-1 text-sm text-slate-500">{selectedProfileMeta.description}</p>
            </div>
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Metier de l'entreprise</div>
              <select className="w-full rounded-xl border px-3 py-2 text-sm" value={featuresForm.business_profile} onChange={(e) => onChangeBusinessProfile(e.target.value as CompanyBusinessProfile)}>
                {COMPANY_BUSINESS_PROFILE_OPTIONS.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
              </select>
            </label>
            <div className="space-y-2">
              <div className="text-xs text-slate-600">Mode d'affichage</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {COMPANY_FEATURE_MODE_OPTIONS.map((mode) => (
                  <button key={mode.id} type="button" onClick={() => setFeaturesForm((prev) => ({ ...prev, feature_mode: mode.id }))} className={["rounded-2xl border p-3 text-left transition", featuresForm.feature_mode === mode.id ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"].join(" ")}>
                    <div className="text-sm font-semibold text-slate-900">{mode.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{mode.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-600">Mode interface</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {COMPANY_INTERFACE_MODE_OPTIONS.map((mode) => (
                  <button key={mode.id} type="button" onClick={() => setFeaturesForm((prev) => ({ ...prev, mode_interface: mode.id }))} className={["rounded-2xl border p-3 text-left transition", featuresForm.mode_interface === mode.id ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"].join(" ")}>
                    <div className="text-sm font-semibold text-slate-900">{mode.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{mode.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Synthese</div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">{activeModuleCount}</div>
              <div className="text-sm text-slate-600">modules visibles dans cette interface</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Permission profil</div>
              <div className="text-sm font-semibold text-slate-900">Bibliotheque avancee</div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className={["rounded-full px-3 py-1 text-xs font-semibold", advancedPreparationEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"].join(" ")}>{advancedPreparationEnabled ? "Actif sur ce profil" : "Masque sur ce profil"}</span>
                <button type="button" onClick={() => navigate("/entreprise/profils")} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-900 hover:bg-slate-50">Ouvrir les permissions profil</button>
              </div>
            </div>
            <button type="button" disabled={savingSettings} onClick={() => void onSaveFeatureSettings()} className={["w-full rounded-xl px-4 py-2 text-sm", savingSettings ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800"].join(" ")}>{savingSettings ? t("common.states.saving") : "Enregistrer les fonctionnalites"}</button>
          </section>

          <section className="rounded-2xl border bg-white p-4 space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Reglages</div>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Fonctionnalites par categorie</h2>
              <p className="mt-1 text-sm text-slate-500">Les modules restent complets. Les permissions de profil se reglent separement.</p>
            </div>
            <div className="space-y-4">
              {modulesBySection.map((section) => (
                <div key={section.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">{section.label}</div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {section.modules.map((module) => {
                      const checked = featuresForm.enabled_modules.includes(module.id);
                      return (
                        <button key={module.id} type="button" onClick={() => onToggleModule(module.id)} className={["rounded-2xl border p-3 text-left transition", checked ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"].join(" ")}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900">{module.label}</div>
                              <div className="mt-1 text-xs text-slate-500">{module.description}</div>
                              <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">Roles : {module.roles.join(" / ")}</div>
                            </div>
                            <span className={["shrink-0 rounded-full px-3 py-1 text-xs font-semibold", checked ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"].join(" ")}>{checked ? "Actif" : "Inactif"}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Profils</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Permissions du profil connecte</h2>
            <p className="mt-1 text-sm text-slate-500">Ces permissions controlent les menus, les pages du backoffice et les modules visibles dans les fiches chantier.</p>
            {!profilePermissionSchemaReady ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">Migration permissions profil non appliquee sur Supabase.</div> : null}
          </div>
          {profilePermissionSections.map((section) => (
            <section key={section.id} className="rounded-2xl border bg-white p-4 space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{section.id === "backoffice" ? "Navigation" : section.id === "avance" ? "Options" : "Chantier"}</div>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{section.label}</h3>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {section.permissions.map((permission) => {
                  const enabled = hasProfileFeaturePermission(currentProfilePermissions, permission.key, currentProfileRole);
                  const disabledByCompany = isCompanyModulePermissionKey(permission.key) && !featuresForm.enabled_modules.includes(permission.key);
                  return (
                    <div key={permission.key} className={["rounded-2xl border p-4", enabled ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50"].join(" ")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">{permission.label}</div>
                          <div className="mt-1 text-xs text-slate-500">{permission.description}</div>
                          {disabledByCompany ? <div className="mt-2 text-[11px] font-medium text-amber-700">Module desactive au niveau entreprise.</div> : null}
                        </div>
                        <span className={["shrink-0 rounded-full px-3 py-1 text-xs font-semibold", enabled ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"].join(" ")}>{enabled ? "Actif" : "Masque"}</span>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button type="button" onClick={() => void onToggleCurrentProfilePermission(permission.key)} disabled={savingProfilePermission || !profilePermissionSchemaReady} className={["rounded-xl px-4 py-2 text-sm", savingProfilePermission || !profilePermissionSchemaReady ? "bg-slate-300 text-slate-700" : enabled ? "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100" : "bg-slate-900 text-white hover:bg-slate-800"].join(" ")}>
                          {savingProfilePermission ? t("common.states.saving") : enabled ? "Desactiver" : "Activer"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
