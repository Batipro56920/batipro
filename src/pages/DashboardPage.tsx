import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { listChantiers, type ChantierRow } from "../services/chantiers.service";
import { listDashboardAlerts, type DashboardAlertRow } from "../services/dashboardAlerts.service";
import { useI18n } from "../i18n";
import { DashboardBusinessPanel } from "../features/dashboard/components/DashboardBusinessPanel";
import { DashboardEmptyState } from "../features/dashboard/components/DashboardEmptyState";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { DashboardKpiGrid } from "../features/dashboard/components/DashboardKpiGrid";
import { DashboardPriorityFeed } from "../features/dashboard/components/DashboardPriorityFeed";
import { DashboardProjectsGrid } from "../features/dashboard/components/DashboardProjectsGrid";
import { DashboardSkeleton } from "../features/dashboard/components/DashboardSkeleton";
import { useDashboardMetrics } from "../features/dashboard/hooks/useDashboardMetrics";
import type { DashboardView, MaterielSnapshot } from "../features/dashboard/types";

const DASHBOARD_VIEWS = new Set<Exclude<DashboardView, null>>(["chantiers", "avancement", "heures", "materiel", "alertes"]);

function dashboardViewFromQuery(value: string | null): DashboardView {
  if (!value) return null;
  return DASHBOARD_VIEWS.has(value as Exclude<DashboardView, null>) ? value as Exclude<DashboardView, null> : null;
}

function isMissingRelationError(message: string | undefined): boolean {
  const msg = String(message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("relation") || msg.includes("schema cache");
}

export default function DashboardPage() {
  const { locale, t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [chantiers, setChantiers] = useState<ChantierRow[]>([]);
  const [materiel, setMateriel] = useState<MaterielSnapshot[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlertRow[]>([]);
  const [activeView, setActiveView] = useState<DashboardView>(() => dashboardViewFromQuery(searchParams.get("view")));
  const [loading, setLoading] = useState(true);

  useEffect(() => { setActiveView(dashboardViewFromQuery(searchParams.get("view"))); }, [searchParams]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const chantiersResult = await listChantiers({ scope: "actifs" });
        const activeChantierIds = chantiersResult.map((chantier) => chantier.id);
        const materielResult = activeChantierIds.length === 0
          ? { data: [], error: null }
          : await supabase.from("materiel_demandes").select("id, chantier_id, titre, designation, statut, status, quantite, unite, created_at").in("chantier_id", activeChantierIds).order("created_at", { ascending: false });
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
    return () => { alive = false; };
  }, []);

  function selectDashboardView(view: DashboardView) {
    setActiveView(view);
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (view) next.set("view", view); else next.delete("view");
      return next;
    }, { replace: true });
  }

  const metrics = useDashboardMetrics({ chantiers, materiel, alerts, activeView, loading, locale, t });
  const hasData = chantiers.length > 0 || alerts.length > 0 || materiel.length > 0;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 px-1 pb-6">
      <DashboardHeader />
      {loading ? <DashboardSkeleton /> : !hasData ? <DashboardEmptyState /> : (
        <>
          <DashboardKpiGrid kpis={metrics.kpis} activeView={activeView} onSelect={selectDashboardView} />
          <DashboardPriorityFeed today={metrics.priorityToday} week={metrics.priorityWeek} focusRows={metrics.focusRows} alerts={metrics.alertCards} hasActiveFocus={activeView !== null} onClearFocus={() => selectDashboardView(null)} />
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
            <DashboardProjectsGrid projects={metrics.projects} />
            <DashboardBusinessPanel metrics={metrics.businessMetrics} />
          </div>
        </>
      )}
    </div>
  );
}
