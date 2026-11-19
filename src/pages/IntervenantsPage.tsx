import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { getChantiers, type ChantierRow } from "../services/chantiers.service";
import {
  archiveIntervenant,
  createIntervenant,
  deleteIntervenant,
  generateIntervenantInvitation,
  generateIntervenantPortalAccess,
  listIntervenantChantierLinks,
  listIntervenants,
  restoreIntervenant,
  type IntervenantStatus,
  type IntervenantRow,
  updateIntervenant,
} from "../services/intervenants.service";
import { useI18n } from "../i18n";
import IntervenantFormFields, {
  EMPTY_INTERVENANT_FORM,
  INTERVENANT_STATUS_LABELS,
  effectiveHourlyCost,
  intervenantFormFromRow,
  intervenantPayload,
  moneyFr,
  type IntervenantFormState,
} from "../components/intervenants/IntervenantFormFields";

type IntervenantLinkRow = {
  intervenant_id: string;
  chantier_id: string;
};

// "Profils & accès" gère le terrain (ouvriers, sous-traitants) et, plus tard, le portail
// client — pas les profils bureau (dirigeant, comptable, commercial...), qui se gèrent
// depuis Personnel avec un vrai rôle BUREAU, pas une étiquette dérivée d'un intitulé de poste.
type ProfileType = "intervenant" | "chef_de_chantier" | "sous_traitant" | "client";

type ProfileFilter = "all" | ProfileType;

type ProfileAccessSummary = {
  profileType: ProfileType;
  businessRole: string;
  accessLabel: string;
  accessStatus: "active" | "invited" | "disabled" | "none";
  portalLabel: string;
};

const PROFILE_TYPE_LABELS: Record<ProfileType, string> = {
  intervenant: "Intervenant",
  chef_de_chantier: "Chef de chantier",
  sous_traitant: "Sous-traitant",
  client: "Client",
};

const PROFILE_FILTERS: Array<{ key: ProfileFilter; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "intervenant", label: PROFILE_TYPE_LABELS.intervenant },
  { key: "chef_de_chantier", label: PROFILE_TYPE_LABELS.chef_de_chantier },
  { key: "sous_traitant", label: PROFILE_TYPE_LABELS.sous_traitant },
  { key: "client", label: PROFILE_TYPE_LABELS.client },
];

export default function IntervenantsPage() {
  const { locale, t } = useI18n();
  const [rows, setRows] = useState<Array<IntervenantRow & { chantier_ids: string[] }>>([]);
  const [chantiers, setChantiers] = useState<ChantierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<(IntervenantRow & { chantier_ids: string[] }) | null>(null);
  const [form, setForm] = useState<IntervenantFormState>(EMPTY_INTERVENANT_FORM);
  const [inviteUrlById, setInviteUrlById] = useState<Record<string, string>>({});
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [openingPortalId, setOpeningPortalId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [profileFilter, setProfileFilter] = useState<ProfileFilter>("all");

  const chantierNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const chantier of chantiers) map.set(chantier.id, chantier.nom);
    return map;
  }, [chantiers]);

  const profileSummaryById = useMemo(() => {
    const map = new Map<string, ProfileAccessSummary>();
    for (const row of rows) map.set(row.id, getProfileAccessSummary(row));
    return map;
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (profileFilter === "all") return rows;
    return rows.filter((row) => profileSummaryById.get(row.id)?.profileType === profileFilter);
  }, [profileFilter, profileSummaryById, rows]);

  const profileCounts = useMemo(() => {
    const counts = new Map<ProfileFilter, number>([["all", rows.length]]);
    for (const row of rows) {
      const profileType = profileSummaryById.get(row.id)?.profileType ?? "intervenant";
      counts.set(profileType, (counts.get(profileType) ?? 0) + 1);
    }
    return counts;
  }, [profileSummaryById, rows]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [intervenantsRows, chantierRows, chantierLinksRes] = await Promise.all([
        listIntervenants(),
        getChantiers(),
        listIntervenantChantierLinks(),
      ]);

      const chantierIdsByIntervenant = new Map<string, Set<string>>();
      const appendLink = (row: IntervenantLinkRow) => {
        if (!row?.intervenant_id || !row?.chantier_id) return;
        if (!chantierIdsByIntervenant.has(row.intervenant_id)) {
          chantierIdsByIntervenant.set(row.intervenant_id, new Set<string>());
        }
        chantierIdsByIntervenant.get(row.intervenant_id)?.add(row.chantier_id);
      };

      for (const row of chantierLinksRes as IntervenantLinkRow[]) appendLink(row);
      for (const row of intervenantsRows) {
        if (row.chantier_id) appendLink({ intervenant_id: row.id, chantier_id: row.chantier_id });
      }

      setRows(
        intervenantsRows.map((row) => ({
          ...row,
          chantier_ids: Array.from(chantierIdsByIntervenant.get(row.id) ?? []),
        })),
      );
      setChantiers(chantierRows);
    } catch (err: any) {
      setError(err?.message ?? t("intervenantsPage.loadError"));
      setRows([]);
      setChantiers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function openCreateModal() {
    setModalOpen(true);
    setEditingRow(null);
    setForm(EMPTY_INTERVENANT_FORM);
  }

  function openEditModal(row: IntervenantRow & { chantier_ids: string[] }) {
    setModalOpen(true);
    setEditingRow(row);
    setForm(intervenantFormFromRow(row));
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingRow(null);
    setForm(EMPTY_INTERVENANT_FORM);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = intervenantPayload(form);
      if (!payload.nom) throw new Error("Le nom de l'intervenant est obligatoire.");
      if (editingRow) await updateIntervenant(editingRow.id, payload);
      else await createIntervenant(payload);

      closeModal();
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? "Erreur enregistrement intervenant.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row: IntervenantRow) {
    if (!window.confirm(`Supprimer l'intervenant "${row.nom}" ? Cette action supprime la fiche, pas les chantiers.`)) return;
    setDeletingId(row.id);
    setError(null);
    try {
      await deleteIntervenant(row.id);
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? "Erreur suppression intervenant.");
    } finally {
      setDeletingId(null);
    }
  }

  async function onArchive(row: IntervenantRow) {
    setDeletingId(row.id);
    setError(null);
    try {
      if (row.archived_at) await restoreIntervenant(row.id);
      else await archiveIntervenant(row.id);
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? "Erreur archivage intervenant.");
    } finally {
      setDeletingId(null);
    }
  }

  async function onInvite(row: IntervenantRow) {
    setInvitingId(row.id);
    setError(null);
    try {
      const data = await generateIntervenantInvitation(row.id);
      const inviteUrl = String((data as any)?.accessUrl ?? "").trim();
      if (!inviteUrl) throw new Error("Lien d'invitation introuvable.");
      setInviteUrlById((prev) => ({ ...prev, [row.id]: inviteUrl }));
      await navigator.clipboard.writeText(inviteUrl);
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? "Erreur generation invitation.");
    } finally {
      setInvitingId(null);
    }
  }

  async function onOpenPortal(row: IntervenantRow & { chantier_ids: string[] }) {
    const chantierId = row.chantier_ids[0] ?? "";
    if (!chantierId) {
      setError("Ajoute d'abord un accès chantier à ce profil pour ouvrir son portail terrain.");
      return;
    }
    if (!String(row.email ?? "").trim()) {
      setError("Renseigne d'abord un email sur cette fiche : le lien du portail est envoyé à cette adresse.");
      return;
    }

    const portalWindow = window.open("about:blank", "_blank");
    if (portalWindow) {
      portalWindow.opener = null;
      portalWindow.document.title = "Ouverture du portail";
      portalWindow.document.body.textContent = "Ouverture du portail terrain...";
    }

    setOpeningPortalId(row.id);
    setError(null);
    try {
      const data = await generateIntervenantPortalAccess({ intervenantId: row.id, chantierId, expiresInDays: 1 });
      const portalUrl = data.accessUrl.trim();
      if (!portalUrl) throw new Error("Lien portail introuvable.");

      if (portalWindow && !portalWindow.closed) {
        portalWindow.location.href = portalUrl;
      } else {
        window.location.assign(portalUrl);
      }
    } catch (err: any) {
      if (portalWindow && !portalWindow.closed) portalWindow.close();
      setError(err?.message ?? "Erreur ouverture portail intervenant.");
    } finally {
      setOpeningPortalId(null);
    }
  }

  function legacyAccountStatusLabel(row: IntervenantRow) {
    if (row.archived_at) return "Archivé";
    if (row.user_id) return "Compte actif";
    if (row.invitation_last_sent_at) return "Invitation envoyee";
    return "Non invité";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Profils & accès</h1>
          <p className="text-slate-500">
            Centre de gestion des profils, rôles, accès chantier et portails. Le portail intervenant reste le portail terrain existant.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={refresh}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
          >
            {t("common.actions.refresh")}
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
          >
            Ajouter un intervenant
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <ProfileMetric label="Profils" value={rows.length} helper="Fiches connues" />
        <ProfileMetric label="Portail terrain" value={rows.filter((row) => row.user_id || row.invitation_last_sent_at).length} helper="Comptes ou invitations" />
        <ProfileMetric label="Accès chantier" value={rows.filter((row) => row.chantier_ids.length > 0).length} helper="Profils rattachés" />
        <ProfileMetric label="Types prêts" value={Object.keys(PROFILE_TYPE_LABELS).length} helper="Structure extensible" />
      </div>

      <div className="rounded-2xl border bg-white p-3">
        <div className="flex flex-wrap gap-2">
          {PROFILE_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setProfileFilter(filter.key)}
              className={[
                "rounded-xl border px-3 py-2 text-sm font-medium",
                profileFilter === filter.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {filter.label}
              <span className="ml-2 text-xs opacity-70">{profileCounts.get(filter.key) ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">{t("intervenantsPage.loading")}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
          Aucun intervenant. Cree la premiere fiche depuis ce tableau.
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
          Aucun profil ne correspond au filtre sélectionné.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="min-w-[920px] w-full table-fixed text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t("common.labels.name")}</th>
                <th className="px-4 py-3 text-left font-medium">Type de profil</th>
                <th className="px-4 py-3 text-left font-medium">Rôle métier</th>
                <th className="px-4 py-3 text-left font-medium">Accès</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-left font-medium">Portail</th>
                <th className="px-4 py-3 text-left font-medium">Contact</th>
                <th className="px-4 py-3 text-left font-medium">{t("sidebar.chantiers")}</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const summary = profileSummaryById.get(row.id) ?? getProfileAccessSummary(row);
                const firstChantierName = row.chantier_ids[0] ? chantierNameById.get(row.chantier_ids[0]) ?? "chantier rattaché" : "chantier rattaché";
                return (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.nom}</div>
                    {row.archived_at ? (
                      <div className="mt-1 inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        Archivé
                      </div>
                    ) : null}
                    {row.notes ? <div className="mt-1 text-xs text-slate-500 line-clamp-2">{row.notes}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
                      {PROFILE_TYPE_LABELS[summary.profileType]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{summary.businessRole}</div>
                    {row.entreprise ? <div className="mt-1 text-xs text-slate-500">{row.entreprise}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className={accessBadgeClass(summary.accessStatus)}>{summary.accessLabel}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium">
                      {INTERVENANT_STATUS_LABELS[row.status ?? "subcontractor"]}
                    </span>
                    {row.is_active === false ? <div className="mt-1 text-xs text-red-600">Inactif</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{summary.portalLabel}</div>
                    <div className="mt-1 text-xs text-slate-500">{legacyAccountStatusLabel(row)}</div>
                    <div className="mt-1 text-xs text-slate-500">Base technique des futurs portails</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{row.email ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.telephone ?? "-"}</div>
                    {row.invitation_last_sent_at ? (
                      <div className="mt-2 text-xs text-slate-500">
                        Derniere invitation : {new Date(row.invitation_last_sent_at).toLocaleString(locale)}
                      </div>
                    ) : null}
                    {inviteUrlById[row.id] ? (
                      <div className="mt-2 rounded-xl border bg-slate-50 p-2 text-xs text-slate-600 break-all">
                        {inviteUrlById[row.id]}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {row.chantier_ids.length === 0
                      ? "-"
                      : row.chantier_ids
                          .map((chantierId) => chantierNameById.get(chantierId) ?? chantierId)
                          .join(", ")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/intervenants/${row.id}`}
                        className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        Voir fiche
                      </Link>
                      <button
                        type="button"
                        onClick={() => onOpenPortal(row)}
                        disabled={row.chantier_ids.length === 0 || !String(row.email ?? "").trim() || openingPortalId === row.id}
                        title={
                          row.chantier_ids.length === 0
                            ? "Aucun chantier rattaché"
                            : !String(row.email ?? "").trim()
                              ? "Renseigne un email sur cette fiche pour ouvrir le portail"
                              : `Ouvrir le portail terrain sur ${firstChantierName}`
                        }
                        className={[
                          "rounded-xl border px-3 py-2 text-sm",
                          row.chantier_ids.length === 0 || !String(row.email ?? "").trim() || openingPortalId === row.id
                            ? "bg-slate-100 text-slate-400 border-slate-200"
                            : "hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {openingPortalId === row.id ? "Ouverture..." : "Ouvrir portail"}
                      </button>
                      {/*
                        Le bouton grise disait pourquoi dans une infobulle, que
                        personne ne survole : on cherchait la raison sans la trouver.
                      */}
                      {row.chantier_ids.length === 0 || !String(row.email ?? "").trim() ? (
                        <span className="text-xs text-amber-700">
                          {row.chantier_ids.length === 0
                            ? "Portail indisponible : aucun chantier rattache."
                            : "Portail indisponible : renseigne un email sur cette fiche, le lien d acces y est rattache."}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openEditModal(row)}
                        className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        {t("common.actions.edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => onInvite(row)}
                        disabled={!!row.user_id || invitingId === row.id}
                        className={[
                          "rounded-xl border px-3 py-2 text-sm",
                          row.user_id || invitingId === row.id
                            ? "bg-slate-100 text-slate-400 border-slate-200"
                            : "hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {invitingId === row.id ? "Generation..." : row.invitation_last_sent_at ? "Regenerer invitation" : "Envoyer invitation compte"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onArchive(row)}
                        disabled={deletingId === row.id}
                        className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      >
                        {row.archived_at ? "Restaurer" : "Archiver"}
                      </button>
                      {row.chantier_ids.length > 0 ? (
                        <Link
                          to={`/intervenants/${row.id}`}
                          className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          Voir chantiers associés
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onDelete(row)}
                        disabled={deletingId === row.id}
                        className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                      >
                        {deletingId === row.id ? "Suppression..." : t("common.actions.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4" onClick={closeModal}>
          <div
            className="mx-auto flex h-auto max-h-[calc(100vh-32px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">
                    {editingRow ? "Modifier l'intervenant" : "Ajouter un intervenant"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    La creation de compte intervenant se fait ensuite depuis la fiche globale.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                >
                  Fermer
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <form id="intervenant-form" onSubmit={onSubmit}>
                <IntervenantFormFields form={form} onChange={setForm} />
              </form>
            </div>

            <footer className="shrink-0 border-t px-6 py-4">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  {t("common.actions.cancel")}
                </button>
                <button
                  type="submit"
                  form="intervenant-form"
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? "Enregistrement..." : editingRow ? "Mettre a jour" : "Creer l'intervenant"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileMetric({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function getProfileAccessSummary(row: IntervenantRow & { chantier_ids: string[] }): ProfileAccessSummary {
  const roleSource = `${row.job_title ?? ""} ${row.metier ?? ""} ${row.specialty ?? ""}`.toLowerCase();
  const profileType = inferProfileType(row, roleSource);
  const businessRole = row.job_title || row.metier || row.specialty || PROFILE_TYPE_LABELS[profileType];
  const hasPortalAccount = Boolean(row.user_id);
  const hasInvitation = Boolean(row.invitation_last_sent_at);
  const hasChantierAccess = row.chantier_ids.length > 0;
  const accessStatus: ProfileAccessSummary["accessStatus"] = row.archived_at || row.is_active === false
    ? "disabled"
    : hasPortalAccount
      ? "active"
      : hasInvitation
        ? "invited"
        : "none";

  return {
    profileType,
    businessRole,
    accessLabel: hasChantierAccess ? `${row.chantier_ids.length} chantier${row.chantier_ids.length > 1 ? "s" : ""}` : "Aucun accès chantier",
    accessStatus,
    portalLabel: profileType === "client"
      ? "Portail client à venir"
      : hasPortalAccount
        ? "Portail terrain actif"
        : hasInvitation
          ? "Portail terrain invité"
          : "Portail terrain disponible",
  };
}

function inferProfileType(row: IntervenantRow, roleSource: string): ProfileType {
  if (row.status === "subcontractor") return "sous_traitant";
  if (roleSource.includes("chef") && roleSource.includes("chantier")) return "chef_de_chantier";
  if (roleSource.includes("client")) return "client";
  return "intervenant";
}

function accessBadgeClass(status: ProfileAccessSummary["accessStatus"]) {
  const base = "inline-flex rounded-full border px-3 py-1 text-xs font-medium";
  if (status === "active") return `${base} border-emerald-200 bg-emerald-50 text-emerald-700`;
  if (status === "invited") return `${base} border-amber-200 bg-amber-50 text-amber-700`;
  if (status === "disabled") return `${base} border-slate-200 bg-slate-100 text-slate-500`;
  return `${base} border-slate-200 bg-slate-50 text-slate-600`;
}
