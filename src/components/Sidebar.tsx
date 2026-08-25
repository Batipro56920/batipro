import { NavLink } from "react-router-dom";
import {
  Banknote,
  Boxes,
  BrainCircuit,
  Calculator,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileSpreadsheet,
  LayoutDashboard,
  Hammer,
  Users,
  LibraryBig,
  ChartColumnBig,
  Building2,
  Truck,
  BriefcaseBusiness,
  Handshake,
  Landmark,
  ReceiptText,
  FolderKanban,
  PackageSearch,
  TrendingUp,
  Wallet,
  MessageCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { CompanyFeatureModuleId } from "../config/companyFeatures";
import { useI18n } from "../i18n";
import {
  getCompanySettings,
  getEnabledCompanyModulesFromSettings,
} from "../services/companySettings.service";
import { getCurrentUserProfile } from "../services/currentUserProfile.service";

type Props = {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  companyName?: string;
};

export default function Sidebar({ collapsed = false, onToggleCollapse, companyName }: Props) {
  const { t } = useI18n();
  const [enabledModules, setEnabledModules] = useState<Set<CompanyFeatureModuleId> | null>(null);
  const [profileAccess, setProfileAccess] = useState<{ role: string | null; allowedGroups: string[] | null } | null>(null);

  useEffect(() => {
    let alive = true;
    async function loadFeatureSettings() {
      try {
        const [settings, profile] = await Promise.all([getCompanySettings(), getCurrentUserProfile()]);
        if (!alive) return;
        setEnabledModules(new Set(getEnabledCompanyModulesFromSettings(settings)));
        setProfileAccess({ role: profile?.role ?? null, allowedGroups: profile?.allowed_sidebar_groups ?? null });
      } catch {
        if (!alive) return;
        setEnabledModules(null);
        setProfileAccess(null);
      }
    }
    void loadFeatureSettings();
    return () => { alive = false; };
  }, []);

  const nav = [
    { to: "/dashboard", label: t("sidebar.dashboard"), icon: LayoutDashboard, group: "Pilotage", end: true },
    { to: "/assistant-direction", label: "Assistant COCO", icon: BrainCircuit, group: "Pilotage", adminOnly: true },
    { to: "/rentabilite", label: "Rentabilité", icon: TrendingUp, feature: "rapports" as const, permissionKey: "statistiques" as const, group: "Pilotage" },
    { to: "/crm", label: "CRM", icon: BriefcaseBusiness, permissionKey: "crm" as const, group: "Commerce", end: true },
    { to: "/projets", label: "Projets commerciaux", icon: FolderKanban, permissionKey: "crm" as const, group: "Commerce" },
    { to: "/crm/apporteurs", label: "Apporteurs d’affaires", icon: Handshake, permissionKey: "crm" as const, group: "Commerce" },
    { to: "/chantiers", label: t("sidebar.chantiers"), icon: Hammer, feature: "preparation_chantier" as const, permissionKey: "preparation_chantier" as const, group: "Production" },
    { to: "/conversations", label: "Conversations", icon: MessageCircle, feature: "journal_chantier" as const, group: "Production" },
    { to: "/taches", label: "Tâches chantier", icon: ClipboardList, feature: "preparation_chantier" as const, permissionKey: "preparation_chantier" as const, group: "Production" },
    { to: "/reserves", label: "Réserves chantier", icon: ClipboardList, feature: "preparation_chantier" as const, permissionKey: "preparation_chantier" as const, group: "Production" },
    { to: "/visites-chantier", label: "Visites chantier", icon: ClipboardList, feature: "validation_qualite" as const, group: "Production" },
    { to: "/planning", label: "Planning", icon: CalendarDays, feature: "preparation_chantier" as const, permissionKey: "preparation_chantier" as const, group: "Production" },
    { to: "/temps", label: "Temps", icon: Clock3, feature: "temps" as const, permissionKey: "temps" as const, group: "Production" },
    { to: "/crm/sav", label: "SAV", icon: ClipboardList, permissionKey: "crm" as const, group: "Production" },
    { to: "/retours-terrain", label: t("sidebar.terrainFeedback"), icon: ClipboardList, feature: "journal_chantier" as const, group: "Production" },
    { to: "/bibliotheque", label: "Bibliothèque tâches", icon: LibraryBig, feature: "documents" as const, permissionKey: "bibliotheque" as const, group: "Production" },
    { to: "/intervenants", label: "Profils & accès", icon: Users, permissionKey: "intervenants" as const, group: "Ressources" },
    { to: "/ressources/statistiques", label: "Statistiques", icon: ChartColumnBig, feature: "rapports" as const, permissionKey: "statistiques" as const, group: "Ressources" },
    { to: "/fournisseurs", label: t("sidebar.suppliers"), icon: Truck, feature: "approvisionnement" as const, permissionKey: "fournisseurs" as const, group: "Achats" },
    { to: "/bons-commande", label: "Bons de commande", icon: ReceiptText, feature: "approvisionnement" as const, permissionKey: "fournisseurs" as const, group: "Achats" },
    { to: "/fournisseurs?tab=stock", label: "Stock", icon: Boxes, feature: "approvisionnement" as const, permissionKey: "fournisseurs" as const, group: "Achats" },
    { to: "/catalogue-produits", label: "Produits", icon: PackageSearch, feature: "approvisionnement" as const, permissionKey: "fournisseurs" as const, group: "Achats" },
    { to: "/financier/encours-fournisseurs", label: "Encours fournisseurs", icon: ChartColumnBig, feature: "approvisionnement" as const, permissionKey: "fournisseurs" as const, group: "Achats" },
    { to: "/factures", label: "Factures", icon: ReceiptText, permissionKey: "chantier_financier_billing" as const, group: "Financier" },
    { to: "/crm/apporteurs?status=commission_a_payer", label: "Commissions apporteurs", icon: ReceiptText, permissionKey: "crm" as const, group: "Financier" },
    { to: "/financier/encaissements", label: "Encaissements", icon: Banknote, permissionKey: "chantier_financier_billing" as const, group: "Financier" },
    { to: "/financier/decaissements", label: "Engagements fournisseurs", icon: Wallet, feature: "approvisionnement" as const, permissionKey: "fournisseurs" as const, group: "Financier" },
    { to: "/financier/tva", label: "TVA", icon: Landmark, feature: "rapports" as const, permissionKey: "statistiques" as const, group: "Financier" },
    { to: "/financier/tresorerie", label: "Position simplifiée", icon: TrendingUp, feature: "rapports" as const, permissionKey: "statistiques" as const, group: "Financier" },
    { to: "/financier/charges-fixes", label: "Charges fixes", icon: Calculator, permissionKey: "entreprise_parametres" as const, group: "Financier" },
    { to: "/financier/export-comptable", label: "Export comptable", icon: FileSpreadsheet, feature: "rapports" as const, permissionKey: "statistiques" as const, group: "Financier" },
    { to: "/ressources/profils-types", label: "Profils types", icon: Users, permissionKey: "entreprise_parametres" as const, group: "Paramètres" },
    { to: "/entreprise/personnel", label: "Personnel", icon: Users, group: "Paramètres", adminOnly: true },
    { to: "/entreprise", label: "Mon entreprise", icon: Building2, permissionKey: "entreprise_parametres" as const, group: "Paramètres" },
  ].filter((item) => {
    const role = String(profileAccess?.role ?? "").trim().toUpperCase();
    const adminAllowed = !("adminOnly" in item && item.adminOnly) || role === "ADMIN";
    const featureAllowed = !item.feature || !enabledModules || enabledModules.has(item.feature);
    const allowedGroups = profileAccess?.allowedGroups ?? null;
    const groupAllowed = role === "ADMIN" || !allowedGroups || allowedGroups.includes(item.group);
    return adminAllowed && featureAllowed && groupAllowed;
  });

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
            <div className="flex items-center gap-2"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-sm font-black text-[#0F2747]">B</div><div className="min-w-0"><div className="truncate text-sm font-bold tracking-tight">Batipro</div><div className="mt-0.5 truncate text-[11px] font-medium text-blue-100/70">ERP chantier</div></div></div>
          </div>
          <button type="button" onClick={onToggleCollapse} className="hidden rounded-xl border border-white/10 bg-white/5 p-2 text-blue-100 transition hover:bg-white/10 lg:inline-flex" aria-label={collapsed ? t("layout.expandNavigation") : t("layout.collapseNavigation")} title={collapsed ? t("layout.expandNavigation") : t("layout.collapseNavigation")}>{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-2.5">
        {groups.map((group) => <div key={group.label}><div className={["px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-100/45", collapsed ? "sr-only" : ""].join(" ")}>{group.label}</div><ul className="space-y-1">{group.items.map((item) => { const Icon = item.icon; return <li key={`${item.group}-${item.label}-${item.to}`}><NavLink to={item.to} end={Boolean(item.end)} className={({ isActive }) => ["group relative flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition duration-150", collapsed ? "justify-center gap-0" : "gap-3", isActive ? "bg-white text-[#0F2747] shadow-sm" : "text-blue-50/75 hover:bg-white/10 hover:text-white"].join(" ")} title={collapsed ? item.label : undefined}><Icon className="h-4 w-4 shrink-0" /><span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span></NavLink></li>; })}</ul></div>)}
      </nav>
      <div className={["border-t border-white/10 p-3", collapsed ? "hidden" : ""].join(" ")}><div className="rounded-2xl bg-white/7 p-3"><div className="truncate text-xs font-semibold text-white">{companyName || "Entreprise"}</div><div className="mt-1 text-[11px] text-blue-100/65">Espace entreprise actif</div></div></div>
    </div>
  );
}
