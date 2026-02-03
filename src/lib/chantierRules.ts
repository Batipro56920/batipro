import type { Chantier, ChantierStatus, ChantierTask } from "../types/chantier";

export const TAB_KEYS = ["infos", "planning", "reserves", "documents"] as const;
export type TabKey = (typeof TAB_KEYS)[number];

export function ensureArrays(chantier: Chantier) {
  return {
    tasks: chantier.tasks ?? [],
    reserves: chantier.reserves ?? [],
    documents: chantier.documents ?? [],
  };
}

export function computeAvancementFromTasks(tasks: ChantierTask[]) {
  if (!tasks.length) return null;
  const done = tasks.filter((t) => t.status === "FAIT").length;
  return Math.round((done / tasks.length) * 100);
}

export function chantierStatusBadge(status: ChantierStatus) {
  switch (status) {
    case "EN_ATTENTE":
      return { label: "En attente", className: "bg-slate-50 border-slate-200 text-slate-700" };
    case "EN_COURS":
      return { label: "En cours", className: "bg-blue-50 border-blue-200 text-blue-800" };
    case "TERMINE":
      return { label: "Terminé", className: "bg-emerald-50 border-emerald-200 text-emerald-800" };
  }
}
