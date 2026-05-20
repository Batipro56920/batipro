import { NavLink } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Hammer,
  Users,
  LibraryBig,
  ChartColumnBig,
  Building2,
  Truck,
  BriefcaseBusiness,
  FileText,
  ReceiptText,
  FolderKanban,
  PackageSearch,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { CompanyFeatureModuleId } from "../config/companyFeatures";
import { useI18n } from "../i18n";
import {
  getCompanySettings,
  getEnabledCompanyModulesFromSettings,
} from "../services/companySettings.service";
import {
  getCurrentProfileFeaturePermissions,
  hasProfileFeaturePermission,
  type ProfileFeaturePermissionKey,
  type ProfileFeaturePermissions,
} from "../services/profileFeaturePermissions.service";

type Props = {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  companyName?: string;
};

export default function Sidebar({ collapsed = false, onToggleCollapse, companyName }: Props) {
  const { t } = useI18n();
  const [enabledModules, setEnabledModules] = useState<Set<CompanyFeatureModuleId> | null>(
    null,
  );
  const [profilePermissions, setProfilePermissions] = useState<{
    role: string | null;
    permissions: ProfileFeaturePermissions;
  } | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadFeatureSettings() {
      try {
        const [settings, profileResult] = await Promise.all([
          getCompanySettings(),
          getCurrentProfileFeaturePermissions(),
        ]);
        if (!alive) return;
        setEnabledModules(new Set(getEnabledCompanyModulesFromSettings(settings)));
        setProfilePermissions({
          role: profileResult.role,
          permissions: profileResult.permissions,
        });
      } catch {
        if (!alive) return;
        setEnabledModules(null);
        setProfilePermissions(null);
      }
    }

    void loadFeatureSettings();

    return () => {
      alive = false;
    };
  }, []);

  const nav = [
    { to: "/dashboard", label: t("sidebar.dashboard"), icon: LayoutDashboard, group: "Pilotage", end: true },
    {
      to: "/crm",
      label: "CRM",
      icon: BriefcaseBusiness,
      permissionKey: "crm" as const,
      group: "Commerce",
      end: true,
    },
    {
      to: "/crm/opportunites",
      label: "Opportunités",
      icon: FolderKanban,
      permissionKey: "crm" as const,
      group: "Commerce",
    },
    {
      to: "/crm/devis",
      label: "Devis",
      icon: FileText,
      permissionKey: "crm" as const,
      group: "Commerce",
    },
    {
      to: "/factures",
      label: "Factures",
      icon: ReceiptText,
      permissionKey: "crm" as const,
      group: "Commerce",
    },
    {
      to: "/projets",
      label: "Projets",
      icon: FolderKanban,
      permissionKey: "crm" as const,
      group: "Production",
    },
    { to: "/chantiers", label: t("sidebar.chantiers"), icon: Hammer, group: "Production" },
    {
      to: "/crm/sav",
      label: "SAV",
      icon: ClipboardList,
      permissionKey: "crm" as const,
      group: "Production",
    },
    {
      to: "/intervenants",
      label: "Profils & accès",
      icon: Users,
      permissionKey: "intervenants" as const,
      group: "Production",
    },
    {
      to: "/retours-terrain",
      label: t("sidebar.terrainFeedback"),
      icon: ClipboardList,
      feature: "journal_chantier" as const,
      group: "Production",
    },
    {
      to: "/bibliotheque",
      label: t("sidebar.library"),
      icon: LibraryBig,
      feature: "documents" as const,
      permissionKey: "bibliotheque" as const,
      group: "Administration",
    },
    {
      to: "/fournisseurs",
      label: t("sidebar.suppliers"),
      icon: Truck,
      feature: "approvisionnement" as const,
      permissionKey: "fournisseurs" as const,
      group: "Achats",
    },
    {
      to: "/bons-commande",
      label: "Bons de commande",
      icon: ReceiptText,
      feature: "approvisionnement" as const,
      permissionKey: "fournisseurs" as const,
      group: "Achats",
    },
    {
      to: "/catalogue-produits",
      label: "Produits",
      icon: PackageSearch,
      feature: "approvisionnement" as const,
      permissionKey: "fournisseurs" as const,
      group: "Achats",
    },
    {
      to: "/statistiques",
      label: "Rentabilité / statistiques",
      icon: ChartColumnBig,
      feature: "rapports" as const,
      permissionKey: "statistiques" as const,
      group: "Pilotage",
    },
    {
      to: "/entreprise",
      label: "Paramètres",
      icon: Building2,
      permissionKey: "entreprise_parametres" as const,
      group: "Administration",
    },
  ].filter(
    (item) => {
      const featureAllowed = !item.feature || !enabledModules || enabledModules.has(item.feature);
      const permissionKey = (item.permissionKey ?? item.feature ?? null) as ProfileFeaturePermissionKey | null;
      const profileAllowed = !permissionKey || !profilePermissions
        ? true
        : hasProfileFeaturePermission(
            profilePermissions.permissions,
            permissionKey,
            profilePermissions.role,
          );
      return featureAllowed && profileAllowed;
    },
  );

  const groups = nav.reduce<Array<{ label: string; items: typeof nav }>>((acc, item) => {
    const group = acc.find((row) => row.label === item.group);
    if (group) group.items.push(item);
    else acc.push({ label: item.group, items: [item] });
    return acc;
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#0F2747] text-white">
      <div className={["border-b border-white/10", collapsed ? "p-3" : "p-4"].join(" ")}>
        <div className="flex items-center justify-between gap-2">
          <div className={["min-w-0 leading-none", collapsed ? "sr-only" : ""].join(" ")}>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-sm font-black text-[#0F2747]">B</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold tracking-tight">Batipro</div>
                <div className="mt-0.5 truncate text-[11px] font-medium text-blue-100/70">ERP chantier</div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden rounded-xl border border-white/10 bg-white/5 p-2 text-blue-100 transition hover:bg-white/10 lg:inline-flex"
            aria-label={collapsed ? t("layout.expandNavigation") : t("layout.collapseNavigation")}
            title={collapsed ? t("layout.expandNavigation") : t("layout.collapseNavigation")}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-2.5">
        {groups.map((group) => (
          <div key={group.label}>
            <div className={["px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-100/45", collapsed ? "sr-only" : ""].join(" ")}>
              {group.label}
            </div>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={Boolean(item.end)}
                      className={({ isActive }) =>
                        [
                          "group relative flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition duration-150",
                          collapsed ? "justify-center gap-0" : "gap-3",
                          isActive
                            ? "bg-white text-[#0F2747] shadow-sm"
                            : "text-blue-50/75 hover:bg-white/10 hover:text-white",
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
          </div>
        ))}
      </nav>

      <div className={["border-t border-white/10 p-3", collapsed ? "hidden" : ""].join(" ")}>
        <div className="rounded-2xl bg-white/7 p-3">
          <div className="truncate text-xs font-semibold text-white">{companyName || "Entreprise"}</div>
          <div className="mt-1 text-[11px] text-blue-100/65">Espace entreprise actif</div>
        </div>
      </div>
    </div>
  );
}
