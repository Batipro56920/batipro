import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierReservesSection({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetedReserveId = searchParams.get("reserveId") ?? "";
  const sourceFeedbackId = searchParams.get("feedbackId") ?? "";
  const encodedChantierId = id ? encodeURIComponent(id) : "";
  const terrainFeedbackHref = id ? `/retours-terrain?chantierId=${encodedChantierId}` : "/retours-terrain";
  const chantierJournalHref = id ? `/chantiers/${encodedChantierId}/historique` : "";
  const sourceFeedbackHref =
    id && sourceFeedbackId
      ? `/retours-terrain?chantierId=${encodedChantierId}&feedbackId=${encodeURIComponent(sourceFeedbackId)}`
      : terrainFeedbackHref;

  function clearTargetedReserve() {
    if (!searchParams.has("reserveId") && !searchParams.has("feedbackId")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("reserveId");
    nextParams.delete("feedbackId");
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <ChantierChapterDrawer
      eyebrow="Qualité chantier"
      title="Réserves"
      subtitle="Réserves ouvertes et levées. La création, le filtre et le détail se font dans le panneau latéral."
      actionLabel="Gérer les réserves"
      previewClassName="batipro-chapter-preview--reserves"
      autoOpenKey={targetedReserveId ? `reserve:${targetedReserveId}` : ""}
      autoOpenLabel="Réserve ciblée à traiter"
      onAutoOpenClear={clearTargetedReserve}
    >
      {targetedReserveId ? (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">Réserve ciblée</div>
              <div className="mt-1 text-blue-800/80">
                Le panneau réserves est ouvert sur une réserve précise{sourceFeedbackId ? ", reliée à un retour terrain source." : "."}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                to={sourceFeedbackHref}
                className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                {sourceFeedbackId ? "Ouvrir le retour source" : "Voir retours chantier"}
              </Link>
              {chantierJournalHref ? (
                <Link
                  to={chantierJournalHref}
                  className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                >
                  Voir journal chantier
                </Link>
              ) : null}
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
              Retrouvez les observations, blocages et anomalies remontés par les intervenants, créez une réserve si nécessaire puis suivez-la ici dans la qualité chantier.
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {chantierJournalHref ? (
              <Link
                to={chantierJournalHref}
                className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
              >
                Journal chantier
              </Link>
            ) : null}
            <Link
              to={terrainFeedbackHref}
              className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Voir les retours terrain
            </Link>
          </div>
        </div>
      </div>
      {children}
    </ChantierChapterDrawer>
  );
}
