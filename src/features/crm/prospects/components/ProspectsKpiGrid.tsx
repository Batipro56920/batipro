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
    { label: "Prospects actifs", value: String(active.length), hint: "Leads encore ouverts", icon: UsersRound, tone: "text-primary-on bg-primary-soft border-primary/20" },
    { label: "Nouveaux semaine", value: String(newWeek.length), hint: "Demandes récentes", icon: TrendingUp, tone: "text-success-on bg-success-soft border-success/20" },
    { label: "À relancer", value: String(followup.length), hint: "Suivi commercial", icon: Repeat2, tone: "text-warning-on bg-warning-soft border-warning/20" },
    { label: "Sans activité > 7j", value: String(noActivity.length), hint: "Risque d’oubli", icon: Clock3, tone: "text-danger-on bg-danger-soft border-danger/20" },
    { label: "Budget moyen", value: eur(averageBudget), hint: "Sur budgets renseignés", icon: BadgeEuro, tone: "text-ink-secondary bg-interactive border-subtle" },
    { label: "Conversion clients", value: `${conversionRate}%`, hint: `${converted.length} converti(s)`, icon: Flame, tone: "text-info-on bg-info-soft border-info/20" },
  ];

  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="rounded-card border border-subtle bg-surface p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className={`rounded-lg border p-1.5 ${item.tone}`}>
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
            </div>
            <div className="bt-card-title mt-3 text-ink">{item.value}</div>
            <div className="mt-1 text-sm font-semibold text-ink">{item.label}</div>
            <div className="mt-0.5 text-xs text-muted">{item.hint}</div>
          </div>
        );
      })}
    </section>
  );
}
