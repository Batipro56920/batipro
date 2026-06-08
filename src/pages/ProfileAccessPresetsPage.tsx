import { useEffect, useMemo, useState } from "react";
import {
  BUSINESS_PROFILE_PERMISSION_PRESETS,
  getProfilePermissionSections,
  listBusinessProfilePermissionPresets,
  saveBusinessProfilePermissionPreset,
  type BusinessProfilePermissionPreset,
  type BusinessProfilePresetId,
  type ProfileFeaturePermissionKey,
  type ProfileFeaturePermissions,
} from "../services/profileFeaturePermissions.service";

function countEnabled(permissions: ProfileFeaturePermissions) {
  return Object.values(permissions).filter((enabled) => enabled === true).length;
}

function samePermissions(left: ProfileFeaturePermissions, right: ProfileFeaturePermissions) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (left[key as ProfileFeaturePermissionKey] !== right[key as ProfileFeaturePermissionKey]) return false;
  }
  return true;
}

export default function ProfileAccessPresetsPage() {
  const sections = useMemo(() => getProfilePermissionSections(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [presets, setPresets] = useState<BusinessProfilePermissionPreset[]>(BUSINESS_PROFILE_PERMISSION_PRESETS);
  const [selectedPresetId, setSelectedPresetId] = useState<BusinessProfilePresetId>(BUSINESS_PROFILE_PERMISSION_PRESETS[0].id);
  const [draftPermissions, setDraftPermissions] = useState<ProfileFeaturePermissions>({});
  const [schemaReady, setSchemaReady] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? presets[0];
  const defaultPreset = BUSINESS_PROFILE_PERMISSION_PRESETS.find((preset) => preset.id === selectedPresetId);
  const hasChanges = selectedPreset ? !samePermissions(draftPermissions, selectedPreset.permissions) : false;

  async function refresh(nextSelectedPresetId = selectedPresetId) {
    setLoading(true);
    setError(null);
    try {
      const result = await listBusinessProfilePermissionPresets();
      setPresets(result.presets);
      setSchemaReady(result.schemaReady);
      const nextPreset = result.presets.find((preset) => preset.id === nextSelectedPresetId) ?? result.presets[0];
      setSelectedPresetId(nextPreset.id);
      setDraftPermissions(nextPreset.permissions);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les profils types.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function selectPreset(presetId: BusinessProfilePresetId) {
    const preset = presets.find((entry) => entry.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setDraftPermissions(preset.permissions);
    setNotice(null);
    setError(null);
  }

  function togglePermission(key: ProfileFeaturePermissionKey) {
    setDraftPermissions((prev) => ({ ...prev, [key]: prev[key] !== true }));
  }

  function resetToDefault() {
    if (!defaultPreset) return;
    setDraftPermissions(defaultPreset.permissions);
    setNotice(null);
  }

  async function savePreset() {
    if (!selectedPreset) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveBusinessProfilePermissionPreset(selectedPreset.id, draftPermissions);
      const nextPresets = presets.map((preset) => preset.id === selectedPreset.id ? { ...preset, permissions: saved } : preset);
      setPresets(nextPresets);
      setDraftPermissions(saved);
      setSchemaReady(true);
      setNotice(`Droits du profil type "${selectedPreset.label}" enregistrés.`);
    } catch (err: any) {
      setError(err?.message ?? "Impossible d'enregistrer ce profil type.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Chargement des profils types...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-title text-xs font-semibold uppercase tracking-[0.16em]">Paramètres</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Profils types & droits</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Définis ce que chaque profil métier peut voir et faire. Ces droits seront appliqués ensuite depuis Profils & accès quand tu invites ou configures une personne.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Actualiser
        </button>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}
      {!schemaReady ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          La table Supabase des modèles de profils types n'est pas encore créée. La matrice est visible avec les modèles Batipro par défaut, mais l'enregistrement nécessite le SQL fourni.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-2">
          {presets.map((preset) => {
            const selected = preset.id === selectedPresetId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => selectPreset(preset.id)}
                className={[
                  "w-full rounded-xl border p-4 text-left transition",
                  selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
                ].join(" ")}
              >
                <div className={selected ? "text-xs font-semibold uppercase tracking-[0.16em] text-blue-100" : "text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"}>
                  {preset.roleLabel}
                </div>
                <div className="mt-1 font-semibold">{preset.label}</div>
                <div className={selected ? "mt-1 text-xs text-blue-100" : "mt-1 text-xs text-slate-500"}>{countEnabled(preset.permissions)} droits actifs</div>
              </button>
            );
          })}
        </aside>

        <section className="rounded-2xl border bg-white p-5">
          {selectedPreset ? (
            <>
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{selectedPreset.roleLabel}</div>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">{selectedPreset.label}</h2>
                  <p className="mt-1 max-w-3xl text-sm text-slate-500">{selectedPreset.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={resetToDefault}
                    disabled={!defaultPreset || saving}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Réinitialiser
                  </button>
                  <button
                    type="button"
                    onClick={() => void savePreset()}
                    disabled={!schemaReady || saving || !hasChanges}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {saving ? "Enregistrement..." : "Enregistrer ce profil"}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                {sections.map((section) => (
                  <section key={section.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-950">{section.label}</h3>
                      <span className="text-xs text-slate-500">
                        {section.permissions.filter((permission) => draftPermissions[permission.key] === true).length}/{section.permissions.length} actifs
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {section.permissions.map((permission) => {
                        const enabled = draftPermissions[permission.key] === true;
                        return (
                          <label key={permission.key} className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={() => togglePermission(permission.key)}
                              className="mt-1 h-4 w-4 shrink-0"
                            />
                            <span>
                              <span className="block font-medium text-slate-900">{permission.label}</span>
                              <span className="mt-0.5 block text-xs leading-5 text-slate-500">{permission.description}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">Aucun profil type disponible.</div>
          )}
        </section>
      </div>
    </div>
  );
}
