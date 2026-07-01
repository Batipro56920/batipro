import type { IntervenantRow } from "../../services/intervenants.service";
import VisitesModule from "./VisitesModule";

type Props = {
  chantierId: string;
  chantierName: string;
  chantierReference?: string | null;
  chantierAddress?: string | null;
  clientName?: string | null;
  intervenants: IntervenantRow[];
  targetedVisitId?: string | null;
  onClearTargetedVisit?: () => void;
  onDocumentsRefresh: () => Promise<void>;
};

export default function VisiteTab({
  chantierId,
  chantierName,
  chantierReference,
  chantierAddress,
  clientName,
  intervenants,
  targetedVisitId,
  onClearTargetedVisit,
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
      targetedVisitId={targetedVisitId}
      onClearTargetedVisit={onClearTargetedVisit}
      onDocumentsRefresh={onDocumentsRefresh}
    />
  );
}
