import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

function buildTerrainFeedbackHref(chantierId: string, feedbackId?: string) {
  const params = new URLSearchParams({ chantierId });
  if (feedbackId) params.set("feedbackId", feedbackId);
  return `/retours-terrain?${params.toString()}`;
}

export default function ChantierReservesSection({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetedReserveId = searchParams.get("reserveId") ?? "";
  const sourceFeedbackId = searchParams.get("feedbackId") ?? "";
  const hasTargetedReserve = Boolean(targetedReserveId);
  const hasSourceFeedback = Boolean(sourceFeedbackId);
  const encodedChantierId = id ? encodeURIComponent(id) : "";
  const terrainFeedbackHref = id
    ? buildTerrainFeedbackHref(id, hasSourceFeedback ? sourceFeedbackId : undefined)
    : "/retours-terrain";
  const chantierFeedbackListHref = id ? buildTerrainFeedbackHref(id) : "/retours-terrain";
  const chantierJournalHref = id ? `/chantiers/${encodedChantierId}/historique` : "";
  const chantierExecutionHref = id ? `/chantiers/${encodedChantierId}/execution` : "";
  const chantierPlanningHref = id ? `/chantiers/${encodedChantierId}/planning` : "";
  const chantierDocumentsHref = id ? `/chantiers/${encodedChantierId}/documents` : "";
  const sourceFeedbackHref = terrainFeedbackHref;
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
      ? "Retour terrain source à transformer en réserve"
      : "";
  const chapterActionLabel = hasTargetedReserve
    ? "Traiter la réserve ciblée"
    : hasSourceFeedback
      ? "Créer ou compléter la réserve"
      : "Gérer les réserves";
  const chapterSubtitle = hasSourceFeedback
    ? "Réserves ouvertes et levées. Le retour terrain source reste relié pour traiter la qualité chantier, revenir au signalement et conserver la trace dans le journal."
    : "Réserves ouvertes et levées. La création, le filtre et le détail se font dans le panneau latéral.";
  const linkedWorkflowSteps = hasSourceFeedback
    ? [
        {
          key: "feedback",
          label: "Retour source",
          helper: "Signalement terrain conservé en contexte",
          href: sourceFeedbackHref,
        },
        {
          key: "reserve",
          label: hasTargetedReserve ? "Réserve ciblée" : "Réserve qualité",
          helper: hasTargetedReserve ? "Traitement ouvert sur la réserve liée" : "Création ou contrôle depuis la qualité",
          href: "",
        },
        {
          key: "journal",
          label: "Journal chantier",
          helper: "Trace de création et suivi du traitement",
          href: chantierJournalHref,
        },
      ]
    : [];

  function clearReserveTargetOnly() {
    if (!searchParams.has("reserveId")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("reserveId");
    setSearchParams(nextParams, { replace: true });
  }

  function clearAutoOpenContext() {
    if (hasTargetedReserve && hasSourceFeedback) {
      clearReserveTargetOnly();
      return;
    }
    clearTargetedReserve();
  }

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
      onAutoOpenClear={clearAutoOpenContext}
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
              {hasSourceFeedback ? (
                <>
                  <Link
                    to={chantierFeedbackListHref}
                    className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                  >
                    Tous les retours
                  </Link>
                  <button
                    type="button"
                    onClick={clearReserveTargetOnly}
                    className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                  >
                    Garder le retour source
                  </button>
                </>
              ) : null}
              {chantierExecutionHref ? (
                <Link
                  to={chantierExecutionHref}
                  className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                >
                  Exécution
                </Link>
              ) : null}
              {chantierPlanningHref ? (
                <Link
                  to={chantierPlanningHref}
                  className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                >
                  Planning
                </Link>
              ) : null}
              {chantierDocumentsHref ? (
                <Link
                  to={chantierDocumentsHref}
                  className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                >
                  Documents
                </Link>
              ) : null}
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
              <Link
                to={chantierFeedbackListHref}
                className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
              >
                Tous les retours
              </Link>
              {chantierExecutionHref ? (
                <Link
                  to={chantierExecutionHref}
                  className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Exécution
                </Link>
              ) : null}
              {chantierPlanningHref ? (
                <Link
                  to={chantierPlanningHref}
                  className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Planning
                </Link>
              ) : null}
              {chantierDocumentsHref ? (
                <Link
                  to={chantierDocumentsHref}
                  className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Documents
                </Link>
              ) : null}
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
      {linkedWorkflowSteps.length > 0 ? (
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          {linkedWorkflowSteps.map((step) => {
            const content = (
              <>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Parcours lié</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{step.label}</div>
                <div className="mt-1 text-xs text-slate-500">{step.helper}</div>
              </>
            );

            if (step.href) {
              return (
                <Link
                  key={step.key}
                  to={step.href}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50"
                >
                  {content}
                </Link>
              );
            }

            return (
              <div key={step.key} className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                {content}
              </div>
            );
          })}
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
            {hasSourceFeedback ? (
              <Link
                to={chantierFeedbackListHref}
                className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
              >
                Liste chantier
              </Link>
            ) : null}
            {chantierExecutionHref ? (
              <Link
                to={chantierExecutionHref}
                className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
              >
                Exécution
              </Link>
            ) : null}
            {chantierPlanningHref ? (
              <Link
                to={chantierPlanningHref}
                className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
              >
                Planning
              </Link>
            ) : null}
            {chantierDocumentsHref ? (
              <Link
                to={chantierDocumentsHref}
                className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
              >
                Documents
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
