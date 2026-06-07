import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QuoteWorkspace } from "../features/quotes/components/workspace/QuoteWorkspace";
import { createEmptyQuote, withTotals } from "../features/quotes/application/quoteEngine";
import { useQuote } from "../features/quotes/hooks/useQuote";
import { useQuoteStore } from "../features/quotes/store/quoteStore";
import { flattenQuoteForPersistence, mapQuoteNodeToItemPatch, mapQuoteToQuotePatch } from "../features/quotes/infrastructure/quoteMapper";
import type { Quote } from "../features/quotes/domain/Quote";
import type { QuoteLineNode } from "../features/quotes/domain/QuoteLine";
import type { QuoteNode } from "../features/quotes/domain/QuoteSection";
import type { QuoteVatRate } from "../features/quotes/domain/QuoteEnums";
import { useProjectsData } from "../features/projects/hooks/useProjectsData";
import type { ProjectRecord } from "../features/projects/types";
import { createCrmQuote, createCrmQuoteItemFromTemplate } from "../services/crm.service";
import { loadLatestCrmVisitQuoteSource, type CrmVisitQuoteSource } from "../services/crmVisitReports.service";

export default function ProjectQuoteBuilderPage() {
  const { projectId, quoteId } = useParams();
  const navigate = useNavigate();
  const hydratedRef = useRef(false);
  const [visitSource, setVisitSource] = useState<CrmVisitQuoteSource | null>(null);
  const [visitSourceLoading, setVisitSourceLoading] = useState(true);
  const { projectsById, loading: projectsLoading, error: projectsError } = useProjectsData();
  const project = projectId ? projectsById.get(projectId) ?? null : null;
  const quoteQuery = useQuote(quoteId);
  const hydrate = useQuoteStore((state) => state.hydrate);
  const quote = useQuoteStore((state) => state.quote);
  const setSaveState = useQuoteStore((state) => state.setSaveState);

  useEffect(() => {
    let alive = true;
    if (quoteId || !project) {
      setVisitSourceLoading(false);
      return;
    }
    setVisitSourceLoading(true);
    loadLatestCrmVisitQuoteSource({
      opportunity_id: project.opportunity?.id ?? null,
      prospect_id: project.prospect?.id ?? null,
      client_id: project.client?.id ?? null,
    })
      .then((source) => {
        if (!alive) return;
        setVisitSource(source ?? readVisitQuoteSource(project.id));
      })
      .catch(() => {
        if (!alive) return;
        setVisitSource(readVisitQuoteSource(project.id));
      })
      .finally(() => {
        if (alive) setVisitSourceLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [project, quoteId]);

  useEffect(() => {
    if (quoteId || hydratedRef.current || !project || visitSourceLoading) return;
    hydrate(buildProjectQuote(project, visitSource));
    hydratedRef.current = true;
  }, [hydrate, project, quoteId, visitSource, visitSourceLoading]);

  const options = useMemo(() => {
    if (quoteId && quoteQuery.dataset) return quoteQuery.options;
    if (!project) return { clients: [], prospects: [], projects: [] };
    return {
      clients: project.client
        ? [{ id: project.client.id, label: project.clientName, address: project.address ?? "", phone: project.contactPhone, email: project.contactEmail }]
        : [],
      prospects: project.prospect
        ? [{ id: project.prospect.id, label: project.clientName, address: project.address ?? "", phone: project.contactPhone, email: project.contactEmail }]
        : [],
      projects: [{ id: project.id, label: project.name, clientName: project.clientName, address: project.address ?? "", clientId: project.client?.id ?? null, prospectId: project.prospect?.id ?? null }],
    };
  }, [project, quoteId, quoteQuery.dataset, quoteQuery.options]);

  if (projectsLoading || visitSourceLoading || (quoteId && quoteQuery.loading)) {
    return <div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement de l'editeur devis...</div>;
  }

  if (projectsError || !project) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{projectsError ?? "Projet introuvable."}</div>;
  }

  if (quoteId && (quoteQuery.error || !quoteQuery.dataset)) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{quoteQuery.error ?? "Devis introuvable."}</div>;
  }

  const currentProject = project;

  async function save() {
    if (quoteId) {
      await quoteQuery.save();
      return;
    }
    try {
      setSaveState("saving");
      const savedQuote = await createProjectQuote(quote);
      localStorage.removeItem(`batipro.project-quote-draft.${currentProject.id}`);
      localStorage.removeItem(`batipro.project-quote-source.${currentProject.id}`);
      setSaveState("saved");
      navigate(`/projets/${currentProject.id}/devis/${savedQuote.id}/edit`);
    } catch (error) {
      setSaveState("error", error instanceof Error ? error.message : "Creation du devis impossible.");
    }
  }

  return (
    <QuoteWorkspace
      oldQuotes={currentProject.quotes}
      clients={options.clients}
      prospects={options.prospects}
      projects={options.projects}
      saving={quoteId ? quoteQuery.saving : false}
      onSave={() => void save()}
      onSend={() => window.alert("Envoi devis a finaliser apres persistance Supabase du devis projet.")}
      onClose={() => navigate(`/projets/${currentProject.id}?tab=quotes`)}
    />
  );
}

async function createProjectQuote(quote: Quote) {
  const quotePatch = mapQuoteToQuotePatch(quote);
  const createdQuote = await createCrmQuote({ ...quotePatch, montant_ht: quote.totals.sellHt, montant_ttc: quote.totals.ttc, tva: quote.settings.defaultVatRate, statut: "brouillon" });

  const idMap = new Map<string, string>();
  const quoteToPersist: Quote = { ...quote, id: createdQuote.id };
  for (const row of flattenQuoteForPersistence(quoteToPersist)) {
    const patch = mapQuoteNodeToItemPatch(row.node, createdQuote.id, row.order);
    const parentItemId = row.node.parentId ? idMap.get(row.node.parentId) ?? null : null;
    const createdItem = await createCrmQuoteItemFromTemplate({
      quote_id: createdQuote.id,
      parentItemId,
      lineType: patch.line_type,
      designation: patch.designation,
      description: patch.description,
      quantity: patch.quantite,
      unit: patch.unite,
      unitPriceHt: patch.sale_unit_price_ht,
      tvaRate: patch.tva_rate,
      ordre: row.order,
    });
    idMap.set(row.node.id, createdItem.id);
  }

  return createdQuote;
}

function buildProjectQuote(project: ProjectRecord, source: CrmVisitQuoteSource | null): Quote {
  const draft = readStoredQuoteDraft(project.id);
  if (draft) return withTotals(draft);

  return withTotals({
    ...createEmptyQuote(null, `DEV-${new Date().getFullYear()}-${project.id.slice(0, 6).toUpperCase()}`),
    projectId: project.id,
    clientId: project.client?.id ?? null,
    prospectId: project.prospect?.id ?? null,
    clientName: project.clientName,
    siteAddress: project.address ?? "",
    description: source?.needDescription || project.needDescription || project.name,
    nodes: mapVisitLinesToQuoteNodes(source),
  });
}

function readStoredQuoteDraft(projectId: string): Quote | null {
  const raw = localStorage.getItem(`batipro.project-quote-draft.${projectId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Quote;
  } catch {
    return null;
  }
}

function readVisitQuoteSource(projectId: string): CrmVisitQuoteSource | null {
  const raw = localStorage.getItem(`batipro.project-quote-source.${projectId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CrmVisitQuoteSource;
  } catch {
    return null;
  }
}

function mapVisitLinesToQuoteNodes(source: CrmVisitQuoteSource | null): QuoteNode[] {
  if (!source?.lines?.length) return [];
  const sectionMap = new Map<string, QuoteNode>();
  const roots: QuoteNode[] = [];

  for (const item of source.lines) {
    if (item.type !== "section") continue;
    const section: QuoteNode = { id: crypto.randomUUID(), persistedId: null, type: "section", parentId: null, title: item.title || "Section", order: roots.length + 1, children: [] };
    if (item.id) sectionMap.set(item.id, section);
    roots.push(section);
  }

  for (const item of source.lines) {
    if (item.type !== "task") continue;
    const parent = item.parentId ? sectionMap.get(item.parentId) : null;
    const target = parent && parent.type === "section" ? parent.children : roots;
    const line: QuoteLineNode = {
      id: crypto.randomUUID(),
      persistedId: null,
      type: "line",
      parentId: parent?.id ?? null,
      title: item.title || "Prestation",
      order: target.length + 1,
      kind: "fourniture",
      quantity: Number(item.quantity ?? 0),
      unit: normalizeQuoteUnit(item.unit),
      saleUnitPriceHt: Number(item.priceHintHt ?? 0),
      purchaseUnitPriceHt: 0,
      vatRate: 20 as QuoteVatRate,
      reference: item.libraryId ?? null,
    };
    target.push(line);
    const note = [item.technicalNotes, item.constraints].filter(Boolean).join("\n");
    if (note) target.push({ id: crypto.randomUUID(), persistedId: null, type: "text", parentId: parent?.id ?? null, title: "Note technique", order: target.length + 1, content: note });
  }

  return roots;
}

function normalizeQuoteUnit(unit: string | null | undefined) {
  if (unit === "m2") return "m²";
  if (unit === "m3") return "m³";
  return unit || "u";
}
