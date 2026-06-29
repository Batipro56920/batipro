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

function getBillableAmount(project: ProjectRecord, quote: ProjectQuote | null) {
  if (!quote) return project.quoteAmount;
  return Number(quote.montant_ttc || quote.montant_ht || 0);
}

function getCommercialSource(project: ProjectRecord) {
  const source = project.sourceLabel?.trim() || null;
  const apporteur = project.prospect?.apporteur_affaire?.trim() || null;
  if (!source && !apporteur) return null;
  return {
    label: source ?? "Origine commerciale",
    detail: apporteur,
    isApporteur: Boolean(source?.toLowerCase().includes("apporteur") || apporteur),
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
}: {
  projects: ProjectRecord[];
  billingMode?: boolean;
  quoteCreationMode?: boolean;
}) {
  if (!projects.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="text-lg font-semibold text-slate-950">Aucun projet trouvé</div>
        <p className="mt-2 text-sm text-slate-500">
          {billingMode
            ? "Aucun projet avec devis accepté ne correspond aux filtres actifs."
            : quoteCreationMode
              ? "Créez un prospect ou une opportunité avant de démarrer un devis."
              : "Créez un prospect ou une opportunité pour initialiser un dossier projet."}
        </p>
        <Link
          to={billingMode ? "/projets" : "/crm/prospects"}
          className="mt-5 inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          {billingMode ? "Voir tous les projets" : "Ajouter un prospect"}
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
              <th className="px-4 py-3">{billingMode ? "Devis accepté" : quoteCreationMode ? "Devis existants" : "Prochaine action"}</th>
              <th className="px-4 py-3 text-right">{billingMode ? "Montant à facturer" : "Montant devis"}</th>
              <th className="px-4 py-3">Création</th>
              <th className="px-4 py-3">Échéance</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((project) => {
              const billableQuote = billingMode ? getBillableQuote(project) : null;
              const commercialSource = getCommercialSource(project);
              const primaryChantier = getPrimaryChantier(project);
              const projectPath = quoteCreationMode
                ? `/projets/${project.id}/devis/nouveau`
                : `/projets/${project.id}${billingMode ? "?tab=quotes" : ""}`;
              return (
                <tr key={project.id} className="transition hover:bg-slate-50/80">
                  <td className="max-w-[260px] px-4 py-3">
                    <Link to={`/projets/${project.id}${billingMode ? "?tab=quotes" : ""}`} className="font-semibold text-slate-950 hover:text-blue-700">
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
                        {commercialSource.detail ? <div className="truncate text-xs text-slate-500">{commercialSource.detail}</div> : null}
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
                    ) : quoteCreationMode ? (
                      <>
                        <div className="truncate text-slate-700">{project.quotes.length ? `${project.quotes.length} devis rattaché${project.quotes.length > 1 ? "s" : ""}` : "Aucun devis"}</div>
                        <div className="mt-1 text-xs text-slate-500">Nouveau chiffrage possible</div>
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
                        className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                      >
                        {quoteCreationMode ? (
                          <>
                            <FileText className="h-3.5 w-3.5" />
                            Créer devis
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
