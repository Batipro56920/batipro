import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierReservesSection({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const targetedReserveId = searchParams.get("reserveId") ?? "";
  const terrainFeedbackHref = id ? `/retours-terrain?chantierId=${encodeURIComponent(id)}` : "/retours-terrain";

  return (
    <ChantierChapterDrawer
      eyebrow="Qualite chantier"
      title="Reserves"
      subtitle="Reserves ouvertes et levees. La creation, le filtre et le detail se font dans le panneau lateral."
      actionLabel="Gerer les reserves"
      previewClassName="batipro-chapter-preview--reserves"
      autoOpenKey={targetedReserveId ? `reserve:${targetedReserveId}` : ""}
    >
      {targetedReserveId ? (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Recherche globale : le panneau reserves est ouvert pour traiter la reserve ciblee.
        </div>
      ) : null}
      <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold">Retours terrain du chantier</div>
            <div className="mt-1 text-blue-800/80">
              Ouvrez les observations, blocages et anomalies remontes par les intervenants pour ce chantier.
            </div>
          </div>
          <Link
            to={terrainFeedbackHref}
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Voir les retours terrain
          </Link>
        </div>
      </div>
      {children}
    </ChantierChapterDrawer>
  );
}
