import { Link } from "react-router-dom";
import type { CrmSection } from "../types";

const PRIMARY_NAV: Array<{ key?: CrmSection; label: string; href: string }> = [
  { key: "dashboard", label: "Dashboard", href: "/crm" },
  { key: "prospects", label: "Prospects", href: "/crm/prospects" },
  { key: "clients", label: "Clients", href: "/crm/clients" },
  { key: "quotes", label: "Devis", href: "/crm/devis" },
  { key: "agenda", label: "Agenda", href: "/crm/agenda" },
  { key: "sav", label: "SAV", href: "/crm/sav" },
];

function navClass(active: boolean) {
  return [
    "bt-control shrink-0 rounded-field px-3 py-2 text-sm font-semibold transition",
    active ? "bg-primary text-primary-contrast shadow-sm" : "text-ink-secondary hover:bg-interactive hover:text-ink",
  ].join(" ");
}

export function CrmNavigationTabs({ section }: { section: CrmSection }) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto rounded-surface border border-subtle bg-surface p-1.5 shadow-sm" aria-label="Navigation CRM">
      {PRIMARY_NAV.map((item) => (
        <Link key={item.href} to={item.href} className={navClass(Boolean(item.key && section === item.key))}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export const CrmNavigation = CrmNavigationTabs;
