import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { listChantiers, type ChantierRow } from "../services/chantiers.service";
import { listDashboardAlerts, type DashboardAlertRow } from "../services/dashboardAlerts.service";
import { useI18n } from "../i18n";
import { DashboardAlertCenter } from "../features/dashboard/components/DashboardAlertCenter";
import { DashboardBusinessPanel } from "../features/dashboard/components/DashboardBusinessPanel";
import { DashboardEmptyState } from "../features/dashboard/components/DashboardEmptyState";
import { DashboardHeader } from "../features/dashboard/components/DashboardHeader";
import { DashboardKpiGrid } from "../features/dashboard/components/DashboardKpiGrid";
import { DashboardPriorityFeed } from "../features/dashboard/components/DashboardPriorityFeed";
import { DashboardProjectsGrid } from "../features/dashboard/components/DashboardProjectsGrid";
import { DashboardSkeleton } from "../features/dashboard/components/DashboardSkeleton";
import { useDashboardMetrics } from "../features/dashboard/hooks/useDashboardMetrics";
import type { DashboardView, MaterielSnapshot } from "../features/dashboard/types";

function isMissingRelationError(message: string | undefined): boolean {
  const msg = String(message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("relation") || msg.includes("schema cache");
}

export default function DashboardPage() {
  const { locale, t } = useI18n();
  const [chantiers, setChantiers] = useState<ChantierRow[]>([]);
  const [materiel, setMateriel] = useState<MaterielSnapshot[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlertRow[]>([]);
  const [activeView, setActiveView] = useState<DashboardView>("chantiers");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
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
        if (!alive) return;
        setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  const metrics = useDashboardMetrics({
    chantiers,
    materiel,
    alerts,
    activeView,
    loading,
    locale,
    t,
  });

  const hasData = chantiers.length > 0 || alerts.length > 0 || materiel.length > 0;

  return (
    <div className="space-y-5">
      <DashboardHeader />

      {loading ? (
        <DashboardSkeleton />
      ) : !hasData ? (
        <DashboardEmptyState />
      ) : (
        <>
          <DashboardKpiGrid kpis={metrics.kpis} activeView={activeView} onSelect={setActiveView} />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <DashboardPriorityFeed
              today={metrics.priorityToday}
              week={metrics.priorityWeek}
              focusRows={metrics.focusRows}
              hasActiveFocus={activeView !== null}
              onClearFocus={() => setActiveView(null)}
            />
            <DashboardAlertCenter alerts={metrics.alertCards} />
          </div>

          <DashboardProjectsGrid projects={metrics.projects} />
          <DashboardBusinessPanel metrics={metrics.businessMetrics} />
        </>
      )}
    </div>
  );
}
