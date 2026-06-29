import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QuoteBuilderWorkspace } from "../features/quotes/builder/QuoteBuilderWorkspace";
import { loadQuoteBuilder } from "../features/quotes/builder/quoteBuilderRepository";
import { useQuoteBuilderStore } from "../features/quotes/builder/quoteBuilderStore";
import { QuoteDocumentLoader } from "../features/quotes/builder/QuoteBuilderWorkspace";
import { useProjectsData } from "../features/projects/hooks/useProjectsData";
import {
  getCurrentProfileFeaturePermissions,
  hasProfileFeaturePermission,
} from "../services/profileFeaturePermissions.service";

function quoteBuilderErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Chargement du devis impossible.";
}

export default function ProjectQuoteBuilderV1Page() {
  const { projectId, quoteId } = useParams();
  const navigate = useNavigate();
  const { projectsById, loading, error } = useProjectsData();
  const project = projectId ? projectsById.get(projectId) ?? null : null;
  const quote = useQuoteBuilderStore((state) => state.quote);
  const hydrate = useQuoteBuilderStore((state) => state.hydrate);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionAllowed, setPermissionAllowed] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function verifyQuoteAccess() {
      setPermissionLoading(true);
      try {
        const current = await getCurrentProfileFeaturePermissions();
        const requiredPermission = quoteId ? "crm_quote_edit" : "crm_quote_create";
        const allowed =
          hasProfileFeaturePermission(current.permissions, "crm", current.role) &&
          hasProfileFeaturePermission(current.permissions, requiredPermission, current.role);
        if (!cancelled) setPermissionAllowed(allowed);
      } catch {
        if (!cancelled) setPermissionAllowed(false);
      } finally {
        if (!cancelled) setPermissionLoading(false);
      }
    }
    void verifyQuoteAccess();
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  useEffect(() => {
    if (!project || !permissionAllowed) return;
    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError(null);
    void loadQuoteBuilder(project, quoteId)
      .then((loaded) => {
        if (cancelled) return;
        hydrate(loaded);
        setQuoteLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setQuoteError(quoteBuilderErrorMessage(err));
        setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrate, permissionAllowed, project, quoteId]);

  const quoteMatchesRoute = Boolean(
    project &&
      quote &&
      quote.projectId === project.id &&
      (quoteId ? quote.id === quoteId : quote.id === null),
  );

  if (permissionLoading) return <QuoteDocumentLoader />;

  if (!permissionAllowed) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Votre profil ne permet pas {quoteId ? "de modifier ce devis" : "de créer un devis"}.
      </div>
    );
  }

  if (loading) return <QuoteDocumentLoader />;

  if (error || !project) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error ?? "Projet introuvable."}</div>;
  }

  if (quoteError) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{quoteError}</div>;
  }

  if (quoteLoading || !quoteMatchesRoute) return <QuoteDocumentLoader />;

  return <QuoteBuilderWorkspace onClose={() => navigate(`/projets/${project.id}?tab=quotes`)} />;
}
