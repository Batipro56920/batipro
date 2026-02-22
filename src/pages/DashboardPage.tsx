import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { countChantiers } from "../services/chantiers.service";

export default function DashboardPage() {
  const [enCoursCount, setEnCoursCount] = useState<number>(0);
  const [reservesOpenCount, setReservesOpenCount] = useState<number>(0);
  const [materielMissingCount, setMaterielMissingCount] = useState<number>(0);
  const [globalTimeHours, setGlobalTimeHours] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    function isMissingTableError(message: string | undefined) {
      const msg = String(message ?? "").toLowerCase();
      return msg.includes("does not exist") || msg.includes("relation") || msg.includes("schema cache");
    }

    async function load() {
      setLoading(true);
      try {
        const [count, reservesRes, materielRes, timeRes] = await Promise.all([
          countChantiers({ scope: "en_cours" }),
          supabase.from("chantier_reserves").select("id", { count: "exact", head: true }).neq("status", "LEVEE"),
          supabase
            .from("materiel_demandes")
            .select("id", { count: "exact", head: true })
            .neq("statut", "livree")
            .neq("statut", "refusee"),
          supabase.from("chantier_time_entries").select("duration_hours"),
        ]);

        if (!alive) return;

        setEnCoursCount(count);

        if (reservesRes.error && !isMissingTableError(reservesRes.error.message)) {
          throw reservesRes.error;
        }
        setReservesOpenCount(reservesRes.count ?? 0);

        if (materielRes.error && !isMissingTableError(materielRes.error.message)) {
          throw materielRes.error;
        }
        setMaterielMissingCount(materielRes.count ?? 0);

        if (timeRes.error && !isMissingTableError(timeRes.error.message)) {
          throw timeRes.error;
        }

        const totalHours = (timeRes.data ?? []).reduce((sum, row) => {
          const value = Number((row as { duration_hours?: number | null }).duration_hours ?? 0);
          return sum + (Number.isFinite(value) ? value : 0);
        }, 0);
        setGlobalTimeHours(Math.round(totalHours * 10) / 10);
      } catch {
        if (!alive) return;
        setEnCoursCount(0);
        setReservesOpenCount(0);
        setMaterielMissingCount(0);
        setGlobalTimeHours(0);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tableau de bord</h1>
        <p className="text-slate-500">Vue d'ensemble de vos chantiers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Chantiers en cours</div>
          <div className="text-3xl font-bold">{loading ? "..." : enCoursCount}</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Reserves ouvertes</div>
          <div className="text-3xl font-bold">{loading ? "..." : reservesOpenCount}</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Materiel manquant</div>
          <div className="text-3xl font-bold">{loading ? "..." : materielMissingCount}</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Temps global</div>
          <div className="text-3xl font-bold">{loading ? "..." : `${globalTimeHours}h`}</div>
        </div>
      </div>
    </div>
  );
}