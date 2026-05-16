import RapportsTab from "../../../components/chantiers/RapportsTab";
import type { ChantierRow } from "../../../services/chantiers.service";

export default function ChantierReportsSection({
  chantier,
  onDocumentsRefresh,
  onActivityRefresh,
}: {
  chantier: ChantierRow;
  onDocumentsRefresh?: () => Promise<void>;
  onActivityRefresh?: () => Promise<void> | void;
}) {
  return <RapportsTab chantier={chantier} onDocumentsRefresh={onDocumentsRefresh} onActivityRefresh={onActivityRefresh} />;
}
