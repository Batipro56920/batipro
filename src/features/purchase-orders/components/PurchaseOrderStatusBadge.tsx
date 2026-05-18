import type { PurchaseOrderStatus } from "../domain/types";

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: "Brouillon",
  sent: "Envoye",
  confirmed: "Confirme",
  partially_delivered: "Livre partiellement",
  delivered: "Livre",
  cancelled: "Annule",
};

const STATUS_CLASSES: Record<PurchaseOrderStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-600",
  sent: "border-blue-200 bg-blue-50 text-blue-700",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  partially_delivered: "border-amber-200 bg-amber-50 text-amber-700",
  delivered: "border-green-200 bg-green-50 text-green-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
};

export function PurchaseOrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function purchaseOrderStatusLabel(status: PurchaseOrderStatus) {
  return STATUS_LABELS[status];
}
