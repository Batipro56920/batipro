import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { LoadingState } from "../components/ui/design-system";
import { buildProjects } from "../features/projects/utils/projectMappers";
import type { ProjectRecord } from "../features/projects/types";
import type { ChantierRow } from "../services/chantiers.service";
import { loadCrmDataset, type CrmDataset, type CrmQuoteRow } from "../services/crm.service";

type QuoteDiagnostic = Pick<
  CrmQuoteRow,
  "quote_number" | "statut" | "montant_ttc" | "updated_at" | "opportunity_id" | "prospect_id" | "client_id" | "chantier_id" | "display_options"
>;

type ChantierQuoteLink = Pick<ChantierRow, "id" | "crm_opportunity_id" | "crm_prospect_id" | "crm_client_id" | "crm_quote_id">;

type QuoteOpenIssue =
  | { kind: "missing-id" }
  | { kind: "missing-quote" }
  | {
      kind: "missing-project-link";
      quote: QuoteDiagnostic;
      chantier: ChantierQuoteLink | null;
    };

type ResolveState =
  | { status: "loading" }
  | { status: "ready"; targetPath: string }
  | { status: "not-found"; issue: QuoteOpenIssue }
  | { status: "error"; message: string };

function projectIdFromDisplayOptions(displayOptions: Record<string, unknown> | null | undefined) {
  const projectId = displayOptions?.project_id;
  return typeof projectId === "string" && projectId.trim() ? projectId.trim() : "";
}

function quoteBuilderProjectId(quote: CrmQuoteRow) {
  return projectIdFromDisplayOptions(quote.display_options);
}

function projectIdFromChantierLink(chantier: ChantierQuoteLink | null) {
  if (!chantier) return "";
  if (chantier.crm_opportunity_id) return `opportunity-${chantier.crm_opportunity_id}`;
  if (chantier.crm_prospect_id) return `prospect-${chantier.crm_prospect_id}`;
  if (chantier.crm_client_id) return `client-${chantier.crm_client_id}`;
  return "";
}

function findQuoteLinkedChantier(quote: CrmQuoteRow, chantiers: CrmDataset["chantiers"]): ChantierQuoteLink | null {
  return (
    chantiers.find((chantier) => chantier.id === quote.chantier_id) ??
    chantiers.find((chantier) => chantier.crm_quote_id === quote.id) ??
    null
  );
}

function quoteEditorPath(projectId: string, quoteId: string) {
  return `/projets/${encodeURIComponent(projectId)}/devis/${encodeURIComponent(quoteId)}/edit`;
}

function findProjectById(projects: ProjectRecord[], projectId: string) {
  return projects.find((candidate) => candidate.id === projectId) ?? null;
}

function issueMessage(issue: QuoteOpenIssue) {
  if (issue.kind === "missing-id") return "Aucun identifiant de devis n'a été fourni dans l'URL.";
  if (issue.kind === "missing-quote") {
    return "Ce devis n'existe pas dans les devis CRM chargés ou n'est pas accessible avec vos droits actuels.";
  }
  return "Ce devis existe, mais il n'a aucun rattachement projet commercial confirmé pour ouvrir l'éditeur.";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function LinkStatus({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-white px-3 py-2">
      <div className="text-[11px] font-semibold uppercase text-amber-700">{label}</div>
      <div className="mt-1 break-all font-mono text-[11px] text-amber-950">{value || "manquant"}</div>
    </div>
  );
}

function QuoteSnapshot({ quote }: { quote: QuoteDiagnostic }) {
  return (
    <div className="mt-3 grid gap-2 rounded-2xl border border-amber-200 bg-white/70 p-3 sm:grid-cols-4">
      <div>
        <div className="text-[11px] font-semibold uppercase text-amber-700">Numéro</div>
        <div className="mt-1 font-semibold text-amber-950">{quote.quote_number || "-"}</div>
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase text-amber-700">Statut</div>
        <div className="mt-1 capitalize text-amber-950">{quote.statut.replace(/_/g, " ")}</div>
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase text-amber-700">Montant TTC</div>
        <div className="mt-1 text-amber-950">{formatCurrency(quote.montant_ttc)}</div>
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase text-amber-700">Dernière mise à jour</div>
        <div className="mt-1 text-amber-950">{formatDate(quote.updated_at)}</div>
      </div>
    </div>
  );
}

export default function CrmQuoteEditRedirectPage() {
  const { id } = useParams();
  const [state, setState] = useState<ResolveState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function resolveQuoteProject() {
      if (!id) {
        setState({ status: "not-found", issue: { kind: "missing-id" } });
        return;
      }

      setState({ status: "loading" });
      try {
        const dataset = await loadCrmDataset();
        const projects = buildProjects(dataset);
        const project = projects.find((candidate) => candidate.quotes.some((quote) => quote.id === id));
        if (cancelled) return;
        if (project) {
          setState({ status: "ready", targetPath: quoteEditorPath(project.id, id) });
          return;
        }

        const quote = dataset.quotes.find((candidate) => candidate.id === id);
        const builderProjectId = quote ? quoteBuilderProjectId(quote) : "";
        const builderProject = builderProjectId ? findProjectById(projects, builderProjectId) : null;
        if (builderProject) {
          setState({ status: "ready", targetPath: quoteEditorPath(builderProject.id, id) });
          return;
        }

        const linkedChantier = quote ? findQuoteLinkedChantier(quote, dataset.chantiers) : null;
        const chantierProjectId = projectIdFromChantierLink(linkedChantier);
        const chantierProject = chantierProjectId ? findProjectById(projects, chantierProjectId) : null;
        if (chantierProject) {
          setState({ status: "ready", targetPath: quoteEditorPath(chantierProject.id, id) });
          return;
        }

        setState({
          status: "not-found",
          issue: quote
            ? {
                kind: "missing-project-link",
                quote: {
                  quote_number: quote.quote_number,
                  statut: quote.statut,
                  montant_ttc: quote.montant_ttc,
                  updated_at: quote.updated_at,
                  opportunity_id: quote.opportunity_id,
                  prospect_id: quote.prospect_id,
                  client_id: quote.client_id,
                  chantier_id: quote.chantier_id,
                  display_options: quote.display_options,
                },
                chantier: linkedChantier,
              }
            : { kind: "missing-quote" },
        });
      } catch (err: any) {
        if (!cancelled) setState({ status: "error", message: err?.message ?? "Chargement du devis impossible." });
      }
    }

    void resolveQuoteProject();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === "ready") return <Navigate to={state.targetPath} replace />;
  if (state.status === "loading") return <LoadingState label="Ouverture de l'éditeur devis..." />;

  const quoteSearchTerm =
    state.status === "not-found" && state.issue.kind === "missing-project-link"
      ? state.issue.quote.quote_number || id || ""
      : id ?? "";
  const crmQuotesPath = quoteSearchTerm ? `/crm/devis?q=${encodeURIComponent(quoteSearchTerm)}` : "/crm/devis";

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
      <div className="font-semibold">Devis impossible à ouvrir depuis le CRM.</div>
      <p className="mt-2">
        {state.status === "error" ? state.message : issueMessage(state.issue)}
      </p>
      {id ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-white/70 px-4 py-3 text-xs text-amber-950">
          <div className="font-semibold">Identifiant du devis à vérifier</div>
          <div className="mt-1 break-all font-mono text-[11px]">{id}</div>
          <div className="mt-1 text-amber-800">
            Utile pour retrouver le devis dans la liste CRM ou corriger son rattachement projet commercial.
          </div>
        </div>
      ) : null}
      {state.status === "not-found" && state.issue.kind === "missing-project-link" ? (
        <>
          <QuoteSnapshot quote={state.issue.quote} />
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <LinkStatus label="Projet devis" value={projectIdFromDisplayOptions(state.issue.quote.display_options)} />
            <LinkStatus label="Chantier devis" value={state.issue.quote.chantier_id ?? state.issue.chantier?.id} />
            <LinkStatus label="Opportunité" value={state.issue.quote.opportunity_id ?? state.issue.chantier?.crm_opportunity_id} />
            <LinkStatus label="Client" value={state.issue.quote.client_id ?? state.issue.chantier?.crm_client_id} />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <LinkStatus label="Prospect" value={state.issue.quote.prospect_id ?? state.issue.chantier?.crm_prospect_id} />
            <LinkStatus label="Projet déduit du chantier" value={projectIdFromChantierLink(state.issue.chantier)} />
          </div>
        </>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={crmQuotesPath}
          className="inline-flex h-9 items-center justify-center rounded-xl bg-amber-900 px-3 text-sm font-semibold text-white hover:bg-amber-800"
        >
          Retour aux devis
        </Link>
        <Link
          to="/projets"
          className="inline-flex h-9 items-center justify-center rounded-xl border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100"
        >
          Voir les projets commerciaux
        </Link>
      </div>
    </div>
  );
}
