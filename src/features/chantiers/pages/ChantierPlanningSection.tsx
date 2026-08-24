import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ClipboardList, FileText, LayoutGrid, Users } from "lucide-react";
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
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="inline-flex rounded-field border border-subtle bg-interactive p-1">
              <button
                type="button"
                onClick={() => setMode("daily")}
                className={[
                  "bt-tap inline-flex items-center gap-2 rounded-field px-3 py-1.5 text-sm font-semibold transition",
                  mode === "daily" ? "bg-ink text-surface shadow-sm" : "text-ink-secondary hover:bg-surface",
                ].join(" ")}
              >
                <ClipboardList className="h-4 w-4" strokeWidth={1.75} />
                Agenda interventions
              </button>
              <button
                type="button"
                onClick={() => setMode("gantt")}
                className={[
                  "bt-tap inline-flex items-center gap-2 rounded-field px-3 py-1.5 text-sm font-semibold transition",
                  mode === "gantt" ? "bg-ink text-surface shadow-sm" : "text-ink-secondary hover:bg-surface",
                ].join(" ")}
              >
                <LayoutGrid className="h-4 w-4" strokeWidth={1.75} />
                Gantt chantier
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/chantiers/${chantierId}/execution`} className="bt-control inline-flex items-center rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">
                Exécution
              </Link>
              <Link to={`/chantiers/${chantierId}/equipe`} className="bt-control inline-flex items-center rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">
                Équipe
              </Link>
              <Link to={`/chantiers/${chantierId}/documents`} className="bt-control inline-flex items-center rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">
                Documents
              </Link>
              <Link to={terrainFeedbackHref} className="bt-control inline-flex items-center gap-2 rounded-field border border-warning/20 bg-warning-soft px-3 py-2 text-sm font-semibold text-warning-on hover:bg-interactive">
                <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
                Retours terrain
              </Link>
              <Link to={`/chantiers/${chantierId}/qualite`} className="bt-control inline-flex items-center rounded-field border border-info/20 bg-info-soft px-3 py-2 text-sm font-semibold text-info-on hover:bg-interactive">
                Qualité / réserves
              </Link>
            </div>
          </div>
        </div>
      </div>

      {mode === "daily" ? (
        <DailyChantierPlanning chantierId={chantierId} chantierName={chantierName} intervenants={intervenants} />
      ) : (
        <Suspense fallback={<div className="rounded-surface border border-subtle bg-surface p-4 text-sm text-muted">Chargement du Gantt chantier...</div>}>
          <PlanningBoard chantierId={chantierId} chantierName={chantierName} intervenants={intervenants} />
        </Suspense>
      )}
    </div>
  );
}
