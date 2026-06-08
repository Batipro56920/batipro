import { lazy, Suspense, useState } from "react";
import type { IntervenantRow } from "../../../services/intervenants.service";
import DailyChantierPlanning from "../../../components/chantiers/DailyChantierPlanning";

const PlanningBoard = lazy(() => import("../../../components/chantiers/PlanningBoard"));

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
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Planning chantier</div>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Quotidien et Gantt</h2>
          <p className="mt-1 text-sm text-slate-500">Le quotidien sert au pilotage terrain. Le Gantt sert à organiser les phases et les blocs sur plusieurs jours.</p>
        </div>
        <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setMode("daily")}
            className={["rounded-xl px-3 py-2 text-sm font-semibold transition", mode === "daily" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white"].join(" ")}
          >
            Quotidien
          </button>
          <button
            type="button"
            onClick={() => setMode("gantt")}
            className={["rounded-xl px-3 py-2 text-sm font-semibold transition", mode === "gantt" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white"].join(" ")}
          >
            Gantt
          </button>
        </div>
      </div>

      {mode === "daily" ? (
        <DailyChantierPlanning chantierId={chantierId} chantierName={chantierName} intervenants={intervenants} />
      ) : (
        <Suspense fallback={<div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">Chargement du planning...</div>}>
          <PlanningBoard chantierId={chantierId} chantierName={chantierName} intervenants={intervenants} />
        </Suspense>
      )}
    </div>
  );
}

