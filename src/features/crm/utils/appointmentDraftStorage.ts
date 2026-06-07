export const VISIT_DRAFT_MARKER = "\n\n---BATIPRO_VISITE_TERRAIN_DRAFT---\n";

export function stripVisitDraftPayload(value: string | null | undefined) {
  if (!value) return "";
  return value.split(VISIT_DRAFT_MARKER)[0]?.trim() ?? "";
}
