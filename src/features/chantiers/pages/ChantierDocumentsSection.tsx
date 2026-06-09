import type { ReactNode } from "react";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierDocumentsSection({ children }: { children: ReactNode }) {
  return (
    <ChantierChapterDrawer
      eyebrow="Documents"
      title="Documents chantier"
      subtitle="Documents disponibles sur le chantier. L'import et les actions detaillees se font dans le panneau lateral."
      actionLabel="Gerer les documents"
      previewClassName="batipro-chapter-preview--documents"
    >
      {children}
    </ChantierChapterDrawer>
  );
}
