import type { CrmSection } from "../types";
import { CrmNavigationTabs } from "./CrmNavigation";
import { BriefcaseBusiness, FileText, RefreshCw, Target, UserPlus } from "lucide-react";

const SECTION_LABEL: Record<CrmSection, string> = {
  dashboard: "Pilotage CRM",
  prospects: "Prospects",
  clients: "Clients",
  opportunities: "Opportunites",
  quotes: "Devis",
  invoices: "Factures",
  purchases: "Achats",
  contacts: "Contacts",
  resources: "Ressources",
  library: "Bibliotheque",
  agenda: "Agenda",
  sav: "SAV",
  stats: "Statistiques",
  settings: "Parametres",
};

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
              Prospects, devis, relances, clients et SAV dans une vue de pilotage compacte.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onCreateProspect} className="bt-control inline-flex items-center gap-2 rounded-field bg-primary px-3 py-2 text-sm font-semibold text-primary-contrast hover:bg-primary-hover">
              <UserPlus className="h-4 w-4" strokeWidth={1.75} />
              Prospect
            </button>
            <button type="button" onClick={onCreateOpportunity} className="bt-control inline-flex items-center gap-2 rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">
              <Target className="h-4 w-4" strokeWidth={1.75} />
              Opportunite
            </button>
            <button type="button" onClick={onCreateQuote} className="bt-control inline-flex items-center gap-2 rounded-field border border-primary/20 bg-primary-soft px-3 py-2 text-sm font-semibold text-primary-on hover:bg-interactive">
              <FileText className="h-4 w-4" strokeWidth={1.75} />
              Devis
            </button>
            <button type="button" onClick={onRefresh} className="bt-control inline-flex items-center gap-2 rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">
              <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
              Rafraichir
            </button>
          </div>
        </div>
      </div>
      <CrmNavigationTabs section={section} />
    </header>
  );
}

export const CrmHeader = CrmDashboardHeader;
