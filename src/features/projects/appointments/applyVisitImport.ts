import type { VisitImportSection } from "../../../services/visitReportImport.service";

/**
 * Traduit ce que Coco a proposé en lignes de relevé. Les contraintes propres à
 * un ouvrage restent sur l'ouvrage : elles ne remontent jamais dans l'onglet
 * Contraintes, qui ne parle que du site.
 */
export function buildLinesFromImport<TLine extends Record<string, unknown>>(
  sections: VisitImportSection[],
  makeId: (prefix: string) => string,
): TLine[] {
  const lines: TLine[] = [];
  for (const section of sections) {
    const sectionId = makeId("section");
    lines.push({
      id: sectionId,
      type: "section",
      parentId: null,
      title: section.title,
      unit: "u",
      quantity: 0,
      manualQuantity: false,
      technicalNotes: "",
      constraints: "",
      variants: "",
      attentionPoints: "",
    } as unknown as TLine);

    for (const task of section.tasks) {
      const hasDimensions = task.length !== null || task.width !== null || task.height !== null;
      lines.push({
        id: makeId("task"),
        type: "task",
        parentId: sectionId,
        title: task.title,
        unit: task.unit,
        quantity: task.quantity ?? 0,
        // Une quantité dictée est une saisie manuelle ; des dimensions se recalculent.
        manualQuantity: task.quantity !== null && !hasDimensions,
        length: task.length,
        width: task.width,
        height: task.height,
        estimatedHours: task.estimatedHours,
        priceHintHt: task.priceHintHt,
        family: null,
        libraryId: null,
        taskTemplateId: task.taskTemplateId,
        taskTemplateLabel: task.taskTemplateLabel,
        technicalNotes: task.technicalNotes,
        constraints: task.constraints,
        variants: "",
        attentionPoints: "",
      } as unknown as TLine);
    }
  }
  return lines;
}

/** Les champs de contraintes et de budget vivent à plat dans le brouillon. */
export function applyImportedFields(fields: Record<string, string>): Record<string, string> {
  const patch: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    const clean = String(value ?? "").trim();
    if (!clean) continue;
    // Coco renvoie les remarques de contraintes sous "notes".
    patch[key === "notes" ? "constraintNotes" : key] = clean;
  }
  return patch;
}
