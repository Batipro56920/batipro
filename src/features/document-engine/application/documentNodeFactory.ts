import type { BusinessDocumentNode, DocumentItemKind, DocumentUnit } from "../domain/types";

export function createDocumentSection(title = "Nouvelle section", order = Date.now()): BusinessDocumentNode {
  return { id: crypto.randomUUID(), type: "section", parentId: null, order, title, children: [] };
}

export function createDocumentSubsection(parentId: string, title = "Nouvelle sous-section", order = Date.now()): BusinessDocumentNode {
  return { id: crypto.randomUUID(), type: "subsection", parentId, order, title, children: [] };
}

export function createDocumentLine(parentId: string, kind: DocumentItemKind = "fourniture", order = Date.now()): BusinessDocumentNode {
  return {
    id: crypto.randomUUID(),
    type: kind === "ouvrage" ? "composite" : "line",
    parentId,
    order,
    title: "Nouvelle ligne",
    kind,
    quantity: 1,
    unit: defaultUnit(kind),
    unitPriceHt: 0,
    vatRate: 20,
  };
}

export function createDocumentText(parentId: string, content = "", order = Date.now()): BusinessDocumentNode {
  return { id: crypto.randomUUID(), type: "text", parentId, order, title: "Texte libre", content };
}

export function createDocumentPageBreak(parentId: string, order = Date.now()): BusinessDocumentNode {
  return { id: crypto.randomUUID(), type: "pagebreak", parentId, order, title: "Saut de page" };
}

function defaultUnit(kind: DocumentItemKind): DocumentUnit {
  if (kind === "main_oeuvre") return "h";
  if (kind === "frais") return "forfait";
  return "u";
}
