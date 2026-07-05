// src/components/LayoutShell.tsx
import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, CircleHelp, Menu, Plus, Search, UserRound, X } from "lucide-react";
import Sidebar from "./Sidebar";
import RaulChatbotWidget from "./RaulChatbotWidget";
import CocoDirectionAssistantWidget from "./CocoDirectionAssistantWidget";
import CocoHistoricalImportPanel from "./CocoHistoricalImportPanel";
import { supabase } from "../lib/supabaseClient";
import { getCompanySettings } from "../services/companySettings.service";
import { searchGlobalBatipro, type GlobalSearchResult } from "../services/globalSearch.service";
import { useI18n } from "../i18n";

const SEARCH_PLACEHOLDER = "Rechercher chantier, client, projet, devis, retour terrain...";

const SEARCH_QUICK_LINKS = [
  {
    label: "Chantiers",
    description: "Ouvrir le portefeuille chantier",
    href: "/chantiers",
    badge: "Production",
  },
  {
    label: "Retours terrain",
    description: "Traiter observations, blocages et anomalies",
    href: "/retours-terrain",
    badge: "Terrain",
  },
  {
    label: "Tâches chantier",
    description: "Suivre les travaux à exécuter",
    href: "/taches",
    badge: "Exécution",
  },
  {
    label: "Réserves",
    description: "Piloter les réserves qualité ouvertes",
    href: "/reserves",
    badge: "Qualité",
  },
  {
    label: "Planning",
    description: "Voir la charge et les interventions",
    href: "/planning",
    badge: "Planning",
  },
] as const;

export default function LayoutShell() {
  const storageKey = "batipro.sidebarCollapsed";
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, t } = useI18n();
  const defaultCompanyName = t("layout.defaultCompanyName");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [companyName, setCompanyName] = useState(defaultCompanyName);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(storageKey) === "1";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);

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
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    let alive = true;
    setSearchLoading(true);
    setSearchError(null);
    const timer = window.setTimeout(() => {
      searchGlobalBatipro(query)
        .then((results) => {
          if (!alive) return;
          setSearchResults(results);
        })
        .catch(() => {
          if (!alive) return;
          setSearchResults([]);
          setSearchError("Recherche indisponible pour le moment.");
        })
        .finally(() => {
          if (!alive) return;
          setSearchLoading(false);
        });
    }, 240);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function logout() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  function openSearchResult(result: GlobalSearchResult) {
    setSearchOpen(false);
    setSearchQuery("");
    navigate(result.href);
  }

  function openQuickLink(href: string) {
    setSearchOpen(false);
    setSearchQuery("");
    navigate(href);
  }

  function openMobileSearch() {
    setSearchOpen((value) => !value);
    window.setTimeout(() => mobileSearchInputRef.current?.focus(), 0);
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSearchOpen(false);
      return;
    }
    if (event.key === "Enter" && searchResults[0]) {
      event.preventDefault();
      openSearchResult(searchResults[0]);
    }
  }

  function renderQuickSearchLinks(compact = false) {
    return (
      <div className={compact ? "mt-2 rounded-xl border border-slate-200 bg-white p-2" : "p-2"}>
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Accès rapides chantier
        </div>
        <div className={compact ? "space-y-1" : "grid gap-1 sm:grid-cols-2"}>
          {SEARCH_QUICK_LINKS.map((item) => (
            <button
              key={item.href}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => openQuickLink(item.href)}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
            >
              <span className="mt-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                {item.badge}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-950">{item.label}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">{item.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
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
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="sidebar-toggle rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label={sidebarOpen ? t("layout.closeMenu") : t("layout.openMenu")}
              >
                {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <span className="max-w-[10rem] truncate text-sm font-semibold tracking-tight text-[#0F172A] sm:max-w-[18rem]">
                {companyName}
              </span>
            </div>

            <div className="relative hidden min-w-0 max-w-xl flex-1 lg:block">
              <label className="flex items-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-sm text-slate-400 focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
                <Search className="mr-2 h-4 w-4 shrink-0" />
                <input
                  ref={searchInputRef}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  placeholder={SEARCH_PLACEHOLDER}
                  aria-label="Recherche globale"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={onSearchKeyDown}
                  autoComplete="off"
                />
                <span className="ml-auto rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">Ctrl K</span>
              </label>

              {searchOpen ? (
                <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-950/10">
                  {searchQuery.trim().length >= 2 ? (
                    searchLoading ? (
                      <div className="px-4 py-3 text-sm text-slate-500">Recherche en cours...</div>
                    ) : searchError ? (
                      <div className="px-4 py-3 text-sm text-red-600">{searchError}</div>
                    ) : searchResults.length ? (
                      <div className="max-h-[26rem] overflow-y-auto p-1">
                        {searchResults.map((result) => (
                          <button
                            key={`${result.kind}-${result.id}`}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => openSearchResult(result)}
                            className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
                          >
                            <span className="mt-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100">{result.badge}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-slate-950">{result.title}</span>
                              <span className="mt-0.5 block truncate text-xs text-slate-500">{result.subtitle}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-500">Aucun résultat trouvé.</div>
                    )
                  ) : (
                    renderQuickSearchLinks()
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={openMobileSearch}
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 lg:hidden"
                aria-label="Recherche globale"
                aria-expanded={searchOpen}
              >
                <Search className="h-4 w-4" />
              </button>
              <details className="relative hidden sm:block">
                <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-xl bg-[#3B82F6] px-3 text-sm font-medium text-white shadow-sm shadow-blue-600/15 transition hover:bg-blue-600">
                  <Plus className="h-4 w-4" />
                  Nouveau
                </summary>
                <div className="absolute right-0 top-11 z-40 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 text-sm shadow-xl shadow-slate-950/10">
                  <Link to="/chantiers/nouveau" className="block rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">Nouveau chantier</Link>
                  <Link to="/projets?devis=nouveau" className="block rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">Créer devis depuis projet</Link>
                  <Link to="/crm/prospects?action=nouveau-prospect" className="block rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">Nouveau prospect</Link>
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

          {searchOpen ? (
            <div className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm lg:hidden">
              <label className="flex items-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-slate-400 focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
                <Search className="mr-2 h-4 w-4 shrink-0" />
                <input
                  ref={mobileSearchInputRef}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  placeholder={SEARCH_PLACEHOLDER}
                  aria-label="Recherche globale mobile"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={onSearchKeyDown}
                  autoComplete="off"
                />
                <button type="button" onClick={() => setSearchOpen(false)} className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fermer la recherche">
                  <X className="h-4 w-4" />
                </button>
              </label>
              {searchQuery.trim().length >= 2 ? (
                <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-950/5">
                  {searchLoading ? (
                    <div className="px-4 py-3 text-sm text-slate-500">Recherche en cours...</div>
                  ) : searchError ? (
                    <div className="px-4 py-3 text-sm text-red-600">{searchError}</div>
                  ) : searchResults.length ? (
                    <div className="max-h-80 overflow-y-auto p-1">
                      {searchResults.map((result) => (
                        <button
                          key={`${result.kind}-${result.id}`}
                          type="button"
                          onClick={() => openSearchResult(result)}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
                        >
                          <span className="mt-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100">{result.badge}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-950">{result.title}</span>
                            <span className="mt-0.5 block truncate text-xs text-slate-500">{result.subtitle}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-500">Aucun résultat trouvé.</div>
                  )}
                </div>
              ) : (
                renderQuickSearchLinks(true)
              )}
            </div>
          ) : null}

          <div className="content-body bg-[#F8FAFC] p-4 md:p-6">
            <Outlet />
            {location.pathname === "/assistant-direction" ? <CocoHistoricalImportPanel /> : null}
          </div>
        </main>
      </div>
      <CocoDirectionAssistantWidget />
      <RaulChatbotWidget />
    </div>
  );
}
