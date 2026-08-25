import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { getChantiers, type ChantierRow } from "../services/chantiers.service";
import {
  archiveIntervenant,
  generateIntervenantInvitation,
  getIntervenant,
  listIntervenantChantierLinks,
  restoreIntervenant,
  type IntervenantStatus,
  type IntervenantRow,
  updateIntervenant,
} from "../services/intervenants.service";
import {
  BUSINESS_PROFILE_PERMISSION_PRESETS,
  FIELD_PROFILE_PERMISSION_PRESETS,
  clearProfileFeaturePermissionOverrideForUser,
  detachProfileFeaturePermissionPresetForUser,
  getProfilePermissionModuleMatrix,
  getProfilePermissionSections,
  getProfileFeaturePermissionsForUser,
  hasProfileFeaturePermission,
  setProfileFeaturePermissionOverrideForUser,
  setProfileFeaturePermissionPresetForUser,
  PROFILE_PERMISSION_MODULE_ACTION_LABELS,
  type BusinessProfilePresetId,
  type ProfileFeaturePermissionKey,
  type ProfileFeaturePermissionsResult,
  type ProfilePermissionModuleAction,
} from "../services/profileFeaturePermissions.service";

const CHANTIER_PILLAR_SECTION_IDS = new Set(["organisation", "production", "ressources", "controle", "pilotage"]);
const MODULE_ACTIONS: ProfilePermissionModuleAction[] = ["view", "create", "edit", "delete"];

type FormState = {
  nom: string;
  entreprise: string;
  metier: string;
  email: string;
  telephone: string;
  notes: string;
  status: IntervenantStatus;
  job_title: string;
  hourly_cost_ht: string;
  hourly_sale_price_ht: string;
  entry_date: string;
  is_active: boolean;
  subcontractor_company: string;
  specialty: string;
  daily_rate_ht: string;
  insurance: string;
};

const STATUS_LABELS: Record<IntervenantStatus, string> = {
  employee: "Employé",
  subcontractor: "Sous-traitant",
  temporary_worker: "Intérimaire",
  partner: "Partenaire",
  other: "Autre",
};

export default function IntervenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<IntervenantRow | null>(null);
  const [chantiers, setChantiers] = useState<ChantierRow[]>([]);
  const [chantierIds, setChantierIds] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>({
    nom: "",
    entreprise: "",
    metier: "",
    email: "",
    telephone: "",
    notes: "",
    status: "subcontractor",
    job_title: "",
    hourly_cost_ht: "",
    hourly_sale_price_ht: "",
    entry_date: "",
    is_active: true,
    subcontractor_company: "",
    specialty: "",
    daily_rate_ht: "",
    insurance: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPresetId, setSavingPresetId] = useState<BusinessProfilePresetId | null>(null);
  const [detaching, setDetaching] = useState(false);
  const [togglingKey, setTogglingKey] = useState<ProfileFeaturePermissionKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [permissionsResult, setPermissionsResult] = useState<ProfileFeaturePermissionsResult | null>(null);
  const [droitsExpanded, setDroitsExpanded] = useState(false);

  const moduleMatrix = useMemo(() => getProfilePermissionModuleMatrix(), []);
  const extraSections = useMemo(
    () => getProfilePermissionSections().filter((section) => !CHANTIER_PILLAR_SECTION_IDS.has(section.id)),
    [],
  );

  const chantierById = useMemo(() => {
    const map = new Map<string, ChantierRow>();
    for (const chantier of chantiers) map.set(chantier.id, chantier);
    return map;
  }, [chantiers]);

  async function refresh() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [intervenant, chantierRows, links] = await Promise.all([
        getIntervenant(id),
        getChantiers(),
        listIntervenantChantierLinks(id),
      ]);
      const ids = new Set<string>();
      for (const link of links) ids.add(link.chantier_id);
      if (intervenant.chantier_id) ids.add(intervenant.chantier_id);
      setRow(intervenant);
      setChantiers(chantierRows);
      setChantierIds(Array.from(ids));
      if (intervenant.user_id) {
        try {
          setPermissionsResult(await getProfileFeaturePermissionsForUser(intervenant.user_id));
        } catch {
          setPermissionsResult(null);
        }
      } else {
        setPermissionsResult(null);
      }
      setForm({
        nom: intervenant.nom ?? "",
        entreprise: intervenant.entreprise ?? "",
        metier: intervenant.metier ?? "",
        email: intervenant.email ?? "",
        telephone: intervenant.telephone ?? "",
        notes: intervenant.notes ?? "",
        status: intervenant.status ?? "subcontractor",
        job_title: intervenant.job_title ?? "",
        hourly_cost_ht: intervenant.hourly_cost_ht == null ? "" : String(intervenant.hourly_cost_ht),
        hourly_sale_price_ht: intervenant.hourly_sale_price_ht == null ? "" : String(intervenant.hourly_sale_price_ht),
        entry_date: intervenant.entry_date ?? "",
        is_active: intervenant.is_active !== false,
        subcontractor_company: intervenant.subcontractor_company ?? intervenant.entreprise ?? "",
        specialty: intervenant.specialty ?? intervenant.metier ?? "",
        daily_rate_ht: intervenant.daily_rate_ht == null ? "" : String(intervenant.daily_rate_ht),
        insurance: intervenant.insurance ?? "",
      });
    } catch (err: any) {
      setError(err?.message ?? "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [id]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!row) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateIntervenant(row.id, form);
      setRow(updated);
      setNotice("Fiche intervenant mise à jour.");
    } catch (err: any) {
      setError(err?.message ?? "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function onInvite() {
    if (!row) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await generateIntervenantInvitation(row.id);
      const url = String((data as any)?.accessUrl ?? "").trim();
      if (!url) throw new Error("Lien d'invitation introuvable.");
      setInviteUrl(url);
      await navigator.clipboard.writeText(url);
      await refresh();
      setNotice("Invitation générée et copiée.");
    } catch (err: any) {
      setError(err?.message ?? "Invitation impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function onArchive() {
    if (!row) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = row.archived_at ? await restoreIntervenant(row.id) : await archiveIntervenant(row.id);
      setRow(updated);
      setNotice(row.archived_at ? "Intervenant restauré." : "Intervenant archivé.");
    } catch (err: any) {
      setError(err?.message ?? "Archivage impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function onApplyPreset(presetId: BusinessProfilePresetId) {
    if (!row?.user_id) return;
    setSavingPresetId(presetId);
    setError(null);
    setNotice(null);
    try {
      const result = await setProfileFeaturePermissionPresetForUser(row.user_id, presetId);
      setPermissionsResult(result);
      const preset = BUSINESS_PROFILE_PERMISSION_PRESETS.find((entry) => entry.id === presetId);
      setNotice(`Profil type "${preset?.label ?? presetId}" rattaché en direct à ce compte : ses droits suivront désormais ce profil type en temps réel.`);
    } catch (err: any) {
      setError(err?.message ?? "Application du profil type impossible.");
    } finally {
      setSavingPresetId(null);
    }
  }

  async function onDetachPreset() {
    if (!row?.user_id) return;
    setDetaching(true);
    setError(null);
    setNotice(null);
    try {
      const result = await detachProfileFeaturePermissionPresetForUser(row.user_id);
      setPermissionsResult(result);
      setNotice("Compte détaché du profil type : ses droits actuels sont désormais personnalisés et ne suivront plus les futures modifications du profil type.");
    } catch (err: any) {
      setError(err?.message ?? "Détachement impossible.");
    } finally {
      setDetaching(false);
    }
  }

  async function onToggleOverride(key: ProfileFeaturePermissionKey) {
    if (!row?.user_id || !permissionsResult) return;
    setTogglingKey(key);
    setError(null);
    try {
      const nextEnabled = !hasProfileFeaturePermission(permissionsResult.permissions, key, permissionsResult.role);
      const result = await setProfileFeaturePermissionOverrideForUser(row.user_id, key, nextEnabled);
      setPermissionsResult(result);
    } catch (err: any) {
      setError(err?.message ?? "Mise à jour du droit impossible.");
    } finally {
      setTogglingKey(null);
    }
  }

  async function onClearOverride(key: ProfileFeaturePermissionKey) {
    if (!row?.user_id) return;
    setTogglingKey(key);
    setError(null);
    try {
      const result = await clearProfileFeaturePermissionOverrideForUser(row.user_id, key);
      setPermissionsResult(result);
    } catch (err: any) {
      setError(err?.message ?? "Réinitialisation du droit impossible.");
    } finally {
      setTogglingKey(null);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Chargement intervenant...</div>;
  }

  if (!row) {
    return <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Intervenant introuvable.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/intervenants" className="text-sm text-slate-500 hover:text-slate-900">
            ← Intervenants
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{row.nom}</h1>
          <p className="text-slate-500">
            {row.entreprise || "Entreprise non renseignée"} · {row.metier || "Métier non renseigné"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving || !!row.user_id}
            onClick={onInvite}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {row.invitation_last_sent_at ? "Renvoyer invitation" : "Envoyer invitation compte"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onArchive}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {row.archived_at ? "Restaurer" : "Archiver"}
          </button>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div> : null}
      {inviteUrl ? <div className="rounded-2xl border bg-slate-50 p-4 text-xs text-slate-600 break-all">{inviteUrl}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form className="rounded-2xl border bg-white p-5" onSubmit={onSubmit}>
          <div className="text-sm font-semibold text-slate-900">Infos générales</div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <div className="text-slate-600">Statut *</div>
              <select
                className="w-full rounded-xl border px-3 py-2"
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as IntervenantStatus }))}
                required
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {([
              ["nom", "Nom"],
              ["entreprise", "Entreprise"],
              ["metier", "Métier"],
              ["email", "Email"],
              ["telephone", "Téléphone"],
            ] as const).map(([key, label]) => (
              <label key={key} className="space-y-1 text-sm">
                <div className="text-slate-600">{label}</div>
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={form[key]}
                  onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                  type={key === "email" ? "email" : "text"}
                  required={key === "nom"}
                />
              </label>
              ))}
          </div>
          {form.status === "employee" ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Salarié</div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {([
                  ["job_title", "Poste"],
                  ["entry_date", "Date d'entrée"],
                  ["hourly_cost_ht", "Coût horaire chargé"],
                  ["hourly_sale_price_ht", "Prix de vente horaire"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="space-y-1 text-sm">
                    <div className="text-slate-600">{label}</div>
                    <input
                      className="w-full rounded-xl border px-3 py-2"
                      value={form[key]}
                      type={key === "entry_date" ? "date" : "text"}
                      inputMode={key.includes("hourly") ? "decimal" : undefined}
                      onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                    />
                  </label>
                ))}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  <span>Actif</span>
                </label>
              </div>
            </div>
          ) : null}
          {form.status === "subcontractor" ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Sous-traitant</div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {([
                  ["subcontractor_company", "Entreprise"],
                  ["specialty", "Spécialité"],
                  ["daily_rate_ht", "Tarif journalier HT"],
                  ["insurance", "Assurance / documents"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="space-y-1 text-sm">
                    <div className="text-slate-600">{label}</div>
                    <input
                      className="w-full rounded-xl border px-3 py-2"
                      value={form[key]}
                      inputMode={key === "daily_rate_ht" ? "decimal" : undefined}
                      onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <label className="mt-4 block space-y-1 text-sm">
            <div className="text-slate-600">Notes</div>
            <textarea
              className="min-h-32 w-full rounded-xl border px-3 py-2"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </label>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">
              Enregistrer
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <section className="rounded-2xl border bg-white p-5">
            <div className="text-sm font-semibold text-slate-900">Statut compte</div>
            <div className="mt-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              {row.archived_at ? "Archivé" : row.user_id ? "Compte créé / actif" : row.invitation_last_sent_at ? "Invitation envoyée" : "Non invité"}
            </div>
            {row.invitation_last_sent_at ? (
              <div className="mt-2 text-xs text-slate-500">
                Dernière invitation : {new Date(row.invitation_last_sent_at).toLocaleString("fr-FR")}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">Profil type</div>
              {permissionsResult?.permissionPresetId ? (
                <button
                  type="button"
                  onClick={() => void onDetachPreset()}
                  disabled={detaching}
                  className="text-xs font-semibold text-slate-500 underline decoration-dotted hover:text-slate-900 disabled:opacity-50"
                >
                  {detaching ? "Détachement..." : "Détacher (personnaliser)"}
                </button>
              ) : null}
            </div>
            {row.user_id ? (
              <>
                <div className="mt-3 space-y-2">
                  {FIELD_PROFILE_PERMISSION_PRESETS.map((preset) => {
                    const linked = permissionsResult?.permissionPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => void onApplyPreset(preset.id)}
                        disabled={savingPresetId !== null}
                        className={[
                          "w-full rounded-xl border px-3 py-2 text-left text-sm disabled:opacity-50",
                          linked ? "border-emerald-300 bg-emerald-50" : "border-slate-200 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-slate-900">
                            {savingPresetId === preset.id ? "Application..." : preset.label}
                          </div>
                          {linked ? (
                            <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">Rattaché · lien vivant</span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">{preset.roleLabel}</div>
                      </button>
                    );
                  })}
                </div>
                {!permissionsResult?.permissionPresetId && permissionsResult && Object.keys(permissionsResult.overrides).length > 0 ? (
                  <div className="mt-2 text-xs text-slate-500">
                    Ce compte n'est rattaché à aucun profil type : ses droits sont entièrement personnalisés.
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => setDroitsExpanded((prev) => !prev)}
                  className="mt-3 text-xs font-semibold text-slate-600 underline decoration-dotted hover:text-slate-900"
                >
                  {droitsExpanded ? "Masquer le détail des droits" : "Voir / modifier le détail des droits"}
                </button>
              </>
            ) : (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                Crée ou envoie d'abord l'invitation compte. Le profil type se rattache ensuite au compte utilisateur lié.
              </div>
            )}
          </section>

          {row.user_id && droitsExpanded && permissionsResult ? (
            <section className="rounded-2xl border bg-white p-5">
              <div className="text-sm font-semibold text-slate-900">Droits effectifs</div>
              <p className="mt-1 text-xs text-slate-500">
                {permissionsResult.permissionPresetId
                  ? "Hérités du profil type rattaché. Un droit coché en jaune est une exception personnalisée pour cette personne uniquement."
                  : "Droits entièrement personnalisés pour cette personne."}
              </p>
              <div className="mt-3 space-y-3">
                {moduleMatrix.map((pillar) => (
                  <div key={pillar.pillar} className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[420px] text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left font-semibold uppercase tracking-[0.08em] text-slate-500">
                          <th className="px-2 py-1.5">{pillar.label}</th>
                          {MODULE_ACTIONS.map((action) => (
                            <th key={action} className="px-2 py-1.5 text-center">{PROFILE_PERMISSION_MODULE_ACTION_LABELS[action]}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pillar.modules.map((module) => (
                          <tr key={module.moduleId} className="border-b border-slate-100 last:border-0">
                            <td className="px-2 py-1.5 font-medium text-slate-800">{module.label}</td>
                            {MODULE_ACTIONS.map((action) => {
                              const key = module.keys[action];
                              const enabled = hasProfileFeaturePermission(permissionsResult.permissions, key, permissionsResult.role);
                              const overridden = key in permissionsResult.overrides;
                              return (
                                <td key={action} className="px-2 py-1.5 text-center">
                                  <div className="inline-flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={enabled}
                                      disabled={togglingKey !== null}
                                      onChange={() => void onToggleOverride(key)}
                                      className={["h-3.5 w-3.5", overridden ? "accent-amber-500" : ""].join(" ")}
                                      title={overridden ? "Exception personnalisée — clique sur × pour revenir au profil type" : undefined}
                                    />
                                    {overridden && permissionsResult.permissionPresetId ? (
                                      <button
                                        type="button"
                                        onClick={() => void onClearOverride(key)}
                                        disabled={togglingKey !== null}
                                        className="text-[10px] font-bold text-amber-600 hover:text-amber-800"
                                        title="Revenir au droit du profil type"
                                      >
                                        ×
                                      </button>
                                    ) : null}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                {extraSections.map((section) => (
                  <div key={section.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{section.label}</div>
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {section.permissions.map((permission) => {
                        const enabled = hasProfileFeaturePermission(permissionsResult.permissions, permission.key, permissionsResult.role);
                        const overridden = permission.key in permissionsResult.overrides;
                        return (
                          <label key={permission.key} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={enabled}
                              disabled={togglingKey !== null}
                              onChange={() => void onToggleOverride(permission.key)}
                              className={["h-3.5 w-3.5", overridden ? "accent-amber-500" : ""].join(" ")}
                            />
                            <span className="text-slate-700">{permission.label}</span>
                            {overridden && permissionsResult.permissionPresetId ? (
                              <button
                                type="button"
                                onClick={() => void onClearOverride(permission.key)}
                                disabled={togglingKey !== null}
                                className="text-[10px] font-bold text-amber-600 hover:text-amber-800"
                                title="Revenir au droit du profil type"
                              >
                                ×
                              </button>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border bg-white p-5">
            <div className="text-sm font-semibold text-slate-900">Chantiers associés</div>
            {chantierIds.length === 0 ? (
              <div className="mt-3 text-sm text-slate-500">Aucun chantier associé.</div>
            ) : (
              <div className="mt-3 space-y-2">
                {chantierIds.map((chantierId) => {
                  const chantier = chantierById.get(chantierId);
                  return (
                    <Link key={chantierId} to={`/chantiers/${chantierId}`} className="block rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">
                      {chantier?.nom ?? chantierId}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
