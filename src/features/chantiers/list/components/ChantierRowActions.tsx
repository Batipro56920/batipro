import { Archive, Ban, CalendarDays, CheckCircle2, ClipboardCheck, ClipboardList, Clock3, Download, ExternalLink, FileText, Hammer, MessageSquareWarning, MoreHorizontal, RotateCcw, Trash2, Users, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "../../../../components/feedback/ConfirmDialog";
import { Button } from "../../../../components/ui/button";
import type { ChantierListActions, ChantierDerived } from "../types";

type MenuTone = "default" | "warning" | "danger";

type CommercialAction = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const MENU_ITEM_CLASS =
  "bt-tap flex w-full items-center gap-2.5 rounded-field px-2.5 text-left text-sm font-medium transition-colors duration-[120ms]";

const MENU_TONE: Record<MenuTone, string> = {
  default: "text-ink-secondary hover:bg-interactive hover:text-ink",
  warning: "text-warning-on hover:bg-interactive",
  danger: "text-danger-on hover:bg-interactive",
};

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
    tone: (hasPriority ? "danger" : hasOpen ? "warning" : "default") as MenuTone,
  } as const;
}

function getProjectHref(row: ChantierDerived) {
  if (row.crm_opportunity_id) return `/projets/${encodeURIComponent(`opportunity-${row.crm_opportunity_id}`)}`;
  if (row.crm_prospect_id) return `/projets/${encodeURIComponent(`prospect-${row.crm_prospect_id}`)}`;
  if (row.crm_client_id) return `/projets/${encodeURIComponent(`client-${row.crm_client_id}`)}`;
  return null;
}

function getQuoteHref(row: ChantierDerived, projectHref: string | null) {
  if (!row.crm_quote_id) return null;
  const quoteId = encodeURIComponent(row.crm_quote_id);
  if (projectHref) return `${projectHref}/devis/${quoteId}/edit`;
  return `/crm/devis/${quoteId}/edit`;
}

function getBillingHref(row: ChantierDerived, projectHref: string | null) {
  if (projectHref && (row.crm_quote_id || row.signed_quote_amount_ht || row.signed_quote_amount_ttc)) {
    return `${projectHref}?tab=quotes`;
  }
  if (row.crm_quote_id || row.signed_quote_amount_ht || row.signed_quote_amount_ttc) return "/factures";
  return null;
}

function getBillingLabel(projectHref: string | null) {
  return projectHref ? "Facturation projet" : "Factures chantier";
}

function getCommercialActions(row: ChantierDerived): CommercialAction[] {
  const projectHref = getProjectHref(row);
  const quoteHref = getQuoteHref(row, projectHref);
  const billingHref = getBillingHref(row, projectHref);
  const actions: CommercialAction[] = [];

  if (projectHref) actions.push({ href: projectHref, label: "Projet commercial", icon: ExternalLink });
  if (quoteHref) actions.push({ href: quoteHref, label: "Devis rattaché", icon: FileText });
  if (billingHref) actions.push({ href: billingHref, label: getBillingLabel(projectHref), icon: FileText });

  return actions;
}

/**
 * Une action primaire ("Ouvrir") ; tout le reste passe en menu overflow,
 * rendu selon l'anatomie de dropdown de l'annexe A.
 */
export function ChantierRowActions({
  row,
  actions,
  menuPlacement = "down",
}: {
  row: ChantierDerived;
  actions: ChantierListActions;
  /** "up" quand le menu est ancre en pied de drawer : il ne doit pas sortir du cadre. */
  menuPlacement?: "down" | "up";
}) {
  const terminal = row.status === "TERMINE" || row.status === "ARCHIVE" || row.status === "ANNULE";
  const chantierBaseHref = `/chantiers/${encodeURIComponent(row.id)}`;
  const terrainFeedbackAction = getTerrainFeedbackAction(row);
  const commercialActions = getCommercialActions(row);

  return (
    <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
      <Button type="button" size="sm" variant="primary" onClick={() => actions.onOpen(row)}>
        <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
        Ouvrir
      </Button>
      <details className="relative">
        <summary
          aria-label="Plus d'actions"
          className="bt-tap flex w-8 cursor-pointer list-none items-center justify-center rounded-field border border-strong bg-surface text-ink-secondary transition-colors duration-[120ms] hover:bg-interactive hover:text-ink"
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
        </summary>
        <div
          className={`absolute right-0 z-20 w-[280px] max-w-[320px] rounded-card border border-subtle bg-elevated p-1 shadow-elevated ${
            menuPlacement === "up" ? "bottom-full mb-1.5" : "mt-1.5"
          }`}
        >
          <div className="bt-caption px-2.5 py-1.5 text-muted">Espaces chantier</div>
          <MenuLink icon={ClipboardList} label="Préparation" href={`${chantierBaseHref}/preparation`} />
          <MenuLink icon={Hammer} label="Tâches / exécution" href={`${chantierBaseHref}/execution`} />
          <MenuLink icon={Clock3} label="Temps chantier" href={`${chantierBaseHref}/temps`} />
          <MenuLink icon={CalendarDays} label="Planning" href={`${chantierBaseHref}/planning`} />
          <MenuLink icon={CheckCircle2} label="Qualité / réserves" href={`${chantierBaseHref}/qualite`} />
          <MenuLink icon={ClipboardCheck} label="Visites chantier" href={`${chantierBaseHref}/visites`} />
          <MenuLink icon={FileText} label="Documents" href={`${chantierBaseHref}/documents`} />
          <MenuLink icon={Users} label="Équipe" href={`${chantierBaseHref}/equipe`} />
          <MenuLink icon={MessageSquareWarning} label={terrainFeedbackAction.label} href={terrainFeedbackAction.href} tone={terrainFeedbackAction.tone} />

          {commercialActions.length > 0 ? (
            <>
              <div className="my-1 border-t border-subtle" />
              <div className="bt-caption px-2.5 py-1.5 text-muted">Commercial</div>
              {commercialActions.map((action) => (
                <MenuLink key={action.href} icon={action.icon} label={action.label} href={action.href} />
              ))}
            </>
          ) : null}

          <div className="my-1 border-t border-subtle" />
          <div className="bt-caption px-2.5 py-1.5 text-muted">Gestion</div>
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
          {terminal ? <MenuButton icon={RotateCcw} label="Restaurer" onClick={() => actions.onRestore(row)} /> : null}
          <MenuButton icon={Download} label="Export" onClick={() => actions.onExportRow(row)} />
          <MenuButton icon={ExternalLink} label="Dupliquer" disabled title="Duplication chantier non supportée par l'API actuelle." />

          <div className="my-1 border-t border-subtle" />
          {row.status !== "ANNULE" ? (
            <ConfirmDialog
              title="Annuler ce chantier ?"
              description="Le chantier sera exclu du pilotage opérationnel. Vous pourrez le restaurer ensuite si nécessaire."
              confirmLabel="Annuler le chantier"
              onConfirm={() => actions.onCancel(row)}
              trigger={<MenuButton icon={Ban} label="Annuler" tone="danger" />}
            />
          ) : null}
          <ConfirmDialog
            title="Supprimer ce brouillon ?"
            description="La suppression est logique et uniquement disponible pour les chantiers en brouillon."
            confirmLabel="Supprimer"
            onConfirm={() => actions.onDeleteDraft(row)}
            trigger={
              <MenuButton
                icon={Trash2}
                label="Supprimer"
                tone="danger"
                disabled={row.status !== "BROUILLON"}
                title={row.status === "BROUILLON" ? undefined : "Suppression disponible uniquement sur les brouillons."}
              />
            }
          />
        </div>
      </details>
    </div>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = "default",
  title,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: MenuTone;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`${MENU_ITEM_CLASS} ${MENU_TONE[tone]} disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent`}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      {label}
    </button>
  );
}

function MenuLink({ icon: Icon, label, href, tone = "default" }: { icon: LucideIcon; label: string; href: string; tone?: MenuTone }) {
  return (
    <Link to={href} className={`${MENU_ITEM_CLASS} ${MENU_TONE[tone]}`}>
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      {label}
    </Link>
  );
}
