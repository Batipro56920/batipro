import { Link } from "react-router-dom";
import { CalendarDays, RefreshCw, Target, UserPlus } from "lucide-react";
import { Button } from "../../../components/ui/button";
import type { CrmSection } from "../types";
import { CrmNavigationTabs } from "./CrmNavigation";

export function CrmDashboardHeader({
  section,
  onRefresh,
  onCreateProspect,
  onCreateOpportunity,
  onCreateQuote,
}: {
  section: CrmSection;
  onRefresh: () => void;
  onCreateProspect: () => void;
  onCreateOpportunity: () => void;
  onCreateQuote: () => void;
}) {
  return (
    <div className="space-y-4">
      <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03]">
        <div className="relative p-5 sm:p-6">
          <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-blue-50 to-transparent lg:block" />
          <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">CRM Admin</div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">CRM Batipro</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                Pilotez vos prospects, devis, relances et clients depuis un seul espace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Rafraîchir
              </button>
              <Button type="button" variant="primary" size="md" onClick={onCreateProspect}>
                <UserPlus className="h-4 w-4" />
                Prospect
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={onCreateOpportunity}>
                <Target className="h-4 w-4" />
                Opportunité
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={onCreateQuote}>
                + Devis
              </Button>
              <Link to="/crm/agenda">
                <Button variant="secondary" size="md">
                  <CalendarDays className="h-4 w-4" />
                  Agenda
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <CrmNavigationTabs section={section} />
    </div>
  );
}

export const CrmHeader = CrmDashboardHeader;
