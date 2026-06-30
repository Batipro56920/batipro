import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierReservesSection({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetedReserveId = searchParams.get("reserveId") ?? "";
  const terrainFeedbackHref = id ? `/retours-terrain?chantierId=${encodeURIComponent(id)}` : "/retours-terrain";

  function clearTargetedReserve() {
    if (!searchParams.has("reserveId")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("reserveId");
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <ChantierChapterDrawer
      eyebrow="Qualite chantier"
      title="Reserves"
      subtitle="Reserves ouvertes et levees. La creation, le filtre et le detail se font dans le panneau lateral."
      actionLabel="Gerer les reserves"
      previewClassName="batipro-chapter-preview--reserves"
      autoOpenKey={targetedReserveId ? `reserve:${targetedReserveId}` : ""}
      autoOpenLabel="Reserve ciblee a traiter"
      onAutoOpenClear={clearTargetedReserve}
    >
      {targetedReserveId ? (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">Reserve ciblee</div>
              <div className="mt-1 text-blue-800/80">
                Le panneau reserves est ouvert sur une reserve precise, issue de la recherche, du journal chantier ou d'un retour terrain transforme.
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                to={terrainFeedbackHref}
                className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Voir retours chantier
              </Link>
              <button
                type="button"
                onClick={clearTargetedReserve}
                className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
              >
                Retirer ciblage
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold">Retours terrain du chantier</div>
            <div className="mt-1 text-blue-800/80">
              Retrouvez les observations, blocages et anomalies remontes par les intervenants, creez une reserve si necessaire puis suivez-la ici dans la qualite chantier.
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
