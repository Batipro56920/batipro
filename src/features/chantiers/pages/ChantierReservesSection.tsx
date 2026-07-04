import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierReservesSection({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetedReserveId = searchParams.get("reserveId") ?? "";
  const sourceFeedbackId = searchParams.get("feedbackId") ?? "";
  const hasTargetedReserve = Boolean(targetedReserveId);
  const hasSourceFeedback = Boolean(sourceFeedbackId);
  const encodedChantierId = id ? encodeURIComponent(id) : "";
  const terrainFeedbackParams = new URLSearchParams();
  if (id) terrainFeedbackParams.set("chantierId", id);
  if (hasSourceFeedback) terrainFeedbackParams.set("feedbackId", sourceFeedbackId);
  const terrainFeedbackHref = id ? `/retours-terrain?${terrainFeedbackParams.toString()}` : "/retours-terrain";
  const chantierJournalHref = id ? `/chantiers/${encodedChantierId}/historique` : "";
  const sourceFeedbackHref = hasSourceFeedback ? terrainFeedbackHref : `/retours-terrain?chantierId=${encodedChantierId}`;
  const reserveAutoOpenKey = targetedReserveId
    ? `reserve:${targetedReserveId}`
    : hasSourceFeedback
      ? `feedback-source:${sourceFeedbackId}`
      : "";
  const reserveAutoOpenLabel = targetedReserveId
    ? hasSourceFeedback
      ? "Réserve créée depuis retour terrain"
      : "Réserve ciblée à traiter"
    : hasSourceFeedback
      ? "Retour terrain source à qualifier"
      : "";
  const chapterActionLabel = hasTargetedReserve
    ? "Traiter la réserve ciblée"
    : hasSourceFeedback
      ? "Qualifier le retour terrain"
      : "Gérer les réserves";
  const chapterSubtitle = hasSourceFeedback
    ? "Réserves ouvertes et levées. Le retour terrain source reste relié pour traiter la qualité chantier sans perdre l'origine du signalement."
    : "Réserves ouvertes et levées. La création, le filtre et le détail se font dans le panneau latéral.";

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
      subtitle={chapterSubtitle}
      actionLabel={chapterActionLabel}
      previewClassName="batipro-chapter-preview--reserves"
      autoOpenKey={reserveAutoOpenKey}
      autoOpenLabel={reserveAutoOpenLabel}
      onAutoOpenClear={clearTargetedReserve}
    >
      {targetedReserveId ? (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">Réserve ciblée</div>
              <div className="mt-1 text-blue-800/80">
                Le panneau réserves est ouvert sur une réserve précise{hasSourceFeedback ? ", reliée à un retour terrain source." : "."} Traitez la levée ici, puis revenez au signalement source si son statut doit être clôturé.
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                to={sourceFeedbackHref}
                className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                {hasSourceFeedback ? "Ouvrir le retour source" : "Voir retours chantier"}
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
      ) : hasSourceFeedback ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">Retour terrain source</div>
              <div className="mt-1 text-amber-900/80">
                Cette vue qualité garde le signalement terrain d'origine en contexte : contrôlez la situation, créez ou complétez la réserve adaptée, puis retrouvez la trace dans le journal chantier.
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                to={sourceFeedbackHref}
                className="inline-flex items-center justify-center rounded-xl bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800"
              >
                Ouvrir le retour source
              </Link>
              {chantierJournalHref ? (
                <Link
                  to={chantierJournalHref}
                  className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Journal chantier
                </Link>
              ) : null}
              <button
                type="button"
                onClick={clearTargetedReserve}
                className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
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
              {hasSourceFeedback
                ? "Le lien vers les retours terrain conserve le signalement source pour revenir au bon contexte après traitement de la réserve."
                : "Retrouvez les observations, blocages et anomalies remontés par les intervenants, créez une réserve si nécessaire puis suivez-la ici dans la qualité chantier."}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {hasSourceFeedback && !targetedReserveId ? (
              <Link
                to={sourceFeedbackHref}
                className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
              >
                Retour source
              </Link>
            ) : null}
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
              {hasSourceFeedback ? "Voir le retour terrain" : "Voir les retours terrain"}
            </Link>
          </div>
        </div>
      </div>
      {children}
    </ChantierChapterDrawer>
  );
}
