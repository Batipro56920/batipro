import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
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
  const terrainFeedbackHref = `/chantiers/${encodeURIComponent(chantierId)}/retours-terrain`;
  const intervenantsCount = intervenants.length;
  const teamLabel = intervenantsCount > 0
    ? `${intervenantsCount} intervenant${intervenantsCount > 1 ? "s" : ""} affecté${intervenantsCount > 1 ? "s" : ""}`
    : "Aucun intervenant affecté";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Agenda et planning chantier</div>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Agenda interventions et Gantt chantier</h2>
          <p className="mt-1 text-sm text-slate-500">L'agenda interventions sert au pilotage terrain quotidien. Le Gantt chantier sert à organiser les phases, dépendances et blocs sur plusieurs jours.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium text-slate-700">
              {teamLabel}
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-medium text-blue-700">
              Documents et plans accessibles depuis le dossier
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
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
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/chantiers/${chantierId}/execution`}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Exécution
            </Link>
            <Link
              to={`/chantiers/${chantierId}/equipe`}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Équipe
            </Link>
            <Link
              to={`/chantiers/${chantierId}/documents`}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Documents
            </Link>
            <Link
              to={terrainFeedbackHref}
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
            >
              Retours terrain
            </Link>
            <Link
              to={`/chantiers/${chantierId}/qualite`}
              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
            >
              Qualité / réserves
            </Link>
          </div>
        </div>
      </div>

      {mode === "daily" ? (
        <DailyChantierPlanning chantierId={chantierId} chantierName={chantierName} intervenants={intervenants} />
      ) : (
        <Suspense fallback={<div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">Chargement du Gantt chantier...</div>}>
          <PlanningBoard chantierId={chantierId} chantierName={chantierName} intervenants={intervenants} />
        </Suspense>
      )}
    </div>
  );
}