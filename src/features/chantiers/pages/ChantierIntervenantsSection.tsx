import type { ReactNode } from "react";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierIntervenantsSection({ children }: { children: ReactNode }) {
  return (
    <ChantierChapterDrawer
      eyebrow="Equipe chantier"
      title="Intervenants"
      subtitle="Intervenants rattaches au chantier. L'ajout ou le retrait se fait dans le panneau lateral."
      actionLabel="Gerer les intervenants"
      previewClassName="batipro-chapter-preview--intervenants"
    >
      {children}
    </ChantierChapterDrawer>
  );
}
