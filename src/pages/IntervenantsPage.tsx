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

type ProfileFilter = "all" | IntervenantStatus | "archived";
const PROFILE_FILTERS: Array<{ key: ProfileFilter; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "employee", label: "Salariés" },
  { key: "subcontractor", label: "Sous-traitants" },
  { key: "temporary_worker", label: "Intérimaires" },
  { key: "partner", label: "Partenaires" },
  { key: "other", label: "Autres" },
  { key: "archived", label: "Archivés" },
];

export default function IntervenantsPage() {
  const { t } = useI18n();
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
  const [search, setSearch] = useState("");

  const chantierNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const chantier of chantiers) map.set(chantier.id, chantier.nom);
    return map;
  }, [chantiers]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("fr");
    return rows.filter((row) => {
      if (profileFilter === "archived" && !row.archived_at) return false;
      if (profileFilter !== "all" && profileFilter !== "archived" && (row.status ?? "other") !== profileFilter) return false;
      if (profileFilter === "all" && row.archived_at) return false;
      if (!needle) return true;
      return [row.nom, row.entreprise, row.metier, row.email, row.telephone]
        .some((value) => String(value ?? "").toLocaleLowerCase("fr").includes(needle));
    });
  }, [rows, profileFilter, search]);

  const profileCounts = useMemo(() => {
    const counts = new Map<ProfileFilter, number>([["all", rows.filter((row) => !row.archived_at).length]]);
    for (const row of rows) {
      if (row.archived_at) {
        counts.set("archived", (counts.get("archived") ?? 0) + 1);
      } else {
        const status = row.status ?? "other";
        counts.set(status, (counts.get(status) ?? 0) + 1);
      }
    }
    return counts;
  }, [rows]);

  const activeEmployees = rows.filter((row) => row.status === "employee" && !row.archived_at && row.is_active !== false);
  const productiveCosts = activeEmployees.map((row) => Number(row.hourly_cost_ht))
    .filter((value) => Number.isFinite(value) && value > 0);
  const averageHourlyCost = productiveCosts.length
    ? productiveCosts.reduce((sum, value) => sum + value, 0) / productiveCosts.length : null;

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

      setModalOpen(false);
      setEditingRow(null);
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


  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Ressources · Équipe</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Intervenants et accès</h1>
          <p className="mt-1 text-sm text-slate-500">Une fiche par personne, pour ses coordonnées, ses coûts et son accès au portail terrain.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => void refresh()} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Actualiser</button>
          <button type="button" onClick={openCreateModal} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">+ Ajouter un intervenant</button>
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProfileMetric label="Intervenants actifs" value={rows.filter((row) => !row.archived_at && row.is_active !== false).length} helper="Hors fiches archivées et inactives" />
        <ProfileMetric label="Salariés" value={activeEmployees.length} helper="Pris en compte dans le coût salarial moyen" />
        <ProfileMetric label="Coûts horaires renseignés" value={productiveCosts.length} helper={"Moyenne salariés : " + moneyFr(averageHourlyCost) + " / h"} />
        <ProfileMetric label="Portails créés ou invités" value={rows.filter((row) => row.user_id || row.invitation_last_sent_at).length} helper="Accès terrain gérés séparément de la fiche" />
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="block w-full lg:max-w-xs">
            <span className="sr-only">Rechercher un intervenant</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher nom, métier, entreprise..."
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
          </label>
          <div className="flex flex-wrap gap-2">
            {PROFILE_FILTERS.map((filter) => (
              <button key={filter.key} type="button" onClick={() => setProfileFilter(filter.key)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${profileFilter === filter.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {filter.label} <span className="ml-1 opacity-70">{profileCounts.get(filter.key) ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
      {loading ? <p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Chargement des intervenants…</p>
      : filteredRows.length === 0 ? <p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Aucun intervenant ne correspond à cette recherche.</p>
      : <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3 text-left">Intervenant</th><th className="px-4 py-3 text-left">Activité</th>
                <th className="px-4 py-3 text-left">Coût de référence</th><th className="px-4 py-3 text-left">Portail</th><th className="px-4 py-3 text-left">Actions</th></tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const firstChantierName = row.chantier_ids[0] ? chantierNameById.get(row.chantier_ids[0]) ?? "Chantier" : "Aucun chantier";
                const cost = effectiveHourlyCost(row);
                return <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-4">
                    <Link className="font-semibold text-slate-950 hover:text-blue-700" to={`/intervenants/${row.id}`}>{row.nom}</Link>
                    <div className="mt-1 text-xs text-slate-500">{row.telephone || row.email || "Aucun contact renseigné"}</div>
                    {(row.is_active === false || row.archived_at) && <span className="mt-1 inline-block rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{row.archived_at ? "Archivé" : "Inactif"}</span>}
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">{INTERVENANT_STATUS_LABELS[row.status ?? "other"]}</span>
                    <div className="mt-2 text-xs text-slate-600">{row.job_title || row.metier || row.specialty || "Métier non renseigné"}</div>
                    {row.entreprise && <div className="mt-1 text-xs text-slate-400">{row.entreprise}</div>}
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-semibold text-slate-900">{moneyFr(cost)}{cost != null ? " / h" : ""}</span>
                    {row.status === "subcontractor" && row.daily_rate_ht != null && <div className="mt-1 text-xs text-slate-500">{moneyFr(row.daily_rate_ht)} / jour HT</div>}
                    {row.status === "employee" && !cost && <div className="mt-1 text-xs text-amber-700">Coût à renseigner</div>}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${row.user_id ? "bg-emerald-50 text-emerald-700" : row.invitation_last_sent_at ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                      {row.user_id ? "Compte actif" : row.invitation_last_sent_at ? "Invitation envoyée" : "Sans accès"}
                    </span>
                    <div className="mt-2 text-xs text-slate-500">{row.chantier_ids.length} chantier(s) · {firstChantierName}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/intervenants/${row.id}`} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">Ouvrir la fiche</Link>
                      <button type="button" onClick={() => openEditModal(row)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs hover:bg-slate-100">Modifier</button>
                      {!row.user_id && <button type="button" onClick={() => void onInvite(row)} disabled={invitingId === row.id || !row.email} className="rounded-lg border border-slate-200 px-3 py-2 text-xs disabled:opacity-40">{invitingId === row.id ? "Invitation..." : "Créer l'accès"}</button>}
                    </div>
                    <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">Autres actions</summary>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" disabled={openingPortalId === row.id || !row.email || !row.chantier_ids.length} onClick={() => void onOpenPortal(row)} className="rounded-lg border px-2 py-1.5 disabled:opacity-40">Ouvrir portail</button>
                        <button type="button" disabled={deletingId === row.id} onClick={() => void onArchive(row)} className="rounded-lg border px-2 py-1.5">{row.archived_at ? "Restaurer" : "Archiver"}</button>
                        <button type="button" disabled={deletingId === row.id} onClick={() => void onDelete(row)} className="rounded-lg border border-red-200 px-2 py-1.5 text-red-700">Supprimer</button>
                      </div>
                    </details>
                    {inviteUrlById[row.id] && <p className="mt-2 max-w-xs break-all text-xs text-slate-500">{inviteUrlById[row.id]}</p>}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>}

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
