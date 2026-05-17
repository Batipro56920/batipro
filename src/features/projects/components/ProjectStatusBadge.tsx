import type { ProjectStatus } from "../types";
import { projectStatusLabel } from "../utils/projectMappers";

const STYLES: Record<ProjectStatus, string> = {
  nouveau: "bg-slate-100 text-slate-700",
  qualification: "bg-sky-50 text-sky-700",
  rdv_planifie: "bg-indigo-50 text-indigo-700",
  visite_effectuee: "bg-violet-50 text-violet-700",
  chiffrage: "bg-amber-50 text-amber-700",
  devis_envoye: "bg-blue-50 text-blue-700",
  negociation: "bg-orange-50 text-orange-700",
  accepte: "bg-emerald-50 text-emerald-700",
  preparation_chantier: "bg-cyan-50 text-cyan-700",
  en_chantier: "bg-green-50 text-green-700",
  cloture: "bg-slate-100 text-slate-600",
  sav: "bg-rose-50 text-rose-700",
  perdu: "bg-red-50 text-red-700",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[status]}`}>
      {projectStatusLabel(status)}
    </span>
  );
}
