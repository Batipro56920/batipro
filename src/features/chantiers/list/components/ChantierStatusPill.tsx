import type { ChantierStatus } from "../../../../types/chantier";
import { chantierStatusBadge } from "../../../../lib/chantierRules";
import { TONE_SOFT, type Tone } from "../../../../design-system/tone";

/** Meme libelle que `chantierStatusBadge`, rendu par les tokens semantiques. */
const STATUS_TONE: Record<ChantierStatus, Tone> = {
  BROUILLON: "normal",
  PREPARATION: "normal",
  EN_COURS: "info",
  EN_PAUSE: "warning",
  TERMINE: "success",
  ARCHIVE: "normal",
  ANNULE: "danger",
};

export function ChantierStatusPill({ status }: { status: ChantierStatus }) {
  const badge = chantierStatusBadge(status);
  /* Annexe F : un chip n'a ni bordure ni ombre. */
  return <span className={`bt-caption inline-flex rounded-full px-2 py-0.5 ${TONE_SOFT[STATUS_TONE[status] ?? "normal"]}`}>{badge.label}</span>;
}
