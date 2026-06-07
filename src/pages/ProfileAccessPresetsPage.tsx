import { useEffect, useMemo, useState } from "react";
import {
  BUSINESS_PROFILE_PERMISSION_PRESETS,
  getCurrentProfileFeaturePermissions,
  getProfilePermissionSections,
  hasProfileFeaturePermission,
  setCurrentProfileFeaturePermissionPreset,
  type BusinessProfilePresetId,
  type ProfileFeaturePermissions,
} from "../services/profileFeaturePermissions.service";

function isAdminRole(role: string | null | undefined) {
  return String(role ?? "").trim().toUpperCase() === "ADMIN";
}

export default function ProfileAccessPresetsPage() {
  const [loading, setLoading] = useState(true);
  const [savingPresetId, setSavingPresetId] = useState<BusinessProfilePresetId | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<ProfileFeaturePermissions>({});
  const [schemaReady, setSchemaReady] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const permissionLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const section of getProfilePermissionSections()) {
      for (const permission of section.permissions) {
        map.set(permission.key, permission.label);
      }
    }
    return map;
  }, []);

  const admin = isAdminRole(role);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const current = await getCurrentProfileFeaturePermissions();
      setRole(current.role);
      setPermissions(current.permissions);
      setSchemaReady(current.schemaReady);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les permissions profil.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function applyPreset(presetId: BusinessProfilePresetId) {
    setSavingPresetId(presetId);
    setError(null);
    setNotice(null);
    try {
      const next = await setCurrentProfileFeaturePermissionPreset(presetId);
      setPermissions(next);
      const preset = BUSINESS_PROFILE_PERMISSION_PRESETS.find((entry) => entry.id === presetId);
      setNotice(`Profil type "${preset?.label ?? presetId}" appliqué au profil connecté.`);
    } catch (err: any) {
      setError(err?.message ?? "Impossible d'appliquer ce profil type.");
    } finally {
      setSavingPresetId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
        Chargement des profils types...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Profils types & permissions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Matrice métier Batipro pour les accès commercial, comptable, conducteur, administratif, terrain et sous-traitant.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
      {!schemaReady ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          La colonne Supabase des permissions profil n'est pas disponible. Les profils types sont visibles, mais non applicables.
        </div>
      ) : null}

      <section className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Profil connecté</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{role || "Sans rôle"}</div>
            <div className="mt-1 text-sm text-slate-500">
              Les presets s'appliquent uniquement au profil connecté tant qu'aucune table de modèles par utilisateur n'est validée.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Actualiser
          </button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {BUSINESS_PROFILE_PERMISSION_PRESETS.map((preset) => {
          const activeKeys = Object.entries(preset.permissions)
            .filter(([, enabled]) => enabled === true)
            .map(([key]) => key);
          const deniedKeys = Object.entries(preset.permissions)
            .filter(([, enabled]) => enabled === false)
            .map(([key]) => key);
          const activeOnCurrent = activeKeys.filter((key) =>
            hasProfileFeaturePermission(permissions, key as any, role),
          ).length;

          return (
            <section key={preset.id} className="rounded-2xl border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{preset.roleLabel}</div>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">{preset.label}</h2>
                  <p className="mt-1 text-sm text-slate-500">{preset.description}</p>
                </div>
                <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  {activeKeys.length} droits
                </span>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Droits principaux</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeKeys.slice(0, 12).map((key) => (
                    <span key={key} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                      {permissionLabels.get(key) ?? key}
                    </span>
                  ))}
                  {activeKeys.length > 12 ? (
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
                      +{activeKeys.length - 12}
                    </span>
                  ) : null}
                </div>
              </div>

              {deniedKeys.length > 0 ? (
                <div className="mt-3 text-xs text-slate-500">
                  Restrictions explicites : {deniedKeys.slice(0, 6).map((key) => permissionLabels.get(key) ?? key).join(", ")}
                  {deniedKeys.length > 6 ? `, +${deniedKeys.length - 6}` : ""}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Actifs sur le profil connecté : {activeOnCurrent}/{activeKeys.length}
                </div>
                <button
                  type="button"
                  onClick={() => void applyPreset(preset.id)}
                  disabled={!admin || !schemaReady || savingPresetId !== null}
                  className={[
                    "rounded-xl px-4 py-2 text-sm",
                    !admin || !schemaReady || savingPresetId !== null
                      ? "bg-slate-200 text-slate-500"
                      : "bg-slate-900 text-white hover:bg-slate-800",
                  ].join(" ")}
                >
                  {savingPresetId === preset.id ? "Application..." : "Appliquer au profil connecté"}
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
