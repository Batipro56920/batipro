// src/components/LayoutShell.tsx
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Sidebar from "./Sidebar";
import { supabase } from "../lib/supabaseClient";
import { getCompanySettings } from "../services/companySettings.service";

export default function LayoutShell() {
  const storageKey = "batipro.sidebarCollapsed";
  const navigate = useNavigate();
  const location = useLocation();
  const [companyName, setCompanyName] = useState("Mon entreprise");
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
        setCompanyName(nextName || "Mon entreprise");
      })
      .catch(() => {
        if (!alive) return;
        setCompanyName("Mon entreprise");
      });

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      getCompanySettings()
        .then((settings) => {
          if (!alive) return;
          const nextName = String(settings.company_name ?? "").trim();
          setCompanyName(nextName || "Mon entreprise");
        })
        .catch(() => {
          if (!alive) return;
          setCompanyName("Mon entreprise");
        });
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

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
    <div className="min-h-[100dvh] w-full max-w-full bg-slate-50 text-slate-900 overflow-x-hidden">
      {/* Desktop: fixed sidebar column. Mobile: off-canvas drawer without content push. */}
      <div className={`app-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <aside className={`sidebar border-r bg-white ${sidebarOpen ? "open" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}>
          <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((value) => !value)} />
        </aside>

        <main className="content">
          <header className="header-bar h-14 border-b bg-white flex items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="sidebar-toggle rounded-lg border px-3 py-2 text-sm"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label={sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
              >
                {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <span className="max-w-[14rem] truncate text-sm font-semibold text-slate-900 sm:max-w-none sm:text-base">
                {companyName}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={logout}
                disabled={signingOut}
                className={[
                  "rounded-xl border px-3 py-2 text-sm transition whitespace-nowrap",
                  signingOut
                    ? "bg-slate-100 text-slate-500 border-slate-200"
                    : "bg-white hover:bg-slate-50 border-slate-200",
                ].join(" ")}
              >
                <span className="sm:hidden">{signingOut ? "..." : "Sortir"}</span>
                <span className="hidden sm:inline">{signingOut ? "Deconnexion..." : "Deconnexion"}</span>
              </button>
            </div>
          </header>

          <div className="content-body p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}



