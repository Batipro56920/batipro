import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { listChantiers, type ChantierRow } from "../services/chantiers.service";
import { getCurrentUserProfile } from "../services/currentUserProfile.service";
import { listDashboardAlerts, type DashboardAlertRow } from "../services/dashboardAlerts.service";
import { useI18n } from "../i18n";
import { DashboardBusinessPanel } from "../features/dashboard/components/DashboardBusinessPanel";
import { DashboardChantiersPanel } from "../features/dashboard/components/DashboardChantiersPanel";
import { DashboardEmptyState } from "../features/dashboard/components/DashboardEmptyState";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { DashboardPriorityFeed } from "../features/dashboard/components/DashboardPriorityFeed";
import { DashboardSkeleton } from "../features/dashboard/components/DashboardSkeleton";
import { DashboardVerdict } from "../features/dashboard/components/DashboardVerdict";
import { useDashboardMetrics } from "../features/dashboard/hooks/useDashboardMetrics";
import type { DashboardQueueFilter, MaterielSnapshot } from "../features/dashboard/types";

const QUEUE_FILTERS = new Set<DashboardQueueFilter>(["all", "urgences", "qualite", "retards", "achats", "validations", "alertes", "materiel"]);

/** Anciens liens `?view=` : on les fait atterrir sur le filtre equivalent. */
const LEGACY_VIEW_FILTERS: Record<string, DashboardQueueFilter> = {
  alertes: "alertes",
  materiel: "materiel",
  chantiers: "all",
  avancement: "all",
  heures: "all",
};

function filterFromQuery(filterParam: string | null, viewParam: string | null): DashboardQueueFilter {
  if (filterParam && QUEUE_FILTERS.has(filterParam as DashboardQueueFilter)) return filterParam as DashboardQueueFilter;
  if (viewParam && LEGACY_VIEW_FILTERS[viewParam]) return LEGACY_VIEW_FILTERS[viewParam];
  return "all";
}

function isMissingRelationError(message: string | undefined): boolean {
  const msg = String(message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("relation") || msg.includes("schema cache");
}

/** Prenom si disponible, sinon la partie locale de l'e-mail. */
function firstNameFrom(displayName: string | null, email: string | null): string | null {
  const source = String(displayName ?? "").trim() || String(email ?? "").split("@")[0]?.trim() || "";
  if (!source) return null;
  const first = source.split(/[\s._-]+/).filter(Boolean)[0] ?? source;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export default function DashboardPage() {
  const { locale, t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [chantiers, setChantiers] = useState<ChantierRow[]>([]);
  const [materiel, setMateriel] = useState<MaterielSnapshot[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlertRow[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeFilter = filterFromQuery(searchParams.get("filter"), searchParams.get("view"));

  useEffect(() => {
    let alive = true;

    getCurrentUserProfile()
      .then((profile) => {
        if (alive) setUserName(firstNameFrom(profile?.display_name ?? null, profile?.email ?? null));
      })
      .catch(() => {
        // Nom indisponible : l'en-tete se contente de la salutation.
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const chantiersResult = await listChantiers({ scope: "actifs" });
        const activeChantierIds = chantiersResult.map((chantier) => chantier.id);
        const materielResult =
          activeChantierIds.length === 0
            ? { data: [], error: null }
            : await supabase
                .from("materiel_demandes")
                .select("id, chantier_id, titre, designation, statut, status, quantite, unite, created_at")
                .in("chantier_id", activeChantierIds)
                .order("created_at", { ascending: false });
        const alertsResult = await listDashboardAlerts(chantiersResult);

        if (!alive) return;

        setChantiers(chantiersResult);
        setAlerts(alertsResult);

        if (materielResult.error && !isMissingRelationError(materielResult.error.message)) throw materielResult.error;

        setMateriel((materielResult.data ?? []) as MaterielSnapshot[]);
      } catch {
        if (!alive) return;
        setChantiers([]);
        setMateriel([]);
        setAlerts([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  function selectFilter(filter: DashboardQueueFilter) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("view");
      if (filter === "all") next.delete("filter");
      else next.set("filter", filter);
      return next;
    }, { replace: true });
  }

  const metrics = useDashboardMetrics({
    chantiers,
    materiel,
    alerts,
    filter: activeFilter,
    locale,
    t,
  });

  const hasData = chantiers.length > 0 || alerts.length > 0 || materiel.length > 0;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 lg:space-y-6">
      <DashboardHeader userName={userName} locale={locale} />

      {loading ? (
        <DashboardSkeleton />
      ) : !hasData ? (
        <DashboardEmptyState />
      ) : (
        <>
          <DashboardVerdict verdict={metrics.verdict} segments={metrics.severitySegments} />

          {/* Au-dela de 1280px la file garde une longueur de ligne lisible
              et la colonne de droite occupe la largeur au lieu de la gaspiller. */}
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
            <DashboardPriorityFeed
              items={metrics.filteredQueue}
              chips={metrics.filterChips}
              activeFilter={activeFilter}
              onSelectFilter={selectFilter}
              totalCount={metrics.queue.length}
            />
            <DashboardBusinessPanel metrics={metrics.businessMetrics} defaultOpen />
          </div>

          <DashboardChantiersPanel chantiers={metrics.chantierCards} portfolio={metrics.portfolio} />
        </>
      )}
    </div>
  );
}
