import { BadgeEuro, FileWarning, Headphones, Home, UserRound, UsersRound } from "lucide-react";
import type { ClientWithMetrics } from "../types";
import { eur } from "../../components/crmFormat";

function isRecent(value: string, days: number) {
  const date = new Date(value);
  const limit = new Date();
  limit.setDate(limit.getDate() - days);
  return date >= limit;
}

export function ClientsKpiGrid({ rows }: { rows: ClientWithMetrics[] }) {
  const active = rows.filter((row) => !row.archived_at).length;
  const newMonth = rows.filter((row) => isRecent(row.created_at, 30)).length;
  const revenue = rows.reduce((sum, row) => sum + row.totalRevenue, 0);
  const activeChantiers = rows.reduce((sum, row) => sum + row.activeChantiers, 0);
  const openSav = rows.reduce((sum, row) => sum + row.openSav, 0);
  const pendingInvoices = rows.reduce((sum, row) => sum + row.pendingInvoices, 0);

  const items = [
    { label: "Clients actifs", value: String(active), hint: "Non archivés", icon: UsersRound, tone: "text-blue-700 bg-blue-50 border-blue-200" },
    { label: "Nouveaux ce mois", value: String(newMonth), hint: "Créés récemment", icon: UserRound, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { label: "CA total", value: eur(revenue), hint: "Chantiers liés", icon: BadgeEuro, tone: "text-slate-700 bg-slate-50 border-slate-200" },
    { label: "Chantiers actifs", value: String(activeChantiers), hint: "Production en cours", icon: Home, tone: "text-indigo-700 bg-indigo-50 border-indigo-200" },
    { label: "SAV ouverts", value: String(openSav), hint: "Tickets non clos", icon: Headphones, tone: "text-amber-700 bg-amber-50 border-amber-200" },
    { label: "Factures attente", value: String(pendingInvoices), hint: "Paiements à suivre", icon: FileWarning, tone: "text-red-700 bg-red-50 border-red-200" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
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
