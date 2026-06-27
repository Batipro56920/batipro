import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
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
  ApporteurDocumentRow,
  ApporteurLeadRow,
  ApporteurLeadStatus,
  ApporteurType,
} from "../services/apporteurs.service";
import { loadCrmDataset, type CrmOpportunityRow, type CrmProspectRow } from "../services/crm.service";
import { createProspectWithInitialOpportunity, findOpenProjectForProspect } from "../services/crmWorkflow.service";

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
  { value: "sur_estime", label: "Pourcentage" },
  { value: "fixe", label: "Prix fixe par client" },
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
  apporteur_id: "",
  crm_project_id: "",
  date: new Date().toISOString().slice(0, 10),
  status: "nouveau" as ApporteurLeadStatus,
  comment: "",
};

type ProjectOption = {
  value: string;
  label: string;
  prospectId: string;
  opportunityId: string | null;
  clientName: string;
  telephone: string | null;
  projectAddress: string | null;
  projectType: string | null;
  estimatedAmount: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0);
}

function parseFrenchNumber(value: string) {
  const text = value.trim();
  if (!text || /[,.]$/.test(text) || text.startsWith("-")) return null;
  const normalized = text.includes(",")
    ? text.replace(/\s/g, "").replace(/\./g, "").replace(",", ".")
    : text.replace(/\s/g, "");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateCommission(lead: ApporteurLeadRow, apporteur?: ApporteurAffaireRow) {
  if (!apporteur) return 0;
  if (apporteur.calculation_mode === "fixe") return apporteur.commission_percent || 0;
  return Math.round((lead.estimated_amount * (apporteur.commission_percent / 100)) * 100) / 100;
}

function prospectName(prospect?: CrmProspectRow | null) {
  return [prospect?.prenom, prospect?.nom].filter(Boolean).join(" ") || prospect?.societe || prospect?.nom || "Client sans nom";
}

function optionLabel<T extends string>(items: Array<{ value: T; label: string }>, value: T) {
  return items.find((item) => item.value === value)?.label ?? value;
}

function statusClass(status: ApporteurLeadStatus) {
  if (status === "paye") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "commission_a_payer" || status === "signe") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (status === "perdu") return "bg-red-50 text-red-700 ring-red-200";
  if (status === "devis_envoye" || status === "contacte") return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function isPayableCommissionStatus(status: ApporteurLeadStatus) {
  return status === "signe" || status === "commission_a_payer";
}

function commissionStatusAction(status: ApporteurLeadStatus) {
  if (status === "signe") {
    return { nextStatus: "commission_a_payer" as ApporteurLeadStatus, label: "À payer", notice: "Commission marquée à payer." };
  }
  if (status === "commission_a_payer") {
    return { nextStatus: "paye" as ApporteurLeadStatus, label: "Marquer payé", notice: "Commission marquée payée." };
  }
  return null;
}

function portalLink(tokenRow?: ApporteurAccessTokenRow) {
  if (!tokenRow) return "";
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/apporteur/${tokenRow.token}`;
}

function crmProjectPathForLead(lead: ApporteurLeadRow) {
  if (lead.crm_opportunity_id) return `/projets/opportunity-${lead.crm_opportunity_id}`;
  if (lead.crm_prospect_id) return `/projets/prospect-${lead.crm_prospect_id}`;
  return "";
}

export default function ApporteursAffairesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [apporteurs, setApporteurs] = useState<ApporteurAffaireRow[]>([]);
  const [leads, setLeads] = useState<ApporteurLeadRow[]>([]);
  const [documents, setDocuments] = useState<ApporteurDocumentRow[]>([]);
  const [crmProspects, setCrmProspects] = useState<CrmProspectRow[]>([]);
  const [crmOpportunities, setCrmOpportunities] = useState<CrmOpportunityRow[]>([]);
  const [accessTokens, setAccessTokens] = useState<Record<string, ApporteurAccessTokenRow>>({});
  const [selectedApporteurId, setSelectedApporteurId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<ApporteurLeadStatus | "">("");
  const [apporteurForm, setApporteurForm] = useState(DEFAULT_APPORTEUR_FORM);
  const [showApporteurLayer, setShowApporteurLayer] = useState(false);
  const [editingApporteurId, setEditingApporteurId] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState(DEFAULT_LEAD_FORM);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);

  const selectedApporteur = useMemo(
    () => apporteurs.find((row) => row.id === selectedApporteurId) ?? null,
    [apporteurs, selectedApporteurId],
  );

  const projectOptions = useMemo<ProjectOption[]>(() => {
    const byProspect = new Map(crmProspects.map((prospect) => [prospect.id, prospect]));
    const opportunityOptions = crmOpportunities
      .filter((opportunity) => Boolean(opportunity.prospect_id))
      .map((opportunity) => {
        const prospect = byProspect.get(String(opportunity.prospect_id));
        return {
          value: `opportunity:${opportunity.id}`,
          label: `${opportunity.nom_affaire} - ${prospectName(prospect)}`,
          prospectId: String(opportunity.prospect_id),
          opportunityId: opportunity.id,
          clientName: prospectName(prospect),
          telephone: prospect?.telephone ?? prospect?.mobile ?? null,
          projectAddress: prospect?.adresse ?? null,
          projectType: prospect?.type_projet ?? opportunity.stage_key ?? null,
          estimatedAmount: opportunity.montant_estime || prospect?.budget_estime || 0,
        };
      });
    const opportunityProspectIds = new Set(opportunityOptions.map((option) => option.prospectId));
    const prospectOptions = crmProspects
      .filter((prospect) => !opportunityProspectIds.has(prospect.id))
      .map((prospect) => ({
        value: `prospect:${prospect.id}`,
        label: `${prospectName(prospect)}${prospect.type_projet ? ` - ${prospect.type_projet}` : ""}`,
        prospectId: prospect.id,
        opportunityId: null,
        clientName: prospectName(prospect),
        telephone: prospect.telephone ?? prospect.mobile ?? null,
        projectAddress: prospect.adresse ?? null,
        projectType: prospect.type_projet ?? null,
        estimatedAmount: prospect.budget_estime ?? 0,
      }));
    return [...opportunityOptions, ...prospectOptions].sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [crmOpportunities, crmProspects]);

  const apporteurScopedLeads = useMemo(
    () => (selectedApporteurId ? leads.filter((row) => row.apporteur_id === selectedApporteurId) : leads),
    [leads, selectedApporteurId],
  );

  const filteredLeads = useMemo(
    () => (selectedStatus ? apporteurScopedLeads.filter((row) => row.status === selectedStatus) : apporteurScopedLeads),
    [apporteurScopedLeads, selectedStatus],
  );

  const statusBreakdown = useMemo(
    () =>
      LEAD_STATUSES.map((status) => ({
        ...status,
        count: apporteurScopedLeads.filter((lead) => lead.status === status.value).length,
        commission: apporteurScopedLeads
          .filter((lead) => lead.status === status.value)
          .reduce((sum, lead) => sum + calculateCommission(lead, apporteurs.find((row) => row.id === lead.apporteur_id)), 0),
      })),
    [apporteurs, apporteurScopedLeads],
  );

  const stats = useMemo(() => {
    let totalCommission = 0;
    let unpaidCommission = 0;
    let converted = 0;
    for (const lead of filteredLeads) {
      const apporteur = apporteurs.find((row) => row.id === lead.apporteur_id);
      const commission = calculateCommission(lead, apporteur);
      totalCommission += commission;
      if (isPayableCommissionStatus(lead.status)) unpaidCommission += commission;
      if (lead.crm_opportunity_id || lead.crm_prospect_id) converted += 1;
    }
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
      const [apporteursData, leadsData, documentsData, tokens, crmData] = await Promise.all([
        getApporteursAffaires(),
        getApporteurLeads(),
        getApporteurDocuments(),
        getApporteurAccessTokens(),
        loadCrmDataset(),
      ]);
      setApporteurs(apporteursData);
      setLeads(leadsData);
      setDocuments(documentsData);
      setCrmProspects(crmData.prospects);
      setCrmOpportunities(crmData.opportunities);
      setAccessTokens(tokens.reduce((acc, token) => ({ ...acc, [token.apporteur_id]: token }), {} as Record<string, ApporteurAccessTokenRow>));
      setSelectedApporteurId((current) => current || apporteursData[0]?.id || "");
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les apporteurs.");
    } finally {
      if (initial) setLoading(false);
    }
  }

  function openCreateApporteurLayer() {
    setEditingApporteurId(null);
    setApporteurForm(DEFAULT_APPORTEUR_FORM);
    setShowApporteurLayer(true);
  }

  function closeApporteurLayer() {
    setShowApporteurLayer(false);
    setEditingApporteurId(null);
    setApporteurForm(DEFAULT_APPORTEUR_FORM);
  }

  function resetLeadForm(apporteurId = selectedApporteurId) {
    setEditingLeadId(null);
    setLeadForm({ ...DEFAULT_LEAD_FORM, apporteur_id: apporteurId });
  }

  async function onSaveApporteur() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (!apporteurForm.nom.trim()) throw new Error("Le nom de l'apporteur est requis.");
      const commissionValue = parseFrenchNumber(apporteurForm.commission_percent);
      if (commissionValue === null) {
        throw new Error(
          apporteurForm.calculation_mode === "fixe"
            ? "Renseignez un prix par client valide et positif."
            : "Renseignez un pourcentage négocié valide et positif.",
        );
      }
      const payload = {
        nom: apporteurForm.nom,
        entreprise: apporteurForm.entreprise || null,
        type: apporteurForm.type,
        telephone: apporteurForm.telephone || null,
        email: apporteurForm.email || null,
        commission_percent: commissionValue,
        calculation_mode: apporteurForm.calculation_mode,
        iban: apporteurForm.iban || null,
        active: apporteurForm.active,
        notes: apporteurForm.notes || null,
      };
      const result = editingApporteurId
        ? await updateApporteurAffaire(editingApporteurId, payload)
        : await createApporteurAffaire(payload);
      setNotice(editingApporteurId ? "Apporteur mis à jour." : "Apporteur créé.");
      closeApporteurLayer();
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
    setSelectedApporteurId(apporteur.id);
    setApporteurForm({
      nom: apporteur.nom,
      entreprise: apporteur.entreprise ?? "",
      type: apporteur.type,
      telephone: apporteur.telephone ?? "",
      email: apporteur.email ?? "",
      commission_percent: String(apporteur.commission_percent ?? 0),
      calculation_mode: apporteur.calculation_mode === "fixe" ? "fixe" : "sur_estime",
      iban: apporteur.iban ?? "",
      active: apporteur.active,
      notes: apporteur.notes ?? "",
    });
    setShowApporteurLayer(true);
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
      const apporteurId = leadForm.apporteur_id || selectedApporteurId;
      if (!apporteurId) throw new Error("Un apporteur doit être sélectionné.");
      if (!leadForm.crm_project_id) throw new Error("Sélectionnez le projet CRM à rattacher.");
      const project = projectOptions.find((option) => option.value === leadForm.crm_project_id);
      if (!project) throw new Error("Projet CRM introuvable.");
      const payload = {
        apporteur_id: apporteurId,
        client_name: project.clientName,
        telephone: project.telephone,
        project_address: project.projectAddress,
        project_type: project.projectType,
        estimated_amount: project.estimatedAmount,
        comment: leadForm.comment || null,
        date: leadForm.date,
        status: leadForm.status,
        crm_prospect_id: project.prospectId,
        crm_opportunity_id: project.opportunityId,
      };
      const savedLead = editingLeadId ? await updateApporteurLead(editingLeadId, payload) : await createApporteurLead(payload);
      const crmLinked = Boolean(savedLead.crm_opportunity_id || savedLead.crm_prospect_id);
      setNotice(
        crmLinked
          ? "Projet rattaché à l'apporteur et lié au CRM."
          : "Projet enregistré pour l'apporteur. La liaison CRM n'a pas pu être persistée sur ce schéma.",
      );
      resetLeadForm(apporteurId);
      await refreshData();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de rattacher le projet.");
    } finally {
      setSaving(false);
    }
  }

  function onEditLead(lead: ApporteurLeadRow) {
    setEditingLeadId(lead.id);
    if (lead.apporteur_id) setSelectedApporteurId(lead.apporteur_id);
    setLeadForm({
      apporteur_id: lead.apporteur_id ?? "",
      crm_project_id: lead.crm_opportunity_id ? `opportunity:${lead.crm_opportunity_id}` : lead.crm_prospect_id ? `prospect:${lead.crm_prospect_id}` : "",
      date: lead.date.slice(0, 10),
      status: lead.status,
      comment: lead.comment ?? "",
    });
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

  async function onUpdateLeadCommissionStatus(lead: ApporteurLeadRow) {
    const action = commissionStatusAction(lead.status);
    if (!action) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateApporteurLead(lead.id, { status: action.nextStatus });
      setNotice(action.notice);
      await refreshData();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de mettre à jour la commission.");
    } finally {
      setSaving(false);
    }
  }

  async function onCreateCrmProspectFromLead(lead: ApporteurLeadRow) {
    if (lead.crm_prospect_id) {
      setNotice("Ce lead est déjà relié à un projet CRM.");
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
      const prospect = await createProspectWithInitialOpportunity({
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
      const opportunity = await findOpenProjectForProspect(prospect.id);
      const savedLead = await updateApporteurLead(lead.id, {
        crm_prospect_id: prospect.id,
        crm_opportunity_id: opportunity?.id ?? null,
        status: lead.status === "nouveau" ? "contacte" : lead.status,
      });
      setNotice(
        savedLead.crm_opportunity_id
          ? "Projet commercial CRM créé et relié au lead apporteur."
          : "Prospect CRM créé et relié au lead apporteur. Le projet commercial reste à vérifier dans le CRM.",
      );
      await refreshData();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de créer le projet CRM depuis ce lead.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="bt-card rounded-xl p-8 text-sm text-slate-500">Chargement des apporteurs...</div>;

  return (
    <div className="bt-page space-y-5">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-title text-xs font-semibold uppercase tracking-[0.16em]">Commerce</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Apporteurs d'affaires</h1>
          <p className="mt-1 text-sm text-slate-500">Partenaires, projets rattachés, conversion CRM et commissions à suivre.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void refreshData()} className={secondaryButtonClass}>Rafraîchir</button>
          <button type="button" onClick={openCreateApporteurLayer} className={primaryButtonClass}>Créer un apporteur</button>
        </div>
      </header>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}

      <section className="grid gap-3 md:grid-cols-5">
        <Metric label="Apporteurs actifs" value={String(apporteurs.filter((row) => row.active).length)} />
        <Metric label="Projets rattachés" value={String(filteredLeads.length)} />
        <Metric label="Liens CRM" value={String(stats.converted)} />
        <Metric label="Commissions estimées" value={formatCurrency(stats.totalCommission)} />
        <Metric label="Commissions dues" value={formatCurrency(stats.unpaidCommission)} />
      </section>

      <section className="bt-card rounded-xl bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Pipeline commissions</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Répartition des projets apportés</h2>
          </div>
          {selectedStatus ? <button type="button" onClick={() => setSelectedStatus("")} className={secondaryButtonClass}>Tous les statuts</button> : null}
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-4 xl:grid-cols-7">
          {statusBreakdown.map((status) => (
            <button
              key={status.value}
              type="button"
              onClick={() => setSelectedStatus((current) => (current === status.value ? "" : status.value))}
              className={[
                "rounded-lg border px-3 py-3 text-left text-sm transition",
                selectedStatus === status.value ? statusClass(status.value) : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-blue-50",
              ].join(" ")}
            >
              <span className="block font-semibold">{status.label}</span>
              <span className="mt-2 flex items-center justify-between gap-2 text-xs opacity-80">
                <span>{status.count} projet{status.count > 1 ? "s" : ""}</span>
                <span>{formatCurrency(status.commission)}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="bt-card rounded-xl bg-white p-3">
            <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Apporteurs</div>
            <div className="space-y-2">
              {apporteurs.map((apporteur) => {
                const active = apporteur.id === selectedApporteurId;
                const leadCount = leads.filter((lead) => lead.apporteur_id === apporteur.id).length;
                return (
                  <button key={apporteur.id} type="button" onClick={() => { setSelectedApporteurId(apporteur.id); setSelectedStatus(""); resetLeadForm(apporteur.id); }} className={["w-full rounded-lg border px-3 py-3 text-left transition", active ? "border-blue-500 bg-blue-50" : "border-transparent hover:border-slate-200 hover:bg-slate-50"].join(" ")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-950">{apporteur.nom}</div><div className="mt-0.5 truncate text-xs text-slate-500">{apporteur.entreprise || optionLabel(APPORTREUR_TYPES, apporteur.type)}</div></div>
                      <span className={apporteur.active ? "status-ok" : "status-muted"}>{apporteur.active ? "Actif" : "Inactif"}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500"><span>{leadCount} projet{leadCount > 1 ? "s" : ""}</span><span>{apporteur.calculation_mode === "fixe" ? formatCurrency(apporteur.commission_percent) : `${apporteur.commission_percent}%`}</span></div>
                  </button>
                );
              })}
              {!apporteurs.length ? <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">Aucun apporteur enregistré.</div> : null}
            </div>
          </div>
        </aside>

        <div className="space-y-5">
          <section className="bt-card rounded-xl bg-white p-5">
            {selectedApporteur ? (
              <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Partenaire sélectionné</div><h2 className="mt-1 text-xl font-semibold text-slate-950">{selectedApporteur.nom}</h2><p className="mt-1 text-sm text-slate-500">{selectedApporteur.entreprise || optionLabel(APPORTREUR_TYPES, selectedApporteur.type)}</p></div>
                    <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onEditApporteur(selectedApporteur)} className={secondaryButtonClass}>Modifier</button><button type="button" onClick={() => void onGenerateToken(selectedApporteur.id)} className={secondaryButtonClass}>Générer lien</button><button type="button" disabled={saving} onClick={() => void onRemoveApporteur(selectedApporteur.id)} className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60">Supprimer</button></div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <Info label="Type" value={optionLabel(APPORTREUR_TYPES, selectedApporteur.type)} />
                    <Info label="Commission négociée" value={selectedApporteur.calculation_mode === "fixe" ? `${formatCurrency(selectedApporteur.commission_percent)} / client` : `${selectedApporteur.commission_percent}%`} />
                    <Info label="Mode" value={selectedApporteur.calculation_mode === "fixe" ? "Prix fixe" : "Pourcentage"} />
                    <Info label="Téléphone" value={selectedApporteur.telephone || "-"} />
                    <Info label="Email" value={selectedApporteur.email || "-"} />
                    <Info label="IBAN" value={selectedApporteur.iban || "-"} />
                  </div>
                  {accessTokens[selectedApporteur.id] ? <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900"><div className="font-semibold">Lien public apporteur</div><div className="mt-1 break-all">{portalLink(accessTokens[selectedApporteur.id])}</div></div> : null}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-950">Documents de paiement</div>
                  {documents.filter((document) => document.apporteur_id === selectedApporteur.id).length ? <ul className="mt-3 space-y-2 text-sm text-slate-600">{documents.filter((document) => document.apporteur_id === selectedApporteur.id).map((document) => <li key={document.id} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 ring-1 ring-slate-200"><span>{document.label}</span><a href={document.file_path} target="_blank" rel="noreferrer" className="text-blue-700 underline">Ouvrir</a></li>)}</ul> : <div className="mt-3 text-sm text-slate-500">Aucun document rattaché.</div>}
                </div>
              </div>
            ) : <div className="text-sm text-slate-500">Sélectionnez ou créez un apporteur.</div>}
          </section>

          <FormPanel title={editingLeadId ? "Modifier le rattachement" : "Rattacher un projet CRM"}>
            <div className="grid gap-3 md:grid-cols-2">
              <Select label="Apporteur" value={leadForm.apporteur_id || selectedApporteurId} onChange={(value) => setLeadForm((prev) => ({ ...prev, apporteur_id: value }))} options={apporteurs.map((apporteur) => ({ value: apporteur.id, label: apporteur.nom }))} placeholder="Sélectionner" />
              <Select label="Projet CRM" value={leadForm.crm_project_id} onChange={(value) => setLeadForm((prev) => ({ ...prev, crm_project_id: value }))} options={projectOptions.map((project) => ({ value: project.value, label: project.label }))} placeholder="Sélectionner un projet" />
              <Input label="Date de rattachement" type="date" value={leadForm.date} onChange={(value) => setLeadForm((prev) => ({ ...prev, date: value }))} />
              <Select label="Statut commission" value={leadForm.status} onChange={(value) => setLeadForm((prev) => ({ ...prev, status: value as ApporteurLeadStatus }))} options={LEAD_STATUSES} />
              <div className="md:col-span-2"><Textarea label="Commentaire interne" value={leadForm.comment} onChange={(value) => setLeadForm((prev) => ({ ...prev, comment: value }))} /></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={() => void onSaveLead()} className={primaryButtonClass}>{editingLeadId ? "Enregistrer" : "Rattacher le projet"}</button><button type="button" onClick={() => resetLeadForm()} className={secondaryButtonClass}>Réinitialiser</button></div>
          </FormPanel>
        </div>
      </section>

      <section className="bt-card rounded-xl bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Projets apportés</div><h2 className="mt-1 text-lg font-semibold text-slate-950">Suivi commercial et commissions</h2></div><div className="flex flex-wrap items-center gap-2"><select className={selectClass} value={selectedApporteurId} onChange={(event) => { setSelectedApporteurId(event.target.value); setSelectedStatus(""); }}><option value="">Tous les apporteurs</option>{apporteurs.map((row) => <option key={row.id} value={row.id}>{row.nom}</option>)}</select><select className={selectClass} value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as ApporteurLeadStatus | "")}><option value="">Tous les statuts</option>{LEAD_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></div></div>
        <div className="overflow-x-auto"><table className="bt-table min-w-full"><thead><tr><Th>Projet / client</Th><Th>Apporteur</Th><Th>Montant</Th><Th>Statut</Th><Th>Commission</Th><Th>CRM</Th><Th>Actions</Th></tr></thead><tbody>{filteredLeads.map((lead) => { const apporteur = apporteurs.find((row) => row.id === lead.apporteur_id); const crmPath = crmProjectPathForLead(lead); const linked = Boolean(crmPath); const commissionAction = commissionStatusAction(lead.status); return <tr key={lead.id}><Td><div className="font-semibold text-slate-950">{lead.client_name}</div><div className="text-xs text-slate-500">{lead.project_type || lead.project_address || lead.telephone || "-"}</div></Td><Td>{apporteur?.nom ?? "-"}</Td><Td>{formatCurrency(lead.estimated_amount)}</Td><Td><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(lead.status)}`}>{optionLabel(LEAD_STATUSES, lead.status)}</span></Td><Td>{formatCurrency(calculateCommission(lead, apporteur ?? undefined))}</Td><Td>{linked ? <Link to={crmPath} className="font-medium text-blue-700 hover:underline">Ouvrir projet</Link> : <span className="text-slate-500">À convertir</span>}</Td><Td><div className="flex flex-wrap gap-2"><button type="button" onClick={() => onEditLead(lead)} className="font-medium text-blue-700 hover:underline">Modifier</button>{commissionAction ? <button type="button" disabled={saving} onClick={() => void onUpdateLeadCommissionStatus(lead)} className="font-medium text-amber-700 hover:underline disabled:text-slate-400">{commissionAction.label}</button> : null}<button type="button" disabled={saving || linked} onClick={() => void onCreateCrmProspectFromLead(lead)} className="font-medium text-emerald-700 hover:underline disabled:text-slate-400">Créer projet CRM</button><button type="button" onClick={() => void onRemoveLead(lead.id)} className="font-medium text-red-600 hover:underline">Supprimer</button></div></Td></tr>; })}{!filteredLeads.length ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">Aucun projet rattaché.</td></tr> : null}</tbody></table></div>
      </section>

      {showApporteurLayer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div><div className="section-title text-xs font-semibold uppercase tracking-[0.14em]">Apporteur</div><h2 className="mt-1 text-xl font-bold text-slate-950">{editingApporteurId ? "Modifier l'apporteur" : "Créer un apporteur"}</h2><p className="mt-1 text-sm text-slate-500">Renseignez le contact et la commission négociée de base.</p></div>
              <button type="button" onClick={closeApporteurLayer} className={secondaryButtonClass}>Fermer</button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Input label="Nom" value={apporteurForm.nom} onChange={(value) => setApporteurForm((prev) => ({ ...prev, nom: value }))} />
              <Input label="Entreprise" value={apporteurForm.entreprise} onChange={(value) => setApporteurForm((prev) => ({ ...prev, entreprise: value }))} />
              <Select label="Type" value={apporteurForm.type} onChange={(value) => setApporteurForm((prev) => ({ ...prev, type: value as ApporteurType }))} options={APPORTREUR_TYPES} />
              <Select label="Type de commission" value={apporteurForm.calculation_mode} onChange={(value) => setApporteurForm((prev) => ({ ...prev, calculation_mode: value as ApporteurCalculationMode }))} options={CALCULATION_MODES} />
              <Input label="Téléphone" value={apporteurForm.telephone} onChange={(value) => setApporteurForm((prev) => ({ ...prev, telephone: value }))} />
              <Input label="Email" value={apporteurForm.email} onChange={(value) => setApporteurForm((prev) => ({ ...prev, email: value }))} />
              <Input label={apporteurForm.calculation_mode === "fixe" ? "Prix par client" : "Pourcentage négocié"} value={apporteurForm.commission_percent} onChange={(value) => setApporteurForm((prev) => ({ ...prev, commission_percent: value }))} inputMode="decimal" />
              <Input label="IBAN" value={apporteurForm.iban} onChange={(value) => setApporteurForm((prev) => ({ ...prev, iban: value }))} />
              <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={apporteurForm.active} onChange={(event) => setApporteurForm((prev) => ({ ...prev, active: event.target.checked }))} />Actif</label>
              <div className="md:col-span-2"><Textarea label="Notes" value={apporteurForm.notes} onChange={(value) => setApporteurForm((prev) => ({ ...prev, notes: value }))} /></div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={closeApporteurLayer} className={secondaryButtonClass}>Annuler</button><button type="button" disabled={saving} onClick={() => void onSaveApporteur()} className={primaryButtonClass}>{editingApporteurId ? "Mettre à jour" : "Créer l'apporteur"}</button></div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bt-card rounded-xl bg-white p-4"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div><div className="mt-2 text-xl font-bold text-slate-950">{value}</div></div>;
}

function FormPanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="bt-card rounded-xl bg-white p-4"><h2 className="text-sm font-semibold text-slate-950">{title}</h2><div className="mt-4">{children}</div></section>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-100 bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</div></div>;
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

function Th({ children }: { children: ReactNode }) {
  return <th>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="align-top">{children}</td>;
}

const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const selectClass = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const primaryButtonClass = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-600";
const secondaryButtonClass = "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700";
