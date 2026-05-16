import { useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createCrmAppointment,
  createCrmClient,
  createCrmDocument,
  createCrmInvoice,
  createCrmProspect,
  createCrmQuote,
  createCrmPaymentTerm,
  createCrmPurchase,
  createCrmQuoteComponent,
  createCrmQuoteItemFromTemplate,
  createCrmQuoteLot,
  createCrmQuoteSection,
  createCrmSav,
  createCrmTask,
  downloadCrmQuotePdf,
  loadCrmDataset,
  loadCrmQuoteEngineData,
  moveCrmOpportunityStage,
  recalculateCrmQuoteTotals,
  transformAcceptedQuoteToChantier,
  updateCrmProspect,
  updateCrmQuote,
  updateCrmTask,
  upsertCrmOpportunity,
  convertProspectToClient,
  type CrmAppointmentRow,
  type CrmClientRow,
  type CrmDataset,
  type CrmOpportunityRow,
  type CrmProspectRow,
  type CrmQuoteRow,
  type CrmQuoteEngineData,
  type CrmTaskRow,
} from "../services/crm.service";
import { buildQuoteDefaults, getCompanyQuoteSettings } from "../features/quotes/infrastructure/companyQuoteSettingsRepository";
import { ErrorAlert, LoadingState, ModuleTabs, StatCard } from "../components/ui/design-system";

type CrmSection =
  | "dashboard"
  | "prospects"
  | "clients"
  | "opportunities"
  | "quotes"
  | "invoices"
  | "purchases"
  | "contacts"
  | "resources"
  | "library"
  | "agenda"
  | "sav"
  | "stats"
  | "settings";

type Props = {
  section?: CrmSection;
};

const EMPTY_DATASET: CrmDataset = {
  prospects: [],
  clients: [],
  opportunities: [],
  quotes: [],
  tasks: [],
  appointments: [],
  sav: [],
  stages: [],
  documents: [],
  communications: [],
  invoices: [],
  purchases: [],
  chantiers: [],
  taskTemplates: [],
};

const NAV: Array<{ key: CrmSection; label: string; href: string }> = [
  { key: "dashboard", label: "Dashboard", href: "/crm" },
  { key: "prospects", label: "Prospects", href: "/crm/prospects" },
  { key: "clients", label: "Clients", href: "/crm/clients" },
  { key: "opportunities", label: "Opportunités", href: "/crm/opportunites" },
  { key: "quotes", label: "Devis", href: "/crm/devis" },
  { key: "invoices", label: "Factures", href: "/crm/factures" },
  { key: "purchases", label: "Achats", href: "/crm/achats" },
  { key: "contacts", label: "Contacts", href: "/crm/contacts" },
  { key: "resources", label: "Ressources", href: "/crm/ressources" },
  { key: "library", label: "Bibliothèque", href: "/crm/bibliotheque" },
  { key: "agenda", label: "Agenda", href: "/crm/agenda" },
  { key: "sav", label: "SAV", href: "/crm/sav" },
  { key: "stats", label: "Statistiques", href: "/crm/statistiques" },
  { key: "settings", label: "Paramètres", href: "/crm/parametres" },
];

const CRM_NAV = NAV.map((item) => {
  const labels: Partial<Record<CrmSection, string>> = {
    opportunities: "Opportunités",
    library: "Bibliothèque",
    settings: "Paramètres",
  };
  return labels[item.key] ? { ...item, label: labels[item.key] as string } : item;
});

function eur(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function dateOnly(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
}

function entityLabel(row: Pick<CrmProspectRow | CrmClientRow, "prenom" | "nom" | "societe" | "email"> | null | undefined) {
  if (!row) return "—";
  return [row.prenom, row.nom].filter(Boolean).join(" ") || row.societe || row.email || "Sans nom";
}

function statusPill(status: string) {
  const danger = ["perdu", "refuse", "expire", "ouvert"].includes(status);
  const ok = ["gagne", "accepte", "signe", "clos", "terminee"].includes(status);
  return [
    "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
    ok
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : danger
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-slate-50 text-slate-700",
  ].join(" ");
}

function CrmModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4" onClick={onClose}>
      <div className="mx-auto my-8 max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-950/10" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50">
            Fermer
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function SelectEntity({
  prospects,
  clients,
  prospectId,
  clientId,
  setProspectId,
  setClientId,
}: {
  prospects: CrmProspectRow[];
  clients: CrmClientRow[];
  prospectId: string;
  clientId: string;
  setProspectId: (value: string) => void;
  setClientId: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-1 text-sm">
        <div className="text-slate-600">Prospect</div>
        <select className="w-full rounded-xl border px-3 py-2" value={prospectId} onChange={(e) => setProspectId(e.target.value)}>
          <option value="">Aucun</option>
          {prospects.map((row) => (
            <option key={row.id} value={row.id}>{entityLabel(row)}</option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <div className="text-slate-600">Client</div>
        <select className="w-full rounded-xl border px-3 py-2" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Aucun</option>
          {clients.map((row) => (
            <option key={row.id} value={row.id}>{entityLabel(row)}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

export default function CrmPage({ section = "dashboard" }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<CrmDataset>(EMPTY_DATASET);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<null | "prospect" | "client" | "opportunity" | "quote" | "task" | "appointment" | "sav" | "document" | "invoice" | "purchase">(null);
  const [dragOpportunityId, setDragOpportunityId] = useState<string | null>(null);
  const [quoteEngine, setQuoteEngine] = useState<CrmQuoteEngineData | null>(null);
  const [quoteEngineLoading, setQuoteEngineLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setData(await loadCrmDataset());
    } catch (err: any) {
      setError(err?.message ?? "Erreur chargement CRM.");
      setData(EMPTY_DATASET);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const prospectById = useMemo(() => new Map(data.prospects.map((row) => [row.id, row])), [data.prospects]);
  const clientById = useMemo(() => new Map(data.clients.map((row) => [row.id, row])), [data.clients]);
  const opportunityById = useMemo(() => new Map(data.opportunities.map((row) => [row.id, row])), [data.opportunities]);
  const quoteById = useMemo(() => new Map(data.quotes.map((row) => [row.id, row])), [data.quotes]);
  const activeProspects = data.prospects.filter((row) => !["gagne", "perdu", "archive"].includes(row.statut));
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const today = now.toISOString().slice(0, 10);

  const kpis = {
    activeProspects: activeProspects.length,
    newProspectsWeek: data.prospects.filter((row) => new Date(row.created_at) >= weekAgo).length,
    quotesPending: data.quotes.filter((row) => !["accepte", "refuse", "expire"].includes(row.statut)).length,
    quotesSigned: data.quotes.filter((row) => row.statut === "accepte").length,
    quotesRefused: data.quotes.filter((row) => row.statut === "refuse").length,
    signedRevenue: data.quotes.filter((row) => row.statut === "accepte").reduce((sum, row) => sum + Number(row.montant_ht ?? 0), 0),
    pipelineRevenue: data.opportunities.filter((row) => row.status === "ouverte").reduce((sum, row) => sum + Number(row.montant_estime ?? 0), 0),
    overdueTasks: data.tasks.filter((row) => row.statut !== "terminee" && row.due_at && row.due_at.slice(0, 10) < today).length,
    appointmentsToday: data.appointments.filter((row) => row.starts_at.slice(0, 10) === today).length,
    openSav: data.sav.filter((row) => row.statut !== "clos").length,
    chantierRevenue: data.chantiers.filter((row) => row.crm_quote_id).reduce((sum, row) => sum + Number(row.signed_quote_amount_ht ?? 0), 0),
    crmActiveChantiers: data.chantiers.filter((row) => row.crm_quote_id && ["PREPARATION", "EN_COURS", "EN_PAUSE"].includes(row.status)).length,
    crmFinishedChantiers: data.chantiers.filter((row) => row.crm_quote_id && row.status === "TERMINE").length,
  };
  const transformationRate = data.quotes.length ? Math.round((kpis.quotesSigned / data.quotes.length) * 100) : 0;

  const filteredProspects = data.prospects.filter((row) =>
    [entityLabel(row), row.email, row.telephone, row.ville, row.type_projet, row.statut].join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  const filteredClients = data.clients.filter((row) =>
    [entityLabel(row), row.email, row.telephone, row.ville, row.societe].join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  const filteredQuotes = data.quotes.filter((row) =>
    [row.quote_number, row.description, row.statut, entityLabel(clientById.get(row.client_id ?? "")), entityLabel(prospectById.get(row.prospect_id ?? ""))]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  async function submitSafely(action: () => Promise<unknown>) {
    setSaving(true);
    setError(null);
    try {
      await action();
      setModal(null);
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? "Action CRM impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function transformQuote(row: CrmQuoteRow) {
    await submitSafely(async () => {
      const prospect = row.prospect_id ? prospectById.get(row.prospect_id) ?? null : null;
      const client = row.client_id ? clientById.get(row.client_id) ?? null : null;
      const opportunity = row.opportunity_id ? opportunityById.get(row.opportunity_id) ?? null : null;
      await transformAcceptedQuoteToChantier({ quote: row.statut === "accepte" ? row : await updateCrmQuote(row.id, { statut: "accepte" }), prospect, client, opportunity });
    });
  }

  async function createDraftQuoteAndOpen() {
    await submitSafely(async () => {
      const settings = await getCompanyQuoteSettings();
      const defaults = buildQuoteDefaults(settings);
      const quote = await createCrmQuote({
        quote_number: defaults.quoteNumber,
        statut: "brouillon",
        description: "Nouveau devis",
        valid_until: defaults.validUntil,
        date_emission: new Date().toISOString().slice(0, 10),
        tva: settings.defaultVatRate,
        acompte_percent: settings.defaultDepositPercent,
        payment_terms_text: settings.defaultPaymentTerms,
        legal_mentions: { text: settings.defaultLegalMentions } as any,
        waste_management: { text: settings.defaultWasteManagement } as any,
        display_options: defaults.displayOptions as any,
      });
      navigate(`/crm/devis/${quote.id}/edit`);
    });
  }

  async function openQuoteEngine(row: CrmQuoteRow) {
    setQuoteEngineLoading(true);
    setError(null);
    try {
      setQuoteEngine(await loadCrmQuoteEngineData(row.id));
    } catch (err: any) {
      setError(err?.message ?? "Chargement du devis impossible.");
    } finally {
      setQuoteEngineLoading(false);
    }
  }

  async function addQuoteTemplateLine(payload: {
    quoteId: string;
    sectionId: string;
    lotTitle: string;
    templateId: string;
    quantity: string;
    marginRate: string;
    coefficient: string;
    tvaRate: string;
  }) {
    await submitSafely(async () => {
      const template = data.taskTemplates.find((row) => row.id === payload.templateId) ?? null;
      const existing = await loadCrmQuoteEngineData(payload.quoteId).catch(() => null);
      const lot =
        existing?.lots.find((row) => row.title.toLowerCase() === payload.lotTitle.trim().toLowerCase()) ??
        (await createCrmQuoteLot({ quote_id: payload.quoteId, title: payload.lotTitle || template?.lot || "Lot principal", ordre: existing?.lots.length ?? 0 }));
      await createCrmQuoteItemFromTemplate({
        quote_id: payload.quoteId,
        lot_id: lot.id,
        section_id: payload.sectionId || null,
        lot: lot.title,
        template,
        quantity: payload.quantity,
        marginRate: payload.marginRate,
        coefficient: payload.coefficient,
        tvaRate: payload.tvaRate,
        ordre: existing?.items.length ?? 0,
      });
      await recalculateCrmQuoteTotals(payload.quoteId);
      setQuoteEngine(await loadCrmQuoteEngineData(payload.quoteId));
    });
  }

  async function addQuoteSection(payload: { quoteId: string; parentId?: string | null; title: string; sectionType: "section" | "subsection" }) {
    await submitSafely(async () => {
      await createCrmQuoteSection({
        quote_id: payload.quoteId,
        parent_id: payload.parentId ?? null,
        title: payload.title,
        section_type: payload.sectionType,
        ordre: (quoteEngine?.sections.length ?? 0) + 1,
      });
      setQuoteEngine(await loadCrmQuoteEngineData(payload.quoteId));
    });
  }

  async function addQuoteComponent(payload: {
    quoteId: string;
    itemId: string;
    componentType: "material" | "labor" | "subcontracting" | "equipment" | "fee" | "text";
    designation: string;
    quantity: string;
    unit: string;
    purchaseUnitPrice: string;
    saleUnitPrice: string;
    tvaRate: string;
  }) {
    await submitSafely(async () => {
      await createCrmQuoteComponent({
        quote_id: payload.quoteId,
        quote_item_id: payload.itemId,
        component_type: payload.componentType,
        designation: payload.designation,
        quantity: Number(payload.quantity),
        unit: payload.unit,
        purchase_unit_price_ht: Number(payload.purchaseUnitPrice),
        sale_unit_price_ht: Number(payload.saleUnitPrice),
        tva_rate: Number(payload.tvaRate),
      });
      setQuoteEngine(await loadCrmQuoteEngineData(payload.quoteId));
    });
  }

  async function addPaymentTerm(payload: { quoteId: string; label: string; percent: string; dueTrigger: string }) {
    await submitSafely(async () => {
      const percent = Number(payload.percent || 0);
      await createCrmPaymentTerm({
        quote_id: payload.quoteId,
        label: payload.label,
        percent,
        amount_ht: Number(quoteEngine?.quote.montant_ht ?? 0) * (percent / 100),
        amount_ttc: Number(quoteEngine?.quote.montant_ttc ?? 0) * (percent / 100),
        due_trigger: payload.dueTrigger,
        ordre: quoteEngine?.paymentTerms.length ?? 0,
      });
      setQuoteEngine(await loadCrmQuoteEngineData(payload.quoteId));
    });
  }

  async function downloadQuote(row: CrmQuoteRow) {
    setError(null);
    try {
      const engine = await loadCrmQuoteEngineData(row.id);
      downloadCrmQuotePdf({
        quote: engine.quote,
        client: row.client_id ? clientById.get(row.client_id) ?? null : null,
        prospect: row.prospect_id ? prospectById.get(row.prospect_id) ?? null : null,
        lots: engine.lots,
        items: engine.items,
      });
    } catch (err: any) {
      setError(err?.message ?? "Generation PDF impossible.");
    }
  }

  const header = (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">CRM Admin</div>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Cockpit commercial Batipro</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Prospects, pipeline, devis, relances, rendez-vous, transformation chantier et SAV dans un même module.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={refresh} className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50">
            Rafraîchir
          </button>
          <button type="button" onClick={() => setModal("prospect")} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
            + Prospect
          </button>
          <button type="button" onClick={createDraftQuoteAndOpen} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800 hover:bg-blue-100">
            + Devis
          </button>
        </div>
      </div>

      <ModuleTabs>
        {CRM_NAV.map((item) => (
          <Link
            key={item.key}
            to={item.href}
            className={[
              "shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition",
              section === item.key ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
            ].join(" ")}
          >
            {item.label}
          </Link>
        ))}
      </ModuleTabs>
    </div>
  );

  return (
    <div className="bt-page">
      {header}

      {error ? <ErrorAlert message={error} /> : null}
      {loading ? (
        <LoadingState label="Chargement du CRM..." />
      ) : section === "dashboard" ? (
        <DashboardView
          data={data}
          kpis={kpis}
          transformationRate={transformationRate}
          prospectById={prospectById}
          clientById={clientById}
          quoteById={quoteById}
          setModal={setModal}
          setError={setError}
        />
      ) : section === "prospects" ? (
        <ProspectsView
          rows={filteredProspects}
          query={query}
          setQuery={setQuery}
          onCreate={() => setModal("prospect")}
          onConvert={(row) => submitSafely(async () => convertProspectToClient(row))}
          onStatus={(row, statut) => submitSafely(async () => updateCrmProspect(row.id, { statut }))}
          onTask={(row) => submitSafely(async () => createCrmTask({ prospect_id: row.id, type: "relance", titre: `Relancer ${entityLabel(row)}`, due_at: new Date().toISOString() }))}
        />
      ) : section === "clients" ? (
        <ClientsView rows={filteredClients} chantiers={data.chantiers} sav={data.sav} query={query} setQuery={setQuery} onCreate={() => setModal("client")} />
      ) : section === "opportunities" ? (
        <OpportunitiesView
          data={data}
          prospectById={prospectById}
          clientById={clientById}
          dragOpportunityId={dragOpportunityId}
          setDragOpportunityId={setDragOpportunityId}
          onMove={(opportunity, stage) => submitSafely(async () => moveCrmOpportunityStage(opportunity.id, stage))}
          onCreate={() => setModal("opportunity")}
        />
      ) : section === "quotes" ? (
        <QuotesView
          rows={filteredQuotes}
          prospectById={prospectById}
          clientById={clientById}
          onCreate={createDraftQuoteAndOpen}
          onStatus={(row, statut) => submitSafely(async () => updateCrmQuote(row.id, { statut }))}
          onTransform={transformQuote}
          onOpen={openQuoteEngine}
          onPdf={downloadQuote}
          query={query}
          setQuery={setQuery}
        />
      ) : section === "invoices" ? (
        <InvoicesView rows={data.invoices} clients={clientById} onCreate={() => setModal("invoice")} />
      ) : section === "purchases" ? (
        <PurchasesView rows={data.purchases} chantiers={data.chantiers} onCreate={() => setModal("purchase")} />
      ) : section === "contacts" ? (
        <ContactsView prospects={data.prospects} clients={data.clients} />
      ) : section === "resources" ? (
        <ResourcesView templates={data.taskTemplates} />
      ) : section === "library" ? (
        <ResourcesView templates={data.taskTemplates} />
      ) : section === "agenda" ? (
        <AgendaView tasks={data.tasks} appointments={data.appointments} onTask={() => setModal("task")} onAppointment={() => setModal("appointment")} onDone={(row) => submitSafely(async () => updateCrmTask(row.id, { statut: "terminee" }))} />
      ) : section === "sav" ? (
        <SavView rows={data.sav} clients={clientById} onCreate={() => setModal("sav")} />
      ) : section === "stats" ? (
        <StatsView data={data} kpis={kpis} transformationRate={transformationRate} />
      ) : (
        <SettingsView stages={data.stages} />
      )}

      {modal === "prospect" ? <ProspectForm saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => createCrmProspect(payload))} /> : null}
      {modal === "client" ? <ClientForm saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => createCrmClient(payload))} /> : null}
      {modal === "opportunity" ? <OpportunityForm data={data} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => upsertCrmOpportunity(payload))} /> : null}
      {modal === "task" ? <TaskForm data={data} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => createCrmTask(payload))} /> : null}
      {modal === "appointment" ? <AppointmentForm data={data} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => createCrmAppointment(payload))} /> : null}
      {modal === "sav" ? <SavForm data={data} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => createCrmSav(payload))} /> : null}
      {modal === "document" ? <DocumentForm data={data} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => createCrmDocument(payload))} /> : null}
      {modal === "invoice" ? <InvoiceForm data={data} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => createCrmInvoice(payload))} /> : null}
      {modal === "purchase" ? <PurchaseForm data={data} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => createCrmPurchase(payload))} /> : null}
      {quoteEngine ? (
        <QuoteEngineModal
          engine={quoteEngine}
          templates={data.taskTemplates}
          loading={quoteEngineLoading}
          saving={saving}
          onClose={() => setQuoteEngine(null)}
          onAddLine={addQuoteTemplateLine}
          onAddSection={addQuoteSection}
          onAddComponent={addQuoteComponent}
          onAddPaymentTerm={addPaymentTerm}
          onPdf={() => void downloadQuote(quoteEngine.quote)}
          onTransform={() => transformQuote(quoteEngine.quote)}
        />
      ) : null}
    </div>
  );
}

function DashboardView({
  data,
  kpis,
  transformationRate,
  prospectById,
  clientById,
  quoteById,
  setModal,
}: {
  data: CrmDataset;
  kpis: Record<string, number>;
  transformationRate: number;
  prospectById: Map<string, CrmProspectRow>;
  clientById: Map<string, CrmClientRow>;
  quoteById: Map<string, CrmQuoteRow>;
  setModal: (value: "task" | "appointment" | "quote" | "sav") => void;
  setError: (value: string | null) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const overdueTasks = data.tasks.filter((row) => row.statut !== "terminee" && row.due_at && row.due_at.slice(0, 10) < today);
  const todayAppointments = data.appointments.filter((row) => row.starts_at.slice(0, 10) === today);
  const expiredQuotes = data.quotes.filter((row) => row.valid_until && row.valid_until < today && !["accepte", "refuse"].includes(row.statut));
  const riskOpportunities = data.opportunities.filter((row) => row.status === "ouverte" && row.prochaine_action_date && row.prochaine_action_date < today);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Prospects actifs", kpis.activeProspects],
          ["Nouveaux semaine", kpis.newProspectsWeek],
          ["Devis attente", kpis.quotesPending],
          ["CA signé", eur(kpis.signedRevenue)],
          ["Taux transformation", `${transformationRate}%`],
          ["CA opportunité", eur(kpis.pipelineRevenue)],
          ["Relances retard", kpis.overdueTasks],
          ["RDV du jour", kpis.appointmentsToday],
          ["SAV ouverts", kpis.openSav],
          ["Devis refusés", kpis.quotesRefused],
        ].map(([label, value]) => (
          <StatCard key={String(label)} label={String(label)} value={value} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="rounded-3xl border bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Mes actions aujourd’hui</div>
              <h2 className="mt-1 text-lg font-semibold">Relances, appels, RDV, devis à envoyer</h2>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal("task")} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">+ Tâche</button>
              <button onClick={() => setModal("appointment")} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">+ RDV</button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {[...overdueTasks, ...data.tasks.filter((row) => row.due_at?.slice(0, 10) === today)].slice(0, 8).map((task) => (
              <div key={task.id} className="rounded-2xl border bg-slate-50 p-3">
                <div className="font-medium">{task.titre}</div>
                <div className="mt-1 text-xs text-slate-500">{task.type} · {task.due_at ? dateOnly(task.due_at) : "Sans échéance"}</div>
              </div>
            ))}
            {todayAppointments.slice(0, 4).map((rdv) => (
              <div key={rdv.id} className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                <div className="font-medium text-blue-950">{rdv.titre}</div>
                <div className="mt-1 text-xs text-blue-700">{new Date(rdv.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700">Alertes</div>
          <div className="mt-4 space-y-2">
            {expiredQuotes.map((quote) => (
              <div key={quote.id} className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                Devis expiré : {quote.quote_number} · {entityLabel(clientById.get(quote.client_id ?? "") ?? prospectById.get(quote.prospect_id ?? ""))}
              </div>
            ))}
            {riskOpportunities.map((opp) => (
              <div key={opp.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Affaire à risque : {opp.nom_affaire} · action oubliée {dateOnly(opp.prochaine_action_date)}
              </div>
            ))}
            {data.quotes.filter((quote) => quote.statut === "envoye" && quote.signature_status === "attente_signature").slice(0, 4).map((quote) => (
              <div key={quote.id} className="rounded-2xl border bg-slate-50 p-3 text-sm text-slate-700">
                Signature manquante : {quote.quote_number}
              </div>
            ))}
            {expiredQuotes.length === 0 && riskOpportunities.length === 0 ? <div className="text-sm text-slate-500">Aucune alerte critique.</div> : null}
          </div>
        </section>
      </div>

      <PipelineMini data={data} quoteById={quoteById} />
    </div>
  );
}

function PipelineMini({ data }: { data: CrmDataset; quoteById: Map<string, CrmQuoteRow> }) {
  return (
    <section className="rounded-3xl border bg-white p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Pipeline commercial</div>
      <div className="mt-4 grid gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {data.stages.slice(0, 7).map((stage) => {
          const rows = data.opportunities.filter((row) => row.stage_key === stage.key);
          return (
            <div key={stage.id} className="rounded-2xl border bg-slate-50 p-3">
              <div className="font-semibold text-slate-900">{stage.label}</div>
              <div className="mt-1 text-xs text-slate-500">{rows.length} affaire(s) · {eur(rows.reduce((sum, row) => sum + row.montant_estime, 0))}</div>
              <div className="mt-3 space-y-2">
                {rows.slice(0, 3).map((row) => (
                  <div key={row.id} className="rounded-xl bg-white p-3 text-sm shadow-sm">
                    <div className="font-medium">{row.nom_affaire}</div>
                    <div className="mt-1 text-xs text-slate-500">{eur(row.montant_estime)} · {row.probabilite}%</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProspectsView({
  rows,
  query,
  setQuery,
  onCreate,
  onConvert,
  onStatus,
  onTask,
}: {
  rows: CrmProspectRow[];
  query: string;
  setQuery: (value: string) => void;
  onCreate: () => void;
  onConvert: (row: CrmProspectRow) => void;
  onStatus: (row: CrmProspectRow, status: CrmProspectRow["statut"]) => void;
  onTask: (row: CrmProspectRow) => void;
}) {
  return (
    <ListShell title="Prospects" actionLabel="Ajouter un prospect" query={query} setQuery={setQuery} onCreate={onCreate}>
      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {["Prospect", "Projet", "Budget", "Source", "Statut", "Actions"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="px-4 py-3">
                  <div className="font-semibold">{entityLabel(row)}</div>
                  <div className="text-xs text-slate-500">{row.email ?? "—"} · {row.mobile ?? row.telephone ?? "—"}</div>
                  <div className="text-xs text-slate-500">{row.adresse ?? ""} {row.ville ?? ""}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{row.type_projet ?? "—"}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-slate-500">{row.description_besoin ?? row.notes ?? ""}</div>
                </td>
                <td className="px-4 py-3">{eur(row.budget_estime)}</td>
                <td className="px-4 py-3">{row.source_acquisition ?? "—"}</td>
                <td className="px-4 py-3"><span className={statusPill(row.statut)}>{row.statut}</span></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <a href={row.telephone ? `tel:${row.telephone}` : undefined} className="rounded-xl border px-3 py-2 hover:bg-slate-50">Appeler</a>
                    <a href={row.email ? `mailto:${row.email}` : undefined} className="rounded-xl border px-3 py-2 hover:bg-slate-50">Email</a>
                    <button onClick={() => onTask(row)} className="rounded-xl border px-3 py-2 hover:bg-slate-50">Créer tâche</button>
                    <button onClick={() => onStatus(row, "devis_en_cours")} className="rounded-xl border px-3 py-2 hover:bg-slate-50">Créer devis</button>
                    <button onClick={() => onConvert(row)} className="rounded-xl border border-emerald-200 px-3 py-2 text-emerald-700 hover:bg-emerald-50">Convertir client</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ListShell>
  );
}

function ClientsView({
  rows,
  chantiers,
  sav,
  query,
  setQuery,
  onCreate,
}: {
  rows: CrmClientRow[];
  chantiers: CrmDataset["chantiers"];
  sav: CrmDataset["sav"];
  query: string;
  setQuery: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <ListShell title="Clients" actionLabel="Ajouter un client" query={query} setQuery={setQuery} onCreate={onCreate}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-3xl border bg-white p-5">
            {(() => {
              const clientChantiers = chantiers.filter((chantier) => chantier.crm_client_id === row.id);
              const activeCount = clientChantiers.filter((chantier) => ["PREPARATION", "EN_COURS", "EN_PAUSE"].includes(chantier.status)).length;
              const doneCount = clientChantiers.filter((chantier) => chantier.status === "TERMINE").length;
              const archivedCount = clientChantiers.filter((chantier) => chantier.status === "ARCHIVE").length;
              const amount = clientChantiers.reduce((sum, chantier) => sum + Number(chantier.signed_quote_amount_ht ?? 0), 0);
              const savCount = sav.filter((ticket) => ticket.client_id === row.id).length;
              return (
                <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{entityLabel(row)}</div>
                <div className="mt-1 text-sm text-slate-500">{row.type} · {row.ville ?? "Ville non renseignée"}</div>
              </div>
              <span className={statusPill(row.archived_at ? "archive" : "actif")}>{row.archived_at ? "archivé" : "actif"}</span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <div>Email : {row.email ?? "—"}</div>
              <div>Téléphone : {row.mobile ?? row.telephone ?? "—"}</div>
              <div>Adresse : {row.adresse ?? "—"}</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 p-2">En cours : <span className="font-semibold">{activeCount}</span></div>
              <div className="rounded-xl bg-slate-50 p-2">Terminés : <span className="font-semibold">{doneCount}</span></div>
              <div className="rounded-xl bg-slate-50 p-2">Archivés : <span className="font-semibold">{archivedCount}</span></div>
              <div className="rounded-xl bg-slate-50 p-2">SAV : <span className="font-semibold">{savCount}</span></div>
            </div>
            <div className="mt-2 rounded-xl border bg-slate-50 p-2 text-xs text-slate-600">Montant total chantiers : <span className="font-semibold text-slate-950">{eur(amount)}</span></div>
                </>
              );
            })()}
          </div>
        ))}
      </div>
    </ListShell>
  );
}

function OpportunitiesView({
  data,
  prospectById,
  clientById,
  dragOpportunityId,
  setDragOpportunityId,
  onMove,
  onCreate,
}: {
  data: CrmDataset;
  prospectById: Map<string, CrmProspectRow>;
  clientById: Map<string, CrmClientRow>;
  dragOpportunityId: string | null;
  setDragOpportunityId: (value: string | null) => void;
  onMove: (row: CrmOpportunityRow, stage: CrmDataset["stages"][number]) => void;
  onCreate: () => void;
}) {
  const opportunityById = new Map(data.opportunities.map((row) => [row.id, row]));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Pipeline commercial</h2>
        <button onClick={onCreate} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">Ajouter opportunité</button>
      </div>
      <div className="grid min-h-[34rem] gap-3 overflow-x-auto xl:grid-cols-9">
        {data.stages.map((stage) => {
          const rows = data.opportunities.filter((row) => row.stage_key === stage.key);
          return (
            <div
              key={stage.id}
              className="min-w-[16rem] rounded-3xl border bg-slate-100 p-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                const row = dragOpportunityId ? opportunityById.get(dragOpportunityId) : null;
                if (row) onMove(row, stage);
                setDragOpportunityId(null);
              }}
            >
              <div className="font-semibold">{stage.label}</div>
              <div className="mt-1 text-xs text-slate-500">{rows.length} · {eur(rows.reduce((sum, row) => sum + row.montant_estime, 0))}</div>
              <div className="mt-3 space-y-2">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    draggable
                    onDragStart={() => setDragOpportunityId(row.id)}
                    className="cursor-grab rounded-2xl border bg-white p-3 shadow-sm"
                  >
                    <div className="font-medium">{row.nom_affaire}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {entityLabel(clientById.get(row.client_id ?? "") ?? prospectById.get(row.prospect_id ?? ""))}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-semibold">{eur(row.montant_estime)}</span>
                      <span className={statusPill(row.probabilite >= 75 ? "gagne" : "ouverte")}>{row.probabilite}%</span>
                    </div>
                    {row.prochaine_action ? <div className="mt-2 text-xs text-slate-500">Action : {row.prochaine_action}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuotesView({
  rows,
  prospectById,
  clientById,
  onCreate,
  onStatus,
  onTransform,
  onOpen,
  onPdf,
  query,
  setQuery,
}: {
  rows: CrmQuoteRow[];
  prospectById: Map<string, CrmProspectRow>;
  clientById: Map<string, CrmClientRow>;
  onCreate: () => void;
  onStatus: (row: CrmQuoteRow, status: CrmQuoteRow["statut"]) => void;
  onTransform: (row: CrmQuoteRow) => void;
  onOpen: (row: CrmQuoteRow) => void;
  onPdf: (row: CrmQuoteRow) => void;
  query: string;
  setQuery: (value: string) => void;
}) {
  const statusFilter = "tous";
  const visibleRows = rows
    .filter((row) => statusFilter === "tous" || row.statut === statusFilter)
    .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));
  const pageRows = visibleRows.slice(0, 30);
  return (
    <ListShell title="Devis CRM" actionLabel="Créer un devis" query={query} setQuery={setQuery} onCreate={onCreate}>
      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>{["N°", "Client/prospect", "Montant", "Validité", "Statut", "Signature", "Actions"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="px-4 py-3 font-semibold">{row.quote_number}</td>
                <td className="px-4 py-3">{entityLabel(clientById.get(row.client_id ?? "") ?? prospectById.get(row.prospect_id ?? ""))}</td>
                <td className="px-4 py-3">{eur(row.montant_ht)} HT<br /><span className="text-xs text-slate-500">{eur(row.montant_ttc)} TTC</span></td>
                <td className="px-4 py-3">{dateOnly(row.valid_until)}</td>
                <td className="px-4 py-3"><span className={statusPill(row.statut)}>{row.statut}</span></td>
                <td className="px-4 py-3">{row.signature_status}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => onOpen(row)} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-blue-800 hover:bg-blue-100">Chiffrage</button>
                    <button onClick={() => onPdf(row)} className="rounded-xl border px-3 py-2 hover:bg-slate-50">PDF</button>
                    <button onClick={() => onStatus(row, "envoye")} className="rounded-xl border px-3 py-2 hover:bg-slate-50">Envoyer</button>
                    <button onClick={() => onStatus(row, "relance_1")} className="rounded-xl border px-3 py-2 hover:bg-slate-50">Relancer</button>
                    <button onClick={() => onStatus(row, "accepte")} className="rounded-xl border border-emerald-200 px-3 py-2 text-emerald-700 hover:bg-emerald-50">Accepter</button>
                    <button onClick={() => onStatus(row, "refuse")} className="rounded-xl border border-red-200 px-3 py-2 text-red-700 hover:bg-red-50">Refuser</button>
                    <button onClick={() => onTransform(row)} className="rounded-xl bg-slate-900 px-3 py-2 text-white">Transformer chantier</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ListShell>
  );
}

function QuoteEngineModal({
  engine,
  templates,
  loading,
  saving,
  onClose,
  onAddLine,
  onAddSection,
  onAddComponent,
  onAddPaymentTerm,
  onPdf,
  onTransform,
}: {
  engine: CrmQuoteEngineData;
  templates: CrmDataset["taskTemplates"];
  loading: boolean;
  saving: boolean;
  onClose: () => void;
  onAddLine: (payload: {
    quoteId: string;
    sectionId: string;
    lotTitle: string;
    templateId: string;
    quantity: string;
    marginRate: string;
    coefficient: string;
    tvaRate: string;
  }) => void;
  onAddSection: (payload: { quoteId: string; parentId?: string | null; title: string; sectionType: "section" | "subsection" }) => void;
  onAddComponent: (payload: {
    quoteId: string;
    itemId: string;
    componentType: "material" | "labor" | "subcontracting" | "equipment" | "fee" | "text";
    designation: string;
    quantity: string;
    unit: string;
    purchaseUnitPrice: string;
    saleUnitPrice: string;
    tvaRate: string;
  }) => void;
  onAddPaymentTerm: (payload: { quoteId: string; label: string; percent: string; dueTrigger: string }) => void;
  onPdf: () => void;
  onTransform: () => void;
}) {
  const firstTemplate = templates[0];
  const [form, setForm] = useState<Record<string, string>>({
    lotTitle: firstTemplate?.lot ?? "Lot principal",
    sectionId: "",
    templateId: firstTemplate?.id ?? "",
    quantity: String(firstTemplate?.quantite_defaut ?? 1),
    marginRate: "25",
    coefficient: "1",
    tvaRate: "20",
  });
  const [sectionForm, setSectionForm] = useState<Record<string, string>>({ title: "", parentId: "", sectionType: "section" });
  const [componentForm, setComponentForm] = useState<Record<string, string>>({
    itemId: "",
    componentType: "material",
    designation: "",
    quantity: "1",
    unit: "u",
    purchaseUnitPrice: "0",
    saleUnitPrice: "0",
    tvaRate: "20",
  });
  const [paymentForm, setPaymentForm] = useState<Record<string, string>>({ label: "Acompte signature", percent: "30", dueTrigger: "signature" });
  const selectedTemplate = templates.find((row) => row.id === form.templateId) ?? null;
  const debourse = engine.items.reduce(
    (sum, row) =>
      sum +
      (Number(row.cost_materials_ht ?? 0) + Number(row.cost_labor_ht ?? 0) + Number(row.cost_subcontracting_ht ?? 0) + Number(row.cost_fees_ht ?? 0)) *
        Number(row.quantite ?? 1),
    0,
  );
  const margin = Number(engine.quote.montant_ht ?? 0) - debourse;

  return (
    <CrmModal title={`Chiffrage BTP - ${engine.quote.quote_number}`} onClose={onClose}>
      <div className="space-y-5">
        {loading ? <div className="rounded-2xl border bg-slate-50 p-3 text-sm text-slate-500">Chargement...</div> : null}
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["HT", eur(engine.quote.montant_ht)],
            ["TTC", eur(engine.quote.montant_ttc)],
            ["Debourse sec", eur(debourse)],
            ["Marge", eur(margin)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
              <div className="mt-1 text-lg font-semibold text-slate-950">{value}</div>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border bg-white p-4">
          <div className="font-semibold">Sections et sous-sections</div>
          <form
            className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_150px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              onAddSection({
                quoteId: engine.quote.id,
                parentId: sectionForm.parentId || null,
                title: sectionForm.title,
                sectionType: sectionForm.sectionType === "subsection" ? "subsection" : "section",
              });
              setSectionForm({ title: "", parentId: "", sectionType: "section" });
            }}
          >
            <Input form={sectionForm} setForm={setSectionForm} name="title" label="Titre" required />
            <label className="block space-y-1 text-sm">
              <div className="text-slate-600">Parent</div>
              <select className="w-full rounded-xl border px-3 py-2" value={sectionForm.parentId} onChange={(event) => setSectionForm((prev) => ({ ...prev, parentId: event.target.value, sectionType: event.target.value ? "subsection" : "section" }))}>
                <option value="">Aucun</option>
                {engine.sections.filter((row) => !row.parent_id).map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}
              </select>
            </label>
            <Input form={sectionForm} setForm={setSectionForm} name="sectionType" label="Type" />
            <div className="flex items-end">
              <button disabled={saving || !sectionForm.title} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60">Ajouter</button>
            </div>
          </form>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {engine.sections.map((row) => (
              <span key={row.id} className="rounded-full border bg-slate-50 px-3 py-1">{row.parent_id ? "Sous-section" : "Section"} · {row.title}</span>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-4">
          <div className="font-semibold">Ajouter un ouvrage depuis la bibliotheque</div>
          <form
            className="mt-3 grid gap-3 md:grid-cols-[1fr_1.4fr_100px_100px_90px]"
            onSubmit={(event) => {
              event.preventDefault();
              onAddLine({
                quoteId: engine.quote.id,
                sectionId: form.sectionId,
                lotTitle: form.lotTitle,
                templateId: form.templateId,
                quantity: form.quantity,
                marginRate: form.marginRate,
                coefficient: form.coefficient,
                tvaRate: form.tvaRate,
              });
            }}
          >
            <Input form={form} setForm={setForm} name="lotTitle" label="Lot" />
            <label className="block space-y-1 text-sm">
              <div className="text-slate-600">Section</div>
              <select className="w-full rounded-xl border px-3 py-2" value={form.sectionId} onChange={(event) => setForm((prev) => ({ ...prev, sectionId: event.target.value }))}>
                <option value="">Aucune</option>
                {engine.sections.map((row) => <option key={row.id} value={row.id}>{row.parent_id ? "— " : ""}{row.title}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <div className="text-slate-600">Ouvrage bibliotheque</div>
              <select
                className="w-full rounded-xl border px-3 py-2"
                value={form.templateId}
                onChange={(event) => {
                  const template = templates.find((row) => row.id === event.target.value);
                  setForm((prev) => ({
                    ...prev,
                    templateId: event.target.value,
                    lotTitle: template?.lot ?? prev.lotTitle,
                    quantity: String(template?.quantite_defaut ?? prev.quantity ?? 1),
                  }));
                }}
                required
              >
                <option value="">Selectionner</option>
                {templates.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.lot ? `${row.lot} - ` : ""}{row.titre}
                  </option>
                ))}
              </select>
            </label>
            <Input form={form} setForm={setForm} name="quantity" label="Quantite" type="number" />
            <Input form={form} setForm={setForm} name="marginRate" label="Marge %" type="number" />
            <Input form={form} setForm={setForm} name="tvaRate" label="TVA" type="number" />
            <div className="md:col-span-5 flex items-end justify-between gap-3">
              <div className="text-xs text-slate-500">
                {selectedTemplate
                  ? `Base: ${selectedTemplate.unite ?? "u"} / ${eur(selectedTemplate.cout_reference_unitaire_ht ?? 0)} / ${selectedTemplate.temps_prevu_par_unite_h ?? 0}h`
                  : "La bibliotheque existante sert de catalogue d'ouvrages."}
              </div>
              <button disabled={saving || !form.templateId} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60">
                Ajouter ligne
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border bg-white p-4">
          <div className="font-semibold">Composants d'ouvrage et conditions de paiement</div>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                onAddComponent({
                  quoteId: engine.quote.id,
                  itemId: componentForm.itemId,
                  componentType: componentForm.componentType as any,
                  designation: componentForm.designation,
                  quantity: componentForm.quantity,
                  unit: componentForm.unit,
                  purchaseUnitPrice: componentForm.purchaseUnitPrice,
                  saleUnitPrice: componentForm.saleUnitPrice,
                  tvaRate: componentForm.tvaRate,
                });
                setComponentForm((prev) => ({ ...prev, designation: "", purchaseUnitPrice: "0", saleUnitPrice: "0" }));
              }}
            >
              <label className="block space-y-1 text-sm">
                <div className="text-slate-600">Ouvrage</div>
                <select className="w-full rounded-xl border px-3 py-2" value={componentForm.itemId} onChange={(event) => setComponentForm((prev) => ({ ...prev, itemId: event.target.value }))} required>
                  <option value="">Selectionner</option>
                  {engine.items.map((row) => <option key={row.id} value={row.id}>{row.designation}</option>)}
                </select>
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <Input form={componentForm} setForm={setComponentForm} name="componentType" label="Type" />
                <Input form={componentForm} setForm={setComponentForm} name="designation" label="Designation composant" required />
                <Input form={componentForm} setForm={setComponentForm} name="quantity" label="Quantite" type="number" />
                <Input form={componentForm} setForm={setComponentForm} name="unit" label="Unite" />
                <Input form={componentForm} setForm={setComponentForm} name="purchaseUnitPrice" label="Prix achat HT" type="number" />
                <Input form={componentForm} setForm={setComponentForm} name="saleUnitPrice" label="Prix vente HT" type="number" />
              </div>
              <button disabled={saving || !componentForm.itemId || !componentForm.designation} className="justify-self-end rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">Ajouter composant</button>
            </form>
            <form
              className="grid content-start gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                onAddPaymentTerm({
                  quoteId: engine.quote.id,
                  label: paymentForm.label,
                  percent: paymentForm.percent,
                  dueTrigger: paymentForm.dueTrigger,
                });
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <Input form={paymentForm} setForm={setPaymentForm} name="label" label="Echeance" />
                <Input form={paymentForm} setForm={setPaymentForm} name="percent" label="Pourcentage" type="number" />
                <Input form={paymentForm} setForm={setPaymentForm} name="dueTrigger" label="Declencheur" />
              </div>
              <button disabled={saving} className="justify-self-end rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">Ajouter condition</button>
              <div className="space-y-2 text-xs text-slate-600">
                {engine.paymentTerms.map((row) => (
                  <div key={row.id} className="rounded-xl border bg-slate-50 p-2">{row.label} · {row.percent ?? 0}% · {eur(row.amount_ttc ?? 0)} TTC</div>
                ))}
              </div>
            </form>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>{["Lot / ouvrage", "Qte", "Debourse", "Marge", "TVA", "Total HT"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {engine.items.map((row) => {
                const lot = engine.lots.find((item) => item.id === row.lot_id)?.title ?? row.lot ?? "Sans lot";
                const cost =
                  (Number(row.cost_materials_ht ?? 0) + Number(row.cost_labor_ht ?? 0) + Number(row.cost_subcontracting_ht ?? 0) + Number(row.cost_fees_ht ?? 0)) *
                  Number(row.quantite ?? 1);
                return (
                  <tr key={row.id} className="border-t align-top">
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{lot}</div>
                      <div className="font-medium">{row.designation}</div>
                      {row.technical_description ? <div className="mt-1 text-xs text-slate-500">{row.technical_description}</div> : null}
                    </td>
                    <td className="px-4 py-3">{row.quantite} {row.unite ?? ""}</td>
                    <td className="px-4 py-3">{eur(cost)}</td>
                    <td className="px-4 py-3">{row.margin_rate}%</td>
                    <td className="px-4 py-3">{row.tva_rate}%</td>
                    <td className="px-4 py-3 font-semibold">{eur(row.sale_total_ht ?? row.total_ht)}</td>
                  </tr>
                );
              })}
              {!engine.items.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    Aucune ligne. Ajoutez des ouvrages depuis la bibliotheque pour obtenir un devis exploitable.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onPdf} className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50">Generer PDF</button>
          <button type="button" onClick={onTransform} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">Transformer en chantier</button>
        </div>
      </div>
    </CrmModal>
  );
}

function InvoicesView({ rows, clients, onCreate }: { rows: CrmDataset["invoices"]; clients: Map<string, CrmClientRow>; onCreate: () => void }) {
  return (
    <ListShell title="Factures client" actionLabel="Nouvelle facture" query="" setQuery={() => undefined} onCreate={onCreate} hideSearch>
      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>{["Numero", "Client", "Type", "Montant", "Echeance", "Statut"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3 font-semibold">{row.invoice_number ?? "A numeroter"}</td>
                <td className="px-4 py-3">{entityLabel(clients.get(row.client_id ?? ""))}</td>
                <td className="px-4 py-3">{row.type}</td>
                <td className="px-4 py-3">{eur(row.amount_ht)} HT<br /><span className="text-xs text-slate-500">{eur(row.amount_ttc)} TTC</span></td>
                <td className="px-4 py-3">{dateOnly(row.due_date)}</td>
                <td className="px-4 py-3"><span className={statusPill(row.statut)}>{row.statut}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ListShell>
  );
}

function PurchasesView({ rows, chantiers, onCreate }: { rows: CrmDataset["purchases"]; chantiers: CrmDataset["chantiers"]; onCreate: () => void }) {
  const chantierById = new Map(chantiers.map((row) => [row.id, row]));
  return (
    <ListShell title="Achats / factures fournisseurs" actionLabel="Nouvel achat" query="" setQuery={() => undefined} onCreate={onCreate} hideSearch>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-3xl border bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{row.label}</div>
                <div className="text-xs text-slate-500">{row.category} · {chantierById.get(row.chantier_id ?? "")?.nom ?? "Hors chantier"}</div>
              </div>
              <span className={statusPill(row.status)}>{row.status}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">HT<br /><b>{eur(row.amount_ht)}</b></div>
              <div className="rounded-2xl bg-slate-50 p-3">TTC<br /><b>{eur(row.amount_ttc)}</b></div>
            </div>
          </div>
        ))}
      </div>
    </ListShell>
  );
}

function ContactsView({ prospects, clients }: { prospects: CrmProspectRow[]; clients: CrmClientRow[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-3xl border bg-white p-5">
        <div className="font-semibold">Clients</div>
        <div className="mt-4 space-y-2">
          {clients.map((row) => <div key={row.id} className="rounded-2xl border bg-slate-50 p-3">{entityLabel(row)}<div className="text-xs text-slate-500">{row.email ?? row.telephone ?? "Sans contact"}</div></div>)}
        </div>
      </section>
      <section className="rounded-3xl border bg-white p-5">
        <div className="font-semibold">Prospects</div>
        <div className="mt-4 space-y-2">
          {prospects.map((row) => <div key={row.id} className="rounded-2xl border bg-slate-50 p-3">{entityLabel(row)}<div className="text-xs text-slate-500">{row.statut} · {row.email ?? row.telephone ?? "Sans contact"}</div></div>)}
        </div>
      </section>
    </div>
  );
}

function ResourcesView({ templates }: { templates: CrmDataset["taskTemplates"] }) {
  return (
    <ListShell title="Ressources / bibliotheque devis" actionLabel="Ouvrir bibliotheque" query="" setQuery={() => undefined} onCreate={() => { window.location.href = "/bibliotheque"; }} hideSearch>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((row) => (
          <div key={row.id} className="rounded-3xl border bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{row.lot ?? "Sans famille"}</div>
            <div className="mt-1 font-semibold">{row.titre}</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 p-2">Unite<br /><b>{row.unite ?? "u"}</b></div>
              <div className="rounded-xl bg-slate-50 p-2">Temps<br /><b>{row.temps_prevu_par_unite_h ?? 0}h</b></div>
              <div className="rounded-xl bg-slate-50 p-2">Cout ref.<br /><b>{eur(row.cout_reference_unitaire_ht ?? 0)}</b></div>
            </div>
            {row.description_technique ? <p className="mt-3 text-sm text-slate-600">{row.description_technique}</p> : null}
          </div>
        ))}
      </div>
    </ListShell>
  );
}

function AgendaView({ tasks, appointments, onTask, onAppointment, onDone }: { tasks: CrmTaskRow[]; appointments: CrmAppointmentRow[]; onTask: () => void; onAppointment: () => void; onDone: (row: CrmTaskRow) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tâches commerciales et rendez-vous</h2>
        <div className="flex gap-2">
          <button onClick={onTask} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">+ Tâche</button>
          <button onClick={onAppointment} className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white">+ RDV</button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border bg-white p-5">
          <div className="font-semibold">Tâches</div>
          <div className="mt-4 space-y-2">
            {tasks.map((row) => (
              <div key={row.id} className="flex items-start justify-between gap-3 rounded-2xl border bg-slate-50 p-3">
                <div>
                  <div className="font-medium">{row.titre}</div>
                  <div className="text-xs text-slate-500">{row.type} · {dateOnly(row.due_at)}</div>
                </div>
                {row.statut !== "terminee" ? <button onClick={() => onDone(row)} className="rounded-xl border px-3 py-2 text-xs hover:bg-white">Terminer</button> : <span className={statusPill("terminee")}>terminée</span>}
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border bg-white p-5">
          <div className="font-semibold">Calendrier</div>
          <div className="mt-4 grid gap-2">
            {appointments.map((row) => (
              <div key={row.id} className="rounded-2xl border bg-slate-50 p-3">
                <div className="font-medium">{row.titre}</div>
                <div className="text-xs text-slate-500">{row.type} · {new Date(row.starts_at).toLocaleString("fr-FR")}</div>
                {row.compte_rendu ? <div className="mt-2 text-sm text-slate-600">{row.compte_rendu}</div> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SavView({ rows, clients, onCreate }: { rows: CrmDataset["sav"]; clients: Map<string, CrmClientRow>; onCreate: () => void }) {
  return (
    <ListShell title="SAV / Après chantier" actionLabel="Créer ticket SAV" query="" setQuery={() => undefined} onCreate={onCreate} hideSearch>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-3xl border bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="font-semibold">{row.titre}</div>
              <span className={statusPill(row.statut)}>{row.statut}</span>
            </div>
            <div className="mt-2 text-sm text-slate-500">{entityLabel(clients.get(row.client_id ?? ""))}</div>
            <p className="mt-3 text-sm text-slate-700">{row.description ?? "—"}</p>
            <div className="mt-3 text-xs text-slate-500">Urgence : {row.urgence} · Créé le {dateOnly(row.created_at)}</div>
          </div>
        ))}
      </div>
    </ListShell>
  );
}

function StatsView({ data, kpis, transformationRate }: { data: CrmDataset; kpis: Record<string, number>; transformationRate: number }) {
  const avgQuote = data.quotes.length ? data.quotes.reduce((sum, row) => sum + row.montant_ht, 0) / data.quotes.length : 0;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[
        ["CA signé", eur(kpis.signedRevenue)],
        ["CA transformé chantier", eur(kpis.chantierRevenue)],
        ["CA pipeline", eur(kpis.pipelineRevenue)],
        ["Taux transformation", `${transformationRate}%`],
        ["Taux devis → chantier", `${data.quotes.length ? Math.round((data.chantiers.filter((row) => row.crm_quote_id).length / data.quotes.length) * 100) : 0}%`],
        ["Chantiers actifs CRM", kpis.crmActiveChantiers],
        ["Chantiers terminés CRM", kpis.crmFinishedChantiers],
        ["Délai signature", "à mesurer"],
        ["Nombre devis", data.quotes.length],
        ["Devis gagnés", kpis.quotesSigned],
        ["Devis perdus", kpis.quotesRefused],
        ["Panier moyen", eur(avgQuote)],
        ["Performance commerciale", `${data.opportunities.filter((row) => row.status === "gagnee").length} gagnées`],
        ["SAV ouverts", kpis.openSav],
      ].map(([label, value]) => (
        <div key={String(label)} className="rounded-3xl border bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
        </div>
      ))}
    </div>
  );
}

function SettingsView({ stages }: { stages: CrmDataset["stages"] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-3xl border bg-white p-5">
        <div className="font-semibold">Étapes pipeline</div>
        <div className="mt-4 space-y-2">
          {stages.map((stage) => (
            <div key={stage.id} className="flex items-center justify-between rounded-2xl border bg-slate-50 p-3">
              <span>{stage.ordre}. {stage.label}</span>
              <span className="text-xs text-slate-500">{stage.probability_default}%</span>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-3xl border bg-white p-5">
        <div className="font-semibold">Paramètres prévus</div>
        <div className="mt-3 grid gap-2 text-sm text-slate-600">
          {["Sources prospects", "Types projets", "Tags", "Modèles email", "Modèles devis", "Priorités", "Statuts"].map((item) => (
            <div key={item} className="rounded-2xl border bg-slate-50 p-3">{item}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ListShell({ title, actionLabel, query, setQuery, onCreate, children, hideSearch = false }: { title: string; actionLabel: string; query: string; setQuery: (value: string) => void; onCreate: () => void; children: React.ReactNode; hideSearch?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="flex flex-wrap gap-2">
          {!hideSearch ? <input className="rounded-xl border px-3 py-2 text-sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher..." /> : null}
          <button onClick={onCreate} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">{actionLabel}</button>
        </div>
      </div>
      {children}
    </div>
  );
}

function ProspectForm({ saving, onClose, onSubmit }: { saving: boolean; onClose: () => void; onSubmit: (payload: Partial<CrmProspectRow>) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ type: "particulier", statut: "nouveau", urgence: "normale" });
  return (
    <CrmModal title="Ajouter un prospect" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form as Partial<CrmProspectRow>); }} className="space-y-4">
        <CrmIdentityFields form={form} setForm={setForm} />
        <div className="grid gap-4 md:grid-cols-3">
          <Input form={form} setForm={setForm} name="source_acquisition" label="Source acquisition" />
          <Input form={form} setForm={setForm} name="budget_estime" label="Budget estimé" type="number" />
          <Input form={form} setForm={setForm} name="type_projet" label="Type projet" />
        </div>
        <TextArea form={form} setForm={setForm} name="description_besoin" label="Description besoin" />
        <Submit saving={saving} label="Créer prospect" />
      </form>
    </CrmModal>
  );
}

function ClientForm({ saving, onClose, onSubmit }: { saving: boolean; onClose: () => void; onSubmit: (payload: Partial<CrmClientRow>) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ type: "particulier" });
  return (
    <CrmModal title="Ajouter un client" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form as Partial<CrmClientRow>); }} className="space-y-4">
        <CrmIdentityFields form={form} setForm={setForm} />
        <TextArea form={form} setForm={setForm} name="notes" label="Notes internes" />
        <Submit saving={saving} label="Créer client" />
      </form>
    </CrmModal>
  );
}

function OpportunityForm({ data, saving, onClose, onSubmit }: { data: CrmDataset; saving: boolean; onClose: () => void; onSubmit: (payload: Partial<CrmOpportunityRow>) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ stage_key: "lead", montant_estime: "0", probabilite: "25" });
  return (
    <CrmModal title="Créer une opportunité" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form as Partial<CrmOpportunityRow>); }} className="space-y-4">
        <Input form={form} setForm={setForm} name="nom_affaire" label="Nom affaire" required />
        <SelectEntity prospects={data.prospects} clients={data.clients} prospectId={form.prospect_id ?? ""} clientId={form.client_id ?? ""} setProspectId={(v) => setForm((p) => ({ ...p, prospect_id: v }))} setClientId={(v) => setForm((p) => ({ ...p, client_id: v }))} />
        <div className="grid gap-4 md:grid-cols-3">
          <Input form={form} setForm={setForm} name="montant_estime" label="Montant estimé" type="number" />
          <Input form={form} setForm={setForm} name="probabilite" label="Probabilité" type="number" />
          <Input form={form} setForm={setForm} name="echeance" label="Échéance" type="date" />
        </div>
        <TextArea form={form} setForm={setForm} name="notes" label="Notes" />
        <Submit saving={saving} label="Créer opportunité" />
      </form>
    </CrmModal>
  );
}

export function QuoteForm({ data, saving, onClose, onSubmit }: { data: CrmDataset; saving: boolean; onClose: () => void; onSubmit: (payload: Partial<CrmQuoteRow>) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ statut: "brouillon", montant_ht: "0", tva: "20" });
  return (
    <CrmModal title="Créer un devis CRM" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form as Partial<CrmQuoteRow>); }} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Input form={form} setForm={setForm} name="quote_number" label="Numéro devis" />
          <Input form={form} setForm={setForm} name="valid_until" label="Validité" type="date" />
        </div>
        <SelectEntity prospects={data.prospects} clients={data.clients} prospectId={form.prospect_id ?? ""} clientId={form.client_id ?? ""} setProspectId={(v) => setForm((p) => ({ ...p, prospect_id: v }))} setClientId={(v) => setForm((p) => ({ ...p, client_id: v }))} />
        <div className="grid gap-4 md:grid-cols-3">
          <Input form={form} setForm={setForm} name="montant_ht" label="Montant HT" type="number" />
          <Input form={form} setForm={setForm} name="tva" label="TVA %" type="number" />
          <Input form={form} setForm={setForm} name="marge_estimee" label="Marge estimée" type="number" />
        </div>
        <Input form={form} setForm={setForm} name="lot" label="Lot" />
        <TextArea form={form} setForm={setForm} name="description" label="Description" />
        <Submit saving={saving} label="Créer devis" />
      </form>
    </CrmModal>
  );
}

function TaskForm({ data, saving, onClose, onSubmit }: { data: CrmDataset; saving: boolean; onClose: () => void; onSubmit: (payload: Partial<CrmTaskRow>) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ type: "relance", priorite: "normale", statut: "a_faire" });
  return (
    <CrmModal title="Créer une tâche commerciale" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form as Partial<CrmTaskRow>); }} className="space-y-4">
        <Input form={form} setForm={setForm} name="titre" label="Titre" required />
        <SelectEntity prospects={data.prospects} clients={data.clients} prospectId={form.prospect_id ?? ""} clientId={form.client_id ?? ""} setProspectId={(v) => setForm((p) => ({ ...p, prospect_id: v }))} setClientId={(v) => setForm((p) => ({ ...p, client_id: v }))} />
        <div className="grid gap-4 md:grid-cols-3">
          <Input form={form} setForm={setForm} name="type" label="Type" />
          <Input form={form} setForm={setForm} name="due_at" label="Échéance" type="datetime-local" />
          <Input form={form} setForm={setForm} name="priorite" label="Priorité" />
        </div>
        <TextArea form={form} setForm={setForm} name="description" label="Description" />
        <Submit saving={saving} label="Créer tâche" />
      </form>
    </CrmModal>
  );
}

function AppointmentForm({ data, saving, onClose, onSubmit }: { data: CrmDataset; saving: boolean; onClose: () => void; onSubmit: (payload: Partial<CrmAppointmentRow>) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ type: "rdv_commercial", statut: "planifie" });
  return (
    <CrmModal title="Créer un rendez-vous" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form as Partial<CrmAppointmentRow>); }} className="space-y-4">
        <Input form={form} setForm={setForm} name="titre" label="Titre" required />
        <SelectEntity prospects={data.prospects} clients={data.clients} prospectId={form.prospect_id ?? ""} clientId={form.client_id ?? ""} setProspectId={(v) => setForm((p) => ({ ...p, prospect_id: v }))} setClientId={(v) => setForm((p) => ({ ...p, client_id: v }))} />
        <div className="grid gap-4 md:grid-cols-3">
          <Input form={form} setForm={setForm} name="type" label="Type" />
          <Input form={form} setForm={setForm} name="starts_at" label="Début" type="datetime-local" required />
          <Input form={form} setForm={setForm} name="ends_at" label="Fin" type="datetime-local" />
        </div>
        <TextArea form={form} setForm={setForm} name="notes" label="Notes / compte rendu" />
        <Submit saving={saving} label="Créer RDV" />
      </form>
    </CrmModal>
  );
}

function SavForm({ data, saving, onClose, onSubmit }: { data: CrmDataset; saving: boolean; onClose: () => void; onSubmit: (payload: Partial<CrmDataset["sav"][number]>) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ urgence: "normale", statut: "ouvert" });
  return (
    <CrmModal title="Créer ticket SAV" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form as Partial<CrmDataset["sav"][number]>); }} className="space-y-4">
        <Input form={form} setForm={setForm} name="titre" label="Titre" required />
        <label className="space-y-1 text-sm block">
          <div className="text-slate-600">Client</div>
          <select className="w-full rounded-xl border px-3 py-2" value={form.client_id ?? ""} onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}>
            <option value="">Aucun</option>
            {data.clients.map((row) => <option key={row.id} value={row.id}>{entityLabel(row)}</option>)}
          </select>
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <Input form={form} setForm={setForm} name="urgence" label="Urgence" />
          <Input form={form} setForm={setForm} name="planned_at" label="Planifié le" type="datetime-local" />
        </div>
        <TextArea form={form} setForm={setForm} name="description" label="Description" />
        <Submit saving={saving} label="Créer SAV" />
      </form>
    </CrmModal>
  );
}

function DocumentForm({ data, saving, onClose, onSubmit }: { data: CrmDataset; saving: boolean; onClose: () => void; onSubmit: (payload: any) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ type: "autre" });
  return (
    <CrmModal title="Ajouter document CRM" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
        <Input form={form} setForm={setForm} name="nom" label="Nom" required />
        <SelectEntity prospects={data.prospects} clients={data.clients} prospectId={form.prospect_id ?? ""} clientId={form.client_id ?? ""} setProspectId={(v) => setForm((p) => ({ ...p, prospect_id: v }))} setClientId={(v) => setForm((p) => ({ ...p, client_id: v }))} />
        <Input form={form} setForm={setForm} name="url" label="URL / lien document" />
        <TextArea form={form} setForm={setForm} name="notes" label="Notes" />
        <Submit saving={saving} label="Ajouter document" />
      </form>
    </CrmModal>
  );
}

function InvoiceForm({ data, saving, onClose, onSubmit }: { data: CrmDataset; saving: boolean; onClose: () => void; onSubmit: (payload: any) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ type: "acompte", statut: "brouillon" });
  return (
    <CrmModal title="Créer facture base" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
        <label className="space-y-1 text-sm block">
          <div className="text-slate-600">Client</div>
          <select className="w-full rounded-xl border px-3 py-2" value={form.client_id ?? ""} onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}>
            <option value="">Aucun</option>
            {data.clients.map((row) => <option key={row.id} value={row.id}>{entityLabel(row)}</option>)}
          </select>
        </label>
        <div className="grid gap-4 md:grid-cols-3">
          <Input form={form} setForm={setForm} name="type" label="Type" />
          <Input form={form} setForm={setForm} name="amount_ht" label="Montant HT" type="number" />
          <Input form={form} setForm={setForm} name="due_date" label="Échéance" type="date" />
        </div>
        <Submit saving={saving} label="Créer facture" />
      </form>
    </CrmModal>
  );
}

function PurchaseForm({ data, saving, onClose, onSubmit }: { data: CrmDataset; saving: boolean; onClose: () => void; onSubmit: (payload: any) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ category: "materials", status: "planned", tva_rate: "20" });
  return (
    <CrmModal title="Créer un achat fournisseur" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm block">
            <div className="text-slate-600">Chantier</div>
            <select className="w-full rounded-xl border px-3 py-2" value={form.chantier_id ?? ""} onChange={(e) => setForm((p) => ({ ...p, chantier_id: e.target.value }))}>
              <option value="">Aucun</option>
              {data.chantiers.map((row) => <option key={row.id} value={row.id}>{row.nom}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm block">
            <div className="text-slate-600">Devis CRM</div>
            <select className="w-full rounded-xl border px-3 py-2" value={form.quote_id ?? ""} onChange={(e) => setForm((p) => ({ ...p, quote_id: e.target.value }))}>
              <option value="">Aucun</option>
              {data.quotes.map((row) => <option key={row.id} value={row.id}>{row.quote_number}</option>)}
            </select>
          </label>
        </div>
        <Input form={form} setForm={setForm} name="label" label="Libellé achat" required />
        <div className="grid gap-4 md:grid-cols-4">
          <Input form={form} setForm={setForm} name="category" label="Catégorie" />
          <Input form={form} setForm={setForm} name="amount_ht" label="Montant HT" type="number" />
          <Input form={form} setForm={setForm} name="tva_rate" label="TVA %" type="number" />
          <Input form={form} setForm={setForm} name="status" label="Statut" />
        </div>
        <TextArea form={form} setForm={setForm} name="notes" label="Notes" />
        <Submit saving={saving} label="Créer achat" />
      </form>
    </CrmModal>
  );
}

function CrmIdentityFields({ form, setForm }: { form: Record<string, string>; setForm: Dispatch<SetStateAction<Record<string, string>>> }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Input form={form} setForm={setForm} name="type" label="Type" />
        <Input form={form} setForm={setForm} name="civilite" label="Civilité" />
        <Input form={form} setForm={setForm} name="societe" label="Société" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input form={form} setForm={setForm} name="prenom" label="Prénom" />
        <Input form={form} setForm={setForm} name="nom" label="Nom" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Input form={form} setForm={setForm} name="email" label="Email" type="email" />
        <Input form={form} setForm={setForm} name="telephone" label="Téléphone" />
        <Input form={form} setForm={setForm} name="mobile" label="Mobile" />
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_140px_minmax(0,1fr)]">
        <Input form={form} setForm={setForm} name="adresse" label="Adresse" />
        <Input form={form} setForm={setForm} name="code_postal" label="Code postal" />
        <Input form={form} setForm={setForm} name="ville" label="Ville" />
      </div>
      <Input form={form} setForm={setForm} name="tags" label="Tags (séparés par virgules)" />
    </>
  );
}

function Input({ form, setForm, name, label, type = "text", required = false }: { form: Record<string, string>; setForm: Dispatch<SetStateAction<Record<string, string>>>; name: string; label: string; type?: string; required?: boolean }) {
  return (
    <label className="block space-y-1 text-sm">
      <div className="text-slate-600">{label}</div>
      <input
        className="w-full rounded-xl border px-3 py-2"
        value={form[name] ?? ""}
        onChange={(event) => setForm((prev) => ({ ...prev, [name]: event.target.value }))}
        type={type}
        required={required}
      />
    </label>
  );
}

function TextArea({ form, setForm, name, label }: { form: Record<string, string>; setForm: Dispatch<SetStateAction<Record<string, string>>>; name: string; label: string }) {
  return (
    <label className="block space-y-1 text-sm">
      <div className="text-slate-600">{label}</div>
      <textarea
        className="min-h-28 w-full rounded-xl border px-3 py-2"
        value={form[name] ?? ""}
        onChange={(event) => setForm((prev) => ({ ...prev, [name]: event.target.value }))}
      />
    </label>
  );
}

function Submit({ saving, label }: { saving: boolean; label: string }) {
  return (
    <div className="flex justify-end">
      <button disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60">
        {saving ? "Enregistrement..." : label}
      </button>
    </div>
  );
}
