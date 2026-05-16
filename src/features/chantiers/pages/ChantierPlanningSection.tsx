import { lazy, Suspense } from "react";
import type { IntervenantRow } from "../../../services/intervenants.service";

const PlanningBoard = lazy(() => import("../../../components/chantiers/PlanningBoard"));

export default function ChantierPlanningSection({
  chantierId,
  chantierName,
  intervenants,
}: {
  chantierId: string;
  chantierName: string | null;
  intervenants: IntervenantRow[];
}) {
  return (
    <Suspense fallback={<div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">Chargement du planning...</div>}>
      <PlanningBoard chantierId={chantierId} chantierName={chantierName} intervenants={intervenants} />
    </Suspense>
  );
}

