import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierTasksQuotesSection({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const terrainFeedbackHref = id ? `/retours-terrain?chantierId=${encodeURIComponent(id)}` : "/retours-terrain";

  return (
    <ChantierChapterDrawer
      eyebrow="Execution"
      title="Taches et devis"
      subtitle="Taches chantier et devis rattaches. L'import, la creation et les edits detaillees se font dans le panneau lateral."
      actionLabel="Gerer taches et devis"
      previewClassName="batipro-chapter-preview--tasks-quotes"
      drawerMaxWidthClassName="max-w-6xl"
    >
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold">Retours terrain lies a l'execution</div>
            <div className="mt-1 text-amber-800/80">
              Ouvrez les blocages, anomalies et observations terrain du chantier avant d'ajuster les taches ou les devis.
            </div>
          </div>
          <Link
            to={terrainFeedbackHref}
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800"
          >
            Voir les retours terrain
          </Link>
        </div>
      </div>
      {children}
    </ChantierChapterDrawer>
  );
}
