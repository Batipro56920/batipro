import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  Loader2,
  Lock,
  Save,
  Settings2,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import Card from "@/components/Card";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import {
  COMPANY_BUSINESS_PROFILES,
  COMPANY_FEATURE_MODULES,
  COMPANY_FEATURE_PROFILE_PERMISSIONS,
  COMPANY_FEATURE_SECTIONS,
  COMPANY_FEATURE_SECTIONS_ORDER,
  COMPANY_INTERFACE_MODE_OPTIONS,
  COMPANY_PERMISSION_SECTIONS,
  COMPANY_PROFILE_PERMISSION_OPTIONS,
  COMPANY_PROFILE_ROLES,
  DEFAULT_COMPANY_FEATURE_SETTINGS,
  DEFAULT_COMPANY_PROFILE_FEATURE_PERMISSIONS,
  DEFAULT_COMPANY_PROFILE_PERMISSIONS,
  type CompanyFeatureModuleId,
  type CompanyFeatureSettings,
  type CompanyProfilePermissionKey,
  type CompanyProfileRole,
  type ProfileFeaturePermissionKey,
  type ProfileFeaturePermissions,
  cloneCompanyFeatureSettings,
  cloneCompanyProfileFeaturePermissions,
  cloneCompanyProfilePermissions,
  ensureCompanyFeatureSettings,
  ensureCompanyProfileFeaturePermissions,
  ensureCompanyProfilePermissions,
  getCompanyFeatureCoverage,
  getCompanyFeatureModuleById,
  getCompanyFeatureProfileOption,
  getCompanyProfileRoleOption,
  getFeatureModeLabel,
  isCompanyModulePermissionKey,
} from "@/lib/companyFeatures";
import {
  getCompanyLogoSignedUrl,
  getCompanySettings,
  upsertCompanySettings,
  uploadCompanyLogo,
  type CompanySettingsRow,
} from "@/lib/services/companySettings";

type CompanySection = "identite" | "fonctionnalites" | "profils";

type CompanyFormState = {
  nom: string;
  raison_sociale: string;
  siret: string;
  tva: string;
  adresse: string;
  code_postal: string;
  ville: string;
  telephone: string;
  email: string;
  site_web: string;
};

type FeatureModuleGroup = {
  id: string;
  label: string;
  description: string;
  modules: typeof COMPANY_FEATURE_MODULES;
};

const EMPTY_COMPANY_FORM: CompanyFormState = {
  nom: "",
  raison_sociale: "",
  siret: "",
  tva: "",
  adresse: "",
  code_postal: "",
  ville: "",
  telephone: "",
  email: "",
  site_web: "",
};

function getActiveSection(pathname: string): CompanySection {
  if (pathname.endsWith("/fonctionnalites")) return "fonctionnalites";
  if (pathname.endsWith("/profils")) return "profils";
  return "identite";
}

function getTextValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toCompanyForm(settings: CompanySettingsRow | null): CompanyFormState {
  if (!settings) return EMPTY_COMPANY_FORM;
  return {
    nom: getTextValue(settings.nom),
    raison_sociale: getTextValue(settings.raison_sociale),
    siret: getTextValue(settings.siret),
    tva: getTextValue(settings.tva),
    adresse: getTextValue(settings.adresse),
    code_postal: getTextValue(settings.code_postal),
    ville: getTextValue(settings.ville),
    telephone: getTextValue(settings.telephone),
    email: getTextValue(settings.email),
    site_web: getTextValue(settings.site_web),
  };
}

function TogglePill({ active }: { active: boolean }) {
  return (
    <span
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        active ? "bg-blue-600" : "bg-gray-300"
      }`}
      aria-hidden="true"
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
          active ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </span>
  );
}

function ProfilePermissionCheckbox({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded border transition ${
        checked
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-gray-300 bg-white text-gray-400 hover:border-blue-300"
      } disabled:cursor-not-allowed disabled:opacity-60`}
      aria-pressed={checked}
    >
      {checked ? <CheckCircle2 size={18} /> : <Lock size={16} />}
    </button>
  );
}

export default function MonEntreprisePage() {
  const { t } = useI18n();
  const { isCompanyOwner } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const activeSection = getActiveSection(location.pathname);

  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<CompanySettingsRow | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanyFormState>(EMPTY_COMPANY_FORM);
  const [featureSettings, setFeatureSettings] = useState<CompanyFeatureSettings>(() =>
    cloneCompanyFeatureSettings(DEFAULT_COMPANY_FEATURE_SETTINGS),
  );
  const [profilePermissions, setProfilePermissions] = useState<ProfileFeaturePermissions>(() =>
    cloneCompanyProfileFeaturePermissions(DEFAULT_COMPANY_PROFILE_FEATURE_PERMISSIONS),
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [savingProfilePermission, setSavingProfilePermission] = useState<ProfileFeaturePermissionKey | null>(null);
  const [currentProfileRole, setCurrentProfileRole] = useState<CompanyProfileRole>("admin");

  useEffect(() => {
    if (location.pathname.endsWith("/charges")) {
      navigate("/financier/charges-fixes", { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      setLoading(true);
      setError(null);
      try {
        const settings = await getCompanySettings();
        if (!active) return;
        setCompanySettings(settings);
        setCompanyForm(toCompanyForm(settings));
        setFeatureSettings(ensureCompanyFeatureSettings(settings?.features));
        setProfilePermissions(ensureCompanyProfileFeaturePermissions(settings?.profile_feature_permissions));
        if (settings?.logo_path) {
          const signedUrl = await getCompanyLogoSignedUrl(settings.logo_path);
          if (active) setLogoPreview(signedUrl);
        } else {
          setLogoPreview(null);
        }
      } catch (err) {
        console.error("Erreur lors du chargement des parametres entreprise", err);
        if (active) setError("Impossible de charger les parametres de l'entreprise.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSettings();
    return () => {
      active = false;
    };
  }, []);

  const modulesBySection = useMemo<FeatureModuleGroup[]>(() => {
    return COMPANY_FEATURE_SECTIONS_ORDER.map((sectionId) => {
      const section = COMPANY_FEATURE_SECTIONS[sectionId];
      return {
        ...section,
        modules: COMPANY_FEATURE_MODULES.filter((module) => module.section === sectionId),
      };
    });
  }, []);

  const profilePermissionSections = useMemo(() => {
    return COMPANY_PERMISSION_SECTIONS.map((section) => ({
      ...section,
      permissions: COMPANY_PROFILE_PERMISSION_OPTIONS.filter((permission) => permission.section === section.id),
    }));
  }, []);

  const selectedProfileMeta = getCompanyProfileRoleOption(currentProfileRole);
  const currentProfilePermissions = profilePermissions[currentProfileRole];
  const activeModuleCount = Object.values(featureSettings.modules).filter(Boolean).length;
  const featureCoverage = getCompanyFeatureCoverage(featureSettings);
  const advancedPreparationEnabled = featureSettings.modules.preparation_arborescence;
  const profilePermissionSchemaReady = currentProfilePermissions ? currentProfilePermissions.__schemaVersion === 2 : false;

  const readonly = !isCompanyOwner;

  function updateCompanyField(field: keyof CompanyFormState, value: string) {
    setCompanyForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateFeatureSettings(next: CompanyFeatureSettings) {
    setFeatureSettings(ensureCompanyFeatureSettings(next));
  }

  function setFeatureMode(mode: CompanyFeatureSettings["mode"]) {
    const next = cloneCompanyFeatureSettings(featureSettings);
    next.mode = mode;
    updateFeatureSettings(next);
  }

  function setInterfaceMode(interfaceMode: CompanyFeatureSettings["interfaceMode"]) {
    const next = cloneCompanyFeatureSettings(featureSettings);
    next.interfaceMode = interfaceMode;
    updateFeatureSettings(next);
  }

  function toggleModule(moduleId: CompanyFeatureModuleId) {
    const module = getCompanyFeatureModuleById(moduleId);
    if (!module) return;
    const next = cloneCompanyFeatureSettings(featureSettings);
    const nextValue = !next.modules[moduleId];
    next.modules[moduleId] = nextValue;
    for (const dependency of module.dependencies ?? []) {
      if (nextValue) next.modules[dependency] = true;
    }
    updateFeatureSettings(next);
  }

  function toggleProfilePermission(permissionKey: ProfileFeaturePermissionKey) {
    const option = getCompanyFeatureProfileOption(permissionKey);
    const next = cloneCompanyProfileFeaturePermissions(profilePermissions);
    const profile = ensureCompanyProfilePermissions(next[currentProfileRole]);
    const currentValue = profile[permissionKey];
    profile[permissionKey] = !currentValue;

    if (!currentValue) {
      for (const dependency of option?.dependencies ?? []) {
        profile[dependency] = true;
      }
      if (isCompanyModulePermissionKey(permissionKey) && !featureSettings.modules[permissionKey]) {
        const nextFeatures = cloneCompanyFeatureSettings(featureSettings);
        nextFeatures.modules[permissionKey] = true;
        updateFeatureSettings(nextFeatures);
      }
    }

    next[currentProfileRole] = profile;
    setProfilePermissions(next);
  }

  async function onSaveCompanySettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readonly) return;

    setSavingIdentity(true);
    setError(null);
    setNotice(null);

    try {
      let logoPath = companySettings?.logo_path ?? null;
      if (logoFile) {
        logoPath = await uploadCompanyLogo(logoFile);
      }

      const saved = await upsertCompanySettings({
        ...companyForm,
        logo_path: logoPath,
      });
      setCompanySettings(saved);
      setCompanyForm(toCompanyForm(saved));
      setLogoFile(null);
      setLogoPreview(saved.logo_path ? await getCompanyLogoSignedUrl(saved.logo_path) : null);
      setNotice("Identite entreprise enregistree.");
    } catch (err) {
      console.error("Erreur lors de l'enregistrement de l'entreprise", err);
      setError("Impossible d'enregistrer l'identite entreprise.");
    } finally {
      setSavingIdentity(false);
    }
  }

  async function onSaveFeatureSettings() {
    if (readonly) return;

    setSavingFeatures(true);
    setError(null);
    setNotice(null);

    try {
      const saved = await upsertCompanySettings({
        features: ensureCompanyFeatureSettings(featureSettings),
        profile_feature_permissions: ensureCompanyProfileFeaturePermissions(profilePermissions),
      });
      setCompanySettings(saved);
      setFeatureSettings(ensureCompanyFeatureSettings(saved.features));
      setProfilePermissions(ensureCompanyProfileFeaturePermissions(saved.profile_feature_permissions));
      setNotice("Fonctionnalites et profils enregistres.");
    } catch (err) {
      console.error("Erreur lors de l'enregistrement des fonctionnalites", err);
      setError("Impossible d'enregistrer les fonctionnalites.");
    } finally {
      setSavingFeatures(false);
    }
  }

  async function onSaveCurrentProfilePermissions(permissionKey?: ProfileFeaturePermissionKey) {
    if (readonly) return;

    setSavingProfilePermission(permissionKey ?? "__schemaVersion");
    setError(null);
    setNotice(null);

    try {
      const saved = await upsertCompanySettings({
        profile_feature_permissions: ensureCompanyProfileFeaturePermissions(profilePermissions),
      });
      setCompanySettings(saved);
      setProfilePermissions(ensureCompanyProfileFeaturePermissions(saved.profile_feature_permissions));
      setNotice("Permissions du profil enregistrees.");
    } catch (err) {
      console.error("Erreur lors de l'enregistrement des permissions", err);
      setError("Impossible d'enregistrer les permissions du profil.");
    } finally {
      setSavingProfilePermission(null);
    }
  }

  function onLogoChange(file: File | null) {
    setLogoFile(file);
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-gray-500">
        <Loader2 className="mr-2 animate-spin" size={20} />
        Chargement des parametres entreprise...
      </div>
    );
  }

  const sections: Array<{ key: CompanySection; path: string; eyebrow: string; label: string; icon: typeof Building2 }> = [
    { key: "identite", path: "/entreprise", eyebrow: "Mon entreprise", label: "Identite", icon: Building2 },
    {
      key: "fonctionnalites",
      path: "/entreprise/fonctionnalites",
      eyebrow: "Reglages",
      label: "Fonctionnalites",
      icon: Settings2,
    },
    { key: "profils", path: "/entreprise/profils", eyebrow: "Profils", label: "Permissions", icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon entreprise</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Parametres generaux du logiciel, modules actifs et droits par profil utilisateur.
          </p>
        </div>
        {readonly ? (
          <span className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            <Lock size={16} /> Lecture seule
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          const selected = activeSection === section.key;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => navigate(section.path)}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
                selected
                  ? "border-blue-600 bg-blue-50 text-blue-900 shadow-sm"
                  : "border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50/50"
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-md ${
                  selected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                <Icon size={20} />
              </span>
              <span>
                <span className="block text-xs font-semibold uppercase text-gray-500">{section.eyebrow}</span>
                <span className="block font-semibold">{section.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      {notice ? <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {activeSection === "identite" ? (
        <form onSubmit={onSaveCompanySettings} className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <div className="flex flex-col items-center gap-3 lg:w-56">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo entreprise" className="h-full w-full object-contain" />
                  ) : (
                    <Building2 size={36} className="text-gray-400" />
                  )}
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <Upload size={16} /> Logo
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={readonly}
                    onChange={(event) => onLogoChange(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <div className="grid flex-1 gap-4 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-gray-700">Nom commercial</span>
                  <input
                    value={companyForm.nom}
                    onChange={(event) => updateCompanyField("nom", event.target.value)}
                    disabled={readonly}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-gray-700">Raison sociale</span>
                  <input
                    value={companyForm.raison_sociale}
                    onChange={(event) => updateCompanyField("raison_sociale", event.target.value)}
                    disabled={readonly}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-gray-700">SIRET</span>
                  <input
                    value={companyForm.siret}
                    onChange={(event) => updateCompanyField("siret", event.target.value)}
                    disabled={readonly}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-gray-700">TVA intracommunautaire</span>
                  <input
                    value={companyForm.tva}
                    onChange={(event) => updateCompanyField("tva", event.target.value)}
                    disabled={readonly}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-sm font-medium text-gray-700">Adresse</span>
                  <input
                    value={companyForm.adresse}
                    onChange={(event) => updateCompanyField("adresse", event.target.value)}
                    disabled={readonly}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-gray-700">Code postal</span>
                  <input
                    value={companyForm.code_postal}
                    onChange={(event) => updateCompanyField("code_postal", event.target.value)}
                    disabled={readonly}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-gray-700">Ville</span>
                  <input
                    value={companyForm.ville}
                    onChange={(event) => updateCompanyField("ville", event.target.value)}
                    disabled={readonly}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-gray-700">Telephone</span>
                  <input
                    value={companyForm.telephone}
                    onChange={(event) => updateCompanyField("telephone", event.target.value)}
                    disabled={readonly}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-gray-700">Email</span>
                  <input
                    value={companyForm.email}
                    onChange={(event) => updateCompanyField("email", event.target.value)}
                    disabled={readonly}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-sm font-medium text-gray-700">Site web</span>
                  <input
                    value={companyForm.site_web}
                    onChange={(event) => updateCompanyField("site_web", event.target.value)}
                    disabled={readonly}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </label>
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={readonly || savingIdentity}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingIdentity ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Enregistrer l'identite
            </button>
          </div>
        </form>
      ) : activeSection === "fonctionnalites" ? (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Fonctionnalites actives</h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-600">
                  Ces reglages pilotent les modules visibles et disponibles dans le logiciel.
                </p>
              </div>
              <div className="rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <strong>{activeModuleCount}</strong> modules actifs sur {COMPANY_FEATURE_MODULES.length}
                <span className="ml-2 text-blue-600">({featureCoverage}%)</span>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <span className="text-sm font-semibold text-gray-700">Profil metier</span>
                <div className="grid gap-2">
                  {COMPANY_BUSINESS_PROFILES.map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => updateFeatureSettings({ ...featureSettings, businessProfile: profile.id })}
                      disabled={readonly}
                      className={`rounded-md border px-3 py-2 text-left text-sm ${
                        featureSettings.businessProfile === profile.id
                          ? "border-blue-600 bg-blue-50 text-blue-900"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="font-semibold">{profile.label}</span>
                      <span className="mt-1 block text-xs text-gray-500">{profile.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold text-gray-700">Mode de fonctionnalites</span>
                <div className="grid gap-2">
                  {(["standard", "avance", "personnalise"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setFeatureMode(mode)}
                      disabled={readonly}
                      className={`rounded-md border px-3 py-2 text-left text-sm ${
                        featureSettings.mode === mode
                          ? "border-blue-600 bg-blue-50 text-blue-900"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {getFeatureModeLabel(mode)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold text-gray-700">Interface</span>
                <div className="grid gap-2">
                  {COMPANY_INTERFACE_MODE_OPTIONS.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setInterfaceMode(mode.id)}
                      disabled={readonly}
                      className={`rounded-md border px-3 py-2 text-left text-sm ${
                        featureSettings.interfaceMode === mode.id
                          ? "border-blue-600 bg-blue-50 text-blue-900"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="font-semibold">{mode.label}</span>
                      <span className="mt-1 block text-xs text-gray-500">{mode.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {modulesBySection.map((section) => (
            <Card key={section.id} className="p-6">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900">{section.label}</h3>
                <p className="text-sm text-gray-600">{section.description}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {section.modules.map((module) => {
                  const active = featureSettings.modules[module.id];
                  const lockedByDependency = Boolean(module.dependencies?.some((dependency) => !featureSettings.modules[dependency]));
                  return (
                    <button
                      key={module.id}
                      type="button"
                      onClick={() => toggleModule(module.id)}
                      disabled={readonly || lockedByDependency}
                      className={`flex min-h-[116px] items-start justify-between gap-4 rounded-lg border p-4 text-left transition ${
                        active
                          ? "border-blue-600 bg-blue-50 text-blue-950"
                          : "border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50/40"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <span>
                        <span className="block font-semibold">{module.label}</span>
                        <span className="mt-1 block text-sm text-gray-600">{module.description}</span>
                        {module.dependencies?.length ? (
                          <span className="mt-2 block text-xs text-gray-500">
                            Depend de {module.dependencies.map((id) => getCompanyFeatureModuleById(id)?.label).filter(Boolean).join(", ")}
                          </span>
                        ) : null}
                      </span>
                      <TogglePill active={active} />
                    </button>
                  );
                })}
              </div>
            </Card>
          ))}

          {!advancedPreparationEnabled ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Le module preparation avancee est desactive. Les ecrans chantier restent disponibles, mais les fonctions de preparation detaillee ne seront pas exposees.
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSaveFeatureSettings}
              disabled={readonly || savingFeatures}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingFeatures ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Enregistrer les fonctionnalites
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Permissions par profil</h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-600">
                  Ces droits pilotent la visibilite des modules par role sans creer de logique parallele.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">
                <Users size={16} /> {selectedProfileMeta.label}
              </div>
            </div>

            <div className="mt-6 grid gap-2 md:grid-cols-4">
              {COMPANY_PROFILE_ROLES.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setCurrentProfileRole(role.id)}
                  className={`rounded-md border px-3 py-3 text-left text-sm transition ${
                    currentProfileRole === role.id
                      ? "border-blue-600 bg-blue-50 text-blue-900"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="font-semibold">{role.label}</span>
                  <span className="mt-1 block text-xs text-gray-500">{role.description}</span>
                </button>
              ))}
            </div>

            {!profilePermissionSchemaReady ? (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Le profil utilise un ancien schema de permissions. Enregistrez pour le remettre au format actuel.
              </div>
            ) : null}
          </Card>

          {profilePermissionSections.map((section) => (
            <Card key={section.id} className="p-6">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900">{section.label}</h3>
                <p className="text-sm text-gray-600">{section.description}</p>
              </div>
              <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
                {section.permissions.map((permission) => {
                  const checked = Boolean(currentProfilePermissions?.[permission.key]);
                  const moduleDisabled = isCompanyModulePermissionKey(permission.key) && !featureSettings.modules[permission.key];
                  return (
                    <div key={permission.key} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{permission.label}</div>
                        <div className="mt-1 text-sm text-gray-600">{permission.description}</div>
                        {moduleDisabled ? (
                          <div className="mt-2 text-xs font-medium text-amber-700">
                            Module desactive dans les fonctionnalites entreprise.
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <ProfilePermissionCheckbox
                          checked={checked}
                          disabled={readonly}
                          onChange={() => toggleProfilePermission(permission.key)}
                        />
                        <button
                          type="button"
                          onClick={() => onSaveCurrentProfilePermissions(permission.key)}
                          disabled={readonly || savingProfilePermission !== null}
                          className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingProfilePermission === permission.key ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                          {t("common.save")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onSaveCurrentProfilePermissions()}
              disabled={readonly || savingProfilePermission !== null}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfilePermission === "__schemaVersion" ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Enregistrer le profil
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
