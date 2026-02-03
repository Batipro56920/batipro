import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Hammer,
  Settings,
  FileText,
} from "lucide-react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chantiers", label: "Chantiers", icon: Hammer },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/settings", label: "Réglages", icon: Settings },
];

export default function Sidebar() {
  return (
    <div className="h-full">
      <div className="p-4 border-b">
        <div className="font-bold text-lg leading-none">ChantierPro</div>
        <div className="text-xs text-slate-500 mt-1">Batipro</div>
      </div>

      <nav className="p-3">
        <ul className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/dashboard"} // évite le "dashboard actif partout"
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
