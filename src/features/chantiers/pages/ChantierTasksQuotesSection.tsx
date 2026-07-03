import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierTasksQuotesSection({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetedTaskId = searchParams.get("taskId") ?? "";
  const encodedChantierId = id ? encodeURIComponent(id) : "";
  const terrainFeedbackHref = id ? `/retours-terrain?chantierId=${encodedChantierId}` : "/retours-terrain";
  const reservesHref = id ? `/chantiers/${encodedChantierId}/qualite` : "/reserves";
  const taskLibraryHref = "/bibliotheque?q=masque%20chantier";
  const materialNeedsHref = id ? `/chantiers/${encodedChantierId}/preparation` : "/chantiers";

  function clearTargetedTask() {
    if (!searchParams.has("taskId")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("taskId");
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <ChantierChapterDrawer
      eyebrow="Execution"
      title="Taches et devis"
      subtitle="Taches chantier et devis rattaches. L'import, la creation et les edits detaillees se font dans le panneau lateral."
      actionLabel="Gerer taches et devis"
      previewClassName="batipro-chapter-preview--tasks-quotes"
      drawerMaxWidthClassName="max-w-6xl"
      autoOpenKey={targetedTaskId ? `task:${targetedTaskId}` : ""}
      autoOpenLabel="Tache ciblee depuis la recherche globale"
      onAutoOpenClear={clearTargetedTask}
    >
      {targetedTaskId ? (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span>
              Recherche globale : le panneau taches est ouvert pour retrouver la tache ciblee. Retirez le ciblage une fois le controle termine pour revenir a un parcours chantier standard.
            </span>
            <button
              type="button"
              onClick={clearTargetedTask}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
            >
              Retirer le ciblage
            </button>
          </div>
        </div>
      ) : null}
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold">Retours terrain lies a l'execution</div>
            <div className="mt-1 text-amber-800/80">
              Ouvrez les blocages, anomalies et observations terrain du chantier avant d'ajuster les taches ou les devis, puis basculez vers les reserves si le point doit etre suivi en qualite.
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              to={reservesHref}
              className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
            >
              Qualite / reserves
            </Link>
            <Link
              to={terrainFeedbackHref}
              className="inline-flex items-center justify-center rounded-xl bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800"
            >
              Voir les retours terrain
            </Link>
          </div>
        </div>
      </div>
      <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold">Bibliotheque chantier</div>
            <div className="mt-1 text-blue-800/80">
              Retrouvez les modeles masques en production pour les activer ou les completer avant de les utiliser sur les taches.
            </div>
          </div>
          <Link
            to={taskLibraryHref}
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Voir les modeles a activer
          </Link>
        </div>
      </div>
      <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold">Besoins materiel lies aux taches</div>
            <div className="mt-1 text-emerald-800/80">
              Controlez les demandes materiel rattachees aux taches avant d'engager les achats ou les approvisionnements.
            </div>
          </div>
          <Link
            to={materialNeedsHref}
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Voir les besoins materiel
          </Link>
        </div>
      </div>
      {children}
    </ChantierChapterDrawer>
  );
}
