import type { ProjectRecord } from "../../projects/types";
import type { CrmQuoteEngineData, CrmQuoteItemRow } from "../../../services/crm.service";
import type { QuoteBuilderItem, QuoteBuilderItemKind, QuoteBuilderNode, QuoteBuilderQuote, QuoteBuilderSection, QuoteBuilderSubsection, QuoteBuilderUnit } from "./types";

type VisitQuoteSource = {
  needDescription?: string;
  lines?: Array<{
    id?: string;
    type?: string;
    parentId?: string | null;
    title?: string;
    unit?: string;
    quantity?: number;
    priceHintHt?: number | null;
    technicalNotes?: string;
    constraints?: string;
    libraryId?: string | null;
  }>;
};

export function createQuoteBuilderFromProject(project: ProjectRecord): QuoteBuilderQuote {
  const source = readVisitQuoteSource(project.id);
  return {
    id: null,
    projectId: project.id,
    clientId: project.client?.id ?? null,
    prospectId: project.prospect?.id ?? null,
    opportunityId: project.opportunity?.id ?? null,
    number: `DEV-${new Date().getFullYear()}-${project.id.slice(0, 6).toUpperCase()}`,
    status: "draft",
    date: new Date().toISOString().slice(0, 10),
    validUntil: null,
    clientName: project.clientName || "Client a renseigner",
    siteAddress: project.address ?? "",
    description: source?.needDescription || project.needDescription || project.name,
    paymentTerms: "Acompte de 30% a la signature, solde selon avancement et reception.",
    legalMentions: "Devis valable selon la date indiquee. Travaux soumis aux conditions generales de l'entreprise.",
    footerNotes: "",
    settings: { defaultVatRate: 20, depositPercent: 30, showVatColumn: true, showQuantityColumns: true, hideSectionTotals: false },
    nodes: source?.lines?.length ? mapVisitToQuoteNodes(source) : [createSection("Nouvelle section")],
  };
}

export function createQuoteBuilderFromEngine(engine: CrmQuoteEngineData, project: ProjectRecord): QuoteBuilderQuote {
  return {
    ...createQuoteBuilderFromProject(project),
    id: engine.quote.id,
    number: engine.quote.quote_number,
    status: engine.quote.statut === "envoye" ? "sent" : engine.quote.statut === "accepte" ? "accepted" : "saved",
    date: engine.quote.date_emission ?? new Date().toISOString().slice(0, 10),
    validUntil: engine.quote.valid_until,
    description: engine.quote.description ?? project.needDescription ?? project.name,
    paymentTerms: engine.quote.payment_terms_text ?? engine.quote.conditions ?? "Acompte de 30% a la signature, solde selon avancement et reception.",
    legalMentions: typeof engine.quote.legal_mentions === "object" && engine.quote.legal_mentions ? String((engine.quote.legal_mentions as Record<string, unknown>).text ?? "") : "",
    nodes: mapCrmItemsToQuoteNodes(engine.items),
  };
}

export function createSection(title = "Section"): QuoteBuilderSection {
  return { id: crypto.randomUUID(), persistedId: null, type: "section", title, children: [] };
}

export function createSubsection(title = "Sous-section"): QuoteBuilderSubsection {
  return { id: crypto.randomUUID(), persistedId: null, type: "subsection" as const, title, children: [] };
}

export function createItem(title = "Nouvelle prestation", patch: Partial<QuoteBuilderItem> = {}): QuoteBuilderItem {
  return {
    id: crypto.randomUUID(),
    persistedId: null,
    type: "item",
    kind: "fourniture",
    title,
    quantity: 1,
    unit: "u",
    unitPriceHt: 0,
    vatRate: 20,
    ...patch,
  };
}

export function cloneWithPatch(quote: QuoteBuilderQuote, nodeId: string, patch: Partial<QuoteBuilderNode>): QuoteBuilderQuote {
  return { ...quote, nodes: updateNodes(quote.nodes, nodeId, patch) };
}

export function removeNodeFromQuote(quote: QuoteBuilderQuote, nodeId: string): QuoteBuilderQuote {
  return { ...quote, nodes: removeNode(quote.nodes, nodeId) };
}

export function appendNode(quote: QuoteBuilderQuote, parentId: string | null, node: QuoteBuilderNode): QuoteBuilderQuote {
  if (node.type === "section") return { ...quote, nodes: [...quote.nodes, node] };
  const targetId = parentId ?? quote.nodes.at(-1)?.id;
  if (!targetId) return { ...quote, nodes: [{ ...createSection("Section 1"), children: [node as QuoteBuilderItem] }] };
  return { ...quote, nodes: appendToParent(quote.nodes, targetId, node) };
}

export function moveNode(quote: QuoteBuilderQuote, activeId: string, overId: string): QuoteBuilderQuote {
  if (activeId === overId) return quote;
  return { ...quote, nodes: moveInSiblings(quote.nodes, activeId, overId) };
}

function mapVisitToQuoteNodes(source: VisitQuoteSource): QuoteBuilderSection[] {
  const sections = new Map<string, QuoteBuilderSection>();
  const roots: QuoteBuilderSection[] = [];
  for (const item of source.lines ?? []) {
    if (item.type !== "section") continue;
    const section = createSection(item.title || "Section");
    if (item.id) sections.set(item.id, section);
    roots.push(section);
  }
  for (const item of source.lines ?? []) {
    if (item.type !== "task") continue;
    let section = item.parentId ? sections.get(item.parentId) : roots.at(-1);
    if (!section) {
      section = createSection("Releve visite");
      roots.push(section);
    }
    section.children.push(createItem(item.title || "Prestation relevee", {
      quantity: Number(item.quantity ?? 1),
      unit: normalizeUnit(item.unit),
      unitPriceHt: Number(item.priceHintHt ?? 0),
      internalNote: [item.technicalNotes, item.constraints].filter(Boolean).join("\n"),
      sourceLibraryId: item.libraryId ?? null,
    }));
  }
  return roots.length ? roots : [createSection("Nouvelle section")];
}

function mapCrmItemsToQuoteNodes(items: CrmQuoteItemRow[]): QuoteBuilderSection[] {
  const sorted = [...items].sort((a, b) => Number(a.ordre ?? 0) - Number(b.ordre ?? 0));
  const roots: QuoteBuilderSection[] = [];
  let currentSection: QuoteBuilderSection | null = null;
  let currentSubsection: QuoteBuilderSubsection | null = null;

  for (const row of sorted) {
    if (row.line_type === "section") {
      currentSection = createSection(row.designation);
      currentSection.persistedId = row.id;
      roots.push(currentSection);
      currentSubsection = null;
      continue;
    }
    if (row.line_type === "subsection" || row.line_type === "sous_section") {
      currentSubsection = createSubsection(row.designation);
      currentSubsection.persistedId = row.id;
      if (!currentSection) {
        currentSection = createSection("Section");
        roots.push(currentSection);
      }
      currentSection.children.push(currentSubsection);
      continue;
    }
    const item = createItem(row.designation, {
      persistedId: row.id,
      kind: dbKind(row.line_type),
      description: row.description ?? "",
      quantity: Number(row.quantite ?? 1),
      unit: normalizeUnit(row.unite),
      unitPriceHt: Number(row.sale_unit_price_ht ?? row.prix_unitaire_ht ?? 0),
      vatRate: Number(row.tva_rate ?? 20),
      internalNote: row.technical_description ?? "",
      sourceLibraryId: row.task_template_id,
    });
    if (currentSubsection) currentSubsection.children.push(item);
    else {
      if (!currentSection) {
        currentSection = createSection("Section");
        roots.push(currentSection);
      }
      currentSection.children.push(item);
    }
  }
  return roots.length ? roots : [createSection("Nouvelle section")];
}

function appendToParent(nodes: QuoteBuilderSection[], parentId: string, node: QuoteBuilderNode): QuoteBuilderSection[] {
  return nodes.map((section) => {
    if (section.id === parentId && node.type !== "section") return { ...section, children: [...section.children, node as QuoteBuilderItem | QuoteBuilderSubsection] };
    return {
      ...section,
      children: section.children.map((child) => child.type === "subsection" && child.id === parentId && node.type === "item" ? { ...child, children: [...child.children, node] } : child),
    };
  });
}

function updateNodes(nodes: QuoteBuilderSection[], nodeId: string, patch: Partial<QuoteBuilderNode>): QuoteBuilderSection[] {
  return nodes.map((section) => {
    if (section.id === nodeId) return { ...section, ...patch } as QuoteBuilderSection;
    return {
      ...section,
      children: section.children.map((child) => {
        if (child.id === nodeId) return { ...child, ...patch } as QuoteBuilderSubsectionOrItem;
        if (child.type !== "subsection") return child;
        return { ...child, children: child.children.map((item) => item.id === nodeId ? { ...item, ...patch } as QuoteBuilderItem : item) };
      }),
    };
  });
}

type QuoteBuilderSubsectionOrItem = QuoteBuilderSection["children"][number];

function removeNode(nodes: QuoteBuilderSection[], nodeId: string): QuoteBuilderSection[] {
  return nodes
    .filter((section) => section.id !== nodeId)
    .map((section) => ({
      ...section,
      children: section.children
        .filter((child) => child.id !== nodeId)
        .map((child) => child.type === "subsection" ? { ...child, children: child.children.filter((item) => item.id !== nodeId) } : child),
    }));
}

function moveInSiblings(nodes: QuoteBuilderSection[], activeId: string, overId: string): QuoteBuilderSection[] {
  const movedRoots = reorder(nodes, activeId, overId);
  if (movedRoots !== nodes) return movedRoots;
  return nodes.map((section) => ({
    ...section,
    children: reorder(section.children.map((child) => child.type === "subsection" ? { ...child, children: reorder(child.children, activeId, overId) } : child), activeId, overId),
  }));
}

function reorder<T extends { id: string }>(items: T[], activeId: string, overId: string): T[] {
  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function normalizeUnit(unit: string | null | undefined): QuoteBuilderUnit {
  if (unit === "m²") return "m2";
  if (unit === "m³") return "m3";
  if (unit === "u" || unit === "h" || unit === "ml" || unit === "m2" || unit === "m3" || unit === "forfait") return unit;
  return "u";
}

function dbKind(value: string | null | undefined): QuoteBuilderItemKind {
  if (value === "labor" || value === "main_oeuvre") return "main_oeuvre";
  if (value === "subcontracting" || value === "sous_traitance") return "sous_traitance";
  if (value === "equipment" || value === "materiel") return "materiel";
  if (value === "ouvrage" || value === "composite") return "ouvrage";
  if (value === "misc" || value === "divers") return "divers";
  return "fourniture";
}

function readVisitQuoteSource(projectId: string): VisitQuoteSource | null {
  const raw = localStorage.getItem(`batipro.project-quote-source.${projectId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VisitQuoteSource;
  } catch {
    return null;
  }
}
