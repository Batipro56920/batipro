import type { ReactNode } from "react";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierTimeSection({ children }: { children: ReactNode }) {
  return (
    <ChantierChapterDrawer
      eyebrow="Execution"
      title="Temps chantier"
      subtitle="Temps deja saisi par tache. L'ajout d'une saisie se fait dans le panneau lateral."
      actionLabel="Saisir du temps"
      previewClassName="batipro-chapter-preview--time"
    >
      {children}
    </ChantierChapterDrawer>
  );
}
