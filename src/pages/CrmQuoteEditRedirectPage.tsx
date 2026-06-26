import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { LoadingState } from "../components/ui/design-system";
import { buildProjects } from "../features/projects/utils/projectMappers";
import { loadCrmDataset } from "../services/crm.service";

type ResolveState =
  | { status: "loading" }
  | { status: "ready"; targetPath: string }
  | { status: "not-found" }
  | { status: "error"; message: string };

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
        if (!project) {
          setState({ status: "not-found" });
          return;
        }
        setState({ status: "ready", targetPath: `/projets/${project.id}/devis/${id}/edit` });
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
          : "Ce devis n'est pas rattaché à un dossier projet accessible. Ouvrez la liste des devis pour vérifier son rattachement prospect, client ou opportunité."}
      </p>
      <Link
        to="/crm/devis"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-xl bg-amber-900 px-3 text-sm font-semibold text-white hover:bg-amber-800"
      >
        Retour aux devis
      </Link>
    </div>
  );
}
