import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BrainCircuit, CheckCircle2, ClipboardCheck, FileText, Loader2, Pencil, Plus, ShieldCheck, Wand2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { loadCrmVisitReportDraft, type CrmVisitReportDraft } from "../services/crmVisitReports.service";
import {
  isCurrentUserCocoAdmin,
  listCocoControlledDrafts,
  prepareCocoVisitQuoteDraft,
  saveCocoControlledDraft,
  updateCocoControlledDraftStatus,
  type CocoControlledDraft,
  type CocoControlledDraftStatus,
} from "../services/cocoDirectionAssistant.service";
import { VISIT_DRAFT_MARKER } from "../features/crm/utils/appointmentDraftStorage";
import { useProjectsData } from "../features/projects/hooks/useProjectsData";

type AiDraftHistoryEntry = {
  id: string;
  persistedId: string | null;
  draft: CocoControlledDraft;
  status: CocoControlledDraftStatus;
  createdAt: string;
  persistence: "supabase" | "local";
};

const AI_DRAFT_STATUS_LABELS: Record<CocoControlledDraftStatus, string> = {
  prepared: "Préparé",
  reviewed: "À revoir",
  validated: "Envoyé en revue devis",
  ignored: "Ignoré",
};

const AI_DRAFT_SOURCE_KIND = "crm_visit_quote_analysis";

function parseFallbackDraft(notes: string | null | undefined): CrmVisitReportDraft | null {
  if (!notes?.includes(VISIT_DRAFT_MARKER)) return null;
  try {
    return JSON.parse(notes.slice(notes.lastIndexOf(VISIT_DRAFT_MARKER) + VISIT_DRAFT_MARKER.length)) as CrmVisitReportDraft;
  } catch {
    return null;
  }
}

function lineQuantity(line: NonNullable<CrmVisitReportDraft["lines"]>[number]) {
  return `${Number(line.quantity ?? 0).toLocaleString("fr-FR")} ${line.unit ?? "u"}`;
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "A completer";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} EUR HT`;
}

function draftConfidenceClass(confidence: string) {
  if (confidence === "haute") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (confidence === "faible") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-200 bg-blue-50 text-blue-800";
}

function statusClass(status: CocoControlledDraftStatus) {
  if (status === "validated") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "ignored") return "border-slate-200 bg-slate-100 text-slate-600";
  if (status === "reviewed") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function joinOrFallback(values: string[], fallback: string) {
  return values.length ? values.join(" - ") : fallback;
}

function localHistoryEntry(draft: CocoControlledDraft, status: CocoControlledDraftStatus): AiDraftHistoryEntry {
  return {
    id: draft.id,
    persistedId: null,
    draft,
    status,
    createdAt: new Date().toISOString(),
    persistence: "local",
  };
}

export default function ProjectVisitQuotePrepPage() {
  const { id, visitId } = useParams();
  const navigate = useNavigate();
  const { projectsById, loading, error } = useProjectsData();
  const project = id ? projectsById.get(id) ?? null : null;
  const appointment = project?.appointments.find((item) => item.id === visitId) ?? null;
  const [draft, setDraft] = useState<CrmVisitReportDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(true);
  const [aiAllowed, setAiAllowed] = useState(false);
  const [aiDraft, setAiDraft] = useState<CocoControlledDraft | null>(null);
  const [aiDraftHistory, setAiDraftHistory] = useState<AiDraftHistoryEntry[]>([]);
  const [aiHistoryLoading, setAiHistoryLoading] = useState(false);
  const [aiPersistenceNotice, setAiPersistenceNotice] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    isCurrentUserCocoAdmin()
      .then((allowed) => {
        if (alive) setAiAllowed(allowed);
      })
      .catch(() => {
        if (alive) setAiAllowed(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!visitId || !appointment) {
      setDraftLoading(false);
      return;
    }
    setDraftLoading(true);
    loadCrmVisitReportDraft(visitId)
      .then((stored) => {
        if (!alive) return;
        setDraft(stored ?? parseFallbackDraft(appointment.notes));
      })
      .catch(() => {
        if (alive) setDraft(parseFallbackDraft(appointment.notes));
      })
      .finally(() => {
        if (alive) setDraftLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [appointment, visitId]);

  useEffect(() => {
    setAiDraft(null);
    setAiDraftHistory([]);
    setAiPersistenceNotice(null);
    setAiError(null);
  }, [project?.id, appointment?.id, draft]);

  useEffect(() => {
    let alive = true;
    if (!aiAllowed || !project || !appointment) return;
    setAiHistoryLoading(true);
    listCocoControlledDrafts({ sourceKind: AI_DRAFT_SOURCE_KIND, sourceId: appointment.id, projectId: project.id, limit: 8 })
      .then((records) => {
        if (!alive) return;
        setAiDraftHistory(records.map((record) => ({
          id: record.draft.id,
          persistedId: record.id,
          draft: record.draft,
          status: record.status,
          createdAt: record.createdAt,
          persistence: "supabase" as const,
        })));
        setAiPersistenceNotice(records.length ? null : "Aucun historique IA persistant pour cette visite.");
      })
      .catch((err) => {
        if (!alive) return;
        setAiPersistenceNotice(err instanceof Error ? err.message : "Historique IA persistant indisponible.");
      })
      .finally(() => {
        if (alive) setAiHistoryLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [aiAllowed, appointment, project]);

  const sections = useMemo(() => (draft?.lines ?? []).filter((line) => line.type === "section"), [draft?.lines]);
  const tasks = useMemo(() => (draft?.lines ?? []).filter((line) => line.type === "task"), [draft?.lines]);
  const attachments = draft?.attachments ?? [];
  const missingPrices = tasks.filter((line) => !Number(line.priceHintHt ?? 0)).length;
  const readyForQuote = tasks.length > 0;

  function setLocalDraftHistory(entry: AiDraftHistoryEntry) {
    setAiDraftHistory((previous) => {
      const withoutSameDraft = previous.filter((item) => item.id !== entry.id);
      return [entry, ...withoutSameDraft].slice(0, 8);
    });
  }

  async function recordAiDraftStatus(draftToUpdate: CocoControlledDraft, status: CocoControlledDraftStatus) {
    const existing = aiDraftHistory.find((entry) => entry.id === draftToUpdate.id);
    const localEntry: AiDraftHistoryEntry = {
      ...(existing ?? localHistoryEntry(draftToUpdate, status)),
      draft: draftToUpdate,
      status,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    setLocalDraftHistory(localEntry);

    if (!project || !appointment) return;
    try {
      if (existing?.persistedId) {
        const updated = await updateCocoControlledDraftStatus({ id: existing.persistedId, status });
        if (updated) {
          setLocalDraftHistory({ ...localEntry, persistedId: updated.id, status: updated.status, createdAt: updated.createdAt, persistence: "supabase" });
          setAiPersistenceNotice(null);
        }
        return;
      }

      const saved = await saveCocoControlledDraft({
        sourceKind: AI_DRAFT_SOURCE_KIND,
        sourceId: appointment.id,
        projectId: project.id,
        draft: draftToUpdate,
        status,
      });
      if (saved) {
        setLocalDraftHistory({ ...localEntry, persistedId: saved.id, status: saved.status, createdAt: saved.createdAt, persistence: "supabase" });
        setAiPersistenceNotice(null);
      } else {
        setAiPersistenceNotice("Historique persistant non actif : appliquer la table Supabase ai_controlled_drafts. La proposition reste locale sur cette page.");
      }
    } catch (err) {
      setAiPersistenceNotice(err instanceof Error ? err.message : "Historique IA persistant indisponible. La proposition reste locale sur cette page.");
    }
  }

  function markAiDraft(status: CocoControlledDraftStatus) {
    if (!aiDraft) return;
    void recordAiDraftStatus(aiDraft, status);
    if (status === "ignored") setAiDraft(null);
  }

  function openQuoteReview(status: CocoControlledDraftStatus) {
    if (!project) return;
    if (aiDraft) void recordAiDraftStatus(aiDraft, status);
    navigate(`/projets/${project.id}/devis/nouveau`);
  }

  async function prepareAiDraft() {
    if (!project || !appointment || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const prepared = await prepareCocoVisitQuoteDraft({ project: project as unknown as Record<string, unknown>, appointment: appointment as unknown as Record<string, unknown>, visitDraft: draft as unknown as Record<string, unknown> | null });
      setAiDraft(prepared);
      await recordAiDraftStatus(prepared, "prepared");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Impossible de preparer le brouillon IA.");
    } finally {
      setAiLoading(false);
    }
  }

  if (loading || draftLoading) {
    return <div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement de la preparation devis...</div>;
  }

  if (error || !project || !appointment) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error ?? "Visite introuvable."}</div>;
  }

  return (
    <div className="space-y-5 pb-10">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <Link to={`/projets/${project.id}?tab=visits`} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Retour projet
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Visite terminee / preparation devis</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{project.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Revue rapide du releve terrain avant creation du devis. Corrige seulement ce qui est utile au chiffrage.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/projets/${project.id}/visites/${appointment.id}?edit=1`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
              <Pencil className="h-4 w-4" />
              Reprendre
            </Link>
            <button
              type="button"
              disabled={!readyForQuote}
              onClick={() => navigate(`/projets/${project.id}/devis/nouveau`)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
            >
              <FileText className="h-4 w-4" />
              Creer le devis
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["Lignes a chiffrer", tasks.length],
          ["Sections", sections.length],
          ["Pieces jointes", attachments.length],
          ["Prix a completer", missingPrices],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
            <div className="mt-2 text-2xl font-bold text-slate-950">{value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-blue-50 p-2 text-blue-700"><ClipboardCheck className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold text-slate-950">Synthese utile au devis</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{draft?.needDescription || appointment.compte_rendu || "Aucune synthese renseignee."}</p>
            <div className="mt-3 grid gap-2 text-sm text-slate-500 md:grid-cols-3">
              <span>Client: {draft?.client || project.clientName}</span>
              <span>Adresse: {draft?.address || project.address || "Non renseignee"}</span>
              <span>Prochaine action: {draft?.nextAction || project.nextAction || "Creer le devis"}</span>
            </div>
          </div>
        </div>
      </section>

      {aiAllowed ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-slate-950 p-2 text-white"><BrainCircuit className="h-5 w-5" /></div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Assistant Chiffrage COCO</div>
                <h2 className="mt-1 font-semibold text-slate-950">Brouillon IA apres visite</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  COCO prepare une proposition de pre-devis avec sources, hypotheses, risques, temps et besoins materiaux. Rien n'est ecrit dans le devis final avant revue admin.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void prepareAiDraft()}
              disabled={aiLoading || !readyForQuote}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
            >
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Preparer brouillon IA
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
            <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Productivite controlee</div>
            <p className="mt-1 text-xs leading-5">Le brouillon peut aider a pre-remplir la reflexion chiffrage. Validation, creation de devis, envoi client, chantier, planning et achats restent manuels.</p>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-4">
            {[
              ["Preparer", "Generer une proposition depuis les donnees Batipro."],
              ["Revoir", "Controler sources, hypotheses, risques et lignes."],
              ["Valider", "Basculer vers la revue devis, sans creation automatique."],
              ["Ignorer", "Ecarter la proposition sans toucher aux donnees."],
            ].map(([label, detail]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm font-semibold text-slate-950">{label}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
              </div>
            ))}
          </div>

          {aiPersistenceNotice ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{aiPersistenceNotice}</div> : null}
          {aiError ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{aiError}</div> : null}

          {aiDraft ? (
            <div className="mt-5 space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="font-semibold text-slate-950">{aiDraft.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">Genere le {new Date(aiDraft.generatedAt).toLocaleString("fr-FR")}</p>
                </div>
                <span className={["inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold", draftConfidenceClass(aiDraft.confidence)].join(" ")}>Confiance {aiDraft.confidence}</span>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-950">Sources utilisees</div>
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                    {(aiDraft.sourceSummary.length ? aiDraft.sourceSummary : ["Visite commerciale", "Bibliotheque Batipro", "Fournisseurs actifs"]).map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-950">Hypotheses</div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{joinOrFallback(aiDraft.hypotheses, "Aucune hypothese explicite retournee.")}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-950">Points a verifier</div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{joinOrFallback(aiDraft.pointsToVerify, "Aucun point specifique retourne.")}</p>
                </div>
              </div>

              {aiDraft.risks.length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <div className="font-semibold">Risques signales</div>
                  <ul className="mt-2 space-y-1 text-xs leading-5">
                    {aiDraft.risks.map((risk) => <li key={risk}>- {risk}</li>)}
                  </ul>
                </div>
              ) : null}

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950">Lignes de pre-devis proposees</div>
                {aiDraft.quoteLines.length ? (
                  <div className="divide-y divide-slate-100">
                    {aiDraft.quoteLines.map((line, index) => (
                      <div key={`${line.title}-${index}`} className="grid gap-3 p-4 text-sm xl:grid-cols-[minmax(0,1.2fr)_110px_120px_130px] xl:items-start">
                        <div>
                          <div className="font-semibold text-slate-950">{line.title}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">{line.lot || "Lot a confirmer"} - Source: {line.source}</div>
                          {line.templateTitle ? <div className="mt-1 text-xs text-blue-700">Bibliotheque: {line.templateTitle}</div> : null}
                          {line.pointsToVerify.length ? <div className="mt-1 text-xs text-amber-700">A verifier: {line.pointsToVerify.join(" - ")}</div> : null}
                        </div>
                        <div className="text-slate-600">{line.quantity.toLocaleString("fr-FR")} {line.unit ?? "u"}</div>
                        <div className="text-slate-600">{line.estimatedHours !== null ? `${line.estimatedHours.toLocaleString("fr-FR")} h` : "Temps a confirmer"}</div>
                        <div className="font-semibold text-slate-950">{formatCurrency(line.totalHt ?? (line.unitPriceHt !== null ? line.unitPriceHt * line.quantity : null))}</div>
                      </div>
                    ))}
                  </div>
                ) : <div className="p-4 text-sm text-slate-500">Aucune ligne proposee par l'IA.</div>}
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="font-semibold text-slate-950">Besoins materiaux / fournisseurs</div>
                  <div className="mt-3 space-y-2">
                    {aiDraft.materialNeeds.length ? aiDraft.materialNeeds.map((need, index) => (
                      <div key={`${need.designation}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                        <div className="font-semibold text-slate-950">{need.designation}</div>
                        <div className="mt-1 text-xs text-slate-500">{need.quantity ?? "Quantite a confirmer"} {need.unit ?? ""} - {need.supplierName ?? "Fournisseur a choisir"}</div>
                      </div>
                    )) : <div className="text-sm text-slate-500">Aucun besoin materiel structure retourne.</div>}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="font-semibold text-slate-950">Actions proposees</div>
                  <div className="mt-3 space-y-2">
                    {aiDraft.proposedActions.length ? aiDraft.proposedActions.map((action, index) => (
                      <div key={`${action.label}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                        <div className="flex items-center gap-2 font-semibold text-slate-950">
                          {action.actionType === "ignore" ? <XCircle className="h-4 w-4 text-slate-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                          {action.label}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">{action.module} - {action.detail}</div>
                      </div>
                    )) : <div className="text-sm text-slate-500">Aucune action structuree retournee.</div>}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-600">
                  <div className="font-semibold text-slate-950">Validation admin obligatoire</div>
                  <div className="mt-1 text-xs">Les actions ci-dessous ne publient pas, n'envoient pas et ne creent pas de chantier automatiquement.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => markAiDraft("reviewed")} className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">Revoir</button>
                  <button type="button" onClick={() => markAiDraft("ignored")} className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">Ignorer</button>
                  <button type="button" onClick={() => openQuoteReview("validated")} className="inline-flex h-10 items-center rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700">Valider en revue devis</button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-slate-950">Historique des propositions IA</div>
              {aiHistoryLoading ? <div className="text-xs text-slate-500">Chargement...</div> : null}
            </div>
            <div className="mt-3 space-y-2">
              {aiDraftHistory.length ? aiDraftHistory.map((entry) => (
                <div key={`${entry.id}-${entry.status}`} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold text-slate-950">{entry.draft.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString("fr-FR")} - {entry.draft.quoteLines.length} ligne(s), {entry.draft.materialNeeds.length} besoin(s) materiaux - {entry.persistence === "supabase" ? "historique persistant" : "local"}</div>
                  </div>
                  <span className={["inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold", statusClass(entry.status)].join(" ")}>{AI_DRAFT_STATUS_LABELS[entry.status]}</span>
                </div>
              )) : <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Aucune proposition IA preparee sur cette revue.</div>}
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-950">Lignes reprises dans le devis</h2>
            <p className="mt-1 text-sm text-slate-500">Le devis sera pre-rempli avec ces lignes. Les prix et marges restent finalisables a la main.</p>
          </div>
          <Link to={`/projets/${project.id}/visites/${appointment.id}?edit=1`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            <Plus className="h-4 w-4" />
            Ajuster
          </Link>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          {tasks.length ? (
            <div className="divide-y divide-slate-100">
              {tasks.map((line) => (
                <div key={line.id ?? line.title} className="grid gap-2 p-4 text-sm md:grid-cols-[minmax(0,1fr)_120px_140px] md:items-center">
                  <div>
                    <div className="font-semibold text-slate-950">{line.title || "Prestation relevee"}</div>
                    {line.technicalNotes || line.constraints ? <div className="mt-1 line-clamp-2 text-xs text-slate-500">{[line.technicalNotes, line.constraints].filter(Boolean).join(" - ")}</div> : null}
                  </div>
                  <div className="text-slate-600">{lineQuantity(line)}</div>
                  <div className={Number(line.priceHintHt ?? 0) ? "font-semibold text-slate-900" : "font-semibold text-amber-700"}>
                    {Number(line.priceHintHt ?? 0) ? `${Number(line.priceHintHt).toLocaleString("fr-FR")} EUR HT` : "Prix a completer"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 text-sm text-slate-500">Aucune ligne relevee. Reprends la visite pour ajouter les taches a chiffrer.</div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">Photos et documents utiles</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {attachments.length ? attachments.map((item) => (
            <div key={item.id ?? item.name} className="rounded-2xl border border-slate-200 p-3 text-sm">
              {item.previewUrl ? <img src={item.previewUrl} alt={item.name} className="mb-3 aspect-video w-full rounded-xl object-cover" /> : null}
              <div className="font-semibold text-slate-950">{item.name}</div>
              <div className="mt-1 text-xs text-slate-500">{item.kind}{item.comment ? ` - ${item.comment}` : ""}</div>
            </div>
          )) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Aucune piece jointe utile au devis.</div>}
        </div>
      </section>
    </div>
  );
}
