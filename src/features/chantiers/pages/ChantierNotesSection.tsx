import PreparationNotesPanel from "../../../components/chantiers/PreparationNotesPanel";
import type { ChantierDocumentRow } from "../../../services/chantierDocuments.service";
import type { ChantierTaskRow } from "../../../services/chantierTasks.service";
import type { ChantierZoneRow } from "../../../services/chantierZones.service";
import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

type ChantierNotesSectionProps = {
  chantierId: string;
  tasks: ChantierTaskRow[];
  zones: ChantierZoneRow[];
  documents: ChantierDocumentRow[];
};

export default function ChantierNotesSection(props: ChantierNotesSectionProps) {
  return (
    <ChantierChapterDrawer
      eyebrow="Execution"
      title="Notes chantier"
      subtitle="Notes, observations et rattachements chantier. La saisie et le detail se font dans le panneau lateral."
      actionLabel="Gerer les notes"
      previewClassName="batipro-chapter-preview--notes"
      drawerMaxWidthClassName="max-w-6xl"
    >
      <PreparationNotesPanel {...props} />
    </ChantierChapterDrawer>
  );
}
