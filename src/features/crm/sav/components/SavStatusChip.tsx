export function SavStatusChip({ status }: { status: string }) {
  const value = status.toLowerCase();
  const cls = value.includes("clos") || value.includes("ferme") || value.includes("résolu")
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : value.includes("attente")
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : value.includes("cours") || value.includes("intervention") || value.includes("planifie")
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>{status}</span>;
}

export function SavPriorityChip({ priority }: { priority: string }) {
  const value = priority.toLowerCase();
  const cls = value.includes("haute") || value.includes("urgent") || value.includes("critique")
    ? "border-red-200 bg-red-50 text-red-700"
    : value.includes("moy")
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>{priority}</span>;
}
