import { BadgeEuro, Flag, Percent, Target, Trophy } from "lucide-react";
import type { CrmOpportunityRow } from "../../../../services/crm.service";
import { eur } from "../../components/crmFormat";

function currentMonth(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function OpportunitiesKpiGrid({ rows }: { rows: CrmOpportunityRow[] }) {
  const open = rows.filter((row) => row.status === "ouverte");
  const pipelineRevenue = open.reduce((sum, row) => sum + Number(row.montant_estime ?? 0), 0);
  const weightedRevenue = open.reduce((sum, row) => sum + Number(row.montant_estime ?? 0) * (Number(row.probabilite ?? 0) / 100), 0);
  const won = rows.filter((row) => row.status === "gagnee" || row.stage_key === "gagne");
  const conversion = rows.length ? Math.round((won.length / rows.length) * 100) : 0;
  const signedThisMonth = won.filter((row) => currentMonth(row.updated_at)).length;

  const items = [
    { label: "Opportunités ouvertes", value: String(open.length), hint: "Affaires en cours", icon: Target, tone: "text-blue-700 bg-blue-50 border-blue-200" },
    { label: "CA pipeline", value: eur(pipelineRevenue), hint: "Montant estimé ouvert", icon: BadgeEuro, tone: "text-slate-700 bg-slate-50 border-slate-200" },
    { label: "CA pondéré", value: eur(weightedRevenue), hint: "Montant pondéré probabilité", icon: Percent, tone: "text-indigo-700 bg-indigo-50 border-indigo-200" },
    { label: "Taux conversion", value: `${conversion}%`, hint: `${won.length} gagnée(s)`, icon: Trophy, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { label: "Signature ce mois", value: String(signedThisMonth), hint: "Affaires gagnées ce mois", icon: Flag, tone: "text-amber-700 bg-amber-50 border-amber-200" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-950/[0.03]">
            <span className={`inline-flex rounded-lg border p-1.5 ${item.tone}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="mt-3 text-xl font-bold tracking-tight text-slate-950">{item.value}</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">{item.label}</div>
            <div className="mt-0.5 text-xs text-slate-500">{item.hint}</div>
          </div>
        );
      })}
    </section>
  );
}
