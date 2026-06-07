import { useEffect, useMemo, useState } from "react";
import {
  createApporteurAffaire,
  createApporteurAccessToken,
  createApporteurLead,
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
  ApporteurAccessTokenRow,
  ApporteurAffaireRow,
  ApporteurCalculationMode,
  ApporteurLeadRow,
  ApporteurLeadStatus,
  ApporteurType,
} from "../services/apporteurs.service";
import { createCrmProspect } from "../services/crm.service";

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
  commission_percent: "10",
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
  estimated_amount: "0",
  comment: "",
  apporteur_id: "",
  date: new Date().toISOString().slice(0, 10),
  status: "nouveau" as ApporteurLeadStatus,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0);
}

function parseFrenchNumber(value: string) {
  const text = value.trim();
  if (!text) return 0;
  const normalized = text.includes(",")
    ? text.replace(/\s/g, "").replace(/\./g, "").replace(",", ".")
    : text.replace(/\s/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateCommission(lead: ApporteurLeadRow, apporteur?: ApporteurAffaireRow) {
  if (!apporteur) return 0;
  if (apporteur.calculation_mode === "fixe") return apporteur.commission_percent || 0;
  return Math.round((lead.estimated_amount * (apporteur.commission_percent / 100)) * 100) / 100;
}

function statusLabel(status: ApporteurLeadStatus) {
  return LEAD_STATUSES.find((item) => item.value === status)?.label ?? status;
}

function typeLabel(type: ApporteurType) {
  return APPORTREUR_TYPES.find((item) => item.value === type)?.label ?? type;
}

function calculationModeLabel(mode: ApporteurCalculationMode) {
  return CALCULATION_MODES.find((item) => item.value === mode)?.label ?? mode;
}

function statusClass(status: ApporteurLeadStatus) {
  if (status === "paye") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "commission_a_payer" || status === "signe") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (status === "perdu") return "bg-red-50 text-red-700 ring-red-200";
  if (status === "devis_envoye" || status === "contacte") return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function portalLink(tokenRow?: ApporteurAccessTokenRow) {
  if (!tokenRow) return "";
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/apporteur/${tokenRow.token}`;
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

  const selectedApporteur = useMemo(
    () => apporteurs.find((row) => row.id === selectedApporteurId) ?? null,
    [apporteurs, selectedApporteurId],
  );

  const filteredLeads = useMemo(
    () => (selectedApporteurId ? leads.filter((row) => row.apporteur_id === selectedApporteurId) : leads),
    [leads, selectedApporteurId],
  );

  const stats = useMemo(() => {
    const totalCommission = filteredLeads.reduce((sum, lead) => sum + calculateCommission(lead, apporteurs.find((ap) => ap.id === lead.apporteur_id) ?? undefined), 0);
    const unpaidCommission = filteredLeads
      .filter((lead) => lead.status !== "paye")
      .reduce((sum, lead) => sum + calculateCommission(lead, apporteurs.find((ap) => ap.id === lead.apporteur_id) ?? undefined), 0);
    const converted = filteredLeads.filter((lead) => Boolean(lead.crm_prospect_id)).length;
    return { totalCommission, unpaidCommission, converted };
  }, [apporteurs, filteredLeads]);

  useEffect(() => {
    void refreshData(true);
  }, []);

  async function refreshData(initial = false) {
    if (initial) setLoading(true);
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
      setAccessTokens(tokens.reduce((acc, token) => ({ ...acc, [token.apporteur_id]: token }), {} as Record<string, ApporteurAccessTokenRow>));
      setSelectedApporteurId((current) => current || apporteursData[0]?.id || "");
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les apporteurs.");
    } finally {
      if (initial) setLoading(false);
    }
  }

  function resetApporteurForm() {
    setEditingApporteurId(null);
    setApporteurForm(DEFAULT_APPORTEUR_FORM);
    setError(null);
    setNotice(null);
  }

  function resetLeadForm(apporteurId = selectedApporteurId) {
    setEditingLeadId(null);
    setLeadForm({ ...DEFAULT_LEAD_FORM, apporteur_id: apporteurId });
    setError(null);
    setNotice(null);
  }

  async function onSaveApporteur() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (!apporteurForm.nom.trim()) throw new Error("Le nom de l'apporteur est requis.");
      const payload = {
        nom: apporteurForm.nom,
        entreprise: apporteurForm.entreprise || null,
        type: apporteurForm.type,
        telephone: apporteurForm.telephone || null,
        email: apporteurForm.email || null,
        commission_percent: parseFrenchNumber(apporteurForm.commission_percent),
        calculation_mode: apporteurForm.calculation_mode,
        iban: apporteurForm.iban || null,
        active: apporteurForm.active,
        notes: apporteurForm.notes || null,
      };
      const result = editingApporteurId
        ? await updateApporteurAffaire(editingApporteurId, payload)
        : await createApporteurAffaire(payload);
      setNotice(editingApporteurId ? "Apporteur mis à jour." : "Apporteur créé.");
      resetApporteurForm();
      await refreshData();
      setSelectedApporteurId(result.id);
      resetLeadForm(result.id);
    } catch (err: any) {
      setError(err?.message ?? "Impossible d'enregistrer l'apporteur.");
    } finally {
      setSaving(false);
    }
  }

  function onEditApporteur(apporteur: ApporteurAffaireRow) {
    setEditingApporteurId(apporteur.id);
    setApporteurForm({
      id: apporteur.id,
      nom: apporteur.nom,
      entreprise: apporteur.entreprise ?? "",
      type: apporteur.type,
      telephone: apporteur.telephone ?? "",
      email: apporteur.email ?? "",
      commission_percent: String(apporteur.commission_percent ?? 0),
      calculation_mode: apporteur.calculation_mode,
      iban: apporteur.iban ?? "",
      active: apporteur.active,
      notes: apporteur.notes ?? "",
    });
    setSelectedApporteurId(apporteur.id);
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
        estimated_amount: parseFrenchNumber(leadForm.estimated_amount),
        comment: leadForm.comment || null,
        date: leadForm.date,
        status: leadForm.status,
      };
      if (editingLeadId) await updateApporteurLead(editingLeadId, payload);
      else await createApporteurLead(payload);
      setNotice(editingLeadId ? "Lead mis à jour." : "Lead ajouté.");
      resetLeadForm(leadForm.apporteur_id);
      await refreshData();
    } catch (err: any) {
      setError(err?.message ?? "Impossible d'enregistrer le lead.");
    } finally {
      setSaving(false);
    }
  }

  function onEditLead(lead: ApporteurLeadRow) {
    setEditingLeadId(lead.id);
    setLeadForm({
      id: lead.id,
      client_name: lead.client_name,
      telephone: lead.telephone ?? "",
      project_address: lead.project_address ?? "",
      project_type: lead.project_type ?? "",
      estimated_amount: String(lead.estimated_amount ?? 0),
      comment: lead.comment ?? "",
      apporteur_id: lead.apporteur_id ?? "",
      date: lead.date.slice(0, 10),
      status: lead.status,
    });
    if (lead.apporteur_id) setSelectedApporteurId(lead.apporteur_id);
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

  async function onCreateCrmProspectFromLead(lead: ApporteurLeadRow) {
    if (lead.crm_prospect_id) {
      setNotice("Ce lead est déjà relié à un prospect CRM.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const apporteur = apporteurs.find((row) => row.id === lead.apporteur_id);
      const apporteurLabel = [apporteur?.nom, apporteur?.entreprise].filter(Boolean).join(" - ") || null;
      const description = [
        lead.comment,
        lead.project_address ? `Adresse projet : ${lead.project_address}` : null,
        apporteurLabel ? `Apporteur : ${apporteurLabel}` : null,
      ].filter(Boolean).join("\n");
      const prospect = await createCrmProspect({
        type: "particulier",
        nom: lead.client_name,
        telephone: lead.telephone,
        adresse: lead.project_address,
        source_acquisition: "Apporteur d'affaires",
        apporteur_affaire: apporteurLabel,
        budget_estime: lead.estimated_amount || null,
        type_projet: lead.project_type,
        description_besoin: description || null,
        notes: lead.comment,
        tags: ["apporteur"],
        statut: lead.status === "nouveau" ? "a_qualifier" : "qualifie",
      });
      await updateApporteurLead(lead.id, {
        crm_prospect_id: prospect.id,
        status: lead.status === "nouveau" ? "contacte" : lead.status,
      });
      setNotice("Prospect CRM créé depuis le lead apporteur.");
      await refreshData();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de créer le prospect CRM depuis ce lead.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border bg-white p-8 text-sm text-slate-500">Chargement des apporteurs...</div>;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Commerce</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Apporteurs d'affaires</h1>
          <p className="mt-1 text-sm text-slate-500">Partenaires, leads transmis, conversion CRM et commissions à suivre.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void refreshData()} className={secondaryButtonClass}>Rafraîchir</button>
          <button type="button" onClick={resetApporteurForm} className={primaryButtonClass}>Nouvel apporteur</button>
        </div>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Apporteurs actifs" value={String(apporteurs.filter((row) => row.active).length)} />
        <Metric label="Leads suivis" value={String(filteredLeads.length)} />
        <Metric label="Prospects CRM" value={String(stats.converted)} />
        <Metric label="Commissions dues" value={formatCurrency(stats.unpaidCommission)} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Apporteurs</div>
            <div className="space-y-2">
              {apporteurs.map((apporteur) => {
                const active = apporteur.id === selectedApporteurId;
                const leadCount = leads.filter((lead) => lead.apporteur_id === apporteur.id).length;
                return (
                  <button
                    key={apporteur.id}
                    type="button"
                    onClick={() => { setSelectedApporteurId(apporteur.id); resetLeadForm(apporteur.id); }}
                    className={[
                      "w-full rounded-xl border px-3 py-3 text-left transition",
                      active ? "border-blue-300 bg-blue-50" : "border-transparent hover:border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-950">{apporteur.nom}</div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">{apporteur.entreprise || typeLabel(apporteur.type)}</div>
                      </div>
                      <span className={apporteur.active ? "status-ok" : "status-muted"}>{apporteur.active ? "Actif" : "Inactif"}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>{leadCount} lead{leadCount > 1 ? "s" : ""}</span>
                      <span>{apporteur.calculation_mode === "fixe" ? formatCurrency(apporteur.commission_percent) : `${apporteur.commission_percent}%`}</span>
                    </div>
                  </button>
                );
              })}
              {!apporteurs.length ? <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Aucun apporteur enregistré.</div> : null}
            </div>
          </div>

          <FormPanel title={editingApporteurId ? "Modifier l'apporteur" : "Créer un apporteur"}>
            <div className="grid gap-3">
              <Input label="Nom" value={apporteurForm.nom} onChange={(value) => setApporteurForm((prev) => ({ ...prev, nom: value }))} />
              <Input label="Entreprise" value={apporteurForm.entreprise} onChange={(value) => setApporteurForm((prev) => ({ ...prev, entreprise: value }))} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Type" value={apporteurForm.type} onChange={(value) => setApporteurForm((prev) => ({ ...prev, type: value as ApporteurType }))} options={APPORTREUR_TYPES} />
                <Select label="Calcul" value={apporteurForm.calculation_mode} onChange={(value) => setApporteurForm((prev) => ({ ...prev, calculation_mode: value as ApporteurCalculationMode }))} options={CALCULATION_MODES} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Téléphone" value={apporteurForm.telephone} onChange={(value) => setApporteurForm((prev) => ({ ...prev, telephone: value }))} />
                <Input label="Email" value={apporteurForm.email} onChange={(value) => setApporteurForm((prev) => ({ ...prev, email: value }))} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Commission" value={apporteurForm.commission_percent} onChange={(value) => setApporteurForm((prev) => ({ ...prev, commission_percent: value }))} inputMode="decimal" />
                <Input label="IBAN" value={apporteurForm.iban} onChange={(value) => setApporteurForm((prev) => ({ ...prev, iban: value }))} />
              </div>
              <label className="flex items-center gap-3 text-sm text-slate-700">
                <input type="checkbox" checked={apporteurForm.active} onChange={(e) => setApporteurForm((prev) => ({ ...prev, active: e.target.checked }))} />
                Actif
              </label>
              <Textarea label="Notes" value={apporteurForm.notes} onChange={(value) => setApporteurForm((prev) => ({ ...prev, notes: value }))} />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={saving} onClick={() => void onSaveApporteur()} className={primaryButtonClass}>{editingApporteurId ? "Mettre à jour" : "Créer"}</button>
                <button type="button" onClick={resetApporteurForm} className={secondaryButtonClass}>Réinitialiser</button>
              </div>
            </div>
          </FormPanel>
        </aside>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            {selectedApporteur ? (
              <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Partenaire sélectionné</div>
                      <h2 className="mt-1 text-xl font-semibold text-slate-950">{selectedApporteur.nom}</h2>
                      <p className="mt-1 text-sm text-slate-500">{selectedApporteur.entreprise || typeLabel(selectedApporteur.type)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => onEditApporteur(selectedApporteur)} className={secondaryButtonClass}>Modifier</button>
                      <button type="button" onClick={() => void onGenerateToken(selectedApporteur.id)} className={secondaryButtonClass}>Générer lien</button>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <Info label="Type" value={typeLabel(selectedApporteur.type)} />
                    <Info label="Commission" value={selectedApporteur.calculation_mode === "fixe" ? formatCurrency(selectedApporteur.commission_percent) : `${selectedApporteur.commission_percent}%`} />
                    <Info label="Mode" value={calculationModeLabel(selectedApporteur.calculation_mode)} />
                    <Info label="Téléphone" value={selectedApporteur.telephone || "-"} />
                    <Info label="Email" value={selectedApporteur.email || "-"} />
                    <Info label="IBAN" value={selectedApporteur.iban || "-"} />
                  </div>
                  {accessTokens[selectedApporteur.id] ? (
                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
                      <div className="font-semibold">Lien public apporteur</div>
                      <div className="mt-1 break-all">{portalLink(accessTokens[selectedApporteur.id])}</div>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-950">Documents de paiement</div>
                  {documents.filter((document: any) => document.apporteur_id === selectedApporteur.id).length ? (
                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                      {documents.filter((document: any) => document.apporteur_id === selectedApporteur.id).map((document) => (
                        <li key={document.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                          <span>{document.label}</span>
                          <a href={document.file_path} target="_blank" rel="noreferrer" className="text-blue-700 underline">Ouvrir</a>
                        </li>
                      ))}
                    </ul>
                  ) : <div className="mt-3 text-sm text-slate-500">Aucun document rattaché.</div>}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">Sélectionnez ou créez un apporteur.</div>
            )}
          </section>

          <FormPanel title={editingLeadId ? "Modifier le lead" : "Ajouter un lead apporté"}>
            <div className="grid gap-3 md:grid-cols-2">
              <Select label="Apporteur" value={leadForm.apporteur_id || selectedApporteurId} onChange={(value) => setLeadForm((prev) => ({ ...prev, apporteur_id: value }))} options={apporteurs.map((apporteur) => ({ value: apporteur.id, label: apporteur.nom }))} placeholder="Sélectionner" />
              <Input label="Date" type="date" value={leadForm.date} onChange={(value) => setLeadForm((prev) => ({ ...prev, date: value }))} />
              <Input label="Client" value={leadForm.client_name} onChange={(value) => setLeadForm((prev) => ({ ...prev, client_name: value }))} />
              <Input label="Téléphone" value={leadForm.telephone} onChange={(value) => setLeadForm((prev) => ({ ...prev, telephone: value }))} />
              <Input label="Type de projet" value={leadForm.project_type} onChange={(value) => setLeadForm((prev) => ({ ...prev, project_type: value }))} />
              <Input label="Montant estimé" inputMode="decimal" value={leadForm.estimated_amount} onChange={(value) => setLeadForm((prev) => ({ ...prev, estimated_amount: value }))} />
              <Select label="Statut interne" value={leadForm.status} onChange={(value) => setLeadForm((prev) => ({ ...prev, status: value as ApporteurLeadStatus }))} options={LEAD_STATUSES} />
              <Input label="Adresse projet" value={leadForm.project_address} onChange={(value) => setLeadForm((prev) => ({ ...prev, project_address: value }))} />
              <div className="md:col-span-2"><Textarea label="Commentaire" value={leadForm.comment} onChange={(value) => setLeadForm((prev) => ({ ...prev, comment: value }))} /></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={saving} onClick={() => void onSaveLead()} className={primaryButtonClass}>{editingLeadId ? "Enregistrer le lead" : "Ajouter le lead"}</button>
              <button type="button" onClick={() => resetLeadForm()} className={secondaryButtonClass}>Réinitialiser</button>
            </div>
          </FormPanel>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Leads</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Suivi commercial et commissions</h2>
          </div>
          <select className={selectClass} value={selectedApporteurId} onChange={(e) => setSelectedApporteurId(e.target.value)}>
            <option value="">Tous les apporteurs</option>
            {apporteurs.map((row) => <option key={row.id} value={row.id}>{row.nom}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <Th>Client</Th><Th>Apporteur</Th><Th>Montant</Th><Th>Statut</Th><Th>Commission</Th><Th>CRM</Th><Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => {
                const apporteur = apporteurs.find((row) => row.id === lead.apporteur_id);
                return (
                  <tr key={lead.id} className="border-t border-slate-100">
                    <Td><div className="font-semibold text-slate-950">{lead.client_name}</div><div className="text-xs text-slate-500">{lead.telephone || lead.project_address || "-"}</div></Td>
                    <Td>{apporteur?.nom ?? "-"}</Td>
                    <Td>{formatCurrency(lead.estimated_amount)}</Td>
                    <Td><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(lead.status)}`}>{statusLabel(lead.status)}</span></Td>
                    <Td>{formatCurrency(calculateCommission(lead, apporteur ?? undefined))}</Td>
                    <Td>{lead.crm_prospect_id ? "Prospect créé" : "À convertir"}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => onEditLead(lead)} className="text-blue-700 hover:underline">Modifier</button>
                        <button type="button" disabled={saving || Boolean(lead.crm_prospect_id)} onClick={() => void onCreateCrmProspectFromLead(lead)} className="text-emerald-700 hover:underline disabled:text-slate-400">Créer prospect</button>
                        <button type="button" onClick={() => void onRemoveLead(lead.id)} className="text-red-600 hover:underline">Supprimer</button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
              {!filteredLeads.length ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">Aucun lead trouvé.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div><div className="mt-2 text-2xl font-bold text-slate-950">{value}</div></div>;
}

function FormPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="text-sm font-semibold text-slate-950">{title}</h2><div className="mt-4">{children}</div></section>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</div></div>;
}

function Input({ label, value, onChange, type = "text", inputMode }: { label: string; value: string; onChange: (value: string) => void; type?: string; inputMode?: "decimal" }) {
  return <label className="block text-sm"><span className="text-xs font-medium text-slate-600">{label}</span><input type={type} inputMode={inputMode} className={`${inputClass} mt-1`} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm"><span className="text-xs font-medium text-slate-600">{label}</span><textarea className={`${inputClass} mt-1 min-h-20`} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; placeholder?: string }) {
  return <label className="block text-sm"><span className="text-xs font-medium text-slate-600">{label}</span><select className={`${selectClass} mt-1 w-full`} value={value} onChange={(event) => onChange(event.target.value)}>{placeholder ? <option value="">{placeholder}</option> : null}{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300";
const selectClass = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300";
const primaryButtonClass = "rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-600";
const secondaryButtonClass = "rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
