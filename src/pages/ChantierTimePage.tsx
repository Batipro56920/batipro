import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock3, Trash2 } from "lucide-react";

import { getChantierById, type ChantierRow } from "../services/chantiers.service";
import { getTasksByChantierIdDetailed, type ChantierTaskRow } from "../services/chantierTasks.service";
import { listIntervenantsByChantierId, type IntervenantRow } from "../services/intervenants.service";
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

function getTaskTitle(task: ChantierTaskRow | undefined) {
  return task?.titre_terrain?.trim() || task?.titre?.trim() || "Tache chantier";
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
      await createChantierTimeEntry({
        chantier_id: id,
        task_id: taskId,
        intervenant_id: intervenantId,
        work_date: workDate,
        duration_hours: duration,
        quantite_realisee: doneQuantity,
        note: note.trim() || null,
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
    setDeletingId(entryId);
    setFormError(null);
    try {
      await deleteChantierTimeEntry(entryId);
      setEntries((current) => current.filter((entry) => entry.id !== entryId));
    } catch (err: any) {
      setFormError(err?.message ?? "Erreur suppression temps.");
    } finally {
      setDeletingId(null);
    }
  }

  if (!id) {
    return <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">Chantier manquant.</div>;
  }

  if (loading) {
    return <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Chargement du suivi des temps...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Pilotage temps chantier</div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">{chantier?.nom ?? "Chantier"}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              <span>{chantier?.client || "Client non renseigné"}</span>
              <span>{tasks.length} tache{tasks.length > 1 ? "s" : ""}</span>
              <span>{intervenants.length} intervenant{intervenants.length > 1 ? "s" : ""}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/temps" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <ArrowLeft className="mr-1 inline h-4 w-4" /> Temps global
            </Link>
            <Link to={`/chantiers/${id}/execution`} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100">Taches / execution</Link>
            <Link to={`/chantiers/${id}/equipe`} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100">Equipe</Link>
            <Link to={`/chantiers/${id}/planning`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Planning</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
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
