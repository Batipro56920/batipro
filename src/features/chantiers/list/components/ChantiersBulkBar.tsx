import { Archive, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import type { ChantierDerived } from "../types";

export function ChantiersBulkBar({ selectedRows, saving, onFinish, onArchive, onDeleteDrafts }: { selectedRows: ChantierDerived[]; saving: boolean; onFinish: () => void; onArchive: () => void; onDeleteDrafts: () => void }) {
  if (selectedRows.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
      <span className="font-semibold">{selectedRows.length} sélectionné(s)</span>
      <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={onFinish}>
        <CheckCircle2 className="h-4 w-4" />
        Marquer terminés
      </Button>
      <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={onArchive}>
        <Archive className="h-4 w-4" />
        Archiver
      </Button>
      <Button type="button" size="sm" variant="danger" disabled={saving || selectedRows.every((row) => row.status !== "BROUILLON")} onClick={onDeleteDrafts}>
        <Trash2 className="h-4 w-4" />
        Supprimer brouillons
      </Button>
    </div>
  );
}

