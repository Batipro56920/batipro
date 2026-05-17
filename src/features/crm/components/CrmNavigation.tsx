import { Link } from "react-router-dom";
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

function navClass(active: boolean) {
  return [
    "shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition",
    active ? "bg-slate-950 text-white shadow-sm shadow-slate-950/10" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
  ].join(" ");
}

export function CrmNavigationTabs({ section }: { section: CrmSection }) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm shadow-slate-950/[0.03]" aria-label="Navigation CRM">
      {PRIMARY_NAV.map((item) => (
        <Link key={item.key} to={item.href} className={navClass(section === item.key)}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export const CrmNavigation = CrmNavigationTabs;
