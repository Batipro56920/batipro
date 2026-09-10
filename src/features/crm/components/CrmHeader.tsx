import type { CrmSection } from "../types";
import { CrmNavigationTabs } from "./CrmNavigation";
import { BriefcaseBusiness } from "lucide-react";

const SECTION_LABEL: Record<CrmSection, string> = {
  dashboard: "Pilotage CRM",
  prospects: "Prospects",
  clients: "Clients",
  quotes: "Devis",
  invoices: "Factures",
  purchases: "Achats",
  contacts: "Contacts",
  resources: "Ressources",
  library: "Bibliotheque",
  agenda: "Agenda",
  stats: "Statistiques",
  settings: "Parametres",
};

export function CrmDashboardHeader({
  section,
}: {
  section: CrmSection;
  /** Conservés pour les appelants : les boutons globaux ont été retirés de l'en-tête. */
  onRefresh?: () => void;
  onCreateProspect?: () => void;
  onCreateQuote?: () => void;
}) {
  return (
    <header className="space-y-3">
      <div className="rounded-surface border border-subtle bg-surface p-4 shadow-elevated">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="bt-caption flex items-center gap-2 text-muted">
              <BriefcaseBusiness className="h-4 w-4" strokeWidth={1.75} />
              Commercial
            </div>
            <h1 className="bt-page-title mt-1 text-ink">{SECTION_LABEL[section]}</h1>
            <div className="bt-secondary mt-1 text-muted">
              Prospects, devis, relances et clients dans une vue de pilotage compacte.
            </div>
          </div>
          {/*
            Les créations globales vivaient ici en double : chaque onglet porte
            déjà son propre bouton, et créer une affaire ou un devis sans savoir
            pour quel prospect n'a pas de sens métier.
          */}
        </div>
      </div>
      <CrmNavigationTabs section={section} />
    </header>
  );
}

export const CrmHeader = CrmDashboardHeader;
