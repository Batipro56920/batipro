import { AlertTriangle, ArrowRight, ClipboardList, FileText, Hammer, Users, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../../components/ui/button";
import type { ChantierDerived, ChantierListActions } from "../types";
import { budgetLabel, currency, shortDate, timeLabel } from "../utils/chantiersListUtils";
import { ChantierProgress } from "./ChantierProgress";
import { ChantierRowActions } from "./ChantierRowActions";
import { ChantierStatusPill } from "./ChantierStatusPill";

const TABS = ["Vue rapide", "Tâches", "Équipe", "Documents", "Retours terrain", "Alertes"] as const;

function getProjectHref(row: ChantierDerived) {
  if (row.crm_opportunity_id) return `/projets/opportunity-${row.crm_opportunity_id}`;
  if (row.crm_prospect_id) return `/projets/prospect-${row.crm_prospect_id}`;
  if (row.crm_client_id) return `/projets/client-${row.crm_client_id}`;
  return null;
}

function CommercialContext({ row }: { row: ChantierDerived }) {
  const projectHref = getProjectHref(row);
  const quoteHref = projectHref && row.crm_quote_id ? `${projectHref}/devis/${row.crm_quote_id}/edit` : null;
  const quoteListHref = projectHref ? `${projectHref}?tab=quotes` : null;
  const financialHref = `/chantiers/${row.id}/financier`;
  const hasCommercialContext = Boolean(projectHref || row.crm_quote_id || row.signed_quote_amount_ht || row.crm_client_phone || row.crm_client_email);

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
              <span className="text-blue-700/80">Devis signé</span>
              <div className="font-semibold">{budgetLabel(row.signed_quote_amount_ht)}</div>
            </div>
            <div>
              <span className="text-blue-700/80">Contact client</span>
              <div className="font-semibold">{row.crm_client_phone || row.crm_client_email || "Non renseigné"}</div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {projectHref ? (
            <Link to={projectHref} className="inline-flex h-9 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-100">
              Projet
            </Link>
          ) : null}
          {quoteHref ? (
            <Link to={quoteHref} className="inline-flex h-9 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-100">
              Devis
            </Link>
          ) : null}
          {quoteListHref ? (
            <Link to={quoteListHref} className="inline-flex h-9 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-100">
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
          ) : tab === "Équipe" ? (
            <DetailShortcutPanel
              title="Équipe chantier"
              description="Retrouver les intervenants rattachés, les affectations et la coordination terrain du chantier."
              href={`/chantiers/${row.id}/equipe`}
              icon={Users}
              cta="Ouvrir l'équipe"
              metric={timeLabel(row.heures_prevues, row.heures_passees)}
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
              description="Centraliser les observations, blocages, photos et demandes remontés par les intervenants terrain pour traiter le sujet depuis le bon chantier."
              href={`/retours-terrain?chantierId=${row.id}`}
              icon={AlertTriangle}
              cta="Voir les retours"
              metric="Filtré sur ce chantier"
              tone={row.isLate ? "red" : "blue"}
            />
          ) : (
            <DetailShortcutPanel
              title="Qualité, réserves et alertes"
              description={row.isLate ? "Le chantier est en retard. Ouvrir la qualité permet de traiter les réserves et points de blocage." : "Suivre les réserves, contrôles et points qualité avant réception ou clôture du chantier."}
              href={`/chantiers/${row.id}/qualite`}
              icon={AlertTriangle}
              cta="Ouvrir la qualité"
              metric={row.isLate ? "Chantier en retard" : "Aucune alerte critique"}
              tone={row.isLate ? "red" : "slate"}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

function QuickAccessPanel({ row }: { row: ChantierDerived }) {
  const links = [
    {
      label: "Préparer",
      description: "Lots, préparation et cadrage chantier",
      href: `/chantiers/${row.id}/preparation`,
      icon: ClipboardList,
    },
    {
      label: "Exécuter",
      description: "Tâches, devis, avancement et temps",
      href: `/chantiers/${row.id}/execution`,
      icon: Hammer,
    },
    {
      label: "Retours terrain",
      description: "Observations et blocages filtrés",
      href: `/retours-terrain?chantierId=${row.id}`,
      icon: AlertTriangle,
    },
    {
      label: "Qualité",
      description: "Réserves, contrôles et réception",
      href: `/chantiers/${row.id}/qualite`,
      icon: AlertTriangle,
    },
    {
      label: "Documents",
      description: "Plans, pièces liées et DOE",
      href: `/chantiers/${row.id}/documents`,
      icon: FileText,
    },
    {
      label: "Équipe",
      description: "Intervenants et accès terrain",
      href: `/chantiers/${row.id}/equipe`,
      icon: Users,
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
              key={link.href}
              to={link.href}
              className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50"
            >
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-white group-hover:text-blue-700">
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
  tone?: "blue" | "red" | "slate";
}) {
  const toneClasses =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-800"
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
