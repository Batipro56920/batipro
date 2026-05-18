import type { BusinessDocumentNode, FlatDocumentNode } from "../domain/types";

export function flattenDocumentNodes(nodes: BusinessDocumentNode[]) {
  const result: FlatDocumentNode[] = [];

  nodes
    .slice()
    .sort(byOrder)
    .forEach((node, index) => {
      const sectionNumber = String(index + 1);
      pushNode(result, node, sectionNumber, 0);
    });

  return result;
}

export function renumberDocumentNodes(nodes: BusinessDocumentNode[]) {
  return flattenDocumentNodes(nodes).map((entry) => ({ id: entry.id, number: entry.number }));
}

function pushNode(result: FlatDocumentNode[], node: BusinessDocumentNode, number: string, depth: number) {
  result.push({ id: node.id, number, depth, node });

  if (node.type !== "section" && node.type !== "subsection") return;
  node.children
    .slice()
    .sort(byOrder)
    .forEach((child, index) => {
      pushNode(result, child, `${number}.${index + 1}`, depth + 1);
    });
}

function byOrder(left: BusinessDocumentNode, right: BusinessDocumentNode) {
  return left.order - right.order;
}
