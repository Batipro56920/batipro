import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Users } from "lucide-react";
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
  const terrainFeedbackHref = `/chantiers/${encodeURIComponent(chantierId)}/retours-terrain`;
  const intervenantsCount = intervenants.length;
  const teamLabel = intervenantsCount > 0
    ? `${intervenantsCount} intervenant${intervenantsCount > 1 ? "s" : ""} affecté${intervenantsCount > 1 ? "s" : ""}`
    : "Aucun intervenant affecté";

  return (
    <div className="space-y-4">
      <div className="rounded-surface border border-subtle bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="bt-caption text-muted">Agenda et planning chantier</div>
            <h2 className="bt-section-title mt-1 text-ink">Interventions terrain et Gantt</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-soft px-3 py-1 font-semibold text-neutral-on">
                <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                {teamLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-3 py-1 font-semibold text-info-on">
                <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                Documents et plans depuis le dossier
              </span>
            </div>
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
              to={`/chantiers/${chantierId}/preparation`}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Préparation
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
          <PlanningPage chantierId={chantierId} chantierName={chantierName} intervenants={intervenants} />
        </Suspense>
      )}
    </div>
  );
}
