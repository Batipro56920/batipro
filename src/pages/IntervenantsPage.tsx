import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { getChantiers, type ChantierRow } from "../services/chantiers.service";
import {
  archiveIntervenant,
  createIntervenant,
  deleteIntervenant,
  generateIntervenantInvitation,
  listIntervenantChantierLinks,
  listIntervenants,
  restoreIntervenant,
  type IntervenantStatus,
  type IntervenantRow,
  updateIntervenant,
} from "../services/intervenants.service";
import { useI18n } from "../i18n";

type IntervenantLinkRow = {
  intervenant_id: string;
  chantier_id: string;
};

type ProfileType =
  | "dirigeant"
  | "administratif"
  | "comptable"
  | "chef_de_projet"
  | "conducteur_de_travaux"
  | "intervenant"
  | "chef_de_chantier"
  | "sous_traitant"
  | "client"
  | "fournisseur";

type ProfileFilter = "all" | ProfileType;

type ProfileAccessSummary = {
  profileType: ProfileType;
  businessRole: string;
  accessLabel: string;
  accessStatus: "active" | "invited" | "disabled" | "none";
  portalLabel: string;
};

type IntervenantFormState = {
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

const EMPTY_FORM: IntervenantFormState = {
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
};

const INTERVENANT_STATUS_LABELS: Record<IntervenantStatus, string> = {
  employee: "Employé",
  subcontractor: "Sous-traitant",
  temporary_worker: "Intérimaire",
  partner: "Partenaire",
  other: "Autre",
};

const PROFILE_TYPE_LABELS: Record<ProfileType, string> = {
  dirigeant: "Dirigeant",
  administratif: "Administratif",
  comptable: "Comptable",
  chef_de_projet: "Chef de projet",
  conducteur_de_travaux: "Conducteur de travaux",
  intervenant: "Intervenant",
  chef_de_chantier: "Chef de chantier",
  sous_traitant: "Sous-traitant",
  client: "Client",
  fournisseur: "Fournisseur",
};

const PROFILE_FILTERS: Array<{ key: ProfileFilter; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "intervenant", label: PROFILE_TYPE_LABELS.intervenant },
  { key: "chef_de_chantier", label: PROFILE_TYPE_LABELS.chef_de_chantier },
  { key: "sous_traitant", label: PROFILE_TYPE_LABELS.sous_traitant },
  { key: "conducteur_de_travaux", label: PROFILE_TYPE_LABELS.conducteur_de_travaux },
  { key: "chef_de_projet", label: PROFILE_TYPE_LABELS.chef_de_projet },
  { key: "administratif", label: PROFILE_TYPE_LABELS.administratif },
  { key: "comptable", label: PROFILE_TYPE_LABELS.comptable },
  { key: "dirigeant", label: PROFILE_TYPE_LABELS.dirigeant },
  { key: "client", label: PROFILE_TYPE_LABELS.client },
  { key: "fournisseur", label: PROFILE_TYPE_LABELS.fournisseur },
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
  const [form, setForm] = useState<IntervenantFormState>(EMPTY_FORM);
  const [inviteUrlById, setInviteUrlById] = useState<Record<string, string>>({});
  const [invitingId, setInvitingId] = useState<string | null>(null);
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
    setForm(EMPTY_FORM);
  }

  function openEditModal(row: IntervenantRow & { chantier_ids: string[] }) {
    setModalOpen(true);
    setEditingRow(row);
    setForm({
      nom: row.nom ?? "",
      entreprise: row.entreprise ?? "",
      metier: row.metier ?? "",
      email: row.email ?? "",
      telephone: row.telephone ?? "",
      notes: row.notes ?? "",
      status: row.status ?? "subcontractor",
      job_title: row.job_title ?? "",
      hourly_cost_ht: row.hourly_cost_ht == null ? "" : String(row.hourly_cost_ht),
      hourly_sale_price_ht: row.hourly_sale_price_ht == null ? "" : String(row.hourly_sale_price_ht),
      entry_date: row.entry_date ?? "",
      is_active: row.is_active !== false,
      subcontractor_company: row.subcontractor_company ?? row.entreprise ?? "",
      specialty: row.specialty ?? row.metier ?? "",
      daily_rate_ht: row.daily_rate_ht == null ? "" : String(row.daily_rate_ht),
      insurance: row.insurance ?? "",
    });
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingRow(null);
    setForm(EMPTY_FORM);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (editingRow) {
        await updateIntervenant(editingRow.id, {
          nom: form.nom,
          entreprise: form.entreprise,
          metier: form.metier,
          email: form.email,
          telephone: form.telephone,
          notes: form.notes,
          status: form.status,
          job_title: form.job_title,
          hourly_cost_ht: form.hourly_cost_ht,
          hourly_sale_price_ht: form.hourly_sale_price_ht,
          entry_date: form.entry_date,
          is_active: form.is_active,
          subcontractor_company: form.subcontractor_company,
          specialty: form.specialty,
          daily_rate_ht: form.daily_rate_ht,
          insurance: form.insurance,
        });
      } else {
        await createIntervenant({
          nom: form.nom,
          entreprise: form.entreprise,
          metier: form.metier,
          email: form.email,
          telephone: form.telephone,
          notes: form.notes,
          status: form.status,
          job_title: form.job_title,
          hourly_cost_ht: form.hourly_cost_ht,
          hourly_sale_price_ht: form.hourly_sale_price_ht,
          entry_date: form.entry_date,
          is_active: form.is_active,
          subcontractor_company: form.subcontractor_company,
          specialty: form.specialty,
          daily_rate_ht: form.daily_rate_ht,
          insurance: form.insurance,
        });
      }

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
          <table className="min-w-[1120px] w-full text-sm">
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
            className="mx-auto flex h-auto max-h-[calc(100vh-48px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border bg-white shadow-xl"
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
              <form id="intervenant-form" className="space-y-4" onSubmit={onSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <div className="text-slate-600">Nom</div>
                    <input
                      className="w-full rounded-xl border px-3 py-2"
                      value={form.nom}
                      onChange={(e) => setForm((prev) => ({ ...prev, nom: e.target.value }))}
                      placeholder="Nom complet"
                      required
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <div className="text-slate-600">Entreprise</div>
                    <input
                      className="w-full rounded-xl border px-3 py-2"
                      value={form.entreprise}
                      onChange={(e) => setForm((prev) => ({ ...prev, entreprise: e.target.value }))}
                      placeholder="Entreprise"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <div className="text-slate-600">Statut *</div>
                    <select
                      className="w-full rounded-xl border px-3 py-2"
                      value={form.status}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, status: e.target.value as IntervenantStatus }))
                      }
                      required
                    >
                      {Object.entries(INTERVENANT_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <div className="text-slate-600">Metier</div>
                    <input
                      className="w-full rounded-xl border px-3 py-2"
                      value={form.metier}
                      onChange={(e) => setForm((prev) => ({ ...prev, metier: e.target.value }))}
                      placeholder="Metier / specialite"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <div className="text-slate-600">Email</div>
                    <input
                      className="w-full rounded-xl border px-3 py-2"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="email@exemple.com"
                      type="email"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <div className="text-slate-600">Telephone</div>
                    <input
                      className="w-full rounded-xl border px-3 py-2"
                      value={form.telephone}
                      onChange={(e) => setForm((prev) => ({ ...prev, telephone: e.target.value }))}
                      placeholder="Telephone"
                    />
                  </label>
                </div>

                {form.status === "employee" ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Informations salarié</div>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      <label className="space-y-1 text-sm">
                        <div className="text-slate-600">Poste</div>
                        <input
                          className="w-full rounded-xl border px-3 py-2"
                          value={form.job_title}
                          onChange={(e) => setForm((prev) => ({ ...prev, job_title: e.target.value }))}
                          placeholder="Chef d'équipe, plaquiste..."
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <div className="text-slate-600">Date d'entrée</div>
                        <input
                          type="date"
                          className="w-full rounded-xl border px-3 py-2"
                          value={form.entry_date}
                          onChange={(e) => setForm((prev) => ({ ...prev, entry_date: e.target.value }))}
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <div className="text-slate-600">Coût horaire chargé</div>
                        <input
                          className="w-full rounded-xl border px-3 py-2"
                          inputMode="decimal"
                          value={form.hourly_cost_ht}
                          onChange={(e) => setForm((prev) => ({ ...prev, hourly_cost_ht: e.target.value }))}
                          placeholder="Ex: 32"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <div className="text-slate-600">Prix de vente horaire</div>
                        <input
                          className="w-full rounded-xl border px-3 py-2"
                          inputMode="decimal"
                          value={form.hourly_sale_price_ht}
                          onChange={(e) => setForm((prev) => ({ ...prev, hourly_sale_price_ht: e.target.value }))}
                          placeholder="Ex: 48"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.is_active}
                          onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                        />
                        <span>Actif</span>
                      </label>
                    </div>
                  </div>
                ) : null}

                {form.status === "subcontractor" ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Sous-traitant</div>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      <label className="space-y-1 text-sm">
                        <div className="text-slate-600">Entreprise</div>
                        <input
                          className="w-full rounded-xl border px-3 py-2"
                          value={form.subcontractor_company}
                          onChange={(e) => setForm((prev) => ({ ...prev, subcontractor_company: e.target.value }))}
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <div className="text-slate-600">Spécialité</div>
                        <input
                          className="w-full rounded-xl border px-3 py-2"
                          value={form.specialty}
                          onChange={(e) => setForm((prev) => ({ ...prev, specialty: e.target.value }))}
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <div className="text-slate-600">Tarif journalier HT</div>
                        <input
                          className="w-full rounded-xl border px-3 py-2"
                          inputMode="decimal"
                          value={form.daily_rate_ht}
                          onChange={(e) => setForm((prev) => ({ ...prev, daily_rate_ht: e.target.value }))}
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <div className="text-slate-600">Assurance / documents</div>
                        <input
                          className="w-full rounded-xl border px-3 py-2"
                          value={form.insurance}
                          onChange={(e) => setForm((prev) => ({ ...prev, insurance: e.target.value }))}
                          placeholder="Décennale, RC Pro, KBIS..."
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                <label className="block space-y-1 text-sm">
                  <div className="text-slate-600">{t("common.labels.notes")}</div>
                  <textarea
                    className="min-h-28 w-full rounded-xl border px-3 py-2"
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Informations utiles, contexte, disponibilites..."
                  />
                </label>
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
      : profileType === "fournisseur"
        ? "Portail fournisseur à venir"
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
  if (roleSource.includes("conducteur")) return "conducteur_de_travaux";
  if (roleSource.includes("projet")) return "chef_de_projet";
  if (roleSource.includes("compt")) return "comptable";
  if (roleSource.includes("admin")) return "administratif";
  if (roleSource.includes("dirigeant") || roleSource.includes("gerant") || roleSource.includes("gérant")) return "dirigeant";
  if (roleSource.includes("client")) return "client";
  if (roleSource.includes("fournisseur")) return "fournisseur";
  return "intervenant";
}

function accessBadgeClass(status: ProfileAccessSummary["accessStatus"]) {
  const base = "inline-flex rounded-full border px-3 py-1 text-xs font-medium";
  if (status === "active") return `${base} border-emerald-200 bg-emerald-50 text-emerald-700`;
  if (status === "invited") return `${base} border-amber-200 bg-amber-50 text-amber-700`;
  if (status === "disabled") return `${base} border-slate-200 bg-slate-100 text-slate-500`;
  return `${base} border-slate-200 bg-slate-50 text-slate-600`;
}
