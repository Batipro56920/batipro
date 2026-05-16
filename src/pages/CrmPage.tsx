import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  type CrmDataset,
  type CrmQuoteRow,
  type CrmQuoteEngineData,
} from "../services/crm.service";
import { buildQuoteDefaults, getCompanyQuoteSettings } from "../features/quotes/infrastructure/companyQuoteSettingsRepository";
import { ErrorAlert, LoadingState } from "../components/ui/design-system";
import { CrmHeader } from "../features/crm/components/CrmHeader";
import { entityLabel } from "../features/crm/components/crmFormat";
import CrmAgendaSection from "../features/crm/pages/CrmAgendaSection";
import CrmClientsSection from "../features/crm/pages/CrmClientsSection";
import CrmContactsSection from "../features/crm/pages/CrmContactsSection";
import CrmDashboardSection from "../features/crm/pages/CrmDashboardSection";
import CrmInvoicesSection from "../features/crm/pages/CrmInvoicesSection";
import CrmLibrarySection from "../features/crm/pages/CrmLibrarySection";
import CrmOpportunitiesSection from "../features/crm/pages/CrmOpportunitiesSection";
import CrmProspectsSection from "../features/crm/pages/CrmProspectsSection";
import CrmPurchasesSection from "../features/crm/pages/CrmPurchasesSection";
import CrmQuotesSection from "../features/crm/pages/CrmQuotesSection";
import CrmResourcesSection from "../features/crm/pages/CrmResourcesSection";
import CrmSavSection from "../features/crm/pages/CrmSavSection";
import CrmSettingsSection from "../features/crm/pages/CrmSettingsSection";
import CrmStatsSection from "../features/crm/pages/CrmStatsSection";
import type { CrmModalKey, CrmSection } from "../features/crm/types";

const CrmAppointmentDialog = lazy(() => import("../features/crm/dialogs/CrmAppointmentDialog"));
const CrmClientDialog = lazy(() => import("../features/crm/dialogs/CrmClientDialog"));
const CrmDocumentDialog = lazy(() => import("../features/crm/dialogs/CrmDocumentDialog"));
const CrmInvoiceDialog = lazy(() => import("../features/crm/dialogs/CrmInvoiceDialog"));
const CrmOpportunityDialog = lazy(() => import("../features/crm/dialogs/CrmOpportunityDialog"));
const CrmProspectDialog = lazy(() => import("../features/crm/dialogs/CrmProspectDialog"));
const CrmPurchaseDialog = lazy(() => import("../features/crm/dialogs/CrmPurchaseDialog"));
const CrmQuoteDialog = lazy(() => import("../features/crm/dialogs/CrmQuoteDialog"));
const CrmSavDialog = lazy(() => import("../features/crm/dialogs/CrmSavDialog"));
const CrmTaskDialog = lazy(() => import("../features/crm/dialogs/CrmTaskDialog"));

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



export default function CrmPage({ section = "dashboard" }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<CrmDataset>(EMPTY_DATASET);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<CrmModalKey | null>(null);
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

  return (
    <div className="bt-page">
      <CrmHeader
        section={section}
        onRefresh={refresh}
        onCreateProspect={() => setModal("prospect")}
        onCreateQuote={createDraftQuoteAndOpen}
      />

      {error ? <ErrorAlert message={error} /> : null}
      {loading ? (
        <LoadingState label="Chargement du CRM..." />
      ) : section === "dashboard" ? (
        <CrmDashboardSection
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
        <CrmProspectsSection
          rows={filteredProspects}
          query={query}
          setQuery={setQuery}
          onCreate={() => setModal("prospect")}
          onConvert={(row) => submitSafely(async () => convertProspectToClient(row))}
          onStatus={(row, statut) => submitSafely(async () => updateCrmProspect(row.id, { statut }))}
          onTask={(row) => submitSafely(async () => createCrmTask({ prospect_id: row.id, type: "relance", titre: `Relancer ${entityLabel(row)}`, due_at: new Date().toISOString() }))}
        />
      ) : section === "clients" ? (
        <CrmClientsSection rows={filteredClients} chantiers={data.chantiers} sav={data.sav} query={query} setQuery={setQuery} onCreate={() => setModal("client")} />
      ) : section === "opportunities" ? (
        <CrmOpportunitiesSection
          data={data}
          prospectById={prospectById}
          clientById={clientById}
          dragOpportunityId={dragOpportunityId}
          setDragOpportunityId={setDragOpportunityId}
          onMove={(opportunity, stage) => submitSafely(async () => moveCrmOpportunityStage(opportunity.id, stage))}
          onCreate={() => setModal("opportunity")}
        />
      ) : section === "quotes" ? (
        <CrmQuotesSection
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
        <CrmInvoicesSection rows={data.invoices} clients={clientById} onCreate={() => setModal("invoice")} />
      ) : section === "purchases" ? (
        <CrmPurchasesSection rows={data.purchases} chantiers={data.chantiers} onCreate={() => setModal("purchase")} />
      ) : section === "contacts" ? (
        <CrmContactsSection prospects={data.prospects} clients={data.clients} />
      ) : section === "resources" ? (
        <CrmResourcesSection templates={data.taskTemplates} />
      ) : section === "library" ? (
        <CrmLibrarySection templates={data.taskTemplates} />
      ) : section === "agenda" ? (
        <CrmAgendaSection tasks={data.tasks} appointments={data.appointments} onTask={() => setModal("task")} onAppointment={() => setModal("appointment")} onDone={(row) => submitSafely(async () => updateCrmTask(row.id, { statut: "terminee" }))} />
      ) : section === "sav" ? (
        <CrmSavSection rows={data.sav} clients={clientById} onCreate={() => setModal("sav")} />
      ) : section === "stats" ? (
        <CrmStatsSection data={data} kpis={kpis} transformationRate={transformationRate} />
      ) : (
        <CrmSettingsSection stages={data.stages} />
      )}

      <Suspense fallback={null}>
        {modal === "prospect" ? <CrmProspectDialog saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => createCrmProspect(payload))} /> : null}
        {modal === "client" ? <CrmClientDialog saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => createCrmClient(payload))} /> : null}
        {modal === "opportunity" ? <CrmOpportunityDialog data={data} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => upsertCrmOpportunity(payload))} /> : null}
        {modal === "task" ? <CrmTaskDialog data={data} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => createCrmTask(payload))} /> : null}
        {modal === "appointment" ? <CrmAppointmentDialog data={data} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => createCrmAppointment(payload))} /> : null}
        {modal === "sav" ? <CrmSavDialog data={data} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => createCrmSav(payload))} /> : null}
        {modal === "document" ? <CrmDocumentDialog data={data} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => createCrmDocument(payload))} /> : null}
        {modal === "invoice" ? <CrmInvoiceDialog data={data} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => createCrmInvoice(payload))} /> : null}
        {modal === "purchase" ? <CrmPurchaseDialog data={data} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => submitSafely(() => createCrmPurchase(payload))} /> : null}
        {quoteEngine ? (
          <CrmQuoteDialog
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
      </Suspense>
    </div>
  );
}

























