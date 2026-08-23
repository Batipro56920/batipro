import type { DashboardTone } from "../types";

/** Fond doux + texte lisible : la paire de reference d'un chip de statut. */
export const TONE_SOFT: Record<DashboardTone, string> = {
  normal: "bg-neutral-soft text-neutral-on",
  info: "bg-info-soft text-info-on",
  success: "bg-success-soft text-success-on",
  warning: "bg-warning-soft text-warning-on",
  danger: "bg-danger-soft text-danger-on",
};

/** Aplat plein : traits de bord de ligne, points, segments de jauge. */
export const TONE_SOLID: Record<DashboardTone, string> = {
  normal: "bg-neutral",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export const TONE_TEXT: Record<DashboardTone, string> = {
  normal: "text-ink-secondary",
  info: "text-info-on",
  success: "text-success-on",
  warning: "text-warning-on",
  danger: "text-danger-on",
};
