import PilotageTab from "../../../components/chantiers/PilotageTab";
import type { ChantierTaskRow } from "../../../services/chantierTasks.service";
import type { ChantierZoneRow } from "../../../services/chantierZones.service";

type ChantierUnforeseenSectionProps = {
  chantierId: string;
  tasks: ChantierTaskRow[];
  zones: ChantierZoneRow[];
};

export default function ChantierUnforeseenSection(props: ChantierUnforeseenSectionProps) {
  return <PilotageTab {...props} />;
}
