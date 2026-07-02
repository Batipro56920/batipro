import { Link } from "react-router-dom";
import { ArrowRight, FileText, Hammer } from "lucide-react";
import type { ProjectRecord } from "../types";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { formatCurrency, formatDate } from "./ProjectShared";

type ProjectQuote = ProjectRecord["quotes"][number];
type ProjectChantier = ProjectRecord["chantiers"][number];

function getBillableQuote(project: ProjectRecord): ProjectQuote | null {
  return (
    project.quotes.find((quote) => quote.statut === "accepte" && Number(quote.montant_ttc ?? 0) > 0) ??
    project.quotes.find((quote) => quote.statut === "accepte") ??
    null
  );
}

function getAcceptedQuoteAwaitingChantier(project: ProjectRecord): ProjectQuote | null {
  if (project.chantiers.length > 0) return null;
  return project.quotes.find((quote) => quote.statut === "accepte" && !quote.chantier_id) ?? null;
}

function getQuoteInProgress(project: ProjectRecord): ProjectQuote | null {
  return (
    [...project.quotes]
      .filter((quote) => quote.statut === "brouillon" || quote.statut === "en_preparation")
      .sort((a, b) => String(b.updated_at ?? b.created_at ?? "").localeCompare(String(a.updated_at ?? a.created_at ?? "")))[0] ?? null
  );
}

function getBillableAmount(project: ProjectRecord, quote: ProjectQuote | null) {
  if (!quote) return project.quoteAmount;
  return Number(quote.montant_ttc || quote.montant_ht || 0);
}

function getCommercialSource(project: ProjectRecord) {
  const source = project.sourceLabel?.trim() || null;
  const apporteur = project.prospect?.apporteur_affaire?.trim() || null;
  const isApporteur = Boolean(source?.toLowerCase().includes("apporteur") || apporteur);
  if (!source && !apporteur) return null;
  return {
    label: source ?? (isApporteur ? "Apporteur d'affaires" : "Origine commerciale"),
    detail: apporteur,
    isApporteur,
    trackingPath: isApporteur ? "/crm/apporteurs" : null,
  };
}

function getPrimaryChantier(project: ProjectRecord): ProjectChantier | null {
  const acceptedQuote = project.quotes.find((quote) => quote.statut === "accepte");
  return (
    (acceptedQuote
      ? project.chantiers.find((chantier) => chantier.crm_quote_id === acceptedQuote.id || chantier.id === acceptedQuote.chantier_id)
      : null) ??
    project.chantiers.find((chantier) => chantier.status !== "ARCHIVE" && chantier.status !== "ANNULE") ??
    project.chantiers[0] ??
    null
  );
}

function getChantierStatusLabel(status: ProjectChantier["status"]) {
  const labels: Record<string, string> = {
    BROUILLON: "Brouillon",
    PREPARATION: "Préparation",
    EN_COURS: "En chantier",
    EN_PAUSE: "En pause",
    TERMINE: "Terminé",
    ARCHIVE: "Archivé",
    ANNULE: "Annulé",
  };
  return labels[status] ?? status;
}

function getChantierStatusClassName(status: ProjectChantier["status"]) {
  if (status === "EN_COURS") return "bg-green-50 text-green-700 ring-green-200";
  if (status === "PREPARATION") return "bg-cyan-50 text-cyan-700 ring-cyan-200";
  if (status === "EN_PAUSE") return "bg-orange-50 text-orange-700 ring-orange-200";
  if (status === "TERMINE") return "bg-slate-100 text-slate-700 ring-slate-200";
  if (status === "ARCHIVE") return "bg-slate-100 text-slate-500 ring-slate-200";
  if (status === "ANNULE") return "bg-red-50 text-red-700 ring-red-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export function ProjectsTable({
  projects,
  billingMode = false,
  quoteCreationMode = false,
  chantierCreationMode = false,
}: {
  projects: ProjectRecord[];
  billingMode?: boolean;
  quoteCreationMode?: boolean;
  chantierCreationMode?: boolean;
}) {
  if (!projects.length) {
    const modeActive = billingMode || quoteCreationMode || chantierCreationMode;
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="text-lg font-semibold text-slate-950">Aucun projet trouvé</div>
        <p className="mt-2 text-sm text-slate-500">
          {billingMode
            ? "Aucun projet avec devis accepté ne correspond aux filtres actifs."
            : chantierCreationMode
              ? "Aucune affaire signée n'attend actuellement une création chantier."
              : quoteCreationMode
                ? "Aucun dossier commercial ouvert ne correspond aux filtres actifs pour démarrer un devis."
                : "Créez un prospect ou une opportunité pour initialiser un dossier projet."}
        </p>
        <Link
          to={modeActive ? "/projets" : "/crm/prospects?action=nouveau-prospect"}
          className="mt-5 inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          {modeActive ? "Voir tous les projets" : "Ajouter un prospect"}
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Projet</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Origine</th>
              <th className="px-4 py-3">Adresse</th>
              <th className="px-4 py-3">Commercial</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">{billingMode ? "Devis accepté" : chantierCreationMode ? "Passage chantier" : quoteCreationMode ? "Devis existants" : "Prochaine action"}</th>
              <th className="px-4 py-3 text-right">{billingMode ? "Montant à facturer" : "Montant devis"}</th>
              <th className="px-4 py-3">Création</th>
              <th className="px-4 py-3">Échéance</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((project) => {
              const billableQuote = billingMode ? getBillableQuote(project) : null;
              const acceptedQuoteAwaitingChantier = chantierCreationMode ? getAcceptedQuoteAwaitingChantier(project) : null;
              const quoteInProgress = quoteCreationMode ? getQuoteInProgress(project) : null;
              const commercialSource = getCommercialSource(project);
              const primaryChantier = getPrimaryChantier(project);
              const projectPath = quoteCreationMode
                ? quoteInProgress
                  ? `/projets/${project.id}/devis/${quoteInProgress.id}/edit`
                  : `/projets/${project.id}/devis/nouveau`
                : `/projets/${project.id}${billingMode || chantierCreationMode ? "?tab=quotes" : ""}`;
              return (
                <tr key={project.id} className="transition hover:bg-slate-50/80">
                  <td className="max-w-[260px] px-4 py-3">
                    <Link to={`/projets/${project.id}${billingMode || chantierCreationMode ? "?tab=quotes" : ""}`} className="font-semibold text-slate-950 hover:text-blue-700">
                      {project.name}
                    </Link>
                    <div className="mt-1 truncate text-xs text-slate-500">{project.projectType || "Type à qualifier"}</div>
                    {primaryChantier ? (
                      <Link
                        to={`/chantiers/${primaryChantier.id}`}
                        className={[
                          "mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition hover:bg-white",
                          getChantierStatusClassName(primaryChantier.status),
                        ].join(" ")}
                        title={primaryChantier.nom}
                      >
                        <Hammer className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Chantier · {getChantierStatusLabel(primaryChantier.status)}</span>
                      </Link>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{project.clientName}</td>
                  <td className="max-w-[210px] px-4 py-3">
                    {commercialSource ? (
                      <div className="space-y-1">
                        {commercialSource.trackingPath ? (
                          <Link
                            to={commercialSource.trackingPath}
                            className={[
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition hover:bg-white",
                              commercialSource.isApporteur
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                : "bg-slate-100 text-slate-700 ring-slate-200",
                            ].join(" ")}
                            title="Ouvrir le suivi des apporteurs"
                          >
                            {commercialSource.label}
                          </Link>
                        ) : (
                          <span
                            className={[
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                              commercialSource.isApporteur
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                : "bg-slate-100 text-slate-700 ring-slate-200",
                            ].join(" ")}
                          >
                            {commercialSource.label}
                          </span>
                        )}
                        {commercialSource.detail ? <div className="truncate text-xs text-slate-500">{commercialSource.detail}</div> : null}
                        {commercialSource.trackingPath ? (
                          <Link to={commercialSource.trackingPath} className="block text-xs font-medium text-emerald-700 hover:underline">
                            Suivi commissions
                          </Link>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-slate-400">Non renseignée</span>
                    )}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-slate-500">{project.address || "Adresse à renseigner"}</td>
                  <td className="px-4 py-3 text-slate-500">{project.salesperson || "À assigner"}</td>
                  <td className="px-4 py-3">
                    <ProjectStatusBadge status={project.status} />
                  </td>
                  <td className="max-w-[220px] px-4 py-3">
                    {billingMode ? (
                      <>
                        <div className="truncate font-semibold text-slate-700">{billableQuote?.quote_number || "Devis accepté"}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {billableQuote
                            ? `Accepté le ${formatDate(billableQuote.accepted_at ?? billableQuote.updated_at)}`
                            : "Devis accepté à vérifier"}
                        </div>
                      </>
                    ) : chantierCreationMode ? (
                      <>
                        <div className="truncate font-semibold text-slate-700">{acceptedQuoteAwaitingChantier?.quote_number || "Devis accepté"}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {acceptedQuoteAwaitingChantier
                            ? `Accepté le ${formatDate(acceptedQuoteAwaitingChantier.accepted_at ?? acceptedQuoteAwaitingChantier.updated_at)}`
                            : "Création chantier à vérifier"}
                        </div>
                      </>
                    ) : quoteCreationMode ? (
                      <>
                        <div className="truncate font-semibold text-slate-700">
                          {quoteInProgress?.quote_number || (project.quotes.length ? `${project.quotes.length} devis rattaché${project.quotes.length > 1 ? "s" : ""}` : "Aucun devis")}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {quoteInProgress
                            ? `Devis en cours depuis le ${formatDate(quoteInProgress.updated_at ?? quoteInProgress.created_at)}`
                            : "Nouveau chiffrage possible"}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="truncate text-slate-700">{project.nextAction || "Aucune action planifiée"}</div>
                        {project.nextActionDate ? <div className="mt-1 text-xs text-slate-500">{formatDate(project.nextActionDate)}</div> : null}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatCurrency(billingMode ? getBillableAmount(project, billableQuote) : project.quoteAmount)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(project.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(project.desiredDeadline)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {primaryChantier ? (
                        <Link
                          to={`/chantiers/${primaryChantier.id}`}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                        >
                          <Hammer className="h-3.5 w-3.5" />
                          Chantier
                        </Link>
                      ) : null}
                      <Link
                        to={projectPath}
                        className={[
                          "inline-flex h-8 items-center justify-center gap-2 rounded-lg border px-2.5 text-xs font-semibold transition",
                          chantierCreationMode
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : quoteCreationMode && quoteInProgress
                              ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                              : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {quoteCreationMode ? (
                          <>
                            <FileText className="h-3.5 w-3.5" />
                            {quoteInProgress ? "Reprendre devis" : "Créer devis"}
                          </>
                        ) : chantierCreationMode ? (
                          <>
                            <Hammer className="h-3.5 w-3.5" />
                            Créer chantier
                          </>
                        ) : (
                          <>
                            {billingMode ? "Facturer" : "Ouvrir"}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </>
                        )}
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
