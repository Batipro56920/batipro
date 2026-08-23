import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Pencil, RefreshCw, Save, X } from "lucide-react";
import { listKnowledgeImprovements, type KnowledgeImprovement } from "../features/field-knowledge/FieldKnowledgeEngine";
import {
  applyKnowledgeImprovement,
  rejectKnowledgeImprovement,
  simulateKnowledgeImprovement,
  type KnowledgeImpactSimulation,
} from "../features/knowledge-manager/KnowledgeManager";

type ImprovementStatus = KnowledgeImprovement["status"] | "all";

const STATUS_OPTIONS: Array<{ value: ImprovementStatus; label: string }> = [
  { value: "pending", label: "A valider" },
  { value: "accepted", label: "Acceptees" },
  { value: "modified", label: "Modifiees" },
  { value: "rejected", label: "Refusees" },
  { value: "archived", label: "Archivees" },
  { value: "all", label: "Toutes" },
];

function statusClass(status: KnowledgeImprovement["status"]) {
  if (status === "accepted") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "modified") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  if (status === "archived") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function confidenceClass(confidence: KnowledgeImprovement["confidence"]) {
  if (confidence === "high") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (confidence === "medium") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatJson(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

function parseJsonOrText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-950">{value}</div>
    </div>
  );
}

function ValueBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap wrap-break-word text-xs leading-5 text-slate-700">
        {formatJson(value)}
      </pre>
    </div>
  );
}

function formatDiffSummary(diff: Record<string, unknown> | null) {
  if (!diff) return null;
  const changed = Array.isArray(diff.changed) ? diff.changed : [];
  const added = Array.isArray(diff.added) ? diff.added : [];
  const removed = Array.isArray(diff.removed) ? diff.removed : [];
  return [
    changed.length ? `Modifications: ${changed.length}` : null,
    added.length ? `Ajouts: ${added.length}` : null,
    removed.length ? `Suppressions: ${removed.length}` : null,
  ].filter(Boolean);
}

export default function KnowledgeImprovementsPage() {
  const [status, setStatus] = useState<ImprovementStatus>("pending");
  const [rows, setRows] = useState<KnowledgeImprovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [simulations, setSimulations] = useState<Record<string, KnowledgeImpactSimulation | null>>({});
  const [simulationLoadingId, setSimulationLoadingId] = useState<string | null>(null);

  const stats = useMemo(() => {
    return {
      pending: rows.filter((row) => row.status === "pending").length,
      high: rows.filter((row) => row.confidence === "high").length,
      totalSites: rows.reduce((sum, row) => sum + row.chantierCount, 0),
    };
  }, [rows]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const data = await listKnowledgeImprovements(status);
      setRows(data);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les ameliorations IA.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function startEdit(row: KnowledgeImprovement) {
    setEditingId(row.id);
    setEditValue(formatJson(row.proposedValue));
    setReviewComment(row.reviewerComment ?? "");
  }

  async function review(row: KnowledgeImprovement, nextStatus: "accepted" | "rejected" | "modified") {
    setSavingId(row.id);
    setError(null);
    setNotice(null);
    try {
      const proposedValue = nextStatus === "modified" ? parseJsonOrText(editValue) : undefined;
      const comment = reviewComment.trim() || undefined;
      if (nextStatus === "rejected") {
        await rejectKnowledgeImprovement(row.id, {
          actorId: null,
          actorLabel: "conducteur",
          reason: comment,
        });
      } else {
        await applyKnowledgeImprovement(row.id, {
          actorId: null,
          actorLabel: "conducteur",
          reason: comment ?? row.reason,
          overrideProposedValue: proposedValue,
        });
      }
      setEditingId(null);
      setEditValue("");
      setReviewComment("");
      setNotice(nextStatus === "rejected" ? "La proposition a été rejetée." : "La proposition a été appliquée et versionnée.");
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? "Impossible d'enregistrer la décision.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleSimulate(row: KnowledgeImprovement) {
    setSimulationLoadingId(row.id);
    setError(null);
    setNotice(null);
    try {
      const simulation = await simulateKnowledgeImprovement(row.id);
      setSimulations((prev) => ({ ...prev, [row.id]: simulation }));
    } catch (err: any) {
      setError(err?.message ?? "Impossible de simuler l'impact.");
    } finally {
      setSimulationLoadingId(null);
    }
  }

  async function handleApply(row: KnowledgeImprovement) {
    setSavingId(row.id);
    setError(null);
    setNotice(null);
    try {
      await applyKnowledgeImprovement(row.id, {
        actorId: null,
        actorLabel: "conducteur",
        reason: reviewComment.trim() || row.reason,
      });
      setReviewComment("");
      setNotice("La proposition a été appliquée et versionnée.");
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? "Impossible d'appliquer la proposition.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Coco chantier</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Ameliorations IA</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Les retours terrain alimentent des propositions. La bibliotheque n'est jamais modifiee sans validation conducteur.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="A valider" value={stats.pending} />
        <Stat label="Confiance haute" value={stats.high} />
        <Stat label="Chantiers observes" value={stats.totalSites} />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-950">File de validation</div>
            <div className="text-xs text-slate-500">Ratios, temps, materiel, controles et erreurs issus du prevu/reel.</div>
          </div>
          <select
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
            value={status}
            onChange={(event) => setStatus(event.target.value as ImprovementStatus)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Chargement des propositions IA...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Aucune proposition IA pour ce filtre.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const editing = editingId === row.id;
            const saving = savingId === row.id;
            return (
              <article key={row.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{row.status}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceClass(row.confidence)}`}>confiance {row.confidence}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {row.chantierCount} chantier(s)
                      </span>
                    </div>
                    <h2 className="mt-3 text-lg font-bold text-slate-950">{row.improvementType}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{row.reason}</p>
                  </div>
                  {row.status === "pending" ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void review(row, "accepted")}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Check className="h-4 w-4" />
                        Accepter et appliquer
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => startEdit(row)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <Pencil className="h-4 w-4" />
                        Modifier et appliquer
                      </button>
                      <button
                        type="button"
                        disabled={saving || simulationLoadingId === row.id}
                        onClick={() => void handleSimulate(row)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Simuler impact
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleApply(row)}
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" />
                        Appliquer sans modifier
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void review(row, "rejected")}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        <X className="h-4 w-4" />
                        Refuser
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <ValueBlock label="Valeur actuelle" value={row.currentValue} />
                  <ValueBlock label="Valeur proposee" value={row.proposedValue} />
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <ValueBlock label="Sources" value={row.source} />
                  <ValueBlock label="Meta" value={{ productId: row.productId, templateId: row.taskTemplateId, lot: row.lot }} />
                  <ValueBlock label="Historique" value={{ createdAt: row.createdAt, reviewedAt: row.reviewedAt, comment: row.reviewerComment }} />
                </div>

                {simulations[row.id] ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Knowledge Manager</div>
                        <div className="text-sm font-semibold text-slate-900">Simulation d’impact validée</div>
                      </div>
                      <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {simulations[row.id]?.impactedChantiers ?? 0} chantier(s)
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-5">
                      <div className="rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-700">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Produits</div>
                        <div className="mt-1 text-base font-semibold text-slate-950">{simulations[row.id]?.impactedProducts ?? 0}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-700">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Templates</div>
                        <div className="mt-1 text-base font-semibold text-slate-950">{simulations[row.id]?.impactedTemplates ?? 0}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-700">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Devis</div>
                        <div className="mt-1 text-base font-semibold text-slate-950">{simulations[row.id]?.impactedQuotes ?? 0}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-700">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Chantiers</div>
                        <div className="mt-1 text-base font-semibold text-slate-950">{simulations[row.id]?.impactedChantiers ?? 0}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-700">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">DOE</div>
                        <div className="mt-1 text-base font-semibold text-slate-950">{simulations[row.id]?.impactedDoe ?? 0}</div>
                      </div>
                    </div>
                    {(simulations[row.id]?.costBefore || simulations[row.id]?.costAfter) ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Coût estimé</div>
                        <div className="mt-2 grid gap-2 md:grid-cols-3">
                          <div>
                            <div className="text-xs text-slate-500">Avant</div>
                            <div className="text-sm font-semibold text-slate-950">{formatJson(simulations[row.id]?.costBefore)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Après</div>
                            <div className="text-sm font-semibold text-slate-950">{formatJson(simulations[row.id]?.costAfter)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Diff</div>
                            <div className="text-sm font-semibold text-slate-950">{formatJson((simulations[row.id]?.costAfter && simulations[row.id]?.costBefore) ? { delta: (simulations[row.id]?.costAfter as Record<string, unknown> ) } : null)}</div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {formatDiffSummary(simulations[row.id]?.diff as Record<string, unknown> | null)?.length ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Diff</div>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                          {formatDiffSummary(simulations[row.id]?.diff as Record<string, unknown> | null)?.map((entry) => <li key={entry}>{entry}</li>)}
                        </ul>
                      </div>
                    ) : null}
                    {simulations[row.id]?.warnings?.length ? (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-700">
                        {simulations[row.id]?.warnings?.map((warning) => <li key={warning}>{warning}</li>)}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                {editing ? (
                  <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-3">
                    <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Valeur ajustee</label>
                    <textarea
                      className="mt-2 min-h-32 w-full rounded-2xl border border-blue-200 bg-white px-3 py-2 text-sm font-mono text-slate-800 outline-none focus:border-blue-400"
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                    />
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Commentaire conducteur</label>
                    <textarea
                      className="mt-2 min-h-20 w-full rounded-2xl border border-blue-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400"
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value)}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void review(row, "modified")}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" />
                        Valider modifie
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setEditingId(null);
                          setEditValue("");
                          setReviewComment("");
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
