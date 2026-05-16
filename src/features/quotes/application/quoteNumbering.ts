import type { QuoteNode } from "../domain/QuoteSection";

export type NumberedQuoteNode = QuoteNode & {
  number: string;
  depth: number;
};

export function numberQuoteNodes(nodes: QuoteNode[]): NumberedQuoteNode[] {
  const result: NumberedQuoteNode[] = [];
  let sectionIndex = 0;

  for (const section of [...nodes].sort((a, b) => a.order - b.order)) {
    if (section.type === "section") {
      sectionIndex += 1;
      result.push({ ...section, number: String(sectionIndex), depth: 0 });
      appendChildren(result, section.children, String(sectionIndex), 1);
      continue;
    }
    result.push({ ...section, number: `${sectionIndex || 1}.${result.length + 1}`, depth: 0 });
  }

  return result;
}

function appendChildren(target: NumberedQuoteNode[], nodes: QuoteNode[], prefix: string, depth: number) {
  let index = 0;
  for (const node of [...nodes].sort((a, b) => a.order - b.order)) {
    index += 1;
    const number = `${prefix}.${index}`;
    target.push({ ...node, number, depth });
    if (node.type === "section" || node.type === "subsection") {
      appendChildren(target, node.children, number, depth + 1);
    }
  }
}
