import { lazy, Suspense, useState } from "react";
import type { IntervenantRow } from "../../../services/intervenants.service";
import DailyChantierPlanning from "../../../components/chantiers/DailyChantierPlanning";

const PlanningPage = lazy(() => import("../../planning/PlanningPage"));

type PlanningMode = "daily" | "gantt";

export default function ChantierPlanningSection({
  chantierId,
  chantierName,
  intervenants,
}: {
  chantierId: string;
  chantierName: string | null;
  intervenants: IntervenantRow[];
}) {
  const [mode, setMode] = useState<PlanningMode>("daily");

  return (
    <div className="space-y-4">
      <div className="rounded-surface border border-subtle bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="bt-caption text-muted">Agenda et planning chantier</div>
            <h2 className="bt-section-title mt-1 text-ink">Interventions terrain et Gantt</h2>
          </div>
          <div className="inline-flex shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setMode("daily")}
              className={["rounded-xl px-3 py-2 text-sm font-semibold transition", mode === "daily" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white"].join(" ")}
            >
              Agenda interventions
            </button>
            <button
              type="button"
              onClick={() => setMode("gantt")}
              className={["rounded-xl px-3 py-2 text-sm font-semibold transition", mode === "gantt" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white"].join(" ")}
            >
              Gantt chantier
            </button>
          </div>
        </div>
      </div>

      {mode === "daily" ? (
        <DailyChantierPlanning chantierId={chantierId} chantierName={chantierName} intervenants={intervenants} />
      ) : (
        <Suspense fallback={<div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">Chargement du Gantt chantier...</div>}>
          <PlanningPage chantierId={chantierId} chantierName={chantierName} intervenants={intervenants} />
        </Suspense>
      )}
    </div>
  );
}
