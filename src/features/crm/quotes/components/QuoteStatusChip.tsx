import type { CrmQuoteRow } from "../../../../services/crm.service";

const labels: Record<CrmQuoteRow["statut"], string> = {
  brouillon: "Brouillon",
  en_preparation: "En préparation",
  envoye: "Envoyé",
  relance_1: "Relance 1",
  relance_2: "Relance 2",
  vu: "Vu",
  negociation: "Négociation",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
  annule: "Annulé",
};

const classes: Record<CrmQuoteRow["statut"], string> = {
  brouillon: "border-slate-200 bg-slate-50 text-slate-700",
  en_preparation: "border-blue-200 bg-blue-50 text-blue-700",
  envoye: "border-indigo-200 bg-indigo-50 text-indigo-700",
  relance_1: "border-amber-200 bg-amber-50 text-amber-700",
  relance_2: "border-amber-200 bg-amber-50 text-amber-700",
  vu: "border-blue-200 bg-blue-50 text-blue-700",
  negociation: "border-purple-200 bg-purple-50 text-purple-700",
  accepte: "border-emerald-200 bg-emerald-50 text-emerald-700",
  refuse: "border-red-200 bg-red-50 text-red-700",
  expire: "border-red-200 bg-red-50 text-red-700",
  annule: "border-slate-200 bg-slate-50 text-slate-500",
};

export function QuoteStatusChip({ status }: { status: CrmQuoteRow["statut"] }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classes[status]}`}>{labels[status]}</span>;
}

export function quoteStatusLabel(status: CrmQuoteRow["statut"]) {
  return labels[status];
}
