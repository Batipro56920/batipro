import { AlertTriangle, ArrowRight, CalendarDays, CircleDollarSign, ClipboardList, Clock3, FileText, Hammer, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../../components/ui/button";
import type { ChantierDerived, ChantierListActions } from "../types";
import { budgetLabel, currency, shortDate, timeLabel } from "../utils/chantiersListUtils";
import { ChantierProgress } from "./ChantierProgress";
import { ChantierRowActions } from "./ChantierRowActions";
import { ChantierStatusPill } from "./ChantierStatusPill";

const TABS = ["Vue rapide", "Tâches", "Temps", "Planning", "Financier", "Documents", "Retours terrain", "Alertes"] as const;
type ShortcutTone = "blue" | "red" | "amber" | "slate";

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
  const href = `/retours-terrain?chantierId=${encodeURIComponent(row.id)}`;

  if (priority > 0) {
    return {
      href,
      open,
      priority,
      hasOpen: true,
      tone: "red" as const,
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
      tone: "amber" as const,
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
    tone: "slate" as const,
    metric: "Aucun retour ouvert",
    description: "Aucun retour terrain ouvert pour ce chantier. L'espace reste disponible pour contrôler les observations historisées ou les nouvelles remontées terrain.",
    cta: "Ouvrir les retours terrain",
  };
}

function shortcutLinkClasses(tone: ShortcutTone = "slate") {
  if (tone === "red") return "border-red-200 bg-red-50 hover:border-red-300 hover:bg-red-100";
  if (tone === "amber") return "border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-amber-100";
  if (tone === "blue") return "border-blue-200 bg-blue-50 hover:border-blue-300 hover:bg-blue-100";
  return "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50";
}

function shortcutIconClasses(tone: ShortcutTone = "slate") {
  if (tone === "red") return "bg-white text-red-700 group-hover:bg-red-50";
  if (tone === "amber") return "bg-white text-amber-700 group-hover:bg-amber-50";
  if (tone === "blue") return "bg-white text-blue-700 group-hover:bg-blue-50";
  return "bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-blue-700";
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
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-blue-950">Dossier commercial</h3>
          <div className="mt-2 grid gap-2 text-sm text-blue-900 sm:grid-cols-2">
            <div>
              <span className="text-blue-700/80">Rattachement</span>
              <div className="font-semibold">{getCommercialSourceLabel(row)}</div>
            </div>
            <div>
              <span className="text-blue-700/80">Devis signé</span>
              <div className="font-semibold">{budgetLabel(row.signed_quote_amount_ht)}</div>
            </div>
            <div>
              <span className="text-blue-700/80">Contact client</span>
              <div className="font-semibold">{getClientContactLabel(row)}</div>
            </div>
            <div>
              <span className="text-blue-700/80">Suite métier</span>
              <div className="font-semibold">{getCommercialNextStepLabel({ quoteHref, billingHref })}</div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {projectHref ? (
            <Link to={projectHref} className="inline-flex h-9 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-100">
              Projet commercial
            </Link>
          ) : null}
          {quoteHref ? (
            <Link to={quoteHref} className="inline-flex h-9 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-100">
              Devis
            </Link>
          ) : null}
          {billingHref ? (
            <Link to={billingHref} className="inline-flex h-9 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-100">
              Facturer
            </Link>
          ) : null}
          <Link to={financialHref} className="inline-flex h-9 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-100">
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
  const alertTone = terrainFeedbackInfo.hasOpen ? terrainFeedbackInfo.tone : row.isLate ? "red" : "slate";
  const alertCta = terrainFeedbackInfo.hasOpen ? terrainFeedbackInfo.cta : "Ouvrir la qualité";

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/20" onClick={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2"><ChantierStatusPill status={row.status} /></div>
              <h2 className="truncate text-xl font-semibold text-slate-950">{row.nom}</h2>
              <p className="mt-1 text-sm text-slate-500">{row.client ?? "Client non renseigné"}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Fermer">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4">
            <ChantierRowActions row={row} actions={actions} />
          </div>
        </div>

        <div className="border-b border-slate-200 px-5 py-3">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-50 p-1">
            {TABS.map((entry) => (
              <button key={entry} type="button" onClick={() => setTab(entry)} className={["shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition", tab === entry ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-950"].join(" ")}>
                {entry}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 p-5">
          {tab === "Vue rapide" ? (
            <>
              <InfoGrid row={row} />
              <CommercialContext row={row} />
              <QuickAccessPanel row={row} />
              <div className="rounded-2xl border border-slate-200 p-4">
                <ChantierProgress value={row.progress} />
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-950">Description projet</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{row.crm_project_description || "Aucune description projet renseignée."}</p>
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
  const qualityTone: ShortcutTone = terrainFeedbackInfo.priority > 0 ? "red" : terrainFeedbackInfo.hasOpen ? "amber" : "slate";
  const links: Array<{
    label: string;
    description: string;
    href: string;
    icon: typeof ClipboardList;
    tone?: ShortcutTone;
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
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">Accès rapides chantier</h3>
          <p className="mt-1 text-sm text-slate-500">Ouvrir directement le bon espace métier du dossier.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={`${link.label}:${link.href}`}
              to={link.href}
              className={`group flex items-start gap-3 rounded-2xl border p-3 transition ${shortcutLinkClasses(link.tone)}`}
            >
              <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${shortcutIconClasses(link.tone)}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-950">{link.label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">{link.description}</span>
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
  tone = "blue",
}: {
  title: string;
  description: string;
  href: string;
  icon: typeof ClipboardList;
  cta: string;
  metric: string;
  tone?: ShortcutTone;
}) {
  const toneClasses =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : tone === "slate"
          ? "border-slate-200 bg-slate-50 text-slate-700"
          : "border-blue-100 bg-blue-50 text-blue-900";

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${toneClasses}`}>
        <Icon className="h-4 w-4" />
        {metric}
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <Link to={href} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
        {cta}
        <ArrowRight className="h-4 w-4" />
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
        <div key={label} className="rounded-2xl border border-slate-200 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
          <div className="mt-1 font-semibold text-slate-950">{value}</div>
        </div>
      ))}
    </div>
  );
}
