import { format, addDays } from "date-fns";
import { calculateQuoteTotals, flattenQuoteNodes } from "./quoteCalculations";
import type { Quote, QuoteAccountOption, QuoteProjectOption } from "../domain/Quote";
import type { QuoteLineKind, QuoteNodeType, QuoteVatRate } from "../domain/QuoteEnums";
import { DEFAULT_QUOTE_SETTINGS } from "../domain/QuoteSettings";
import { EMPTY_QUOTE_TOTALS } from "../domain/QuoteTotals";
import type { QuoteCompositeNode, QuoteLineNode, QuoteTextNode, QuotePageBreakNode } from "../domain/QuoteLine";
import type { QuoteNode, QuoteSectionNode, QuoteSubsectionNode } from "../domain/QuoteSection";
import type { TaskTemplateRow } from "../../../services/taskLibrary.service";

export function createEmptyQuote(id: string | null, number = "DEV-BROUILLON"): Quote {
  const today = new Date();
  return {
    id,
    number,
    date: format(today, "yyyy-MM-dd"),
    validityDate: format(addDays(today, 30), "yyyy-MM-dd"),
    workStartDate: null,
    estimatedDuration: null,
    salespersonId: null,
    clientId: null,
    prospectId: null,
    projectId: null,
    clientName: "",
    siteAddress: "",
    description: "",
    paymentTerms: "30% a la signature, solde selon avancement et reception des travaux.",
    legalMentions: "Devis valable selon la date indiquee. Travaux soumis aux conditions generales de l'entreprise.",
    wasteManagement: "Gestion des dechets selon la reglementation applicable.",
    footerNotes: "",
    status: "draft",
    settings: DEFAULT_QUOTE_SETTINGS,
    nodes: [],
    totals: EMPTY_QUOTE_TOTALS,
  };
}

export function withTotals(quote: Quote): Quote {
  return { ...quote, totals: calculateQuoteTotals(quote) };
}

export function addQuoteNode(quote: Quote, type: QuoteNodeType, parentId: string | null = null, lineKind: QuoteLineKind = "fourniture"): Quote {
  const siblings = parentId ? findChildren(quote.nodes, parentId) : quote.nodes;
  const node = createNode(type, parentId, siblings.length + 1, quote.settings.defaultVatRate, lineKind);
  const nodes = parentId ? updateChildren(quote.nodes, parentId, (children) => [...children, node]) : [...quote.nodes, node];
  return withTotals({ ...quote, nodes });
}

export function addTemplateQuoteNode(quote: Quote, template: TaskTemplateRow): Quote {
  const node: QuoteCompositeNode = {
    id: crypto.randomUUID(),
    persistedId: null,
    type: "composite",
    parentId: null,
    title: template.titre,
    order: quote.nodes.length + 1,
    quantity: template.quantite_defaut ?? 1,
    unit: template.unite ?? "u",
    vatRate: quote.settings.defaultVatRate,
    reference: template.id,
    components: [
      {
        id: crypto.randomUUID(),
        kind: "fourniture",
        label: template.titre,
        quantity: 1,
        unit: template.unite ?? "u",
        purchaseUnitPriceHt: template.cout_reference_unitaire_ht ?? 0,
        saleUnitPriceHt: template.cout_reference_unitaire_ht ?? 0,
        vatRate: quote.settings.defaultVatRate,
        supplierId: null,
        supplierReference: null,
        order: 1,
      },
    ],
  };
  return withTotals({ ...quote, nodes: [...quote.nodes, node] });
}

export function updateQuoteNode(quote: Quote, nodeId: string, patch: Partial<QuoteNode>): Quote {
  return withTotals({ ...quote, nodes: mapNodes(quote.nodes, (node) => (node.id === nodeId ? ({ ...node, ...patch } as QuoteNode) : node)) });
}

export function removeQuoteNode(quote: Quote, nodeId: string): Quote {
  return withTotals({ ...quote, nodes: removeNode(quote.nodes, nodeId) });
}

export function moveQuoteNode(quote: Quote, nodeId: string, direction: -1 | 1): Quote {
  return withTotals({ ...quote, nodes: moveNode(quote.nodes, nodeId, direction) });
}

export function moveQuoteNodeBefore(quote: Quote, nodeId: string, targetId: string): Quote {
  if (nodeId === targetId) return quote;
  return withTotals({ ...quote, nodes: moveNodeBefore(quote.nodes, nodeId, targetId) });
}

export function duplicateQuoteNode(quote: Quote, nodeId: string): Quote {
  return withTotals({ ...quote, nodes: duplicateNode(quote.nodes, nodeId) });
}

export function applyQuoteClient(quote: Quote, client: QuoteAccountOption | null): Quote {
  return {
    ...quote,
    clientId: client?.id ?? null,
    prospectId: null,
    clientName: client?.label ?? "",
    siteAddress: client?.address || quote.siteAddress,
  };
}

export function applyQuoteProspect(quote: Quote, prospect: QuoteAccountOption | null): Quote {
  return {
    ...quote,
    prospectId: prospect?.id ?? null,
    clientId: null,
    clientName: prospect?.label ?? "",
    siteAddress: prospect?.address || quote.siteAddress,
  };
}

export function applyQuoteProject(quote: Quote, project: QuoteProjectOption | null): Quote {
  return {
    ...quote,
    projectId: project?.id ?? null,
    clientId: project?.clientId ?? quote.clientId,
    prospectId: project?.prospectId ?? quote.prospectId,
    clientName: project?.clientName || quote.clientName,
    siteAddress: project?.address || quote.siteAddress,
  };
}

function createNode(type: QuoteNodeType, parentId: string | null, order: number, vatRate: QuoteVatRate, lineKind: QuoteLineKind): QuoteNode {
  const base = { id: crypto.randomUUID(), persistedId: null, parentId, order };
  if (type === "section") return { ...base, type, title: "Nouvelle section", children: [] } satisfies QuoteSectionNode;
  if (type === "subsection") return { ...base, type, title: "Nouvelle sous-section", children: [] } satisfies QuoteSubsectionNode;
  if (type === "text") return { ...base, type, title: "Texte libre", content: "Texte libre" } satisfies QuoteTextNode;
  if (type === "pagebreak") return { ...base, type, title: "Saut de page" } satisfies QuotePageBreakNode;
  if (type === "composite") {
    return { ...base, type, title: "Nouvel ouvrage", quantity: 1, unit: "u", vatRate, reference: null, components: [] } satisfies QuoteCompositeNode;
  }
  return { ...base, type: "line", title: defaultLineTitle(lineKind), kind: lineKind, quantity: 1, unit: lineKind === "main_oeuvre" ? "h" : "u", saleUnitPriceHt: 0, purchaseUnitPriceHt: 0, vatRate, reference: null } satisfies QuoteLineNode;
}

function defaultLineTitle(kind: QuoteLineKind) {
  return kind === "main_oeuvre" ? "Main-d'oeuvre" : kind === "sous_traitance" ? "Sous-traitance" : kind === "materiel" ? "Materiel" : kind === "divers" ? "Divers" : "Fourniture";
}

function findChildren(nodes: QuoteNode[], parentId: string): QuoteNode[] {
  for (const node of nodes) {
    if (node.id === parentId && (node.type === "section" || node.type === "subsection")) return node.children;
    if (node.type === "section" || node.type === "subsection") {
      const found = findChildren(node.children, parentId);
      if (found.length) return found;
    }
  }
  return [];
}

function updateChildren(nodes: QuoteNode[], parentId: string, updater: (children: QuoteNode[]) => QuoteNode[]): QuoteNode[] {
  return nodes.map((node) => {
    if ((node.type === "section" || node.type === "subsection") && node.id === parentId) return { ...node, children: updater(node.children) };
    if (node.type === "section" || node.type === "subsection") return { ...node, children: updateChildren(node.children, parentId, updater) };
    return node;
  });
}

function mapNodes(nodes: QuoteNode[], mapper: (node: QuoteNode) => QuoteNode): QuoteNode[] {
  return nodes.map((node) => {
    const mapped = mapper(node);
    if (mapped.type === "section" || mapped.type === "subsection") return { ...mapped, children: mapNodes(mapped.children, mapper) };
    return mapped;
  });
}

function removeNode(nodes: QuoteNode[], nodeId: string): QuoteNode[] {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => (node.type === "section" || node.type === "subsection" ? { ...node, children: removeNode(node.children, nodeId) } : node))
    .map((node, index) => ({ ...node, order: index + 1 }));
}

function moveNode(nodes: QuoteNode[], nodeId: string, direction: -1 | 1): QuoteNode[] {
  const index = nodes.findIndex((node) => node.id === nodeId);
  if (index >= 0) {
    const next = [...nodes];
    const target = index + direction;
    if (target < 0 || target >= next.length) return nodes;
    const [node] = next.splice(index, 1);
    next.splice(target, 0, node);
    return next.map((row, orderIndex) => ({ ...row, order: orderIndex + 1 }));
  }
  return nodes.map((node) => (node.type === "section" || node.type === "subsection" ? { ...node, children: moveNode(node.children, nodeId, direction) } : node));
}

function moveNodeBefore(nodes: QuoteNode[], nodeId: string, targetId: string): QuoteNode[] {
  const from = nodes.findIndex((node) => node.id === nodeId);
  const to = nodes.findIndex((node) => node.id === targetId);
  if (from >= 0 && to >= 0) {
    const next = [...nodes];
    const [moved] = next.splice(from, 1);
    const targetIndex = next.findIndex((node) => node.id === targetId);
    next.splice(Math.max(0, targetIndex), 0, moved);
    return next.map((node, index) => ({ ...node, order: index + 1 }));
  }
  return nodes.map((node) => (node.type === "section" || node.type === "subsection" ? { ...node, children: moveNodeBefore(node.children, nodeId, targetId) } : node));
}

function duplicateNode(nodes: QuoteNode[], nodeId: string): QuoteNode[] {
  const index = nodes.findIndex((node) => node.id === nodeId);
  if (index >= 0) {
    const next = [...nodes];
    next.splice(index + 1, 0, cloneNode(nodes[index]));
    return next.map((node, orderIndex) => ({ ...node, order: orderIndex + 1 }));
  }
  return nodes.map((node) => (node.type === "section" || node.type === "subsection" ? { ...node, children: duplicateNode(node.children, nodeId) } : node));
}

function cloneNode(node: QuoteNode): QuoteNode {
  const id = crypto.randomUUID();
  if (node.type === "section" || node.type === "subsection") {
    return { ...node, id, persistedId: null, title: `${node.title} copie`, children: node.children.map(cloneNode) };
  }
  if (node.type === "composite") {
    return { ...node, id, persistedId: null, title: `${node.title} copie`, components: node.components.map((component) => ({ ...component, id: crypto.randomUUID() })) };
  }
  return { ...node, id, persistedId: null, title: `${node.title} copie` } as QuoteNode;
}

export function flattenForPersistence(quote: Quote) {
  return flattenQuoteNodes(quote.nodes).map((node, index) => ({ node, order: index + 1 }));
}
