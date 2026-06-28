import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarPlus, CheckCircle2, FileText, Hammer, Pencil, RefreshCw, XCircle } from "lucide-react";
import {
  ensureCrmDefaults,
  moveCrmOpportunityStage,
  transformAcceptedQuoteToChantier,
  updateCrmProspect,
  updateCrmQuote,
  type CrmQuoteStatus,
} from "../../../services/crm.service";
import type { ProjectRecord } from "../types";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { formatCurrency, formatDate } from "./ProjectShared";
import { getPrimaryQuote } from "../hooks/useProjectsData";

const WON_PROJECT_STATUSES = ["accepte", "preparation_chantier", "en_chantier", "cloture"];
const ACTIVE_QUOTE_STATUSES: CrmQuoteStatus[] = ["brouillon", "en_preparation", "envoye", "relance_1", "relance_2", "vu", "negociation"];

export function ProjectDetailHeader({ project, onProjectUpdated }: { project: ProjectRecord; onProjectUpdated?: () => Promise<void> | void }) {
  const navigate = useNavigate();
  const [transformingChantier, setTransformingChantier] = useState(false);
  const [updatingOutcome, setUpdatingOutcome] = useState<"won" | "lost" | null>(null);
  const [chantierError, setChantierError] = useState<string | null>(null);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const quote = getPrimaryQuote(project);
  const acceptedQuote = project.quotes.find((item) => item.statut === "accepte");
  const linkedAcceptedQuoteChantier = acceptedQuote
    ? project.chantiers.find((item) => item.crm_quote_id === acceptedQuote.id || item.id === acceptedQuote.chantier_id) ?? null
    : null;
  const fallbackChantier = !acceptedQuote
    ? project.chantiers.find((item) => item.status !== "ARCHIVE" && item.status !== "ANNULE") ?? project.chantiers[0] ?? null
    : null;
  const chantier = linkedAcceptedQuoteChantier ?? fallbackChantier;
  const linkedChantierId = linkedAcceptedQuoteChantier?.id ?? acceptedQuote?.chantier_id ?? fallbackChantier?.id ?? null;
  const editTarget = project.opportunity ? "/crm/opportunites" : project.sourceType === "client" ? "/crm/clients" : "/crm/prospects";
  const isWonProject = WON_PROJECT_STATUSES.includes(project.status);
  const canMarkWon = Boolean(quote) && !isWonProject && project.status !== "perdu";
  const canMarkLost = !linkedChantierId && !acceptedQuote && !isWonProject && project.status !== "perdu";

  async function createChantierFromAcceptedQuote() {
    if (!acceptedQuote || transformingChantier) return;
    setTransformingChantier(true);
    setChantierError(null);
    try {
      const created = await transformAcceptedQuoteToChantier({
        quote: acceptedQuote,
        prospect: project.prospect,
        client: project.client,
        opportunity: project.opportunity,
      });
      navigate(`/chantiers/${created.id}`);
    } catch (error) {
      setChantierError(error instanceof Error ? error.message : "Creation du chantier impossible.");
    } finally {
      setTransformingChantier(false);
    }
  }

  async function updateProjectOutcome(outcome: "won" | "lost") {
    if (updatingOutcome) return;
    if (outcome === "won" && !canMarkWon) return;
    if (outcome === "lost" && !canMarkLost) return;

    setUpdatingOutcome(outcome);
    setOutcomeError(null);
    try {
      const stages = await ensureCrmDefaults();
      const stage = stages.find((item) => (outcome === "won" ? item.is_won : item.is_lost));
      const now = new Date().toISOString();

      if (project.opportunity && stage) {
        await moveCrmOpportunityStage(project.opportunity.id, stage);
      }

      if (project.prospect) {
        await updateCrmProspect(project.prospect.id, { statut: outcome === "won" ? "gagne" : "perdu" });
      }

      if (outcome === "won" && quote) {
        await updateCrmQuote(quote.id, {
          statut: "accepte",
          signature_status: "signe",
          accepted_at: quote.accepted_at ?? now,
          refused_at: null,
        });
      }

      if (outcome === "lost") {
        await Promise.all(
          project.quotes
            .filter((item) => ACTIVE_QUOTE_STATUSES.includes(item.statut))
            .map((item) => updateCrmQuote(item.id, { statut: "refuse", refused_at: now })),
        );
      }

      await onProjectUpdated?.();
    } catch (error) {
      setOutcomeError(error instanceof Error ? error.message : "Mise a jour du statut projet impossible.");
    } finally {
      setUpdatingOutcome(null);
    }
  }

  return (
    <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link to="/projets" className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50" aria-label="Retour aux projets">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Projet commerce</span>
            <ProjectStatusBadge status={project.status} />
          </div>
          <h1 className="truncate text-3xl font-bold tracking-tight text-slate-950">{project.name}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {project.clientName} · {project.address || "Adresse à renseigner"} · {formatCurrency(project.budgetEstimate || project.quoteAmount)}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>Commercial {project.salesperson || "à assigner"}</span>
            <span>Source {project.sourceLabel || "non renseignée"}</span>
            <span>Échéance {formatDate(project.desiredDeadline)}</span>
          </div>
          {chantierError ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{chantierError}</div> : null}
          {outcomeError ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{outcomeError}</div> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to={editTarget} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50">
            <Pencil className="h-4 w-4" />
            Modifier
          </Link>
          <Link to={`/projets/${project.id}/visites/nouveau`} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50">
            <CalendarPlus className="h-4 w-4" />
            Visite de chiffrage
          </Link>
          <Link to={quote ? `/projets/${project.id}/devis/${quote.id}/edit` : `/projets/${project.id}/devis/nouveau`} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700">
            <FileText className="h-4 w-4" />
            {quote ? "Ouvrir devis" : "Créer devis"}
          </Link>
          <Link to="/crm/agenda" className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
            Relancer
          </Link>
          {linkedChantierId ? (
            <Link to={`/chantiers/${linkedChantierId}`} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50" title={chantier?.nom ?? "Ouvrir le chantier lie au devis accepte"}>
              <Hammer className="h-4 w-4" />
              Ouvrir chantier
            </Link>
          ) : acceptedQuote ? (
            <button type="button" onClick={createChantierFromAcceptedQuote} disabled={transformingChantier} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60">
              <Hammer className="h-4 w-4" />
              {transformingChantier ? "Creation..." : "Créer chantier"}
            </button>
          ) : (
            <button type="button" disabled title="Disponible uniquement après acceptation d’un devis." className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-400">
              <Hammer className="h-4 w-4" />
              Créer chantier
            </button>
          )}
          <button
            type="button"
            onClick={() => void updateProjectOutcome("won")}
            disabled={!canMarkWon || updatingOutcome !== null}
            title={canMarkWon ? "Marquer le devis principal comme accepte et le projet comme gagne." : "Disponible uniquement avec un devis non encore gagne."}
            className={[
              "inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
              canMarkWon ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-slate-200 bg-slate-50 text-slate-400",
            ].join(" ")}
          >
            <CheckCircle2 className="h-4 w-4" />
            {updatingOutcome === "won" ? "Gain..." : "Gagné"}
          </button>
          <button
            type="button"
            onClick={() => void updateProjectOutcome("lost")}
            disabled={!canMarkLost || updatingOutcome !== null}
            title={canMarkLost ? "Marquer le projet comme perdu et refuser les devis actifs." : "Indisponible si le projet est deja gagne, accepte ou lie a un chantier."}
            className={[
              "inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
              canMarkLost ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100" : "border-slate-200 bg-slate-50 text-slate-400",
            ].join(" ")}
          >
            <XCircle className="h-4 w-4" />
            {updatingOutcome === "lost" ? "Perte..." : "Perdu"}
          </button>
        </div>
      </div>
    </header>
  );
}
