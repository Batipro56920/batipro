import { useSearchParams } from "react-router-dom";

import PreparationNotesPanel from "../../../components/chantiers/PreparationNotesPanel";
import type { ChantierDocumentRow } from "../../../services/chantierDocuments.service";
import type { ChantierTaskRow } from "../../../services/chantierTasks.service";
import type { ChantierZoneRow } from "../../../services/chantierZones.service";
import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

type ChantierNotesSectionProps = {
  chantierId: string;
  tasks: ChantierTaskRow[];
  zones: ChantierZoneRow[];
  documents: ChantierDocumentRow[];
};

export default function ChantierNotesSection(props: ChantierNotesSectionProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const targetedNoteId = searchParams.get("noteId") ?? "";

  function clearTargetedNote() {
    if (!searchParams.has("noteId")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("noteId");
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <ChantierChapterDrawer
      eyebrow="Execution"
      title="Notes chantier"
      subtitle="Notes, observations et rattachements chantier. La saisie et le detail se font dans le panneau lateral."
      actionLabel="Gerer les notes"
      previewClassName="batipro-chapter-preview--notes"
      drawerMaxWidthClassName="max-w-6xl"
      autoOpenKey={targetedNoteId ? `note:${targetedNoteId}` : ""}
      autoOpenLabel="Note ciblee depuis la recherche globale"
      onAutoOpenClear={clearTargetedNote}
    >
      {targetedNoteId ? (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span>
              Recherche globale : le panneau notes est ouvert et la note ciblee est surlignee quand elle est accessible. Retirez le ciblage une fois le controle termine pour revenir au parcours chantier standard.
            </span>
            <button
              type="button"
              onClick={clearTargetedNote}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
            >
              Retirer le ciblage
            </button>
          </div>
        </div>
      ) : null}
      <PreparationNotesPanel {...props} targetedNoteId={targetedNoteId} />
    </ChantierChapterDrawer>
  );
}
