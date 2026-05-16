import { Link } from "react-router-dom";
import { ModuleTabs } from "../../../components/ui/design-system";
import type { CrmSection } from "../types";

const CRM_NAV: Array<{ key: CrmSection; label: string; href: string }> = [
  { key: "dashboard", label: "Dashboard", href: "/crm" },
  { key: "prospects", label: "Prospects", href: "/crm/prospects" },
  { key: "clients", label: "Clients", href: "/crm/clients" },
  { key: "opportunities", label: "OpportunitÃ©s", href: "/crm/opportunites" },
  { key: "quotes", label: "Devis", href: "/crm/devis" },
  { key: "invoices", label: "Factures", href: "/crm/factures" },
  { key: "purchases", label: "Achats", href: "/crm/achats" },
  { key: "contacts", label: "Contacts", href: "/crm/contacts" },
  { key: "resources", label: "Ressources", href: "/crm/ressources" },
  { key: "library", label: "BibliothÃ¨que", href: "/crm/bibliotheque" },
  { key: "agenda", label: "Agenda", href: "/crm/agenda" },
  { key: "sav", label: "SAV", href: "/crm/sav" },
  { key: "stats", label: "Statistiques", href: "/crm/statistiques" },
  { key: "settings", label: "ParamÃ¨tres", href: "/crm/parametres" },
];

export function CrmNavigation({ section }: { section: CrmSection }) {
  return (
    <ModuleTabs>
      {CRM_NAV.map((item) => (
        <Link
          key={item.key}
          to={item.href}
          className={[
            "shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition",
            section === item.key ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
          ].join(" ")}
        >
          {item.label}
        </Link>
      ))}
    </ModuleTabs>
  );
}

