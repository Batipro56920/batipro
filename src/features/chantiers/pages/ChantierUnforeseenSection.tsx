import { useSearchParams } from "react-router-dom";

import PilotageTab from "../../../components/chantiers/PilotageTab";
import type { ChantierTaskRow } from "../../../services/chantierTasks.service";
import type { ChantierZoneRow } from "../../../services/chantierZones.service";
import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

type ChantierUnforeseenSectionProps = {
  chantierId: string;
  tasks: ChantierTaskRow[];
  zones: ChantierZoneRow[];
};

export default function ChantierUnforeseenSection(props: ChantierUnforeseenSectionProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const targetedChangeOrderId = searchParams.get("changeOrderId") ?? "";

  function clearTargetedChangeOrder() {
    if (!searchParams.has("changeOrderId")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("changeOrderId");
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <ChantierChapterDrawer
      eyebrow="Pilotage chantier"
      title="Imprevus et pilotage"
      subtitle="Suivi des imprevus, arbitrages et pilotage operationnel. Les saisies detaillees se font dans le panneau lateral."
      actionLabel="Ouvrir le pilotage"
      previewClassName="batipro-chapter-preview--unforeseen"
      drawerMaxWidthClassName="max-w-6xl"
      autoOpenKey={targetedChangeOrderId ? `change-order:${targetedChangeOrderId}` : ""}
      autoOpenLabel="Imprevu / TS cible depuis la recherche globale"
      onAutoOpenClear={clearTargetedChangeOrder}
    >
      {targetedChangeOrderId ? (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Recherche globale : le panneau pilotage est ouvert pour retrouver l'imprevu ou le travaux supplementaire cible. Retirez le ciblage une fois le controle termine pour revenir au parcours chantier standard.
        </div>
      ) : null}
      <PilotageTab {...props} />
    </ChantierChapterDrawer>
  );
}
