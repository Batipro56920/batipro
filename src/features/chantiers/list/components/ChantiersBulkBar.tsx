import { Archive, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import type { ChantierDerived } from "../types";

/**
 * Barre d'action de lot : ancree en bas, seule surface flottante de l'ecran
 * (niveau 2 : bg-elevated + shadow-elevated + bordure).
 */
export function ChantiersBulkBar({
  selectedRows,
  saving,
  onFinish,
  onArchive,
  onDeleteDrafts,
}: {
  selectedRows: ChantierDerived[];
  saving: boolean;
  onFinish: () => void;
  onArchive: () => void;
  onDeleteDrafts: () => void;
}) {
  if (selectedRows.length === 0) return null;

  return (
    <div className="sticky bottom-4 z-30">
      <div className="flex min-h-14 flex-wrap items-center gap-2 rounded-card border border-subtle bg-elevated px-4 py-2 shadow-elevated">
        <span className="bt-card-title bt-num text-ink">
          {selectedRows.length} sélectionné{selectedRows.length > 1 ? "s" : ""}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={onFinish}>
            <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
            Marquer terminés
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={onArchive}>
            <Archive className="h-4 w-4" strokeWidth={1.75} />
            Archiver
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            disabled={saving || selectedRows.every((row) => row.status !== "BROUILLON")}
            onClick={onDeleteDrafts}
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            Supprimer brouillons
          </Button>
        </div>
      </div>
    </div>
  );
}
