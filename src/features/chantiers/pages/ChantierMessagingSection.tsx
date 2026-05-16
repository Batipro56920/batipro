import MessagerieTab from "../../../components/chantiers/MessagerieTab";
import type { IntervenantRow } from "../../../services/intervenants.service";

export default function ChantierMessagingSection({
  chantierId,
  intervenants,
  onActivityRefresh,
}: {
  chantierId: string;
  intervenants: IntervenantRow[];
  onActivityRefresh?: () => void | Promise<void>;
}) {
  return <MessagerieTab chantierId={chantierId} intervenants={intervenants} onActivityRefresh={onActivityRefresh} />;
}
