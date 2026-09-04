import { AlertTriangle, ArrowRight, CalendarDays, CircleDollarSign, ClipboardList, Clock3, FileText, Hammer, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../../components/ui/button";
import { TONE_SOFT, type Tone } from "../../../../design-system/tone";
import type { ChantierDerived, ChantierListActions } from "../types";
import { budgetLabel, currency, shortDate, timeLabel } from "../utils/chantiersListUtils";
import { ChantierProgress } from "./ChantierProgress";
import { ChantierRowActions } from "./ChantierRowActions";
import { ChantierStatusPill } from "./ChantierStatusPill";

const TABS = ["Vue rapide", "Tâches", "Temps", "Planning", "Financier", "Documents", "Retours terrain", "Alertes"] as const;

function getProjectHref(row: ChantierDerived) {
  if (row.crm_opportunity_id) return `/projets/opportunity-${row.crm_opportunity_id}`;
  if (row.crm_prospect_id) return `/projets/prospect-${row.crm_prospect_id}`;
  if (row.crm_client_id) return `/projets/client-${row.crm_client_id}`;
  return null;
}

function getCommercialSourceLabel(row: ChantierDerived) {
  if (row.crm_opportunity_id) return "Opportunité commerciale";
  if (row.crm_prospect_id) return "Prospect";
  if (row.crm_client_id) return "Client";
  if (row.crm_quote_id) return "Devis rattaché";
  return "Chantier seul";
}

function getQuoteHref(row: ChantierDerived, projectHref: string | null) {
  if (!row.crm_quote_id) return null;
  if (projectHref) return `${projectHref}/devis/${row.crm_quote_id}/edit`;
  return `/crm/devis/${row.crm_quote_id}/edit`;
}

function getBillingHref(row: ChantierDerived, projectHref: string | null) {
  if (projectHref && (row.crm_quote_id || row.signed_quote_amount_ht || row.signed_quote_amount_ttc)) {
    return `${projectHref}?tab=quotes`;
  }
  if (row.crm_quote_id) return `/crm/devis/${row.crm_quote_id}/edit`;
  return null;
}

function getClientContactLabel(row: ChantierDerived) {
  return [row.crm_client_phone, row.crm_client_email].filter(Boolean).join(" · ") || "Non renseigné";
}

function getCommercialNextStepLabel(params: { quoteHref: string | null; billingHref: string | null }) {
  if (params.billingHref && params.quoteHref) return "Devis et facturation projet";
  if (params.billingHref) return "Facturation projet";
  if (params.quoteHref) return "Devis à consulter";
  return "Financier chantier";
}

function getTerrainFeedbackInfo(row: ChantierDerived) {
  const open = row.terrainFeedbackOpenCount ?? 0;
  const priority = row.terrainFeedbackPriorityCount ?? 0;
  const href = `/chantiers/${encodeURIComponent(row.id)}/retours-terrain`;

  if (priority > 0) {
    return {
      href,
      open,
      priority,
      hasOpen: true,
      tone: "danger" as Tone,
      metric: `${priority} retour${priority > 1 ? "s" : ""} urgent${priority > 1 ? "s" : ""}`,
      description: `${open} retour${open > 1 ? "s" : ""} terrain ouvert${open > 1 ? "s" : ""}, dont ${priority} urgent${priority > 1 ? "s" : ""}. Ouvrir le pilotage permet de traiter le point, l'assigner ou créer une réserve chantier.`,
      cta: "Traiter les retours urgents",
    };
  }

  if (open > 0) {
    return {
      href,
      open,
      priority,
      hasOpen: true,
      tone: "warning" as Tone,
      metric: `${open} retour${open > 1 ? "s" : ""} à traiter`,
      description: `${open} retour${open > 1 ? "s" : ""} terrain ouvert${open > 1 ? "s" : ""}. Le pilotage filtré permet de garder le lien entre le terrain, l'exécution, les documents et les réserves.`,
      cta: "Voir les retours chantier",
    };
  }

  return {
    href,
    open,
    priority,
    hasOpen: false,
    tone: "normal" as Tone,
    metric: "Aucun retour ouvert",
    description: "Aucun retour terrain ouvert pour ce chantier. L'espace reste disponible pour contrôler les observations historisées ou les nouvelles remontées terrain.",
    cta: "Ouvrir les retours terrain",
  };
}

function CommercialContext({ row }: { row: ChantierDerived }) {
  const projectHref = getProjectHref(row);
  const quoteHref = getQuoteHref(row, projectHref);
  const billingHref = getBillingHref(row, projectHref);
  const financialHref = `/chantiers/${row.id}/financier`;
  const hasCommercialContext = Boolean(projectHref || quoteHref || row.signed_quote_amount_ht || row.crm_client_phone || row.crm_client_email);

  if (!hasCommercialContext) {
    return null;
  }

  return (
    <div className={`rounded-card p-4 ${TONE_SOFT.info}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="bt-card-title text-ink">Dossier commercial</h3>
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="bt-caption text-muted">Rattachement</span>
              <div className="bt-card-title text-ink">{getCommercialSourceLabel(row)}</div>
            </div>
            <div>
              <span className="bt-caption text-muted">Devis signé</span>
              <div className="bt-card-title bt-num text-ink">{budgetLabel(row.signed_quote_amount_ht)}</div>
            </div>
            <div>
              <span className="bt-caption text-muted">Contact client</span>
              <div className="bt-card-title text-ink">{getClientContactLabel(row)}</div>
            </div>
            <div>
              <span className="bt-caption text-muted">Suite métier</span>
              <div className="bt-card-title text-ink">{getCommercialNextStepLabel({ quoteHref, billingHref })}</div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {projectHref ? (
            <Link to={projectHref} className="bt-tap inline-flex items-center rounded-field border border-strong bg-surface px-3 text-sm font-medium text-ink-secondary transition-colors duration-[120ms] hover:bg-interactive hover:text-ink">
              Projet commercial
            </Link>
          ) : null}
          {quoteHref ? (
            <Link to={quoteHref} className="bt-tap inline-flex items-center rounded-field border border-strong bg-surface px-3 text-sm font-medium text-ink-secondary transition-colors duration-[120ms] hover:bg-interactive hover:text-ink">
              Devis
            </Link>
          ) : null}
          {billingHref ? (
            <Link to={billingHref} className="bt-tap inline-flex items-center rounded-field border border-strong bg-surface px-3 text-sm font-medium text-ink-secondary transition-colors duration-[120ms] hover:bg-interactive hover:text-ink">
              Facturer
            </Link>
          ) : null}
          <Link to={financialHref} className="bt-tap inline-flex items-center rounded-field border border-strong bg-surface px-3 text-sm font-medium text-ink-secondary transition-colors duration-[120ms] hover:bg-interactive hover:text-ink">
            Financier chantier
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ChantierQuickDrawer({ row, actions, onClose }: { row: ChantierDerived | null; actions: ChantierListActions; onClose: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Vue rapide");
  if (!row) return null;

  const terrainFeedbackInfo = getTerrainFeedbackInfo(row);
  const alertHref = terrainFeedbackInfo.hasOpen ? terrainFeedbackInfo.href : `/chantiers/${row.id}/qualite`;
  const alertTitle = terrainFeedbackInfo.hasOpen ? "Retours terrain à traiter" : "Qualité, réserves et alertes";
  const alertDescription = terrainFeedbackInfo.hasOpen
    ? terrainFeedbackInfo.description
    : row.isLate
      ? "Le chantier est en retard. Ouvrir la qualité permet de traiter les réserves et points de blocage."
      : "Suivre les réserves, contrôles et points qualité avant réception ou clôture du chantier.";
  const alertMetric = terrainFeedbackInfo.hasOpen
    ? terrainFeedbackInfo.metric
    : row.isLate
      ? "Chantier en retard"
      : "Aucune alerte critique";
  const alertTone: Tone = terrainFeedbackInfo.hasOpen ? terrainFeedbackInfo.tone : row.isLate ? "danger" : "normal";
  const alertCta = terrainFeedbackInfo.hasOpen ? terrainFeedbackInfo.cta : "Ouvrir la qualité";

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[color:var(--bt-overlay)]" onClick={onClose}>
      <aside
        className="flex h-full w-full flex-col overflow-y-auto border-l border-subtle bg-elevated shadow-overlay sm:w-[420px] lg:w-[480px] xl:w-[560px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-subtle bg-elevated/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2">
                <ChantierStatusPill status={row.status} />
              </div>
              <h2 className="bt-page-title truncate text-ink">{row.nom}</h2>
              <p className="bt-secondary mt-1 text-muted">{row.client ?? "Client non renseigné"}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Fermer">
              <X className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </div>
          <div className="mt-4">
            <ChantierRowActions row={row} actions={actions} menuPlacement="down" />
          </div>
        </div>

        <div role="tablist" aria-label="Sections du chantier" className="flex gap-1 overflow-x-auto border-b border-subtle px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((entry) => {
            const active = tab === entry;
            return (
              <button
                key={entry}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(entry)}
                className={`bt-tap shrink-0 whitespace-nowrap px-3 text-[13px] font-medium transition-colors duration-[180ms] ${
                  active ? "-mb-px border-b-2 border-primary text-ink" : "text-muted hover:text-ink-secondary"
                }`}
              >
                {entry}
              </button>
            );
          })}
        </div>

        <div className="space-y-4 p-5">
          {tab === "Vue rapide" ? (
            <>
              <InfoGrid row={row} />
              <CommercialContext row={row} />
              <QuickAccessPanel row={row} />
              <div className="rounded-card border border-subtle p-4">
                <ChantierProgress value={row.progress} />
              </div>
              <div className="rounded-card border border-subtle p-4">
                <h3 className="bt-card-title text-ink">Description projet</h3>
                <p className="bt-secondary mt-2 text-muted">{row.crm_project_description || "Aucune description projet renseignée."}</p>
              </div>
            </>
          ) : tab === "Tâches" ? (
            <DetailShortcutPanel
              title="Tâches et devis chantier"
              description="Accéder au pilotage opérationnel : tâches, avancement, quantités, liens devis et préparation terrain."
              href={`/chantiers/${row.id}/execution`}
              icon={ClipboardList}
              cta="Ouvrir l'exécution"
              metric={`${row.progress}% d'avancement`}
            />
          ) : tab === "Temps" ? (
            <DetailShortcutPanel
              title="Temps chantier"
              description="Contrôler les heures saisies par tâche et par intervenant, puis rapprocher les écarts avec l'exécution, l'équipe et le planning."
              href={`/chantiers/${row.id}/temps`}
              icon={Clock3}
              cta="Ouvrir les temps"
              metric={timeLabel(row.heures_prevues, row.heures_passees)}
            />
          ) : tab === "Planning" ? (
            <DetailShortcutPanel
              title="Planning chantier"
              description="Ouvrir le quotidien et le Gantt du chantier pour organiser les jalons et les séquences sans créer de tâches depuis la vue planning."
              href={`/chantiers/${row.id}/planning`}
              icon={CalendarDays}
              cta="Ouvrir le planning"
              metric={shortDate(row.date_fin_prevue ?? row.planning_end_date ?? row.planning_start_date ?? row.date_debut)}
            />
          ) : tab === "Financier" ? (
            <DetailShortcutPanel
              title="Budget et facturation chantier"
              description="Ouvrir le suivi financier du chantier pour rapprocher devis signé, budget prévu, marge estimée et facturation sans repasser par la liste projets."
              href={`/chantiers/${row.id}/financier`}
              icon={CircleDollarSign}
              cta="Ouvrir le financier"
              metric={budgetLabel(row.budgetHt)}
            />
          ) : tab === "Documents" ? (
            <DetailShortcutPanel
              title="Documents chantier"
              description="Consulter les plans, documents client, pièces liées aux tâches, DOE et éléments utiles au terrain."
              href={`/chantiers/${row.id}/documents`}
              icon={FileText}
              cta="Ouvrir les documents"
              metric={row.adresse ?? "Adresse non renseignée"}
            />
          ) : tab === "Retours terrain" ? (
            <DetailShortcutPanel
              title="Retours terrain du chantier"
              description={terrainFeedbackInfo.description}
              href={terrainFeedbackInfo.href}
              icon={AlertTriangle}
              cta={terrainFeedbackInfo.cta}
              metric={terrainFeedbackInfo.metric}
              tone={terrainFeedbackInfo.tone}
            />
          ) : (
            <DetailShortcutPanel
              title={alertTitle}
              description={alertDescription}
              href={alertHref}
              icon={AlertTriangle}
              cta={alertCta}
              metric={alertMetric}
              tone={alertTone}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

function QuickAccessPanel({ row }: { row: ChantierDerived }) {
  const terrainFeedbackInfo = getTerrainFeedbackInfo(row);
  const qualityTone: Tone = terrainFeedbackInfo.priority > 0 ? "danger" : terrainFeedbackInfo.hasOpen ? "warning" : "normal";
  const links: Array<{
    label: string;
    description: string;
    href: string;
    icon: typeof ClipboardList;
    tone?: Tone;
  }> = [
    {
      label: "Préparer",
      description: "Lots, préparation et cadrage chantier",
      href: `/chantiers/${row.id}/preparation`,
      icon: ClipboardList,
    },
    {
      label: "Exécuter",
      description: "Tâches, devis et avancement",
      href: `/chantiers/${row.id}/execution`,
      icon: Hammer,
    },
    {
      label: "Temps",
      description: timeLabel(row.heures_prevues, row.heures_passees),
      href: `/chantiers/${row.id}/temps`,
      icon: Clock3,
    },
    {
      label: "Planning",
      description: "Quotidien et Gantt chantier",
      href: `/chantiers/${row.id}/planning`,
      icon: CalendarDays,
    },
    {
      label: "Financier",
      description: budgetLabel(row.budgetHt),
      href: `/chantiers/${row.id}/financier`,
      icon: CircleDollarSign,
    },
    {
      label: "Retours terrain",
      description: terrainFeedbackInfo.metric,
      href: terrainFeedbackInfo.href,
      icon: AlertTriangle,
      tone: terrainFeedbackInfo.tone,
    },
    {
      label: "Qualité",
      description: terrainFeedbackInfo.hasOpen ? "Réserves, contrôles et retours à rapprocher" : "Réserves, contrôles et réception",
      href: `/chantiers/${row.id}/qualite`,
      icon: AlertTriangle,
      tone: qualityTone,
    },
    {
      label: "Documents",
      description: "Plans, pièces liées et DOE",
      href: `/chantiers/${row.id}/documents`,
      icon: FileText,
    },
  ];

  return (
    <div className="rounded-card border border-subtle p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="bt-card-title text-ink">Accès rapides chantier</h3>
          <p className="bt-secondary mt-1 text-muted">Ouvrir directement le bon espace métier du dossier.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {links.map((link) => {
          const Icon = link.icon;
          const tone = link.tone ?? "normal";
          return (
            <Link
              key={`${link.label}:${link.href}`}
              to={link.href}
              className={`group flex items-start gap-3 rounded-field border border-strong bg-surface p-3 transition-colors duration-[120ms] hover:bg-interactive ${
                tone !== "normal" ? TONE_SOFT[tone] : ""
              }`}
            >
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-interactive text-ink-secondary">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="bt-card-title block text-ink">{link.label}</span>
                <span className="bt-caption mt-0.5 block text-muted">{link.description}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function DetailShortcutPanel({
  title,
  description,
  href,
  icon: Icon,
  cta,
  metric,
  tone = "info",
}: {
  title: string;
  description: string;
  href: string;
  icon: typeof ClipboardList;
  cta: string;
  metric: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-card border border-subtle p-4">
      <div className={`inline-flex items-center gap-2 rounded-field px-3 py-2 text-sm font-medium ${TONE_SOFT[tone]}`}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
        {metric}
      </div>
      <h3 className="bt-card-title mt-4 text-ink">{title}</h3>
      <p className="bt-secondary mt-2 text-muted">{description}</p>
      <Link
        to={href}
        className="bt-tap mt-4 inline-flex items-center gap-2 rounded-field bg-primary px-4 text-sm font-medium text-primary-contrast transition-colors duration-[120ms] hover:bg-primary-hover"
      >
        {cta}
        <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
      </Link>
    </div>
  );
}

function InfoGrid({ row }: { row: ChantierDerived }) {
  const items = [
    ["Adresse", row.adresse ?? "—"],
    ["Budget", budgetLabel(row.budgetHt)],
    ["Marge estimée", currency(row.estimatedMargin)],
    ["Date début", shortDate(row.date_debut ?? row.planning_start_date)],
    ["Date fin", shortDate(row.date_fin_prevue ?? row.planning_end_date)],
    ["Temps", timeLabel(row.heures_prevues, row.heures_passees)],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-card border border-subtle p-4">
          <div className="bt-caption text-muted">{label}</div>
          <div className="bt-card-title bt-num mt-1 text-ink">{value}</div>
        </div>
      ))}
    </div>
  );
}
