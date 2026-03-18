import { useEffect, useState } from "react";
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

export default function MonEntreprisePage() {
  const { t } = useI18n();
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
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [selectedLogoPreviewUrl, setSelectedLogoPreviewUrl] = useState<string | null>(null);

  async function loadSettings() {
    setLoadingSettings(true);
    setSettingsError(null);
    try {
      const settings = await getCompanySettings();
      setCompanySettings(settings);
      setCompanyForm(toCompanyForm(settings));

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

      {loadingSettings ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">{t("monEntreprise.loading")}</div>
      ) : (
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
      )}
    </div>
  );
}
