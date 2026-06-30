import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierDocumentsSection({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetedDocumentId = searchParams.get("documentId") ?? "";
  const executionHref = id ? `/chantiers/${encodeURIComponent(id)}/execution` : "/chantiers";
  const qualiteHref = id ? `/chantiers/${encodeURIComponent(id)}/qualite` : "/chantiers";
  const terrainFeedbackHref = id ? `/retours-terrain?chantierId=${encodeURIComponent(id)}` : "/retours-terrain";

  function clearTargetedDocument() {
    if (!searchParams.has("documentId")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("documentId");
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <ChantierChapterDrawer
      eyebrow="Documents"
      title="Documents chantier"
      subtitle="Documents disponibles sur le chantier. L'import et les actions detaillees se font dans le panneau lateral."
      actionLabel="Gerer les documents"
      previewClassName="batipro-chapter-preview--documents"
      autoOpenKey={targetedDocumentId ? `document:${targetedDocumentId}` : ""}
      autoOpenLabel="Document cible depuis la recherche globale"
      onAutoOpenClear={clearTargetedDocument}
    >
      {targetedDocumentId ? (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Recherche globale : le panneau documents est ouvert pour retrouver le document cible. Retirez le ciblage une fois le document controle pour revenir aux documents du chantier.
        </div>
      ) : null}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="font-semibold text-slate-950">Suite métier liée au document</div>
            <div className="mt-1 text-slate-600">
              Utilisez les documents comme support direct des tâches, réserves et retours terrain du chantier.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={executionHref}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
            >
              Tâches chantier
            </Link>
            <Link
              to={qualiteHref}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50"
            >
              Réserves qualité
            </Link>
            <Link
              to={terrainFeedbackHref}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Retours terrain
            </Link>
          </div>
        </div>
      </div>
      {children}
    </ChantierChapterDrawer>
  );
}