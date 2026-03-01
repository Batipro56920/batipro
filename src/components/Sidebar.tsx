import { NavLink } from "react-router-dom";
import {
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

export default function Sidebar() {
  return (
    <div className="h-full">
      <div className="p-4 border-b">
        <div className="font-bold text-lg leading-none">Navigation</div>
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
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                      "hover:bg-slate-100",
                      isActive
                        ? "bg-slate-900 text-white hover:bg-slate-900"
                        : "text-slate-700",
                    ].join(" ")
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
