import { CalendarDays } from "lucide-react";

export function DashboardHeader() {
  return (
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-slate-950">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Vue d'ensemble de votre activité</p>
      </div>
      <div className="inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm" aria-label="Période affichée : cette semaine">
        <CalendarDays className="h-4 w-4 text-slate-500" />
        Cette semaine
      </div>
    </header>
  );
}
