import { Link } from "react-router-dom";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CrmSection } from "../types";

const PRIMARY_NAV: Array<{ key: CrmSection; label: string; href: string }> = [
  { key: "dashboard", label: "Dashboard", href: "/crm" },
  { key: "prospects", label: "Prospects", href: "/crm/prospects" },
  { key: "clients", label: "Clients", href: "/crm/clients" },
  { key: "opportunities", label: "Opportunités", href: "/crm/opportunites" },
  { key: "quotes", label: "Devis", href: "/crm/devis" },
  { key: "agenda", label: "Agenda", href: "/crm/agenda" },
  { key: "sav", label: "SAV", href: "/crm/sav" },
];

const SECONDARY_NAV: Array<{ key: CrmSection; label: string; href: string }> = [
  { key: "contacts", label: "Contacts", href: "/crm/contacts" },
  { key: "resources", label: "Ressources", href: "/crm/ressources" },
  { key: "library", label: "Bibliothèque CRM", href: "/crm/bibliotheque" },
  { key: "settings", label: "Paramètres CRM", href: "/crm/parametres" },
];

function navClass(active: boolean) {
  return [
    "shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition",
    active ? "bg-slate-950 text-white shadow-sm shadow-slate-950/10" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
  ].join(" ");
}

export function CrmNavigationTabs({ section }: { section: CrmSection }) {
  const [open, setOpen] = useState(false);
  const secondaryActive = SECONDARY_NAV.some((item) => item.key === section);

  return (
    <div className="relative">
      <nav className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm shadow-slate-950/[0.03]" aria-label="Navigation CRM">
        {PRIMARY_NAV.map((item) => (
          <Link key={item.key} to={item.href} className={navClass(section === item.key)}>
            {item.label}
          </Link>
        ))}

        <button type="button" onClick={() => setOpen((value) => !value)} className={`${navClass(secondaryActive)} flex items-center gap-1`}>
          Plus
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
      </nav>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-950/10">
          {SECONDARY_NAV.map((item) => (
            <Link
              key={item.key}
              to={item.href}
              onClick={() => setOpen(false)}
              className={["block rounded-xl px-3 py-2 text-sm font-medium transition", section === item.key ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"].join(" ")}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const CrmNavigation = CrmNavigationTabs;
