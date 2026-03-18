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
import { useI18n } from "../i18n";

type Props = {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

export default function Sidebar({ collapsed = false, onToggleCollapse }: Props) {
  const { t } = useI18n();
  const nav = [
    { to: "/dashboard", label: t("sidebar.dashboard"), icon: LayoutDashboard },
    { to: "/chantiers", label: t("sidebar.chantiers"), icon: Hammer },
    { to: "/intervenants", label: t("sidebar.intervenants"), icon: Users },
    { to: "/bibliotheque", label: t("sidebar.library"), icon: LibraryBig },
    { to: "/statistiques", label: t("sidebar.statistics"), icon: ChartColumnBig },
    { to: "/fournisseurs", label: t("sidebar.suppliers"), icon: Truck },
    { to: "/entreprise", label: t("sidebar.company"), icon: Building2 },
  ];

  return (
    <div className="h-full">
      <div className={["border-b", collapsed ? "p-3" : "p-4"].join(" ")}>
        <div className="flex items-center justify-between gap-2">
          <div className={["font-bold leading-none", collapsed ? "sr-only" : "text-lg"].join(" ")}>{t("layout.navigation")}</div>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:inline-flex"
            aria-label={collapsed ? t("layout.expandNavigation") : t("layout.collapseNavigation")}
            title={collapsed ? t("layout.expandNavigation") : t("layout.collapseNavigation")}
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
