import type { IntervenantRow } from "../../services/intervenants.service";
import VisitesModule from "./VisitesModule";

type Props = {
  chantierId: string;
  chantierName: string;
  chantierReference?: string | null;
  chantierAddress?: string | null;
  clientName?: string | null;
  intervenants: IntervenantRow[];
  onDocumentsRefresh: () => Promise<void>;
};

export default function VisiteTab({
  chantierId,
  chantierName,
  chantierReference,
  chantierAddress,
  clientName,
  intervenants,
  onDocumentsRefresh,
}: Props) {
  return (
    <VisitesModule
      chantierId={chantierId}
      chantierName={chantierName}
      chantierReference={chantierReference}
      chantierAddress={chantierAddress}
      clientName={clientName}
      intervenants={intervenants}
      onDocumentsRefresh={onDocumentsRefresh}
    />
  );
}
