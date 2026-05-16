import DoeTab from "../../../components/chantiers/DoeTab";
import type { ChantierDocumentRow } from "../../../services/chantierDocuments.service";

export default function ChantierDoeSection({
  chantierId,
  chantierName,
  chantierAddress,
  clientName,
  documents,
  onDocumentsRefresh,
}: {
  chantierId: string;
  chantierName: string;
  chantierAddress?: string | null;
  clientName?: string | null;
  documents: ChantierDocumentRow[];
  onDocumentsRefresh: () => Promise<void>;
}) {
  return (
    <DoeTab
      chantierId={chantierId}
      chantierName={chantierName}
      chantierAddress={chantierAddress}
      clientName={clientName}
      documents={documents}
      onDocumentsRefresh={onDocumentsRefresh}
    />
  );
}
