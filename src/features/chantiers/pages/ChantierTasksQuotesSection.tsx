import type { ReactNode } from "react";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierTasksQuotesSection({ children }: { children: ReactNode }) {
  return (
    <ChantierChapterDrawer
      eyebrow="Execution"
      title="Taches et devis"
      subtitle="Taches chantier et devis rattaches. L'import, la creation et les edits detaillees se font dans le panneau lateral."
      actionLabel="Gerer taches et devis"
      previewClassName="batipro-chapter-preview--tasks-quotes"
      drawerMaxWidthClassName="max-w-6xl"
    >
      {children}
    </ChantierChapterDrawer>
  );
}
