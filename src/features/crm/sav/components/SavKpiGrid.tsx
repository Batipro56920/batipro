import { AlertTriangle, CheckCircle2, Clock3, Headphones, Timer, UserRound } from "lucide-react";
import type { SavWithContext } from "../types";

function isMonth(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function SavKpiGrid({ rows }: { rows: SavWithContext[] }) {
  const open = rows.filter((row) => row.statut !== "clos").length;
  const urgent = rows.filter((row) => ["haute", "urgent", "critique"].includes(String(row.urgence).toLowerCase())).length;
  const waiting = rows.filter((row) => row.statut === "en_attente_client").length;
  const intervention = rows.filter((row) => ["planifie", "en_cours", "en_intervention"].includes(row.statut)).length;
  const closedMonth = rows.filter((row) => row.statut === "clos" && isMonth(row.closed_at)).length;

  const items = [
    { label: "Tickets ouverts", value: open, icon: Headphones, tone: "text-blue-700 bg-blue-50 border-blue-200" },
    { label: "Urgents", value: urgent, icon: AlertTriangle, tone: "text-red-700 bg-red-50 border-red-200" },
    { label: "En attente client", value: waiting, icon: UserRound, tone: "text-amber-700 bg-amber-50 border-amber-200" },
    { label: "En intervention", value: intervention, icon: Clock3, tone: "text-indigo-700 bg-indigo-50 border-indigo-200" },
    { label: "Fermés ce mois", value: closedMonth, icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { label: "Délai moyen", value: "—", icon: Timer, tone: "text-slate-700 bg-slate-50 border-slate-200" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-950/[0.03]">
            <span className={`inline-flex rounded-lg border p-1.5 ${item.tone}`}><Icon className="h-4 w-4" /></span>
            <div className="mt-3 text-xl font-bold tracking-tight text-slate-950">{item.value}</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">{item.label}</div>
          </div>
        );
      })}
    </section>
  );
}
