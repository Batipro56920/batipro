import type { BusinessDocumentStatus } from "../domain/types";

const labels: Record<BusinessDocumentStatus, string> = {
  draft: "Brouillon",
  ready: "Pret",
  sent: "Envoye",
  viewed: "Vu",
  accepted: "Accepte",
  modification_requested: "Modification demandee",
  signed: "Signe",
  refused: "Refuse",
  expired: "Expire",
  cancelled: "Annule",
  paid: "Paye",
  partially_paid: "Partiellement paye",
  overdue: "En retard",
};

const styles: Record<BusinessDocumentStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-600",
  ready: "border-blue-200 bg-blue-50 text-blue-700",
  sent: "border-sky-200 bg-sky-50 text-sky-700",
  viewed: "border-indigo-200 bg-indigo-50 text-indigo-700",
  accepted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  modification_requested: "border-amber-200 bg-amber-50 text-amber-700",
  signed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  refused: "border-red-200 bg-red-50 text-red-700",
  expired: "border-amber-200 bg-amber-50 text-amber-700",
  cancelled: "border-slate-200 bg-slate-50 text-slate-500",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  partially_paid: "border-amber-200 bg-amber-50 text-amber-700",
  overdue: "border-red-200 bg-red-50 text-red-700",
};

export function DocumentStatusBadge({ status }: { status: BusinessDocumentStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>;
}
