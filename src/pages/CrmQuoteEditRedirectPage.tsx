import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { LoadingState } from "../components/ui/design-system";
import { buildProjects } from "../features/projects/utils/projectMappers";
import { loadCrmDataset, type CrmQuoteRow } from "../services/crm.service";

type ResolveState =
  | { status: "loading" }
  | { status: "ready"; targetPath: string }
  | { status: "not-found" }
  | { status: "error"; message: string };

function quoteFallbackProjectId(quote: CrmQuoteRow) {
  if (quote.opportunity_id) return `opportunity-${quote.opportunity_id}`;
  if (quote.prospect_id) return `prospect-${quote.prospect_id}`;
  if (quote.client_id) return `client-${quote.client_id}`;
  return "";
}

export default function CrmQuoteEditRedirectPage() {
  const { id } = useParams();
  const [state, setState] = useState<ResolveState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function resolveQuoteProject() {
      if (!id) {
        setState({ status: "not-found" });
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

        setState({ status: "not-found" });
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
        {state.status === "error"
          ? state.message
          : "Ce devis n'est pas rattaché à un dossier projet accessible. Vérifiez son rattachement prospect, client ou opportunité avant de le reprendre."}
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
