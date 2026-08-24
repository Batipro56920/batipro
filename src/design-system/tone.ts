/**
 * Tons semantiques partages par les blocs migres (dashboard, chantiers, ...).
 * Un ton n'est jamais une couleur brute : il pointe toujours vers un token.
 */
export type Tone = "normal" | "info" | "success" | "warning" | "danger";

/** Fond doux + texte lisible : la paire de reference d'un chip de statut. */
export const TONE_SOFT: Record<Tone, string> = {
  normal: "bg-neutral-soft text-neutral-on",
  info: "bg-info-soft text-info-on",
  success: "bg-success-soft text-success-on",
  warning: "bg-warning-soft text-warning-on",
  danger: "bg-danger-soft text-danger-on",
};

/** Aplat plein : traits de bord de ligne, points, segments de jauge. */
export const TONE_SOLID: Record<Tone, string> = {
  normal: "bg-neutral",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export const TONE_TEXT: Record<Tone, string> = {
  normal: "text-ink-secondary",
  info: "text-info-on",
  success: "text-success-on",
  warning: "text-warning-on",
  danger: "text-danger-on",
};
