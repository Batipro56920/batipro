// src/components/LayoutShell.tsx
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, CircleHelp, Menu, Plus, Search, UserRound, X } from "lucide-react";
import Sidebar from "./Sidebar";
import { supabase } from "../lib/supabaseClient";
import { getCompanySettings } from "../services/companySettings.service";
import { useI18n } from "../i18n";

export default function LayoutShell() {
  const storageKey = "batipro.sidebarCollapsed";
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, t } = useI18n();
  const defaultCompanyName = t("layout.defaultCompanyName");
  const [companyName, setCompanyName] = useState(defaultCompanyName);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(storageKey) === "1";
  });

  useEffect(() => {
    let alive = true;

    getCompanySettings()
      .then((settings) => {
        if (!alive) return;
        const nextName = String(settings.company_name ?? "").trim();
        setCompanyName(nextName || defaultCompanyName);
      })
      .catch(() => {
        if (!alive) return;
        setCompanyName(defaultCompanyName);
      });

    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUserEmail(data.user?.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      getCompanySettings()
        .then((settings) => {
          if (!alive) return;
          const nextName = String(settings.company_name ?? "").trim();
          setCompanyName(nextName || defaultCompanyName);
        })
        .catch(() => {
          if (!alive) return;
          setCompanyName(defaultCompanyName);
        });
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [defaultCompanyName]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  async function logout() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-[#F8FAFC] text-slate-900">
      {/* Desktop: fixed sidebar column. Mobile: off-canvas drawer without content push. */}
      <div className={`app-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <aside className={`sidebar border-r border-[#0F2747] bg-[#0F2747] ${sidebarOpen ? "open" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}>
          <Sidebar collapsed={sidebarCollapsed} companyName={companyName} onToggleCollapse={() => setSidebarCollapsed((value) => !value)} />
        </aside>

        <main className="content">
          <header className="header-bar flex h-14 items-center justify-between gap-3 border-b border-[#E2E8F0] bg-white/95 px-4 shadow-sm shadow-slate-950/[0.02] backdrop-blur">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="sidebar-toggle rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label={sidebarOpen ? t("layout.closeMenu") : t("layout.openMenu")}
              >
                {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <span className="max-w-[12rem] truncate text-sm font-semibold tracking-tight text-[#0F172A] sm:max-w-[18rem]">
                {companyName}
              </span>
            </div>

            <label className="hidden min-w-0 max-w-xl flex-1 items-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-sm text-slate-400 lg:flex">
              <Search className="mr-2 h-4 w-4" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                placeholder="Rechercher dans Batipro..."
                aria-label="Recherche globale"
                readOnly
                title="Recherche globale à connecter lors de la prochaine étape fonctionnelle."
              />
              <span className="ml-auto rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">Ctrl K</span>
            </label>

            <div className="flex shrink-0 items-center gap-2">
              <details className="relative hidden sm:block">
                <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-xl bg-[#3B82F6] px-3 text-sm font-medium text-white shadow-sm shadow-blue-600/15 transition hover:bg-blue-600">
                  <Plus className="h-4 w-4" />
                  Nouveau
                </summary>
                <div className="absolute right-0 top-11 z-40 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 text-sm shadow-xl shadow-slate-950/10">
                  <Link to="/chantiers/nouveau" className="block rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">Nouveau chantier</Link>
                  <Link to="/crm/devis" className="block rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">Nouveau devis</Link>
                  <Link to="/crm/prospects" className="block rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">Nouveau prospect</Link>
                </div>
              </details>
              <button
                type="button"
                disabled
                title="Notifications à connecter dans une prochaine étape."
                className="hidden h-9 w-9 cursor-not-allowed place-items-center rounded-xl border border-slate-200 bg-white text-slate-300 shadow-sm md:grid"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled
                title="Centre d'aide à connecter dans une prochaine étape."
                className="hidden h-9 w-9 cursor-not-allowed place-items-center rounded-xl border border-slate-200 bg-white text-slate-300 shadow-sm md:grid"
                aria-label="Aide"
              >
                <CircleHelp className="h-4 w-4" />
              </button>
              <div
                className="hidden items-center rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-sm md:inline-flex"
                role="group"
                aria-label={t("layout.languageSwitcherLabel")}
              >
                {(["fr", "al"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLanguage(value)}
                    className={[
                      "rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                      language === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900",
                    ].join(" ")}
                    aria-pressed={language === value}
                  >
                    {t(`common.languages.${value}`)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={logout}
                disabled={signingOut}
                className={[
                  "flex h-9 items-center gap-2 rounded-xl border px-2.5 text-sm transition whitespace-nowrap",
                  signingOut ? "border-slate-200 bg-slate-100 text-slate-500" : "border-slate-200 bg-white shadow-sm hover:bg-slate-50",
                ].join(" ")}
                title={userEmail ?? t("layout.signOut")}
              >
                <UserRound className="h-4 w-4 text-slate-500" />
                <span className="sm:hidden">{signingOut ? "..." : t("layout.signOutShort")}</span>
                <span className="hidden max-w-[9rem] truncate sm:inline">{signingOut ? t("layout.signingOut") : userEmail ?? t("layout.signOut")}</span>
              </button>
            </div>
          </header>

          <div className="content-body bg-[#F8FAFC] p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}



