// src/components/LayoutShell.tsx
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, X } from "lucide-react";
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

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
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
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-[var(--bt-bg)] text-slate-900">
      {/* Desktop: fixed sidebar column. Mobile: off-canvas drawer without content push. */}
      <div className={`app-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <aside className={`sidebar border-r border-slate-200 bg-white ${sidebarOpen ? "open" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}>
          <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((value) => !value)} />
        </aside>

        <main className="content">
          <header className="header-bar flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 shadow-sm shadow-slate-950/[0.02] backdrop-blur">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="sidebar-toggle rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label={sidebarOpen ? t("layout.closeMenu") : t("layout.openMenu")}
              >
                {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <span className="max-w-[14rem] truncate text-sm font-semibold tracking-tight text-slate-950 sm:max-w-none sm:text-base">
                {companyName}
              </span>
            </div>

            <div className="hidden min-w-0 max-w-md flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400 lg:flex">
              <Search className="mr-2 h-4 w-4" />
              Rechercher dans Batipro...
              <span className="ml-auto rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">Ctrl K</span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div
                className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-sm"
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
                  "rounded-xl border px-3 py-2 text-sm transition whitespace-nowrap",
                  signingOut ? "border-slate-200 bg-slate-100 text-slate-500" : "border-slate-200 bg-white shadow-sm hover:bg-slate-50",
                ].join(" ")}
              >
                <span className="sm:hidden">{signingOut ? "..." : t("layout.signOutShort")}</span>
                <span className="hidden sm:inline">{signingOut ? t("layout.signingOut") : t("layout.signOut")}</span>
              </button>
            </div>
          </header>

          <div className="content-body p-4 md:p-5 xl:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}



