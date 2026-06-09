import type { ReactNode } from "react";

import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierReservesSection({ children }: { children: ReactNode }) {
  return (
    <ChantierChapterDrawer
      eyebrow="Qualite chantier"
      title="Reserves"
      subtitle="Reserves ouvertes et levees. La creation, le filtre et le detail se font dans le panneau lateral."
      actionLabel="Gerer les reserves"
      previewClassName="batipro-chapter-preview--reserves"
    >
      {children}
    </ChantierChapterDrawer>
  );
}
