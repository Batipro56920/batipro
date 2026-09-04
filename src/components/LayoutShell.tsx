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

const SEARCH_PLACEHOLDER = "Rechercher chantier, client, projet, devis, modele, retour terrain...";

const SEARCH_QUICK_LINKS = [
  {
    label: "Projets commerciaux",
    description: "Reprendre prospects, visites, devis et passage chantier",
    href: "/projets",
    badge: "Projet",
  },
  {
    label: "Devis",
    description: "Ouvrir les devis CRM et reprendre un chiffrage",
    href: "/crm/devis",
    badge: "CRM",
  },
  {
    label: "Clients",
    description: "Retrouver un client, ses coordonnées et son historique",
    href: "/crm/clients",
    badge: "Admin",
  },
  {
    label: "Apporteurs d'affaires",
    description: "Suivre partenaires, projets apportés, conversion CRM et commissions",
    href: "/crm/apporteurs",
    badge: "CRM",
  },
  {
    label: "Chantiers",
    description: "Ouvrir le portefeuille chantier",
    href: "/chantiers",
    badge: "Production",
  },
  {
    label: "Planning",
    description: "Voir la charge et les interventions",
    href: "/planning",
    badge: "Planning",
  },
  {
    label: "Bibliothèque de tâches",
    description: "Ouvrir les modèles utilisés pour devis, préparation et chantier",
    href: "/bibliotheque",
    badge: "Référentiel",
  },
  {
    label: "Modèles à chiffrer",
    description: "Compléter les coûts de référence avant reprise dans les devis",
    href: "/bibliotheque?readiness=missing_cost",
    badge: "Devis",
  },
  {
    label: "Charges chantier à préparer",
    description: "Compléter les temps prévus avant pilotage planning et production",
    href: "/bibliotheque?readiness=missing_time",
    badge: "Chantier",
  },
  {
    label: "Détails terrain à compléter",
    description: "Renseigner les consignes techniques avant exécution chantier",
    href: "/bibliotheque?readiness=missing_technical",
    badge: "Exécution",
  },
  {
    label: "Préparations à compléter",
    description: "Relier matières et matériel aux modèles avant préparation chantier",
    href: "/bibliotheque?readiness=missing_preparation",
    badge: "Préparer",
  },
  {
    label: "Temps chantier",
    description: "Contrôler heures passées, tâches et équipe",
    href: "/temps",
    badge: "Temps",
  },
  {
    label: "Retours terrain",
    description: "Traiter observations, blocages et anomalies",
    href: "/retours-terrain",
    badge: "Terrain",
  },
  {
    label: "Réserves",
    description: "Piloter les réserves qualité ouvertes",
    href: "/reserves",
    badge: "Qualité",
  },
] as const;

export default function LayoutShell() {
  const storageKey = "batipro.sidebarCollapsed";
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
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
      <div className={compact ? "mt-2 rounded-xl border border-subtle bg-surface p-2" : "p-2"}>
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Accès rapides Batipro
        </div>
        <div className={compact ? "space-y-1" : "grid gap-1 sm:grid-cols-2"}>
          {SEARCH_QUICK_LINKS.map((item) => (
            <button
              key={item.href}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => openQuickLink(item.href)}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-interactive"
            >
              <span className="mt-0.5 rounded-full bg-interactive px-2 py-0.5 text-[11px] font-semibold text-ink-secondary ring-1 ring-subtle">
                {item.badge}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{item.label}</span>
                <span className="mt-0.5 block truncate text-xs text-muted">{item.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-app text-ink">
      {/* Desktop: fixed sidebar column. Mobile: off-canvas drawer without content push. */}
      <div className={`app-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <aside className={`sidebar border-r border-sidebar bg-sidebar ${sidebarOpen ? "open" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}>
          <Sidebar collapsed={sidebarCollapsed} companyName={companyName} onToggleCollapse={() => setSidebarCollapsed((value) => !value)} />
        </aside>

        <main className="content">
          <header className="header-bar flex h-14 items-center justify-between gap-3 border-b border-subtle bg-surface/95 px-4  backdrop-blur">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="sidebar-toggle rounded-xl border border-subtle bg-surface px-3 py-2 text-sm shadow-sm hover:bg-interactive"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label={sidebarOpen ? t("layout.closeMenu") : t("layout.openMenu")}
              >
                {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <span className="max-w-[10rem] truncate text-sm font-semibold tracking-tight text-ink sm:max-w-[18rem]">
                {companyName}
              </span>
            </div>

            <div className="relative hidden min-w-0 max-w-xl flex-1 lg:block">
              <label className="flex items-center rounded-xl border border-subtle bg-app px-3 py-1.5 text-sm text-muted focus-within:border-primary focus-within:bg-surface focus-within:ring-2 focus-within:ring-primary/25">
                <Search className="mr-2 h-4 w-4 shrink-0" />
                <input
                  ref={searchInputRef}
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink-secondary outline-none placeholder:text-muted"
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
                <span className="ml-auto rounded-md border border-subtle bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted">Ctrl K</span>
              </label>

              {searchOpen ? (
                <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl border border-subtle bg-surface shadow-elevated">
                  {searchQuery.trim().length >= 2 ? (
                    searchLoading ? (
                      <div className="px-4 py-3 text-sm text-muted">Recherche en cours...</div>
                    ) : searchError ? (
                      <div className="px-4 py-3 text-sm text-danger-on">{searchError}</div>
                    ) : searchResults.length ? (
                      <div className="max-h-[26rem] overflow-y-auto p-1">
                        {searchResults.map((result) => (
                          <button
                            key={`${result.kind}-${result.id}`}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => openSearchResult(result)}
                            className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-interactive"
                          >
                            <span className="mt-0.5 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary-on ring-1 ring-primary/25">{result.badge}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-ink">{result.title}</span>
                              <span className="mt-0.5 block truncate text-xs text-muted">{result.subtitle}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-sm text-muted">Aucun résultat trouvé.</div>
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
                className="grid h-9 w-9 place-items-center rounded-xl border border-subtle bg-surface text-ink-secondary shadow-sm transition hover:bg-interactive lg:hidden"
                aria-label="Recherche globale"
                aria-expanded={searchOpen}
              >
                <Search className="h-4 w-4" />
              </button>
              <details className="relative hidden sm:block">
                <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-primary-contrast transition-colors duration-[120ms] hover:bg-primary-hover">
                  <Plus className="h-4 w-4" />
                  Nouveau
                </summary>
                <div className="absolute right-0 top-11 z-40 w-56 overflow-hidden rounded-2xl border border-subtle bg-surface p-1 text-sm shadow-elevated">
                  <Link to="/chantiers/nouveau" className="block rounded-xl px-3 py-2 text-ink-secondary hover:bg-interactive">Nouveau chantier</Link>
                  <Link to="/projets?devis=nouveau" className="block rounded-xl px-3 py-2 text-ink-secondary hover:bg-interactive">Créer devis depuis projet</Link>
                  <Link to="/crm/prospects?action=nouveau-prospect" className="block rounded-xl px-3 py-2 text-ink-secondary hover:bg-interactive">Nouveau prospect</Link>
                </div>
              </details>
              <button
                type="button"
                disabled
                title="Notifications à connecter dans une prochaine étape."
                className="hidden h-9 w-9 cursor-not-allowed place-items-center rounded-xl border border-subtle bg-surface text-muted shadow-sm md:grid"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled
                title="Centre d'aide à connecter dans une prochaine étape."
                className="hidden h-9 w-9 cursor-not-allowed place-items-center rounded-xl border border-subtle bg-surface text-muted shadow-sm md:grid"
                aria-label="Aide"
              >
                <CircleHelp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={logout}
                disabled={signingOut}
                className={[
                  "flex h-9 items-center gap-2 rounded-xl border px-2.5 text-sm transition whitespace-nowrap",
                  signingOut ? "border-subtle bg-interactive text-muted" : "border-subtle bg-surface shadow-sm hover:bg-interactive",
                ].join(" ")}
                title={userEmail ?? t("layout.signOut")}
              >
                <UserRound className="h-4 w-4 text-muted" />
                <span className="sm:hidden">{signingOut ? "..." : t("layout.signOutShort")}</span>
                <span className="hidden max-w-[9rem] truncate sm:inline">{signingOut ? t("layout.signingOut") : userEmail ?? t("layout.signOut")}</span>
              </button>
            </div>
          </header>

          {searchOpen ? (
            <div className="border-b border-subtle bg-surface px-4 py-3 shadow-sm lg:hidden">
              <label className="flex items-center rounded-xl border border-subtle bg-app px-3 py-2 text-sm text-muted focus-within:border-primary focus-within:bg-surface focus-within:ring-2 focus-within:ring-primary/25">
                <Search className="mr-2 h-4 w-4 shrink-0" />
                <input
                  ref={mobileSearchInputRef}
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink-secondary outline-none placeholder:text-muted"
                  placeholder={SEARCH_PLACEHOLDER}
                  aria-label="Recherche globale mobile"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={onSearchKeyDown}
                  autoComplete="off"
                />
                <button type="button" onClick={() => setSearchOpen(false)} className="ml-2 rounded-lg p-1 text-muted hover:bg-interactive hover:text-ink-secondary" aria-label="Fermer la recherche">
                  <X className="h-4 w-4" />
                </button>
              </label>
              {searchQuery.trim().length >= 2 ? (
                <div className="mt-2 overflow-hidden rounded-xl border border-subtle bg-surface shadow-elevated">
                  {searchLoading ? (
                    <div className="px-4 py-3 text-sm text-muted">Recherche en cours...</div>
                  ) : searchError ? (
                    <div className="px-4 py-3 text-sm text-danger-on">{searchError}</div>
                  ) : searchResults.length ? (
                    <div className="max-h-80 overflow-y-auto p-1">
                      {searchResults.map((result) => (
                        <button
                          key={`${result.kind}-${result.id}`}
                          type="button"
                          onClick={() => openSearchResult(result)}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-interactive"
                        >
                          <span className="mt-0.5 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary-on ring-1 ring-primary/25">{result.badge}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">{result.title}</span>
                            <span className="mt-0.5 block truncate text-xs text-muted">{result.subtitle}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-sm text-muted">Aucun résultat trouvé.</div>
                  )}
                </div>
              ) : (
                renderQuickSearchLinks(true)
              )}
            </div>
          ) : null}

          <div className="content-body bg-app p-4 md:p-6">
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
