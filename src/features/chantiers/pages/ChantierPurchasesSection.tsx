import ApprovisionnementTab from "../../../components/chantiers/ApprovisionnementTab";
import type { ChantierTaskRow } from "../../../services/chantierTasks.service";
import type { ChantierZoneRow } from "../../../services/chantierZones.service";
import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierPurchasesSection({
  chantierId,
  tasks,
  zones,
}: {
  chantierId: string;
  tasks: ChantierTaskRow[];
  zones: ChantierZoneRow[];
}) {
  return (
    <ChantierChapterDrawer
      eyebrow="Approvisionnement"
      title="Materiel et achats"
      subtitle="Demandes et besoins materiel du chantier. La saisie detaillee se fait dans le panneau lateral."
      actionLabel="Gerer l'approvisionnement"
      previewClassName="batipro-chapter-preview--purchases"
    >
      <ApprovisionnementTab chantierId={chantierId} tasks={tasks} zones={zones} />
    </ChantierChapterDrawer>
  );
}
