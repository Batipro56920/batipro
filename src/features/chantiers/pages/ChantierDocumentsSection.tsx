import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierDocumentsSection({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const targetedDocumentId = searchParams.get("documentId") ?? "";

  return (
    <ChantierChapterDrawer
      eyebrow="Documents"
      title="Documents chantier"
      subtitle="Documents disponibles sur le chantier. L'import et les actions detaillees se font dans le panneau lateral."
      actionLabel="Gerer les documents"
      previewClassName="batipro-chapter-preview--documents"
      autoOpenKey={targetedDocumentId ? `document:${targetedDocumentId}` : ""}
    >
      {targetedDocumentId ? (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Recherche globale : le panneau documents est ouvert pour retrouver le document cible.
        </div>
      ) : null}
      {children}
    </ChantierChapterDrawer>
  );
}
