import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Clock3, Trash2 } from "lucide-react";

import { getChantierById, type ChantierRow } from "../services/chantiers.service";
import { getTasksByChantierIdDetailed, type ChantierTaskRow } from "../services/chantierTasks.service";
import { listIntervenantsByChantierId, type IntervenantRow } from "../services/intervenants.service";
import { appendChantierActivityLog } from "../services/chantierActivityLog.service";
import {
  createChantierTimeEntry,
  deleteChantierTimeEntry,
  listChantierTimeEntriesByChantierId,
  type ChantierTimeEntryRow,
} from "../services/chantierTimeEntries.service";

function toNumberOrNull(value: string): number | null {
  const raw = value.trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatHours(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return `${Math.round(n * 100) / 100} h`;
}

function formatQuantity(value: number | null | undefined, unit: string | null | undefined) {
  const n = Number(value ?? 0);
  if (n <= 0) return "-";
  const label = Math.round(n * 100) / 100;
  return unit ? `${label} ${unit}` : String(label);
}

function getTaskTitle(task: ChantierTaskRow | undefined | null) {
  return task?.titre_terrain?.trim() || task?.titre?.trim() || "Tache chantier";
}

type TaskTimeSummary = {
  id: string;
  task: ChantierTaskRow | null;
  planned: number;
  logged: number;
  delta: number;
  quantity: number;
  entriesCount: number;
  latestDate: string | null;
  tone: "over" | "missing" | "ok";
};

function buildTaskTimeTone(params: { planned: number; logged: number; entriesCount: number }) {
  if (params.planned > 0 && params.logged > params.planned) return "over" as const;
  if (params.entriesCount === 0) return "missing" as const;
  return "ok" as const;
}

function statusLabel(summary: TaskTimeSummary) {
  if (summary.tone === "over") return `Dépassement ${formatHours(summary.delta)}`;
  if (summary.tone === "missing") return "Aucune saisie";
  return "Sous contrôle";
}

function statusClass(summary: TaskTimeSummary) {
  if (summary.tone === "over") return "border-danger/20 bg-danger-soft text-danger-on";
  if (summary.tone === "missing") return "border-warning/20 bg-warning-soft text-warning-on";
  return "border-success/20 bg-success-soft text-success-on";
}

export default function ChantierTimePage() {
  const { id } = useParams<{ id: string }>();
  const [chantier, setChantier] = useState<ChantierRow | null>(null);
  const [tasks, setTasks] = useState<ChantierTaskRow[]>([]);
  const [intervenants, setIntervenants] = useState<IntervenantRow[]>([]);
  const [entries, setEntries] = useState<ChantierTimeEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState("");
  const [intervenantId, setIntervenantId] = useState("");
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const intervenantById = useMemo(() => new Map(intervenants.map((intervenant) => [intervenant.id, intervenant])), [intervenants]);
  const totalLogged = useMemo(
    () => entries.reduce((sum, entry) => sum + Number(entry.duration_hours ?? 0), 0),
    [entries],
  );
  const plannedHours = Number(chantier?.heures_prevues ?? 0) || tasks.reduce((sum, task) => sum + Number(task.temps_prevu_h ?? 0), 0);
  const selectedTask = taskId ? taskById.get(taskId) : null;

  const taskTimeSummaries = useMemo<TaskTimeSummary[]>(() => {
    const aggregateByTask = new Map<string, { logged: number; quantity: number; entriesCount: number; latestDate: string | null }>();

    for (const entry of entries) {
      const key = entry.task_id || "__sans_tache__";
      const current = aggregateByTask.get(key) ?? { logged: 0, quantity: 0, entriesCount: 0, latestDate: null };
      current.logged += Number(entry.duration_hours ?? 0);
      current.quantity += Number(entry.quantite_realisee ?? 0);
      current.entriesCount += 1;
      if (!current.latestDate || entry.work_date > current.latestDate) current.latestDate = entry.work_date;
      aggregateByTask.set(key, current);
    }

    const summaries: TaskTimeSummary[] = tasks.map((task) => {
      const aggregate = aggregateByTask.get(task.id) ?? { logged: 0, quantity: 0, entriesCount: 0, latestDate: null };
      const planned = Number(task.temps_prevu_h ?? 0);
      const logged = aggregate.logged;
      return {
        id: task.id,
        task,
        planned,
        logged,
        delta: logged - planned,
        quantity: aggregate.quantity,
        entriesCount: aggregate.entriesCount,
        latestDate: aggregate.latestDate,
        tone: buildTaskTimeTone({ planned, logged, entriesCount: aggregate.entriesCount }),
      };
    });

    const orphanAggregate = aggregateByTask.get("__sans_tache__");
    if (orphanAggregate) {
      summaries.push({
        id: "__sans_tache__",
        task: null,
        planned: 0,
        logged: orphanAggregate.logged,
        delta: orphanAggregate.logged,
        quantity: orphanAggregate.quantity,
        entriesCount: orphanAggregate.entriesCount,
        latestDate: orphanAggregate.latestDate,
        tone: "ok",
      });
    }

    const weight = { over: 0, missing: 1, ok: 2 } as const;
    return summaries.sort((a, b) => {
      const byTone = weight[a.tone] - weight[b.tone];
      if (byTone !== 0) return byTone;
      if (a.tone === "over" || b.tone === "over") return b.delta - a.delta;
      return getTaskTitle(a.task).localeCompare(getTaskTitle(b.task), "fr");
    });
  }, [entries, tasks]);

  const timeControlStats = useMemo(() => {
    return {
      over: taskTimeSummaries.filter((summary) => summary.tone === "over").length,
      missing: taskTimeSummaries.filter((summary) => summary.tone === "missing").length,
      withTime: taskTimeSummaries.filter((summary) => summary.entriesCount > 0).length,
    };
  }, [taskTimeSummaries]);

  async function refresh() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [chantierRow, tasksResult, intervenantRows, timeRows] = await Promise.all([
        getChantierById(id),
        getTasksByChantierIdDetailed(id),
        listIntervenantsByChantierId(id),
        listChantierTimeEntriesByChantierId(id),
      ]);
      setChantier(chantierRow);
      setTasks(tasksResult.tasks);
      setIntervenants(intervenantRows.filter((intervenant) => !intervenant.archived_at));
      setEntries(timeRows);
      setTaskId((current) => current || tasksResult.tasks[0]?.id || "");
      setIntervenantId((current) => current || intervenantRows.find((intervenant) => !intervenant.archived_at)?.id || "");
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger le suivi des temps.");
      setChantier(null);
      setTasks([]);
      setIntervenants([]);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [id]);

  useEffect(() => {
    if (!selectedTask?.intervenant_id) return;
    if (intervenantId) return;
    if (intervenants.some((intervenant) => intervenant.id === selectedTask.intervenant_id)) {
      setIntervenantId(selectedTask.intervenant_id);
    }
  }, [intervenantId, intervenants, selectedTask?.intervenant_id]);

  async function recordTimeActivity(input: {
    actionType: "time_logged" | "deleted";
    entry: ChantierTimeEntryRow;
    reason: string;
  }) {
    if (!id) return;
    try {
      await appendChantierActivityLog({
        chantierId: id,
        actionType: input.actionType,
        entityType: "time_entry",
        entityId: input.entry.id,
        reason: input.reason,
        changes: {
          task_id: input.entry.task_id,
          task_title: input.entry.task_id ? getTaskTitle(taskById.get(input.entry.task_id)) : null,
          intervenant_id: input.entry.intervenant_id,
          intervenant_name: intervenantById.get(input.entry.intervenant_id)?.nom ?? null,
          work_date: input.entry.work_date,
          duration_hours: input.entry.duration_hours,
          quantite_realisee: input.entry.quantite_realisee,
        },
      });
    } catch (err) {
      console.warn("[activity-log] time entry append failed", err);
    }
  }

  async function saveTimeEntry() {
    if (!id) return;
    const duration = toNumberOrNull(hours);
    const doneQuantity = quantity.trim() ? toNumberOrNull(quantity) : null;

    if (!taskId) {
      setFormError("Choisis une tache.");
      return;
    }
    if (!intervenantId) {
      setFormError("Choisis un intervenant.");
      return;
    }
    if (!workDate) {
      setFormError("Choisis une date.");
      return;
    }
    if (duration === null || duration <= 0) {
      setFormError("Durée invalide.");
      return;
    }
    if (doneQuantity !== null && doneQuantity <= 0) {
      setFormError("Quantité invalide.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const created = await createChantierTimeEntry({
        chantier_id: id,
        task_id: taskId,
        intervenant_id: intervenantId,
        work_date: workDate,
        duration_hours: duration,
        quantite_realisee: doneQuantity,
        note: note.trim() || null,
      });
      await recordTimeActivity({
        actionType: "time_logged",
        entry: created,
        reason: "Saisie temps ajoutée depuis le suivi des temps",
      });
      setHours("");
      setQuantity("");
      setNote("");
      await refresh();
    } catch (err: any) {
      setFormError(err?.message ?? "Erreur enregistrement temps.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTimeEntry(entryId: string) {
    const entry = entries.find((item) => item.id === entryId);
    setDeletingId(entryId);
    setFormError(null);
    try {
      await deleteChantierTimeEntry(entryId);
      if (entry) {
        await recordTimeActivity({
          actionType: "deleted",
          entry,
          reason: "Saisie temps supprimée depuis le suivi des temps",
        });
      }
      setEntries((current) => current.filter((item) => item.id !== entryId));
    } catch (err: any) {
      setFormError(err?.message ?? "Erreur suppression temps.");
    } finally {
      setDeletingId(null);
    }
  }

  if (!id) {
    return <div className="rounded-surface border border-subtle bg-surface p-4 text-sm text-muted">Chantier manquant.</div>;
  }

  if (loading) {
    return <div className="rounded-surface border border-subtle bg-surface p-4 text-sm text-muted">Chargement du suivi des temps...</div>;
  }

  if (error) {
    return <div className="rounded-surface border border-danger/20 bg-danger-soft p-4 text-sm font-medium text-danger-on">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-surface border border-subtle bg-surface p-4 shadow-elevated">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="bt-caption text-muted">Pilotage temps chantier</div>
            <h1 className="bt-page-title mt-1 text-ink">{chantier?.nom ?? "Chantier"}</h1>
            <div className="bt-secondary mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted">
              <span>{chantier?.client || "Client non renseigné"}</span>
              <span>{tasks.length} tache{tasks.length > 1 ? "s" : ""}</span>
              <span>{intervenants.length} intervenant{intervenants.length > 1 ? "s" : ""}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/temps" className="bt-control inline-flex items-center rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">
              <ArrowLeft className="mr-1 inline h-4 w-4" /> Temps global
            </Link>
            <Link to={`/chantiers/${id}/execution`} className="bt-control inline-flex items-center rounded-field border border-primary/20 bg-primary-soft px-3 py-2 text-sm font-semibold text-primary-on hover:bg-selected">Taches / execution</Link>
            <Link to={`/chantiers/${id}/equipe`} className="bt-control inline-flex items-center rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">Equipe</Link>
            <Link to={`/chantiers/${id}/planning`} className="bt-control inline-flex items-center rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">Planning</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-400">Prévu</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{formatHours(plannedHours)}</div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-400">Saisi</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{formatHours(totalLogged)}</div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-400">Écart</div>
          <div className={`mt-2 text-2xl font-semibold ${totalLogged > plannedHours && plannedHours > 0 ? "text-red-700" : "text-slate-950"}`}>{formatHours(totalLogged - plannedHours)}</div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-400">Tâches à contrôler</div>
          <div className={`mt-2 text-2xl font-semibold ${timeControlStats.over > 0 ? "text-red-700" : timeControlStats.missing > 0 ? "text-amber-700" : "text-slate-950"}`}>
            {timeControlStats.over + timeControlStats.missing}
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Temps par tâche</h2>
            <p className="text-sm text-slate-500">Synthèse temps, quantité réalisée et dernier pointage pour rapprocher saisie terrain et avancement.</p>
          </div>
          <span className="text-xs font-semibold uppercase text-slate-400">
            {timeControlStats.withTime} / {taskTimeSummaries.length} avec saisie
          </span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {taskTimeSummaries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500 lg:col-span-2">
              Aucune tâche chantier à rapprocher des temps.
            </div>
          ) : taskTimeSummaries.map((summary) => (
            <article key={summary.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${summary.tone === "over" ? "border-red-200" : "border-slate-200"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-950">{summary.task ? getTaskTitle(summary.task) : "Saisies sans tâche rattachée"}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span>{summary.task?.lot || summary.task?.corps_etat || "Lot non renseigné"}</span>
                    <span>{summary.latestDate ? `Dernière saisie : ${summary.latestDate}` : "Aucune saisie"}</span>
                  </div>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(summary)}`}>
                  {summary.tone === "over" ? <AlertTriangle className="h-3 w-3" /> : null}
                  {statusLabel(summary)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-[11px] font-semibold uppercase text-slate-400">Prévu</div>
                  <div className="mt-1 font-semibold text-slate-950">{formatHours(summary.planned)}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-[11px] font-semibold uppercase text-slate-400">Saisi</div>
                  <div className="mt-1 font-semibold text-slate-950">{formatHours(summary.logged)}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-[11px] font-semibold uppercase text-slate-400">Quantité</div>
                  <div className="mt-1 font-semibold text-slate-950">{formatQuantity(summary.quantity, summary.task?.unite)}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-[11px] font-semibold uppercase text-slate-400">Pointages</div>
                  <div className="mt-1 font-semibold text-slate-950">{summary.entriesCount}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
        <form className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={(event) => { event.preventDefault(); void saveTimeEntry(); }}>
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-950"><Clock3 className="h-5 w-5" /> Saisie temps</div>
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Tache
              <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={taskId} onChange={(event) => setTaskId(event.target.value)}>
                <option value="">Choisir une tache</option>
                {tasks.map((task) => <option key={task.id} value={task.id}>{getTaskTitle(task)}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Intervenant
              <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={intervenantId} onChange={(event) => setIntervenantId(event.target.value)}>
                <option value="">Choisir un intervenant</option>
                {intervenants.map((intervenant) => <option key={intervenant.id} value={intervenant.id}>{intervenant.nom}</option>)}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">Date<input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} /></label>
              <label className="block text-sm font-medium text-slate-700">Heures<input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" inputMode="decimal" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="Ex. 3,5" /></label>
            </div>
            <label className="block text-sm font-medium text-slate-700">Quantité réalisée<input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Optionnel" /></label>
            <label className="block text-sm font-medium text-slate-700">Note<textarea className="mt-1 min-h-24 w-full rounded-xl border px-3 py-2 text-sm" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Commentaire terrain, zone ou précision" /></label>
            {formError ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div> : null}
            <button type="submit" disabled={saving || tasks.length === 0 || intervenants.length === 0} className="w-full rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
              {saving ? "Enregistrement..." : "Enregistrer le temps"}
            </button>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Temps saisis</h2>
              <p className="text-sm text-slate-500">Historique relié aux taches et aux intervenants du chantier.</p>
            </div>
            <span className="text-xs font-semibold uppercase text-slate-400">{entries.length} saisie{entries.length > 1 ? "s" : ""}</span>
          </div>

          <div className="mt-4 space-y-3">
            {entries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Aucune saisie temps sur ce chantier.</div>
            ) : entries.map((entry) => {
              const task = entry.task_id ? taskById.get(entry.task_id) : undefined;
              const intervenant = intervenantById.get(entry.intervenant_id);
              return (
                <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-950">{getTaskTitle(task)}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                        <span>{intervenant?.nom ?? "Intervenant inconnu"}</span>
                        <span>{entry.work_date}</span>
                        <span>{formatHours(entry.duration_hours)}</span>
                        {entry.quantite_realisee !== null ? <span>Quantité : {entry.quantite_realisee}</span> : null}
                      </div>
                      {entry.note ? <p className="mt-2 text-sm text-slate-600">{entry.note}</p> : null}
                    </div>
                    <button type="button" disabled={deletingId === entry.id} onClick={() => void removeTimeEntry(entry.id)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
                      <Trash2 className="h-4 w-4" /> Supprimer
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </div>
  );
}
