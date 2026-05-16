import type { CrmProspectRow } from "../../../../services/crm.service";

const labels: Record<CrmProspectRow["statut"], string> = {
  nouveau: "Nouveau",
  a_qualifier: "À qualifier",
  qualifie: "Qualifié",
  devis_en_cours: "Devis en cours",
  negociation: "Négociation",
  gagne: "Converti",
  perdu: "Sans suite",
  archive: "Archivé",
};

const classes: Record<CrmProspectRow["statut"], string> = {
  nouveau: "border-blue-200 bg-blue-50 text-blue-700",
  a_qualifier: "border-amber-200 bg-amber-50 text-amber-700",
  qualifie: "border-emerald-200 bg-emerald-50 text-emerald-700",
  devis_en_cours: "border-indigo-200 bg-indigo-50 text-indigo-700",
  negociation: "border-purple-200 bg-purple-50 text-purple-700",
  gagne: "border-emerald-200 bg-emerald-50 text-emerald-700",
  perdu: "border-red-200 bg-red-50 text-red-700",
  archive: "border-slate-200 bg-slate-50 text-slate-600",
};

export function ProspectStatusBadge({ status }: { status: CrmProspectRow["statut"] }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classes[status]}`}>{labels[status]}</span>;
}

export function prospectStatusLabel(status: CrmProspectRow["statut"]) {
  return labels[status];
}
