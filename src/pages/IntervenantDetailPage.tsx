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
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");

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
    try {
      const updated = await updateIntervenant(row.id, form);
      setRow(updated);
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
    try {
      const data = await generateIntervenantInvitation(row.id);
      const url = String((data as any)?.accessUrl ?? "").trim();
      if (!url) throw new Error("Lien d'invitation introuvable.");
      setInviteUrl(url);
      await navigator.clipboard.writeText(url);
      await refresh();
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
    try {
      const updated = row.archived_at ? await restoreIntervenant(row.id) : await archiveIntervenant(row.id);
      setRow(updated);
    } catch (err: any) {
      setError(err?.message ?? "Archivage impossible.");
    } finally {
      setSaving(false);
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
