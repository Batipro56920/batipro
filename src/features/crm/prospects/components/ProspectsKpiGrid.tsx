import { BadgeEuro, Clock3, Flame, Repeat2, TrendingUp, UsersRound } from "lucide-react";
import type { CrmProspectRow } from "../../../../services/crm.service";
import { eur } from "../../components/crmFormat";

function recent(value: string, days: number) {
  const date = new Date(value);
  const limit = new Date();
  limit.setDate(limit.getDate() - days);
  return date >= limit;
}

export function ProspectsKpiGrid({ rows }: { rows: CrmProspectRow[] }) {
  const active = rows.filter((row) => !["gagne", "perdu", "archive"].includes(row.statut));
  const newWeek = rows.filter((row) => recent(row.created_at, 7));
  const followup = rows.filter((row) => !["gagne", "perdu", "archive"].includes(row.statut));
  const noActivity = rows.filter((row) => !recent(row.updated_at ?? row.created_at, 7) && !["gagne", "perdu", "archive"].includes(row.statut));
  const budgets = rows.map((row) => Number(row.budget_estime ?? 0)).filter((value) => value > 0);
  const averageBudget = budgets.length ? budgets.reduce((sum, value) => sum + value, 0) / budgets.length : 0;
  const converted = rows.filter((row) => row.client_id || row.statut === "gagne");
  const conversionRate = rows.length ? Math.round((converted.length / rows.length) * 100) : 0;

  const items = [
    { label: "Prospects actifs", value: String(active.length), hint: "Leads encore ouverts", icon: UsersRound, tone: "text-blue-700 bg-blue-50 border-blue-200" },
    { label: "Nouveaux semaine", value: String(newWeek.length), hint: "Demandes récentes", icon: TrendingUp, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { label: "À relancer", value: String(followup.length), hint: "Suivi commercial", icon: Repeat2, tone: "text-amber-700 bg-amber-50 border-amber-200" },
    { label: "Sans activité > 7j", value: String(noActivity.length), hint: "Risque d’oubli", icon: Clock3, tone: "text-red-700 bg-red-50 border-red-200" },
    { label: "Budget moyen", value: eur(averageBudget), hint: "Sur budgets renseignés", icon: BadgeEuro, tone: "text-slate-700 bg-slate-50 border-slate-200" },
    { label: "Conversion clients", value: `${conversionRate}%`, hint: `${converted.length} converti(s)`, icon: Flame, tone: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-950/[0.03]">
            <div className="flex items-center justify-between gap-3">
              <span className={`rounded-lg border p-1.5 ${item.tone}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 text-xl font-bold tracking-tight text-slate-950">{item.value}</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">{item.label}</div>
            <div className="mt-0.5 text-xs text-slate-500">{item.hint}</div>
          </div>
        );
      })}
    </section>
  );
}
