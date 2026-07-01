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
      eyebrow="Pilotage financier chantier"
      title="Imprévus et travaux supplémentaires"
      subtitle="Suivi des écarts chantier, impacts financiers, arbitrages et travaux à refacturer. Les saisies détaillées se font dans le panneau latéral."
      actionLabel="Ouvrir les imprévus / TS chantier"
      previewClassName="batipro-chapter-preview--unforeseen"
      drawerMaxWidthClassName="max-w-6xl"
      autoOpenKey={targetedChangeOrderId ? `change-order:${targetedChangeOrderId}` : ""}
      autoOpenLabel="Imprévu / TS ciblé depuis la recherche globale"
      onAutoOpenClear={clearTargetedChangeOrder}
    >
      {targetedChangeOrderId ? (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Recherche globale : le panneau financier Imprévus / TS est ouvert pour retrouver l'écart chantier ou le travail supplémentaire ciblé. Retirez le ciblage une fois le contrôle terminé pour revenir au parcours chantier standard.
        </div>
      ) : null}
      <PilotageTab {...props} />
    </ChantierChapterDrawer>
  );
}
