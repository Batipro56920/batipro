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
  type IntervenantRow,
  updateIntervenant,
} from "../services/intervenants.service";
import { useI18n } from "../i18n";

type IntervenantLinkRow = {
  intervenant_id: string;
  chantier_id: string;
};

type IntervenantFormState = {
  nom: string;
  entreprise: string;
  metier: string;
  email: string;
  telephone: string;
  notes: string;
};

const EMPTY_FORM: IntervenantFormState = {
  nom: "",
  entreprise: "",
  metier: "",
  email: "",
  telephone: "",
  notes: "",
};

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

  const chantierNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const chantier of chantiers) map.set(chantier.id, chantier.nom);
    return map;
  }, [chantiers]);

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
        });
      } else {
        await createIntervenant({
          nom: form.nom,
          entreprise: form.entreprise,
          metier: form.metier,
          email: form.email,
          telephone: form.telephone,
          notes: form.notes,
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

  function accountStatusLabel(row: IntervenantRow) {
    if (row.archived_at) return "Archivé";
    if (row.user_id) return "Compte actif";
    if (row.invitation_last_sent_at) return "Invitation envoyee";
    return "Non invité";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("intervenantsPage.title")}</h1>
          <p className="text-slate-500">
            Creation globale des intervenants, invitations de compte et suivi des associations chantier.
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

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">{t("intervenantsPage.loading")}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
          Aucun intervenant. Cree la premiere fiche depuis ce tableau.
        </div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t("common.labels.name")}</th>
                <th className="px-4 py-3 text-left font-medium">Entreprise</th>
                <th className="px-4 py-3 text-left font-medium">Metier</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.labels.email")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.labels.phone")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("sidebar.chantiers")}</th>
                <th className="px-4 py-3 text-left font-medium">Compte</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.labels.date")}</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
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
                  <td className="px-4 py-3">{row.entreprise ?? "-"}</td>
                  <td className="px-4 py-3">{row.metier ?? "-"}</td>
                  <td className="px-4 py-3">{row.email ?? "-"}</td>
                  <td className="px-4 py-3">{row.telephone ?? "-"}</td>
                  <td className="px-4 py-3">
                    {row.chantier_ids.length === 0
                      ? "-"
                      : row.chantier_ids
                          .map((chantierId) => chantierNameById.get(chantierId) ?? chantierId)
                          .join(", ")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium inline-flex">
                      {accountStatusLabel(row)}
                    </div>
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
                    {row.created_at ? new Date(row.created_at).toLocaleDateString(locale) : "-"}
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4" onClick={closeModal}>
          <div
            className="mx-auto mt-10 w-full max-w-2xl rounded-3xl border bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
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

            <form className="mt-5 space-y-4" onSubmit={onSubmit}>
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

              <label className="block space-y-1 text-sm">
                <div className="text-slate-600">{t("common.labels.notes")}</div>
                <textarea
                  className="min-h-28 w-full rounded-xl border px-3 py-2"
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Informations utiles, contexte, disponibilites..."
                />
              </label>

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
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? "Enregistrement..." : editingRow ? "Mettre a jour" : "Creer l'intervenant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
