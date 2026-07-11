import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createInvoice } from "../../invoices/application/invoiceFactory";
import type { InvoiceRecord, InvoiceType } from "../../invoices/domain/types";
import { listInvoices, saveInvoice } from "../../invoices/infrastructure/invoiceRepository";
import { quoteBuilderToBusinessDocument } from "../../quotes/builder/quoteBuilderDocumentAdapter";
import { createQuoteBuilderFromEngine } from "../../quotes/builder/quoteBuilderModel";
import { loadCrmQuoteEngineData, transformAcceptedQuoteToChantier } from "../../../services/crm.service";
import type { ProjectRecord } from "../types";
import { EmptyProjectBlock, Panel, formatCurrency, formatDate } from "./ProjectShared";
import { getPrimaryQuote } from "../hooks/useProjectsData";
import { ProjectProfitabilityWidgets } from "./ProjectProfitabilityWidgets";

const PROJECT_INVOICE_ACTIONS: Array<{ type: InvoiceType; label: string; title: string }> = [
  { type: "deposit", label: "Acompte", title: "Creer une facture d'acompte depuis ce devis" },
  { type: "intermediate", label: "Situation", title: "Creer une facture de situation depuis ce devis" },
  { type: "final", label: "Finale", title: "Creer une facture finale depuis ce devis" },
];

function InfoGrid({ rows }: { rows: Array<[string, string | number | null | undefined]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{value || "Non renseigne"}</div>
        </div>
      ))}
    </div>
  );
}

function recentActivity(project: ProjectRecord) {
  const quote = getPrimaryQuote(project);
  return [
    project.prospect ? ["Prospect cree", project.prospect.created_at] : null,
    project.opportunity ? ["Projet cree", project.opportunity.created_at] : null,
    quote ? [`Devis ${quote.quote_number}`, quote.created_at] : null,
    project.chantiers[0] ? ["Chantier cree", project.chantiers[0].created_at] : null,
    ...project.communications.slice(0, 5).map((communication) => [communication.subject || communication.type, communication.occurred_at] as [string, string]),
  ].filter(Boolean) as Array<[string, string | null | undefined]>;
}

function compactVisitSummary(value?: string | null) {
  const cleaned = String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\b(non renseigne|Non renseignee|A assigner)\b/g, "")
    .trim();
  if (!cleaned) return "Compte-rendu à compléter.";
  return cleaned.length > 220 ? `${cleaned.slice(0, 220).trim()}...` : cleaned;
}

function chantierStatusLabel(status: string | null | undefined) {
  if (status === "PREPARATION") return "Préparation";
  if (status === "EN_COURS") return "En cours";
  if (status === "EN_PAUSE") return "En pause";
  if (status === "TERMINE") return "Terminé";
  if (status === "ARCHIVE") return "Archivé";
  if (status === "ANNULE") return "Annulé";
  return "Statut non renseigné";
}

function invoiceDetailPath(invoiceId: string) {
  return `/factures?invoice=${encodeURIComponent(invoiceId)}`;
}

function ProductionContinuityPanel({ project }: { project: ProjectRecord }) {
  const quote = getPrimaryQuote(project);
  const acceptedQuote = project.quotes.find((item) => item.statut === "accepte") ?? null;
  const productionQuote = acceptedQuote ?? quote;
  const hasAcceptedQuoteWithoutChantier = Boolean(acceptedQuote && !acceptedQuote.chantier_id);
  const productionQuotePath = hasAcceptedQuoteWithoutChantier
    ? `/projets/${project.id}?tab=quotes&chantierQuoteId=${productionQuote?.id}`
    : `/projets/${project.id}?tab=quotes`;

  if (!project.chantiers.length) {
    return (
      <Panel title="Passage en production" description="Continuité entre devis accepté et dossier chantier.">
        {productionQuote ? (
          <div className={["rounded-2xl border p-4", acceptedQuote ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"].join(" ")}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className={["text-xs font-semibold uppercase", acceptedQuote ? "text-emerald-700" : "text-slate-500"].join(" ")}>
                  {acceptedQuote ? "Devis accepté" : "Chantier non rattaché"}
                </div>
                <h3 className="mt-1 truncate font-semibold text-slate-950">{productionQuote.quote_number}</h3>
                <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                  <span>Statut {productionQuote.statut}</span>
                  <span>Montant {formatCurrency(productionQuote.montant_ht)}</span>
                  <span>Validité {formatDate(productionQuote.valid_until)}</span>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {hasAcceptedQuoteWithoutChantier
                    ? "Le devis est prêt à basculer en chantier. La création reste pilotée depuis l'onglet Devis pour conserver le lien devis, facturation et préparation."
                    : "Le dossier reste côté commerce tant qu'un devis accepté n'a pas été transformé en chantier."}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link
                  to={productionQuotePath}
                  className={["inline-flex h-9 items-center rounded-xl px-3 text-sm font-semibold", acceptedQuote ? "bg-emerald-700 text-white hover:bg-emerald-800" : "bg-blue-700 text-white hover:bg-blue-800"].join(" ")}
                >
                  {hasAcceptedQuoteWithoutChantier ? "Créer le chantier" : "Ouvrir les devis"}
                </Link>
                <Link
                  to={`/projets/${project.id}/devis/${productionQuote.id}/edit`}
                  className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Ouvrir le devis
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            <div className="font-semibold text-slate-800">Aucun chantier rattaché</div>
            <p className="mt-1">Le dossier reste côté commerce tant qu'aucun devis accepté n'a été transformé en chantier.</p>
            <Link to={`/projets/${project.id}/devis/nouveau`} className="mt-4 inline-flex h-9 items-center rounded-xl bg-blue-700 px-3 text-sm font-semibold text-white hover:bg-blue-800">
              Créer un devis
            </Link>
          </div>
        )}
      </Panel>
    );
  }

  return (
    <Panel title="Passage en production" description="Chantiers rattachés au projet commercial, avec accès direct aux espaces de pilotage.">
      <div className="space-y-3">
        {project.chantiers.map((chantier) => (
          <article key={chantier.id} className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-semibold text-blue-950">{chantier.nom}</h3>
                  <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {chantierStatusLabel(chantier.status)}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 text-sm text-blue-900 sm:grid-cols-3">
                  <span>Début {formatDate(chantier.date_debut)}</span>
                  <span>Échéance {formatDate(chantier.date_fin_prevue ?? chantier.planning_end_date)}</span>
                  <span>Avancement {Number(chantier.avancement ?? 0)}%</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link to={`/chantiers/${chantier.id}`} className="inline-flex h-9 items-center rounded-xl bg-blue-700 px-3 text-sm font-semibold text-white hover:bg-blue-800">
                  Dossier chantier
                </Link>
                <Link to={`/chantiers/${chantier.id}/preparation`} className="inline-flex h-9 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-100">
                  Préparer
                </Link>
                <Link to={`/chantiers/${chantier.id}/planning`} className="inline-flex h-9 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-100">
                  Planning
                </Link>
                <Link to={`/chantiers/${chantier.id}/execution`} className="inline-flex h-9 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-100">
                  Exécuter
                </Link>
                <Link to={`/retours-terrain?chantierId=${encodeURIComponent(chantier.id)}`} className="inline-flex h-9 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-100">
                  Retours terrain
                </Link>
                <Link to={`/chantiers/${chantier.id}/financier`} className="inline-flex h-9 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-100">
                  Financier
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

export function ProjectSummaryTab({ project }: { project: ProjectRecord }) {
  const quote = getPrimaryQuote(project);
  const latestActivity = recentActivity(project)[0] ?? null;
  const openFollowUps = project.tasks.filter((task) => task.statut !== "termine" && task.statut !== "terminee").length;

  return (
    <div className="space-y-5">
      <Panel title="Resume projet" description="Accueil commercial du dossier, sans melanger la preparation chantier.">
        <div className="space-y-5">
          <InfoGrid
            rows={[
              ["Client", project.clientName],
              ["Adresse", project.address],
              ["Commercial", project.salesperson || "A assigner"],
              ["Source", project.sourceLabel],
              ["Budget estimatif", formatCurrency(project.budgetEstimate)],
              ["Echeance", formatDate(project.desiredDeadline)],
              ["Type projet", project.projectType],
              ["Derniere activite", latestActivity ? `${latestActivity[0]} - ${formatDate(latestActivity[1])}` : "Aucune"],
            ]}
          />

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              ["RDV", project.appointments.length],
              ["Devis", project.quotes.length],
              ["Montant devis", formatCurrency(project.quoteAmount)],
              ["Documents", project.documents.length],
              ["Taches commerciales", openFollowUps],
              ["SAV", project.sav.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xl font-bold text-slate-950">{value}</div>
                <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
              </div>
            ))}
          </div>

          <ProjectProfitabilityWidgets project={project} />
        </div>
      </Panel>

      <ProductionContinuityPanel project={project} />

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="Resume client">
          <InfoGrid
            rows={[
              ["Telephone", project.contactPhone],
              ["Email", project.contactEmail],
              ["Contact principal", project.clientName],
              ["Source lead", project.sourceLabel],
            ]}
          />
        </Panel>

        <Panel title="Situation commerciale">
          <InfoGrid
            rows={[
              ["Statut projet", project.status],
              ["Budget connu", formatCurrency(project.budgetEstimate)],
              ["Prochaine relance", formatDate(project.nextActionDate)],
              ["Commercial", project.salesperson || "A assigner"],
            ]}
          />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Derniere activite">
          {latestActivity ? (
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="font-semibold text-slate-950">{latestActivity[0]}</div>
              <div className="mt-1 text-sm text-slate-500">{formatDate(latestActivity[1])}</div>
            </div>
          ) : (
            <EmptyProjectBlock title="Aucune activite" description="Les appels, mails, notes, visites et devis apparaissent ici." />
          )}
        </Panel>

        <Panel title="Devis recent">
          {quote ? (
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="font-semibold text-slate-950">{quote.quote_number}</div>
              <div className="mt-1 text-sm text-slate-500">{quote.statut} - {formatCurrency(quote.montant_ht)}</div>
              <Link to={`/projets/${project.id}/devis/${quote.id}/edit`} className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800">
                Ouvrir le devis
              </Link>
            </div>
          ) : (
            <EmptyProjectBlock title="Aucun devis" description="Creez un devis depuis le dossier projet." />
          )}
        </Panel>

        <Panel title="Qualification rapide">
          <InfoGrid
            rows={[
              ["Type projet", project.projectType],
              ["Besoin client", project.needDescription],
              ["Urgence", project.prospect?.urgence],
              ["Prochaine action", project.nextAction],
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

export function ProjectVisitsTab({ project }: { project: ProjectRecord }) {
  return (
    <Panel title="RDV / Visites" description="Historique simple des rendez-vous commerciaux." actions={<Link to={`/projets/${project.id}/visites/nouveau`} className="text-sm font-semibold text-blue-700 hover:text-blue-800">Nouvelle visite</Link>}>
      <div className="space-y-3">
        {project.appointments.length ? (
          project.appointments.map((appointment) => (
            <article key={appointment.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-950">{appointment.titre}</h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{appointment.statut}</span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{appointment.type}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
                    <span>{formatDate(appointment.starts_at)}</span>
                    <span>{project.clientName}</span>
                    {project.address ? <span>{project.address}</span> : null}
                  </div>
                </div>
                <Link to={`/projets/${project.id}/visites/${appointment.id}`} className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                  Ouvrir / modifier
                </Link>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{compactVisitSummary(appointment.compte_rendu || appointment.notes)}</p>
            </article>
          ))
        ) : (
          <EmptyProjectBlock title="Aucun rendez-vous" description="Creez une visite de qualification, de chiffrage, de validation devis, de relance ou de SAV." />
        )}
      </div>
    </Panel>
  );
}

export function ProjectQuotesTab({ project }: { project: ProjectRecord }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const chantierQuoteId = searchParams.get("chantierQuoteId");
  const [billingKey, setBillingKey] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [chantierActionKey, setChantierActionKey] = useState<string | null>(null);
  const [chantierError, setChantierError] = useState<string | null>(null);
  const [existingInvoices, setExistingInvoices] = useState<InvoiceRecord[]>([]);
  const acceptedQuote = project.quotes.find((quote) => quote.statut === "accepte");

  useEffect(() => {
    let alive = true;
    listInvoices()
      .then((rows) => {
        if (alive) setExistingInvoices(rows);
      })
      .catch(() => {
        if (alive) setExistingInvoices([]);
      });
    return () => {
      alive = false;
    };
  }, [project.id]);

  function getQuoteInvoices(quoteId: string, invoiceType?: InvoiceType) {
    return existingInvoices.filter((invoice) => {
      const matchesQuote = invoice.sourceQuoteId === quoteId || invoice.document.quoteId === quoteId;
      const matchesType = !invoiceType || invoice.type === invoiceType;
      return matchesQuote && matchesType && invoice.status !== "cancelled";
    });
  }

  function getQuoteChantierId(quoteId: string) {
    return (
      project.quotes.find((quote) => quote.id === quoteId)?.chantier_id ??
      project.chantiers.find((chantier) => chantier.crm_quote_id === quoteId)?.id ??
      (project.chantiers.length === 1 ? project.chantiers[0]?.id : null)
    );
  }

  function chantierPreparationPath(chantierId: string) {
    return `/chantiers/${encodeURIComponent(chantierId)}/preparation`;
  }

  async function createChantierFromQuote(quoteId: string) {
    const quote = project.quotes.find((item) => item.id === quoteId);
    if (!quote || chantierActionKey) return;
    if (quote.statut !== "accepte") {
      setChantierError("La creation chantier est disponible uniquement depuis un devis accepte.");
      return;
    }

    const existingChantierId = getQuoteChantierId(quoteId);
    if (existingChantierId) {
      navigate(chantierPreparationPath(existingChantierId));
      return;
    }

    setChantierActionKey(quoteId);
    setChantierError(null);
    try {
      const created = await transformAcceptedQuoteToChantier({
        quote,
        prospect: project.prospect,
        client: project.client,
        opportunity: project.opportunity,
      });
      navigate(chantierPreparationPath(created.id));
    } catch (error) {
      setChantierError(error instanceof Error ? error.message : "Creation du chantier impossible depuis ce devis.");
    } finally {
      setChantierActionKey(null);
    }
  }

  useEffect(() => {
    if (!chantierQuoteId || chantierActionKey) return;

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("chantierQuoteId");
    setSearchParams(nextSearchParams, { replace: true });

    const quote = project.quotes.find((item) => item.id === chantierQuoteId);
    if (!quote) {
      setChantierError("Devis à passer en chantier introuvable.");
      return;
    }

    const existingChantierId = getQuoteChantierId(quote.id);
    if (existingChantierId) {
      navigate(chantierPreparationPath(existingChantierId));
      return;
    }

    void createChantierFromQuote(quote.id);
  }, [chantierActionKey, chantierQuoteId, navigate, project.quotes, searchParams, setSearchParams]);

  async function createInvoiceFromQuote(quoteId: string, invoiceType: InvoiceType) {
    const quote = project.quotes.find((item) => item.id === quoteId);
    if (!quote) return;
    if (quote.statut !== "accepte") {
      setBillingError("La facturation est disponible uniquement depuis un devis accepté.");
      return;
    }
    if (getQuoteInvoices(quoteId, invoiceType).length) {
      setBillingError("Une facture de ce type existe déjà pour ce devis. Ouvrez la facture existante pour la consulter ou la modifier.");
      return;
    }

    const actionKey = `${quoteId}:${invoiceType}`;
    setBillingKey(actionKey);
    setBillingError(null);
    try {
      const engine = await loadCrmQuoteEngineData(quoteId);
      const quoteBuilder = createQuoteBuilderFromEngine(engine, project);
      const document = quoteBuilderToBusinessDocument(quoteBuilder);
      const invoice = createInvoice(invoiceType, document);
      const savedInvoice = await saveInvoice(invoice);
      setExistingInvoices((current) => [savedInvoice, ...current]);
      navigate(invoiceDetailPath(savedInvoice.id));
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : "Creation de facture impossible depuis ce devis.");
    } finally {
      setBillingKey(null);
    }
  }

  return (
    <Panel title="Devis" description="Pre-devis, devis final, variantes, signatures et relances." actions={<Link to={`/projets/${project.id}/devis/nouveau`} className="text-sm font-semibold text-blue-700 hover:text-blue-800">Creer devis</Link>}>
      <div className="space-y-4">
        {acceptedQuote ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="font-semibold">Devis accepte : le dossier peut passer en chantier.</div>
              <div className="mt-1 text-emerald-700">Utilisez l'action de la ligne de devis pour créer le chantier ou ouvrir le chantier deja lie.</div>
            </div>
            {getQuoteChantierId(acceptedQuote.id) ? (
              <Link to={chantierPreparationPath(getQuoteChantierId(acceptedQuote.id)!)} className="inline-flex h-9 items-center justify-center rounded-xl border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
                Préparer chantier
              </Link>
            ) : (
              <button type="button" onClick={() => void createChantierFromQuote(acceptedQuote.id)} disabled={chantierActionKey !== null} className="inline-flex h-9 items-center justify-center rounded-xl border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60">
                {chantierActionKey === acceptedQuote.id ? "Creation..." : "Créer chantier"}
              </button>
            )}
          </div>
        ) : null}
        {chantierError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {chantierError}
          </div>
        ) : null}
        {billingError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {billingError}
          </div>
        ) : null}
        {project.quotes.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Numero</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Signature</th>
                  <th className="px-4 py-3">Validite</th>
                  <th className="px-4 py-3 text-right">HT</th>
                  <th className="px-4 py-3 text-right">TTC</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {project.quotes.map((quote) => {
                  const quoteInvoices = getQuoteInvoices(quote.id);
                  const quoteChantierId = getQuoteChantierId(quote.id);
                  const canBill = Number(quote.montant_ttc ?? 0) > 0 && quote.statut === "accepte";
                  const canCreateChantier = quote.statut === "accepte" && !quoteChantierId;
                  const isCreatingChantier = chantierActionKey === quote.id;
                  return (
                    <tr key={quote.id}>
                      <td className="px-4 py-3 font-semibold text-slate-950">{quote.quote_number}</td>
                      <td className="px-4 py-3 text-slate-500">{quote.statut}</td>
                      <td className="px-4 py-3 text-slate-500">{quote.signature_status}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(quote.valid_until)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(quote.montant_ht)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(quote.montant_ttc)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link to={`/projets/${project.id}/devis/${quote.id}/edit`} className="inline-flex h-8 items-center font-semibold text-blue-700 hover:text-blue-800">Ouvrir</Link>
                          {quoteChantierId ? (
                            <Link to={chantierPreparationPath(quoteChantierId)} className="inline-flex h-8 items-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                              Préparer
                            </Link>
                          ) : quote.statut === "accepte" ? (
                            <button
                              type="button"
                              onClick={() => void createChantierFromQuote(quote.id)}
                              disabled={!canCreateChantier || isCreatingChantier || chantierActionKey !== null}
                              title={canCreateChantier ? "Creer le chantier depuis ce devis accepte" : "Un chantier est deja lie a ce devis"}
                              className="inline-flex h-8 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:bg-slate-50 disabled:text-slate-400"
                            >
                              {isCreatingChantier ? "Creation..." : "Créer chantier"}
                            </button>
                          ) : null}
                          {quoteInvoices.length ? (
                            <Link to={invoiceDetailPath(quoteInvoices[0].id)} className="inline-flex h-8 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                              {quoteInvoices.length} facture{quoteInvoices.length > 1 ? "s" : ""}
                            </Link>
                          ) : null}
                          {PROJECT_INVOICE_ACTIONS.map((action) => {
                            const actionKey = `${quote.id}:${action.type}`;
                            const isBilling = billingKey === actionKey;
                            const alreadyExists = getQuoteInvoices(quote.id, action.type).length > 0;
                            const disabled = isBilling || !canBill || alreadyExists;
                            const title = alreadyExists
                              ? "Une facture de ce type existe déjà pour ce devis"
                              : canBill
                                ? action.title
                                : quote.statut !== "accepte"
                                  ? "Le devis doit être accepté avant facturation"
                                  : "Le devis doit avoir un montant TTC positif";
                            return (
                              <button
                                key={action.type}
                                type="button"
                                onClick={() => void createInvoiceFromQuote(quote.id, action.type)}
                                disabled={disabled}
                                title={title}
                                className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:bg-slate-50 disabled:text-slate-400"
                              >
                                {isBilling ? "Creation..." : action.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyProjectBlock title="Aucun devis lie" description="Creez un pre-devis ou un devis final depuis le projet." />
        )}
      </div>
    </Panel>
  );
}

export function ProjectDocumentsTab({ project }: { project: ProjectRecord }) {
  return (
    <Panel title="Documents" description="Centraliser les pieces commerciales et projet.">
      <div className="mb-4 flex flex-wrap gap-2">
        {["Photos", "Plans", "Documents client", "Emails", "Pieces devis", "Annexes"].map((category) => (
          <span key={category} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{category}</span>
        ))}
      </div>
      {project.documents.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {project.documents.map((document) => (
            <div key={document.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="font-semibold text-slate-950">{document.nom}</div>
              <div className="mt-1 text-xs text-slate-500">{document.type} - {formatDate(document.created_at)}</div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyProjectBlock title="Aucun document centralise" description="Importez ou rattachez les documents commerciaux depuis les visites et devis." />
      )}
    </Panel>
  );
}

export function ProjectActivityTab({ project }: { project: ProjectRecord }) {
  const events = recentActivity(project);
  return (
    <Panel title="Activite" description="Timeline commerciale du projet.">
      {events.length ? (
        <div className="space-y-4">
          {events.map(([label, date], index) => (
            <div key={`${label}-${index}`} className="flex gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-blue-600" />
              <div>
                <div className="text-sm font-semibold text-slate-900">{label}</div>
                <div className="text-xs text-slate-500">{formatDate(date)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyProjectBlock title="Aucune activite" description="Les appels, emails, RDV, devis et relances apparaitront ici." />
      )}
    </Panel>
  );
}

export function ProjectSavTab({ project }: { project: ProjectRecord }) {
  return (
    <Panel title="SAV" description="Vue legere des tickets lies au projet ou au client.">
      {project.sav.length ? (
        <div className="space-y-3">
          {project.sav.map((ticket) => (
            <div key={ticket.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="font-semibold text-slate-950">{ticket.titre}</div>
              <div className="mt-1 text-sm text-slate-500">{ticket.statut} - {ticket.urgence} - {formatDate(ticket.created_at)}</div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyProjectBlock title="Aucun ticket SAV" description="Les demandes apres chantier liees au client apparaitront ici sans remplacer le module production SAV." />
      )}
    </Panel>
  );
}
