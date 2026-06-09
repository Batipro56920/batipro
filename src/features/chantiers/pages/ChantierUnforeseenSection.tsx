import PilotageTab from "../../../components/chantiers/PilotageTab";
import type { ChantierTaskRow } from "../../../services/chantierTasks.service";
import type { ChantierZoneRow } from "../../../services/chantierZones.service";
import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

type ChantierUnforeseenSectionProps = {
  chantierId: string;
  tasks: ChantierTaskRow[];
  zones: ChantierZoneRow[];
};

export default function ChantierUnforeseenSection(props: ChantierUnforeseenSectionProps) {
  return (
    <ChantierChapterDrawer
      eyebrow="Pilotage chantier"
      title="Imprevus et pilotage"
      subtitle="Suivi des imprevus, arbitrages et pilotage operationnel. Les saisies detaillees se font dans le panneau lateral."
      actionLabel="Ouvrir le pilotage"
      previewClassName="batipro-chapter-preview--unforeseen"
      drawerMaxWidthClassName="max-w-6xl"
    >
      <PilotageTab {...props} />
    </ChantierChapterDrawer>
  );
}
