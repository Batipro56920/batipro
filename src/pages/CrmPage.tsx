import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createCrmAppointment,
  createCrmClient,
  createCrmDocument,
  createCrmInvoice,
  createCrmProspect,
  createCrmPurchase,
  createCrmSav,
  createCrmTask,
  downloadCrmQuotePdf,
  loadCrmDataset,
  loadCrmQuoteEngineData,
  moveCrmOpportunityStage,
  transformAcceptedQuoteToChantier,
  updateCrmProspect,
  updateCrmQuote,
  updateCrmTask,
  upsertCrmOpportunity,
  convertProspectToClient,
  type CrmDataset,
  type CrmQuoteRow,
} from "../services/crm.service";
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
    navigate("/projets");
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
        onCreateOpportunity={() => setModal("opportunity")}
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
          rows={data.prospects}
          query={query}
          setQuery={setQuery}
          onCreate={() => setModal("prospect")}
          onConvert={(row) => submitSafely(async () => convertProspectToClient(row))}
          onStatus={(row, statut) => submitSafely(async () => updateCrmProspect(row.id, { statut }))}
          onTask={(row) => submitSafely(async () => createCrmTask({ prospect_id: row.id, type: "relance", titre: `Relancer ${entityLabel(row)}`, due_at: new Date().toISOString() }))}
          onCreateOpportunity={() => setModal("opportunity")}
          onCreateQuote={createDraftQuoteAndOpen}
        />
      ) : section === "clients" ? (
        <CrmClientsSection
          rows={data.clients}
          chantiers={data.chantiers}
          sav={data.sav}
          quotes={data.quotes}
          invoices={data.invoices}
          documents={data.documents}
          query={query}
          setQuery={setQuery}
          onCreate={() => setModal("client")}
        />
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
          rows={data.quotes}
          prospectById={prospectById}
          clientById={clientById}
          onCreate={createDraftQuoteAndOpen}
          onStatus={(row, statut) => submitSafely(async () => updateCrmQuote(row.id, { statut }))}
          onTransform={transformQuote}
          onPdf={downloadQuote}
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
        <CrmSavSection rows={data.sav} clients={clientById} chantiers={data.chantiers} onCreate={() => setModal("sav")} />
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
      </Suspense>
    </div>
  );
}

















