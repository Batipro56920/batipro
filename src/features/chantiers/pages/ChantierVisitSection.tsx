import VisiteTab from "../../../components/chantiers/VisiteTab";
import type { ChantierRow } from "../../../services/chantiers.service";
import type { IntervenantRow } from "../../../services/intervenants.service";

export default function ChantierVisitSection({
  chantierId,
  chantier,
  intervenants,
  onDocumentsRefresh,
}: {
  chantierId: string;
  chantier: ChantierRow | null;
  intervenants: IntervenantRow[];
  onDocumentsRefresh: () => Promise<void>;
}) {
  return (
    <VisiteTab
      chantierId={chantierId}
      chantierName={chantier?.nom ?? "Chantier"}
      chantierReference={(chantier as any)?.reference ?? chantierId}
      chantierAddress={(chantier as any)?.adresse ?? null}
      clientName={(chantier as any)?.client_nom ?? (chantier as any)?.client ?? null}
      intervenants={intervenants}
      onDocumentsRefresh={onDocumentsRefresh}
    />
  );
}
