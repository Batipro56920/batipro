import ApprovisionnementTab from "../../../components/chantiers/ApprovisionnementTab";
import type { ChantierTaskRow } from "../../../services/chantierTasks.service";
import type { ChantierZoneRow } from "../../../services/chantierZones.service";

export default function ChantierPurchasesSection({
  chantierId,
  tasks,
  zones,
}: {
  chantierId: string;
  tasks: ChantierTaskRow[];
  zones: ChantierZoneRow[];
}) {
  return <ApprovisionnementTab chantierId={chantierId} tasks={tasks} zones={zones} />;
}

