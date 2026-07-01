import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { LoadingState } from "../components/ui/design-system";
import { buildProjects } from "../features/projects/utils/projectMappers";
import { loadCrmDataset, type CrmQuoteRow } from "../services/crm.service";

type QuoteOpenIssue =
  | { kind: "missing-id" }
  | { kind: "missing-quote" }
  | {
      kind: "missing-project-link";
      quote: Pick<CrmQuoteRow, "opportunity_id" | "prospect_id" | "client_id">;
    };

type ResolveState =
  | { status: "loading" }
  | { status: "ready"; targetPath: string }
  | { status: "not-found"; issue: QuoteOpenIssue }
  | { status: "error"; message: string };

function quoteFallbackProjectId(quote: CrmQuoteRow) {
  if (quote.opportunity_id) return `opportunity-${quote.opportunity_id}`;
  if (quote.prospect_id) return `prospect-${quote.prospect_id}`;
  if (quote.client_id) return `client-${quote.client_id}`;
  return "";
}

function issueMessage(issue: QuoteOpenIssue) {
  if (issue.kind === "missing-id") return "Aucun identifiant de devis n'a été fourni dans l'URL.";
  if (issue.kind === "missing-quote") {
    return "Ce devis n'existe pas dans les devis CRM chargés ou n'est pas accessible avec vos droits actuels.";
  }
  return "Ce devis existe, mais il n'a aucun rattachement prospect, client ou opportunité permettant d'ouvrir un dossier projet commercial.";
}

function LinkStatus({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-white px-3 py-2">
      <div className="text-[11px] font-semibold uppercase text-amber-700">{label}</div>
      <div className="mt-1 break-all font-mono text-[11px] text-amber-950">{value || "manquant"}</div>
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
        const project = buildProjects(dataset).find((candidate) => candidate.quotes.some((quote) => quote.id === id));
        if (cancelled) return;
        if (project) {
          setState({ status: "ready", targetPath: `/projets/${encodeURIComponent(project.id)}/devis/${encodeURIComponent(id)}/edit` });
          return;
        }

        const quote = dataset.quotes.find((candidate) => candidate.id === id);
        const fallbackProjectId = quote ? quoteFallbackProjectId(quote) : "";
        if (fallbackProjectId) {
          setState({ status: "ready", targetPath: `/projets/${encodeURIComponent(fallbackProjectId)}/devis/${encodeURIComponent(id)}/edit` });
          return;
        }

        setState({
          status: "not-found",
          issue: quote
            ? {
                kind: "missing-project-link",
                quote: {
                  opportunity_id: quote.opportunity_id,
                  prospect_id: quote.prospect_id,
                  client_id: quote.client_id,
                },
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
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <LinkStatus label="Opportunité" value={state.issue.quote.opportunity_id} />
          <LinkStatus label="Prospect" value={state.issue.quote.prospect_id} />
          <LinkStatus label="Client" value={state.issue.quote.client_id} />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/crm/devis"
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
