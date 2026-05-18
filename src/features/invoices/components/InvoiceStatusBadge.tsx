import type { InvoiceStatus } from "../domain/types";

const labels: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyee",
  partially_paid: "Partiellement payee",
  paid: "Payee",
  overdue: "En retard",
  cancelled: "Annulee",
};

const classes: Record<InvoiceStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-600",
  sent: "border-blue-200 bg-blue-50 text-blue-700",
  partially_paid: "border-amber-200 bg-amber-50 text-amber-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  overdue: "border-red-200 bg-red-50 text-red-700",
  cancelled: "border-slate-200 bg-slate-50 text-slate-500",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[status]}`}>{labels[status]}</span>;
}
