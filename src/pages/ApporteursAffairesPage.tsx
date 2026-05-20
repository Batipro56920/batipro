import { useEffect, useMemo, useState } from "react";
import {
  createApporteurAffaire,
  createApporteurLead,
  createApporteurAccessToken,
  deleteApporteurAffaire,
  deleteApporteurLead,
  getApporteurAccessTokens,
  getApporteurDocuments,
  getApporteurLeads,
  getApporteursAffaires,
  updateApporteurAffaire,
  updateApporteurLead,
} from "../services/apporteurs.service";
import type {
  ApporteurAffaireRow,
  ApporteurCalculationMode,
  ApporteurLeadRow,
  ApporteurLeadStatus,
  ApporteurType,
  ApporteurAccessTokenRow,
} from "../services/apporteurs.service";

const APPORTREUR_TYPES: { value: ApporteurType; label: string }[] = [
  { value: "agent_immobilier", label: "Agent immobilier" },
  { value: "artisan", label: "Artisan" },
  { value: "architecte", label: "Architecte" },
  { value: "client", label: "Client" },
  { value: "partenaire", label: "Partenaire" },
  { value: "reseau", label: "Réseau" },
  { value: "autre", label: "Autre" },
];

const CALCULATION_MODES: { value: ApporteurCalculationMode; label: string }[] = [
  { value: "sur_estime", label: "Sur montant estimé" },
  { value: "sur_signe", label: "Sur montant signé" },
  { value: "fixe", label: "Forfait" },
];

const LEAD_STATUSES: { value: ApporteurLeadStatus; label: string }[] = [
  { value: "nouveau", label: "Nouveau" },
  { value: "contacte", label: "Contacté" },
  { value: "devis_envoye", label: "Devis envoyé" },
  { value: "signe", label: "Signé" },
  { value: "perdu", label: "Perdu" },
  { value: "commission_a_payer", label: "Commission à payer" },
  { value: "paye", label: "Payé" },
];

const DEFAULT_APPORTEUR_FORM = {
  id: "",
  nom: "",
  entreprise: "",
  type: "partenaire" as ApporteurType,
  telephone: "",
  email: "",
  commission_percent: 10,
  calculation_mode: "sur_estime" as ApporteurCalculationMode,
  iban: "",
  active: true,
  notes: "",
};

const DEFAULT_LEAD_FORM = {
  id: "",
  client_name: "",
  telephone: "",
  project_address: "",
  project_type: "",
  estimated_amount: 0,
  comment: "",
  apporteur_id: "",
  date: new Date().toISOString().slice(0, 10),
  status: "nouveau" as ApporteurLeadStatus,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0);
}

function calculateCommission(lead: ApporteurLeadRow, apporteur?: ApporteurAffaireRow) {
  if (!apporteur) return 0;
  if (apporteur.calculation_mode === "fixe") {
    return apporteur.commission_percent || 0;
  }
  return Math.round((lead.estimated_amount * (apporteur.commission_percent / 100)) * 100) / 100;
}

export default function ApporteursAffairesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [apporteurs, setApporteurs] = useState<ApporteurAffaireRow[]>([]);
  const [leads, setLeads] = useState<ApporteurLeadRow[]>([]);
  const [documents, setDocuments] = useState([] as { id: string; label: string; file_path: string }[]);
  const [accessTokens, setAccessTokens] = useState<Record<string, ApporteurAccessTokenRow>>({});

  const [selectedApporteurId, setSelectedApporteurId] = useState<string>("");
  const [apporteurForm, setApporteurForm] = useState<typeof DEFAULT_APPORTEUR_FORM>(DEFAULT_APPORTEUR_FORM);
  const [editingApporteurId, setEditingApporteurId] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState<typeof DEFAULT_LEAD_FORM>(DEFAULT_LEAD_FORM);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);

  const filteredLeads = useMemo(
    () => (selectedApporteurId ? leads.filter((row) => row.apporteur_id === selectedApporteurId) : leads),
    [leads, selectedApporteurId],
  );

  const totalLeads = filteredLeads.length;
  const totalCommission = filteredLeads.reduce((sum, lead) => sum + calculateCommission(lead, apporteurs.find((ap) => ap.id === lead.apporteur_id) ?? undefined), 0);
  const unpaidCommission = filteredLeads.filter((lead) => lead.status !== "paye").reduce((sum, lead) => sum + calculateCommission(lead, apporteurs.find((ap) => ap.id === lead.apporteur_id) ?? undefined), 0);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [apporteursData, leadsData, documentsData, tokens] = await Promise.all([
          getApporteursAffaires(),
          getApporteurLeads(),
          getApporteurDocuments(),
          getApporteurAccessTokens(),
        ]);
        setApporteurs(apporteursData);
        setLeads(leadsData);
        setDocuments(documentsData);
        setAccessTokens(
          tokens.reduce((acc, token) => {
            acc[token.apporteur_id] = token;
            return acc;
          }, {} as Record<string, ApporteurAccessTokenRow>),
        );
      } catch (err: any) {
        setError(err?.message ?? "Impossible de charger les apporteurs.");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  async function refreshData() {
    setError(null);
    setNotice(null);
    try {
      const [apporteursData, leadsData, documentsData, tokens] = await Promise.all([
        getApporteursAffaires(),
        getApporteurLeads(),
        getApporteurDocuments(),
        getApporteurAccessTokens(),
      ]);
      setApporteurs(apporteursData);
      setLeads(leadsData);
      setDocuments(documentsData);
      setAccessTokens(
        tokens.reduce((acc, token) => {
          acc[token.apporteur_id] = token;
          return acc;
        }, {} as Record<string, ApporteurAccessTokenRow>),
      );
    } catch (err: any) {
      setError(err?.message ?? "Impossible de rafraîchir les données.");
    }
  }

  async function onSaveApporteur() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (!apporteurForm.nom.trim()) {
        throw new Error("Le nom de l'apporteur est requis.");
      }
      const payload = {
        nom: apporteurForm.nom,
        entreprise: apporteurForm.entreprise || null,
        type: apporteurForm.type,
        telephone: apporteurForm.telephone || null,
        email: apporteurForm.email || null,
        commission_percent: Number(apporteurForm.commission_percent) || 0,
        calculation_mode: apporteurForm.calculation_mode,
        iban: apporteurForm.iban || null,
        active: apporteurForm.active,
        notes: apporteurForm.notes || null,
      };

      let result: ApporteurAffaireRow;
      if (editingApporteurId) {
        result = await updateApporteurAffaire(editingApporteurId, payload);
      } else {
        result = await createApporteurAffaire(payload);
      }

      setNotice(editingApporteurId ? "Apporteur mis à jour." : "Apporteur créé.");
      setEditingApporteurId(null);
      setApporteurForm(DEFAULT_APPORTEUR_FORM);
      await refreshData();
      setSelectedApporteurId(result.id);
    } catch (err: any) {
      setError(err?.message ?? "Impossible d'enregistrer l'apporteur.");
    } finally {
      setSaving(false);
    }
  }

  async function onEditApporteur(apporteur: ApporteurAffaireRow) {
    setEditingApporteurId(apporteur.id);
    setApporteurForm({
      id: apporteur.id,
      nom: apporteur.nom,
      entreprise: apporteur.entreprise ?? "",
      type: apporteur.type,
      telephone: apporteur.telephone ?? "",
      email: apporteur.email ?? "",
      commission_percent: apporteur.commission_percent,
      calculation_mode: apporteur.calculation_mode,
      iban: apporteur.iban ?? "",
      active: apporteur.active,
      notes: apporteur.notes ?? "",
    });
    setError(null);
    setNotice(null);
  }

  async function onRemoveApporteur(id: string) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await deleteApporteurAffaire(id);
      setNotice("Apporteur supprimé.");
      if (selectedApporteurId === id) setSelectedApporteurId("");
      await refreshData();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de supprimer l'apporteur.");
    } finally {
      setSaving(false);
    }
  }

  async function onGenerateToken(apporteurId: string) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const tokenRow = await createApporteurAccessToken(apporteurId);
      setAccessTokens((prev) => ({ ...prev, [apporteurId]: tokenRow }));
      setNotice("Lien apporteur créé.");
    } catch (err: any) {
      setError(err?.message ?? "Impossible de générer le lien apporteur.");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveLead() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (!leadForm.client_name.trim()) throw new Error("Le nom du client est requis.");
      if (!leadForm.apporteur_id) throw new Error("Un apporteur doit être sélectionné.");
      const payload = {
        apporteur_id: leadForm.apporteur_id,
        client_name: leadForm.client_name,
        telephone: leadForm.telephone || null,
        project_address: leadForm.project_address || null,
        project_type: leadForm.project_type || null,
        estimated_amount: Number(leadForm.estimated_amount) || 0,
        comment: leadForm.comment || null,
        date: leadForm.date,
        status: leadForm.status,
      };
      if (editingLeadId) {
        await updateApporteurLead(editingLeadId, payload);
      } else {
        await createApporteurLead(payload);
      }
      setNotice(editingLeadId ? "Lead mis à jour." : "Lead ajouté.");
      setEditingLeadId(null);
      setLeadForm({ ...DEFAULT_LEAD_FORM, apporteur_id: leadForm.apporteur_id });
      await refreshData();
    } catch (err: any) {
      setError(err?.message ?? "Impossible d'enregistrer le lead.");
    } finally {
      setSaving(false);
    }
  }

  async function onEditLead(lead: ApporteurLeadRow) {
    setEditingLeadId(lead.id);
    setLeadForm({
      id: lead.id,
      client_name: lead.client_name,
      telephone: lead.telephone ?? "",
      project_address: lead.project_address ?? "",
      project_type: lead.project_type ?? "",
      estimated_amount: lead.estimated_amount,
      comment: lead.comment ?? "",
      apporteur_id: lead.apporteur_id ?? "",
      date: lead.date.slice(0, 10),
      status: lead.status,
    });
    setError(null);
    setNotice(null);
  }

  async function onRemoveLead(id: string) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await deleteApporteurLead(id);
      setNotice("Lead supprimé.");
      await refreshData();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de supprimer le lead.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border bg-white p-8 text-sm text-slate-500">Chargement des apporteurs...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Apporteurs d’affaires</h1>
        <p className="text-slate-500">Centralisez vos partenaires, leads transmis et commissions.</p>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_minmax(320px,0.8fr)]">
        <section className="rounded-2xl border bg-white p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Apporteurs</div>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Liste des apporteurs</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingApporteurId(null);
                setApporteurForm(DEFAULT_APPORTEUR_FORM);
                setError(null);
                setNotice(null);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Nouveau apporteur
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {apporteurs.map((apporteur) => {
              const tokenRow = accessTokens[apporteur.id];
              return (
                <div key={apporteur.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{apporteur.nom}</div>
                      <div className="mt-1 text-sm text-slate-500">{apporteur.entreprise || "-"}</div>
                    </div>
                    <span className={['rounded-full px-3 py-1 text-xs font-semibold', apporteur.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'].join(' ')}>
                      {apporteur.active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div>Type: {APPORTREUR_TYPES.find((item) => item.value === apporteur.type)?.label}</div>
                    <div>Commission: {apporteur.commission_percent}%</div>
                    <div>Mode: {CALCULATION_MODES.find((item) => item.value === apporteur.calculation_mode)?.label}</div>
                    <div>Téléphone: {apporteur.telephone || '—'}</div>
                    <div>Email: {apporteur.email || '—'}</div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => { onEditApporteur(apporteur); }} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Modifier</button>
                    <button type="button" onClick={() => void onRemoveApporteur(apporteur.id)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100">Supprimer</button>
                    <button type="button" onClick={() => void onGenerateToken(apporteur.id)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Générer lien</button>
                  </div>
                  {tokenRow ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      <div className="font-semibold text-slate-900">Lien public apporteur</div>
                      <div className="mt-2 break-all">{window.location.origin}/apporteur/{tokenRow.token}</div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {apporteurs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">Aucun apporteur enregistré pour le moment.</div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-4 space-y-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Récapitulatif</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Apporteurs</div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">{apporteurs.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Leads</div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">{totalLeads}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Commission totale estimée</div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">{formatCurrency(totalCommission)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Commission non payée</div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">{formatCurrency(unpaidCommission)}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Documents</div>
            {documents.length ? (
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {documents.map((document) => (
                  <li key={document.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span>{document.label}</span>
                    <a href={document.file_path} target="_blank" rel="noreferrer" className="text-slate-700 underline">Ouvrir</a>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3 text-sm text-slate-500">Aucun document de paiement enregistré.</div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border bg-white p-4 space-y-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Formulaire apporteur</div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Nom</div>
              <input className="w-full rounded-xl border px-3 py-2 text-sm" value={apporteurForm.nom} onChange={(e) => setApporteurForm((prev) => ({ ...prev, nom: e.target.value }))} />
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Entreprise</div>
              <input className="w-full rounded-xl border px-3 py-2 text-sm" value={apporteurForm.entreprise} onChange={(e) => setApporteurForm((prev) => ({ ...prev, entreprise: e.target.value }))} />
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Type</div>
              <select className="w-full rounded-xl border px-3 py-2 text-sm" value={apporteurForm.type} onChange={(e) => setApporteurForm((prev) => ({ ...prev, type: e.target.value as ApporteurType }))}>
                {APPORTREUR_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Téléphone</div>
              <input className="w-full rounded-xl border px-3 py-2 text-sm" value={apporteurForm.telephone} onChange={(e) => setApporteurForm((prev) => ({ ...prev, telephone: e.target.value }))} />
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Email</div>
              <input className="w-full rounded-xl border px-3 py-2 text-sm" value={apporteurForm.email} onChange={(e) => setApporteurForm((prev) => ({ ...prev, email: e.target.value }))} />
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Commission %</div>
              <input type="number" step="0.1" className="w-full rounded-xl border px-3 py-2 text-sm" value={apporteurForm.commission_percent} onChange={(e) => setApporteurForm((prev) => ({ ...prev, commission_percent: Number(e.target.value) }))} />
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Mode de calcul</div>
              <select className="w-full rounded-xl border px-3 py-2 text-sm" value={apporteurForm.calculation_mode} onChange={(e) => setApporteurForm((prev) => ({ ...prev, calculation_mode: e.target.value as ApporteurCalculationMode }))}>
                {CALCULATION_MODES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">IBAN</div>
              <input className="w-full rounded-xl border px-3 py-2 text-sm" value={apporteurForm.iban} onChange={(e) => setApporteurForm((prev) => ({ ...prev, iban: e.target.value }))} />
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={apporteurForm.active} onChange={(e) => setApporteurForm((prev) => ({ ...prev, active: e.target.checked }))} />
              Actif
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <div className="text-xs text-slate-600">Notes</div>
              <textarea className="w-full rounded-xl border px-3 py-2 text-sm" value={apporteurForm.notes} onChange={(e) => setApporteurForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={saving} onClick={() => void onSaveApporteur()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-600">{editingApporteurId ? "Mettre à jour" : "Créer"}</button>
            <button type="button" onClick={() => { setEditingApporteurId(null); setApporteurForm(DEFAULT_APPORTEUR_FORM); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Réinitialiser</button>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-4 space-y-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Leads apportés</div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Apporteur</div>
              <select className="w-full rounded-xl border px-3 py-2 text-sm" value={leadForm.apporteur_id} onChange={(e) => setLeadForm((prev) => ({ ...prev, apporteur_id: e.target.value }))}>
                <option value="">Sélectionner un apporteur</option>
                {apporteurs.map((apporteur) => (
                  <option key={apporteur.id} value={apporteur.id}>{apporteur.nom}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Date</div>
              <input type="date" className="w-full rounded-xl border px-3 py-2 text-sm" value={leadForm.date} onChange={(e) => setLeadForm((prev) => ({ ...prev, date: e.target.value }))} />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <div className="text-xs text-slate-600">Client</div>
              <input className="w-full rounded-xl border px-3 py-2 text-sm" value={leadForm.client_name} onChange={(e) => setLeadForm((prev) => ({ ...prev, client_name: e.target.value }))} />
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Téléphone</div>
              <input className="w-full rounded-xl border px-3 py-2 text-sm" value={leadForm.telephone} onChange={(e) => setLeadForm((prev) => ({ ...prev, telephone: e.target.value }))} />
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Type de projet</div>
              <input className="w-full rounded-xl border px-3 py-2 text-sm" value={leadForm.project_type} onChange={(e) => setLeadForm((prev) => ({ ...prev, project_type: e.target.value }))} />
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Montant estimé</div>
              <input type="number" step="0.01" className="w-full rounded-xl border px-3 py-2 text-sm" value={leadForm.estimated_amount} onChange={(e) => setLeadForm((prev) => ({ ...prev, estimated_amount: Number(e.target.value) }))} />
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Statut</div>
              <select className="w-full rounded-xl border px-3 py-2 text-sm" value={leadForm.status} onChange={(e) => setLeadForm((prev) => ({ ...prev, status: e.target.value as ApporteurLeadStatus }))}>
                {LEAD_STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <div className="text-xs text-slate-600">Adresse projet</div>
              <input className="w-full rounded-xl border px-3 py-2 text-sm" value={leadForm.project_address} onChange={(e) => setLeadForm((prev) => ({ ...prev, project_address: e.target.value }))} />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <div className="text-xs text-slate-600">Commentaire</div>
              <textarea className="w-full rounded-xl border px-3 py-2 text-sm" value={leadForm.comment} onChange={(e) => setLeadForm((prev) => ({ ...prev, comment: e.target.value }))} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={saving} onClick={() => void onSaveLead()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-600">{editingLeadId ? "Enregistrer le lead" : "Ajouter le lead"}</button>
            <button type="button" onClick={() => { setEditingLeadId(null); setLeadForm(DEFAULT_LEAD_FORM); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Réinitialiser</button>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-white p-4">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Leads</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Tous les leads</h2>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-600">Filtrer par apporteur :</label>
            <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={selectedApporteurId} onChange={(e) => setSelectedApporteurId(e.target.value)}>
              <option value="">Tous</option>
              {apporteurs.map((row) => <option key={row.id} value={row.id}>{row.nom}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Client</th>
                <th className="px-4 py-3 text-left font-medium">Apporteur</th>
                <th className="px-4 py-3 text-left font-medium">Montant</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-left font-medium">Commission</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => {
                const apporteur = apporteurs.find((row) => row.id === lead.apporteur_id);
                return (
                  <tr key={lead.id} className="border-t border-slate-200">
                    <td className="px-4 py-3">{lead.client_name}</td>
                    <td className="px-4 py-3">{apporteur?.nom ?? "-"}</td>
                    <td className="px-4 py-3">{formatCurrency(lead.estimated_amount)}</td>
                    <td className="px-4 py-3">{LEAD_STATUSES.find((item) => item.value === lead.status)?.label}</td>
                    <td className="px-4 py-3">{formatCurrency(calculateCommission(lead, apporteur ?? undefined))}</td>
                    <td className="px-4 py-3">{lead.date}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      <button type="button" onClick={() => onEditLead(lead)} className="mr-2 text-blue-600 hover:underline">Modifier</button>
                      <button type="button" onClick={() => void onRemoveLead(lead.id)} className="text-red-600 hover:underline">Supprimer</button>
                    </td>
                  </tr>
                );
              })}
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">Aucun lead trouvé.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
