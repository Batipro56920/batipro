import ChantierPhotosTab from "../../../components/chantiers/ChantierPhotosTab";
import type { ChantierTaskRow } from "../../../services/chantierTasks.service";
import type { ChantierZoneRow } from "../../../services/chantierZones.service";

export default function ChantierPhotosSection({
  chantierId,
  tasks,
  zones,
}: {
  chantierId: string;
  tasks: ChantierTaskRow[];
  zones: ChantierZoneRow[];
}) {
  return <ChantierPhotosTab chantierId={chantierId} tasks={tasks} zones={zones} />;
}

