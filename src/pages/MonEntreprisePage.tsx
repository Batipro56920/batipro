import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  COMPANY_BUSINESS_PROFILE_OPTIONS,
  COMPANY_FEATURE_MODE_OPTIONS,
  getModulesByPillar,
  getPresetFeatureModules,
  getVisibleCompanyModules,
  type CompanyBusinessProfile,
  type CompanyFeatureMode,
  type CompanyFeatureModuleId,
} from "../config/companyFeatures";
import {
  getCompanySettings,
  getCompanyLogoSignedUrl,
  upsertCompanySettings,
  uploadCompanyLogo,
  type CompanySettingsRow,
} from "../services/companySettings.service";
import { useI18n } from "../i18n";

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
    enabled_modules: [...settings.enabled_modules],
  };
}

export default function MonEntreprisePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const activeCompanySection = location.pathname.endsWith("/fonctionnalites")
    ? "fonctionnalites"
    : "identite";
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
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
    enabled_modules: getPresetFeatureModules("entreprise_renovation"),
  });
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [selectedLogoPreviewUrl, setSelectedLogoPreviewUrl] = useState<string | null>(null);

  const modulesByPillar = useMemo(
    () => getModulesByPillar(getVisibleCompanyModules(featuresForm.feature_mode)),
    [featuresForm.feature_mode],
  );
  const selectedProfileMeta = useMemo(
    () =>
      COMPANY_BUSINESS_PROFILE_OPTIONS.find(
        (entry) => entry.id === featuresForm.business_profile,
      ) ?? COMPANY_BUSINESS_PROFILE_OPTIONS[0],
    [featuresForm.business_profile],
  );
  const activeModuleCount = useMemo(
    () => {
      const visibleIds = new Set(modulesByPillar.flatMap((section) => section.modules.map((m) => m.id)));
      return featuresForm.enabled_modules.filter((moduleId) => visibleIds.has(moduleId)).length;
    },
    [featuresForm.enabled_modules, modulesByPillar],
  );

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
          const signed = await getCompanyLogoSignedUrl(settings.logo_path, 600);
          setLogoPreviewUrl(signed);
        } catch {
          setLogoPreviewUrl(null);
        }
      } else {
        setLogoPreviewUrl(null);
      }
    } catch (err: any) {
      setSettingsError(err?.message ?? t("monEntreprise.loadError"));
    } finally {
      setLoadingSettings(false);
    }
  }

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
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [logoFile]);

  const effectiveLogoPreviewUrl = selectedLogoPreviewUrl || logoPreviewUrl;

  async function onSaveCompanySettings() {
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsNotice(null);
    try {
      let nextLogoPath = companySettings?.logo_path ?? null;
      if (logoFile) {
        nextLogoPath = await uploadCompanyLogo(logoFile, companySettings?.logo_path ?? null);
      }

      const saved = await upsertCompanySettings({
        ...companyForm,
        logo_path: nextLogoPath,
      });

      setCompanySettings(saved);
      setCompanyForm(toCompanyForm(saved));
      setLogoFile(null);

      if (saved.logo_path) {
        try {
          const signed = await getCompanyLogoSignedUrl(saved.logo_path, 600);
          setLogoPreviewUrl(signed);
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

  function onChangeBusinessProfile(nextProfile: CompanyBusinessProfile) {
    setFeaturesForm((prev) => ({
      ...prev,
      business_profile: nextProfile,
      enabled_modules: getPresetFeatureModules(nextProfile),
    }));
  }

  function onToggleModule(moduleId: CompanyFeatureModuleId) {
    setFeaturesForm((prev) => {
      const current = new Set(prev.enabled_modules);
      if (current.has(moduleId)) {
        current.delete(moduleId);
      } else {
        current.add(moduleId);
      }
      return {
        ...prev,
        enabled_modules: Array.from(current),
      };
    });
  }

  async function onSaveFeatureSettings() {
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsNotice(null);
    try {
      const saved = await upsertCompanySettings({
        business_profile: featuresForm.business_profile,
        feature_mode: featuresForm.feature_mode,
        enabled_modules: featuresForm.enabled_modules,
      });

      setCompanySettings(saved);
      setCompanyForm(toCompanyForm(saved));
      setFeaturesForm(toCompanyFeaturesForm(saved));
      setSettingsNotice("Configuration des fonctionnalités enregistrée.");
    } catch (err: any) {
      setSettingsError(err?.message ?? "Erreur enregistrement des fonctionnalités.");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("monEntreprise.title")}</h1>
          <p className="text-slate-500">{t("monEntreprise.subtitle")}</p>
        </div>
      </div>

      {settingsError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{settingsError}</div>
      )}
      {settingsNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {settingsNotice}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-2">
        <div className="grid gap-2 md:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate("/entreprise")}
            className={[
              "rounded-xl px-4 py-3 text-left transition",
              activeCompanySection === "identite"
                ? "bg-slate-900 text-white"
                : "bg-slate-50 text-slate-700 hover:bg-slate-100",
            ].join(" ")}
          >
            <div className="text-xs uppercase tracking-[0.2em] opacity-70">Mon entreprise</div>
            <div className="text-sm font-semibold">Identité</div>
          </button>

          <button
            type="button"
            onClick={() => navigate("/entreprise/fonctionnalites")}
            className={[
              "rounded-xl px-4 py-3 text-left transition",
              activeCompanySection === "fonctionnalites"
                ? "bg-slate-900 text-white"
                : "bg-slate-50 text-slate-700 hover:bg-slate-100",
            ].join(" ")}
          >
            <div className="text-xs uppercase tracking-[0.2em] opacity-70">Réglages</div>
            <div className="text-sm font-semibold">Fonctionnalités</div>
          </button>
        </div>
      </div>

      {loadingSettings ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">{t("monEntreprise.loading")}</div>
      ) : activeCompanySection === "identite" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <div className="rounded-2xl border bg-white p-4 space-y-4">
            <div className="font-semibold section-title">{t("monEntreprise.sectionTitle")}</div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm md:col-span-2">
                <div className="text-xs text-slate-600">{t("monEntreprise.fields.companyName")}</div>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={companyForm.company_name}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, company_name: e.target.value }))}
                />
              </label>

              <label className="space-y-1 text-sm md:col-span-2">
                <div className="text-xs text-slate-600">{t("monEntreprise.fields.address")}</div>
                <textarea
                  className="w-full rounded-xl border px-3 py-2 text-sm min-h-20"
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, address: e.target.value }))}
                />
              </label>

              <label className="space-y-1 text-sm">
                <div className="text-xs text-slate-600">{t("monEntreprise.fields.phone")}</div>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={companyForm.phone}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-sm">
                <div className="text-xs text-slate-600">{t("monEntreprise.fields.email")}</div>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={companyForm.email}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </label>

              <label className="space-y-1 text-sm">
                <div className="text-xs text-slate-600">{t("monEntreprise.fields.siret")}</div>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={companyForm.siret}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, siret: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-sm">
                <div className="text-xs text-slate-600">{t("monEntreprise.fields.insurance")}</div>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={companyForm.insurance_decennale}
                  onChange={(e) =>
                    setCompanyForm((prev) => ({ ...prev, insurance_decennale: e.target.value }))
                  }
                />
              </label>

              <label className="space-y-1 text-sm">
                <div className="text-xs text-slate-600">{t("monEntreprise.fields.primaryColor")}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-10 w-14 rounded border bg-white"
                    value={companyForm.primary_color}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, primary_color: e.target.value }))}
                  />
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={companyForm.primary_color}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, primary_color: e.target.value }))}
                  />
                </div>
              </label>

              <label className="space-y-1 text-sm">
                <div className="text-xs text-slate-600">{t("monEntreprise.fields.secondaryColor")}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-10 w-14 rounded border bg-white"
                    value={companyForm.secondary_color}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, secondary_color: e.target.value }))}
                  />
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={companyForm.secondary_color}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, secondary_color: e.target.value }))}
                  />
                </div>
              </label>
            </div>

            <div className="rounded-xl border p-3 space-y-2">
              <div className="text-sm font-medium">{t("monEntreprise.logoTitle")}</div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm"
              />
              <div className="text-xs text-slate-500">{t("monEntreprise.logoHint")}</div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={savingSettings}
                onClick={() => void onSaveCompanySettings()}
                className={[
                  "rounded-xl px-4 py-2 text-sm",
                  savingSettings ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                ].join(" ")}
              >
                {savingSettings ? t("common.states.saving") : t("common.actions.save")}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 space-y-4">
            <div className="font-semibold">{t("monEntreprise.previewTitle")}</div>
            <div className="rounded-xl border p-4 space-y-3">
              <div
                className="rounded-lg px-3 py-2 text-white text-sm font-medium"
                style={{ backgroundColor: companyForm.primary_color || "#2563eb" }}
              >
                {t("monEntreprise.previewHeader")}
              </div>
              <div className="flex items-center gap-3">
                {effectiveLogoPreviewUrl ? (
                  <img
                    src={effectiveLogoPreviewUrl}
                    alt={t("monEntreprise.altLogo")}
                    className="h-16 w-16 rounded-lg border object-contain bg-white"
                  />
                ) : (
                  <div
                    className="h-16 w-16 rounded-lg border flex items-center justify-center text-xs text-white text-center px-1"
                    style={{ backgroundColor: companyForm.secondary_color || "#0f172a" }}
                  >
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
          </div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
          <section className="rounded-2xl border bg-white p-4 space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Profil métier
              </div>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                Modules activés par défaut
              </h2>
              <p className="mt-1 text-sm text-slate-500">{selectedProfileMeta.description}</p>
            </div>

            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Métier de l'entreprise</div>
              <select
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={featuresForm.business_profile}
                onChange={(e) => onChangeBusinessProfile(e.target.value as CompanyBusinessProfile)}
              >
                {COMPANY_BUSINESS_PROFILE_OPTIONS.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              <div className="text-xs text-slate-600">Mode d'affichage</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {COMPANY_FEATURE_MODE_OPTIONS.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() =>
                      setFeaturesForm((prev) => ({ ...prev, feature_mode: mode.id }))
                    }
                    className={[
                      "rounded-2xl border p-3 text-left transition",
                      featuresForm.feature_mode === mode.id
                        ? "border-blue-600 bg-blue-50"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100",
                    ].join(" ")}
                  >
                    <div className="text-sm font-semibold text-slate-900">{mode.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{mode.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Synthèse
              </div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">
                {activeModuleCount}
              </div>
              <div className="text-sm text-slate-600">modules activés</div>
              <div className="mt-3 text-xs text-slate-500">
                L'architecture est pilotée par un registre central, ce qui permet d'ajouter de
                nouveaux modules et de les rattacher ensuite aux rôles utilisateurs.
              </div>
            </div>

            <button
              type="button"
              disabled={savingSettings}
              onClick={() => void onSaveFeatureSettings()}
              className={[
                "w-full rounded-xl px-4 py-2 text-sm",
                savingSettings
                  ? "bg-slate-300 text-slate-700"
                  : "bg-slate-900 text-white hover:bg-slate-800",
              ].join(" ")}
            >
              {savingSettings ? t("common.states.saving") : "Enregistrer les fonctionnalités"}
            </button>
          </section>

          <section className="rounded-2xl border bg-white p-4 space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Réglages
              </div>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                Fonctionnalités par pilier
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Désactivez un module pour le retirer des menus, des onglets chantier et bloquer
                ses routes directes côté backoffice.
              </p>
            </div>

            <div className="space-y-4">
              {modulesByPillar.map((section) => (
                <div key={section.pillar} className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">{section.label}</div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {section.modules.map((module) => {
                      const checked = featuresForm.enabled_modules.includes(module.id);
                      return (
                        <button
                          key={module.id}
                          type="button"
                          onClick={() => onToggleModule(module.id)}
                          className={[
                            "rounded-2xl border p-3 text-left transition",
                            checked
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-slate-200 bg-slate-50 hover:bg-slate-100",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900">
                                {module.label}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {module.description}
                              </div>
                              <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                                Rôles : {module.roles.join(" / ")}
                              </div>
                            </div>
                            <span
                              className={[
                                "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                                checked
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-200 text-slate-600",
                              ].join(" ")}
                            >
                              {checked ? "Actif" : "Inactif"}
                            </span>
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
      )}
    </div>
  );
}
