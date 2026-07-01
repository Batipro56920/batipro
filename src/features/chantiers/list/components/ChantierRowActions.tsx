import { Archive, Ban, CalendarDays, CheckCircle2, ClipboardList, Download, ExternalLink, FileText, Hammer, MessageSquareWarning, MoreHorizontal, RotateCcw, Trash2, Users, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "../../../../components/feedback/ConfirmDialog";
import { Button } from "../../../../components/ui/button";
import type { ChantierListActions, ChantierDerived } from "../types";

function getTerrainFeedbackAction(row: ChantierDerived) {
  const openCount = row.terrainFeedbackOpenCount ?? 0;
  const priorityCount = row.terrainFeedbackPriorityCount ?? 0;
  const hasPriority = priorityCount > 0;
  const hasOpen = openCount > 0;

  return {
    href: `/retours-terrain?chantierId=${encodeURIComponent(row.id)}`,
    label: hasPriority
      ? `Retours terrain (${priorityCount} urgent${priorityCount > 1 ? "s" : ""})`
      : hasOpen
        ? `Retours terrain (${openCount} à traiter)`
        : "Retours terrain",
    tone: hasPriority ? "red" : hasOpen ? "amber" : "blue",
  } as const;
}

export function ChantierRowActions({ row, actions }: { row: ChantierDerived; actions: ChantierListActions }) {
  const terminal = row.status === "TERMINE" || row.status === "ARCHIVE" || row.status === "ANNULE";
  const chantierBaseHref = `/chantiers/${encodeURIComponent(row.id)}`;
  const terrainFeedbackAction = getTerrainFeedbackAction(row);

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
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-950/10">
          <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Espaces chantier
          </div>
          <MenuLink icon={ClipboardList} label="Préparation" href={`${chantierBaseHref}/preparation`} />
          <MenuLink icon={Hammer} label="Tâches / exécution" href={`${chantierBaseHref}/execution`} />
          <MenuLink icon={CalendarDays} label="Planning" href={`${chantierBaseHref}/planning`} />
          <MenuLink icon={CheckCircle2} label="Qualité / réserves" href={`${chantierBaseHref}/qualite`} />
          <MenuLink icon={FileText} label="Documents" href={`${chantierBaseHref}/documents`} />
          <MenuLink icon={Users} label="Équipe" href={`${chantierBaseHref}/equipe`} />
          <MenuLink icon={MessageSquareWarning} label={terrainFeedbackAction.label} href={terrainFeedbackAction.href} tone={terrainFeedbackAction.tone} />

          <div className="my-2 border-t border-slate-100" />
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Gestion
          </div>
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

function MenuButton({ icon: Icon, label, onClick, disabled, danger, title }: { icon: LucideIcon; label: string; onClick?: () => void; disabled?: boolean; danger?: boolean; title?: string }) {
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

function MenuLink({ icon: Icon, label, href, tone = "blue" }: { icon: LucideIcon; label: string; href: string; tone?: "blue" | "amber" | "red" }) {
  const className =
    tone === "red"
      ? "text-red-700 hover:bg-red-50"
      : tone === "amber"
        ? "text-amber-800 hover:bg-amber-50"
        : "text-blue-700 hover:bg-blue-50";

  return (
    <Link
      to={href}
      className={["flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition", className].join(" ")}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
