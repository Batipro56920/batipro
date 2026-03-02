import { NavLink } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Hammer,
  Users,
  LibraryBig,
  ChartColumnBig,
  Building2,
  Truck,
} from "lucide-react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chantiers", label: "Chantiers", icon: Hammer },
  { to: "/intervenants", label: "Intervenants", icon: Users },
  { to: "/bibliotheque", label: "Bibliothèque", icon: LibraryBig },
  { to: "/statistiques", label: "Statistiques", icon: ChartColumnBig },
  { to: "/fournisseurs", label: "Fournisseurs", icon: Truck },
  { to: "/entreprise", label: "Mon entreprise", icon: Building2 },
];

type Props = {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

export default function Sidebar({ collapsed = false, onToggleCollapse }: Props) {
  return (
    <div className="h-full">
      <div className={["border-b", collapsed ? "p-3" : "p-4"].join(" ")}>
        <div className="flex items-center justify-between gap-2">
          <div className={["font-bold leading-none", collapsed ? "sr-only" : "text-lg"].join(" ")}>Navigation</div>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:inline-flex"
            aria-label={collapsed ? "Etendre la navigation" : "Replier la navigation"}
            title={collapsed ? "Etendre la navigation" : "Replier la navigation"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <nav className="p-3">
        <ul className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/dashboard"}
                  className={({ isActive }) =>
                    [
                      "flex items-center rounded-xl px-3 py-2 text-sm transition",
                      collapsed ? "justify-center gap-0" : "gap-3",
                      "hover:bg-slate-100",
                      isActive
                        ? "bg-slate-900 text-white hover:bg-slate-900"
                        : "text-slate-700",
                    ].join(" ")
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
