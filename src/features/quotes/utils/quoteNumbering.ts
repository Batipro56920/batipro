import type { QuoteLine } from "../types";

export function applyQuoteNumbering(lines: QuoteLine[]): Array<QuoteLine & { number: string }> {
  let section = 0;
  let subsection = 0;
  let lineNumber = 0;

  return [...lines]
    .sort((a, b) => a.order - b.order)
    .map((line) => {
      if (line.kind === "section") {
        section += 1;
        subsection = 0;
        lineNumber = 0;
        return { ...line, number: String(section) };
      }
      if (line.kind === "sous_section") {
        subsection += 1;
        lineNumber = 0;
        return { ...line, number: `${section || 1}.${subsection}` };
      }
      lineNumber += 1;
      return { ...line, number: `${section || 1}.${subsection || 0}.${lineNumber}` };
    });
}
