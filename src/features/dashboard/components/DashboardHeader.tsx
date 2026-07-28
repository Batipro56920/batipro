import { Link } from "react-router-dom";
import { BriefcaseBusiness, FileText } from "lucide-react";
import { Button } from "../../../components/ui/button";

export function DashboardHeader() {
  return (
    <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Bonjour Corentin</h1>
          <p className="mt-1 text-sm text-slate-500">À traiter aujourd'hui, sans bruit inutile.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/projets">
            <Button variant="primary" size="md">
              <FileText className="h-4 w-4" />
              Créer devis
            </Button>
          </Link>
          <Link to="/chantiers/nouveau">
            <Button variant="secondary" size="md">
              <BriefcaseBusiness className="h-4 w-4" />
              Nouveau chantier
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
