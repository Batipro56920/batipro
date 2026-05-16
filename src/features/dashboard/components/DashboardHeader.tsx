import { Link } from "react-router-dom";
import { BriefcaseBusiness, CalendarPlus, FileText, UserPlus } from "lucide-react";
import { Button } from "../../../components/ui/button";

export function DashboardHeader() {
  return (
    <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03]">
      <div className="relative p-5 sm:p-6">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-blue-50 to-transparent lg:block" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">Cockpit Batipro</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Bonjour Corentin</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Voici l’état de votre activité aujourd’hui.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/crm/devis">
              <Button variant="primary" size="md">
                <FileText className="h-4 w-4" />
                Nouveau devis
              </Button>
            </Link>
            <Link to="/chantiers/nouveau">
              <Button variant="secondary" size="md">
                <BriefcaseBusiness className="h-4 w-4" />
                Nouveau chantier
              </Button>
            </Link>
            <Link to="/chantiers">
              <Button variant="secondary" size="md">
                <CalendarPlus className="h-4 w-4" />
                Ajouter tâche
              </Button>
            </Link>
            <Link to="/crm/clients">
              <Button variant="secondary" size="md">
                <UserPlus className="h-4 w-4" />
                Nouveau client
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
