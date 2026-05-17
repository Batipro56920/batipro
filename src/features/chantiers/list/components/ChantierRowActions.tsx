import { Archive, Ban, CheckCircle2, Download, ExternalLink, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../../../../components/feedback/ConfirmDialog";
import { Button } from "../../../../components/ui/button";
import type { ChantierListActions, ChantierDerived } from "../types";

export function ChantierRowActions({ row, actions }: { row: ChantierDerived; actions: ChantierListActions }) {
  const terminal = row.status === "TERMINE" || row.status === "ARCHIVE" || row.status === "ANNULE";

  return (
    <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
      <Button type="button" size="sm" variant="primary" onClick={() => actions.onOpen(row)}>
        <ExternalLink className="h-4 w-4" />
        Ouvrir
      </Button>
      <details className="relative">
        <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50">
          <MoreHorizontal className="h-4 w-4" />
        </summary>
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-950/10">
          {row.status !== "TERMINE" ? (
            <ConfirmDialog
              title="Marquer ce chantier terminé ?"
              description="Le chantier sortira des vues opérationnelles actives et n'impactera plus les KPI actifs."
              confirmLabel="Terminer"
              onConfirm={() => actions.onFinish(row)}
              trigger={<MenuButton icon={CheckCircle2} label="Terminer" />}
            />
          ) : null}
          {row.status !== "ARCHIVE" ? (
            <ConfirmDialog
              title="Archiver ce chantier ?"
              description="Les données seront conservées, mais le chantier sera masqué des vues opérationnelles."
              confirmLabel="Archiver"
              onConfirm={() => actions.onArchive(row)}
              trigger={<MenuButton icon={Archive} label="Archiver" />}
            />
          ) : null}
          {row.status !== "ANNULE" ? (
            <ConfirmDialog
              title="Annuler ce chantier ?"
              description="Le chantier sera exclu du pilotage opérationnel. Vous pourrez le restaurer ensuite si nécessaire."
              confirmLabel="Annuler le chantier"
              onConfirm={() => actions.onCancel(row)}
              trigger={<MenuButton icon={Ban} label="Annuler" danger />}
            />
          ) : null}
          {terminal ? <MenuButton icon={RotateCcw} label="Restaurer" onClick={() => actions.onRestore(row)} /> : null}
          <MenuButton icon={Download} label="Export" onClick={() => actions.onExportRow(row)} />
          <MenuButton icon={ExternalLink} label="Dupliquer" disabled title="Duplication chantier non supportée par l'API actuelle." />
          <ConfirmDialog
            title="Supprimer ce brouillon ?"
            description="La suppression est logique et uniquement disponible pour les chantiers en brouillon."
            confirmLabel="Supprimer"
            onConfirm={() => actions.onDeleteDraft(row)}
            trigger={<MenuButton icon={Trash2} label="Supprimer" danger disabled={row.status !== "BROUILLON"} title={row.status === "BROUILLON" ? undefined : "Suppression disponible uniquement sur les brouillons."} />}
          />
        </div>
      </details>
    </div>
  );
}

function MenuButton({ icon: Icon, label, onClick, disabled, danger, title }: { icon: typeof MoreHorizontal; label: string; onClick?: () => void; disabled?: boolean; danger?: boolean; title?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={["flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45", danger ? "text-red-700 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"].join(" ")}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
