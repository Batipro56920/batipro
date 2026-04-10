import { useEffect, useMemo, useState, type FormEvent } from "react";

import { appendChantierActivityLog } from "../../services/chantierActivityLog.service";
import {
  createChantierPreparationNote,
  deleteChantierPreparationNote,
  listChantierPreparationNotes,
  updateChantierPreparationNote,
  type ChantierPreparationNoteRow,
  type ChantierPreparationNoteStatus,
} from "../../services/chantierPreparationNotes.service";
import {
  getCurrentUserProfile,
} from "../../services/currentUserProfile.service";
import {
  listChantierChangeOrders,
  type ChantierChangeOrderRow,
} from "../../services/chantierChangeOrders.service";
import type { ChantierDocumentRow } from "../../services/chantierDocuments.service";
import type { ChantierTaskRow } from "../../services/chantierTasks.service";
import { buildChantierZonePathMap, type ChantierZoneRow } from "../../services/chantierZones.service";

const NOTE_STATUS_OPTIONS: Array<{ value: ChantierPreparationNoteStatus; label: string }> = [
  { value: "actif", label: "Actif" },
  { value: "traite", label: "Traite" },
  { value: "archive", label: "Archive" },
];

type PreparationNotesPanelProps = {
  chantierId: string;
  tasks: ChantierTaskRow[];
  zones: ChantierZoneRow[];
  documents: ChantierDocumentRow[];
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function noteStatusBadgeClass(status: ChantierPreparationNoteStatus) {
  if (status === "traite") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "archive") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function resolveTaskTitle(task: ChantierTaskRow | undefined) {
  return String((task as any)?.titre_terrain ?? task?.titre ?? "").trim() || "Tache chantier";
}

function resolveDocumentTitle(document: ChantierDocumentRow | undefined) {
  return String(document?.title ?? "").trim() || "Document chantier";
}

function resolveChangeOrderTitle(changeOrder: ChantierChangeOrderRow | undefined) {
  return String(changeOrder?.titre ?? "").trim() || "Imprevu / TS";
}

export default function PreparationNotesPanel({
  chantierId,
  tasks,
  zones,
  documents,
}: PreparationNotesPanelProps) {
  const [notes, setNotes] = useState<ChantierPreparationNoteRow[]>([]);
  const [notesSchemaReady, setNotesSchemaReady] = useState(true);
  const [linksSchemaReady, setLinksSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [changeOrders, setChangeOrders] = useState<ChantierChangeOrderRow[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<ChantierPreparationNoteStatus>("actif");
  const [taskId, setTaskId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [changeOrderId, setChangeOrderId] = useState("");
  const [documentId, setDocumentId] = useState("");

  const zonePathById = useMemo(() => buildChantierZonePathMap(zones), [zones]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const documentById = useMemo(() => new Map(documents.map((document) => [document.id, document])), [documents]);
  const changeOrderById = useMemo(() => new Map(changeOrders.map((row) => [row.id, row])), [changeOrders]);
  const editingNote = useMemo(() => notes.find((note) => note.id === editingId) ?? null, [editingId, notes]);

  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      try {
        const profile = await getCurrentUserProfile();
        if (!alive) return;
        setCanManage(Boolean(profile?.id));
        setAuthorName(profile?.display_name ?? null);
        setAuthorId(profile?.id ?? null);
      } catch {
        if (!alive) return;
        setCanManage(false);
        setAuthorName(null);
        setAuthorId(null);
      }
    }

    void loadProfile();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function refreshData() {
      setLoading(true);
      setError(null);
      try {
        const [notesResult, changeOrdersResult] = await Promise.all([
          listChantierPreparationNotes(chantierId),
          listChantierChangeOrders(chantierId),
        ]);

        if (!alive) return;
        setNotes(notesResult.notes);
        setNotesSchemaReady(notesResult.schemaReady);
        setChangeOrders(changeOrdersResult.changeOrders);
        setLinksSchemaReady(notesResult.schemaReady && changeOrdersResult.schemaReady);
      } catch (e: any) {
        if (!alive) return;
        setNotes([]);
        setChangeOrders([]);
        setError(e?.message ?? "Erreur chargement notes chantier.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void refreshData();
    return () => {
      alive = false;
    };
  }, [chantierId]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setContent("");
    setStatus("actif");
    setTaskId("");
    setZoneId("");
    setChangeOrderId("");
    setDocumentId("");
  }

  function startEditing(note: ChantierPreparationNoteRow) {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setStatus(note.status);
    setTaskId(note.task_id ?? "");
    setZoneId(note.zone_id ?? "");
    setChangeOrderId(note.change_order_id ?? "");
    setDocumentId(note.document_id ?? "");
  }

  async function recordNoteActivity(actionType: string, row: ChantierPreparationNoteRow, reason: string) {
    try {
      await appendChantierActivityLog({
        chantierId,
        actionType,
        entityType: "chantier_note",
        entityId: row.id,
        reason,
        changes: {
          title: row.title,
          status: row.status,
          task_id: row.task_id,
          zone_id: row.zone_id,
          change_order_id: row.change_order_id,
          document_id: row.document_id,
        },
      });
    } catch (e) {
      console.warn("[chantier-notes] activity log failed", e);
    }
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;

    setSaving(true);
    setError(null);
    try {
      if (editingNote) {
        const saved = await updateChantierPreparationNote(editingNote.id, {
          title,
          content,
          status,
          task_id: taskId || null,
          zone_id: zoneId || null,
          change_order_id: changeOrderId || null,
          document_id: documentId || null,
          author_id: authorId,
          author_name: authorName,
        });
        setNotes((current) => current.map((note) => (note.id === saved.id ? saved : note)));
        await recordNoteActivity("updated", saved, "Note chantier mise a jour");
      } else {
        const created = await createChantierPreparationNote({
          chantier_id: chantierId,
          title,
          content,
          status,
          task_id: taskId || null,
          zone_id: zoneId || null,
          change_order_id: changeOrderId || null,
          document_id: documentId || null,
          author_id: authorId,
          author_name: authorName,
        });
        setNotes((current) => [created, ...current]);
        await recordNoteActivity("created", created, "Note chantier creee");
      }
      resetForm();
    } catch (e: any) {
      setError(e?.message ?? "Erreur enregistrement note chantier.");
    } finally {
      setSaving(false);
    }
  }

  async function removeNote(note: ChantierPreparationNoteRow) {
    if (!canManage) return;
    if (!window.confirm(`Supprimer la note "${note.title}" ?`)) return;

    const before = notes;
    setDeletingId(note.id);
    setNotes((current) => current.filter((entry) => entry.id !== note.id));
    setError(null);
    try {
      await deleteChantierPreparationNote(note.id);
      await recordNoteActivity("deleted", note, "Note chantier supprimee");
      if (editingId === note.id) resetForm();
    } catch (e: any) {
      setNotes(before);
      setError(e?.message ?? "Erreur suppression note chantier.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Notes chantier
          </div>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">Suivi terrain et informations utiles</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Centralise les points bloquants, consignes internes et suivis ponctuels relies au chantier.
          </p>
        </div>
        {!canManage ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            Consultation seule
          </span>
        ) : null}
      </div>

      {!notesSchemaReady ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Migration notes chantier non appliquee : consultation OK, edition bloquee.
        </div>
      ) : null}

      {!linksSchemaReady ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Les liaisons tache / zone / document / imprevu ne sont pas toutes disponibles tant que la migration n'est pas appliquee.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {canManage ? (
        <form onSubmit={(event) => void saveNote(event)} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="space-y-1 text-xs text-slate-600">
              <span>Titre</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex : validation client sur l'acces cour"
                disabled={saving || !notesSchemaReady}
              />
            </label>
            <label className="space-y-1 text-xs text-slate-600">
              <span>Statut</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                value={status}
                onChange={(event) => setStatus(event.target.value as ChantierPreparationNoteStatus)}
                disabled={saving || !notesSchemaReady}
              >
                {NOTE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 text-xs text-slate-600">
              <span>Tache</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                value={taskId}
                onChange={(event) => setTaskId(event.target.value)}
                disabled={saving || !notesSchemaReady}
              >
                <option value="">Sans tache</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {resolveTaskTitle(task)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs text-slate-600">
              <span>Zone</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                value={zoneId}
                onChange={(event) => setZoneId(event.target.value)}
                disabled={saving || !notesSchemaReady}
              >
                <option value="">Sans zone</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zonePathById.get(zone.id) ?? zone.nom}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs text-slate-600">
              <span>Imprevu / TS</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                value={changeOrderId}
                onChange={(event) => setChangeOrderId(event.target.value)}
                disabled={saving || !notesSchemaReady}
              >
                <option value="">Sans lien</option>
                {changeOrders.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.titre}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs text-slate-600">
              <span>Document</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                value={documentId}
                onChange={(event) => setDocumentId(event.target.value)}
                disabled={saving || !notesSchemaReady}
              >
                <option value="">Sans document</option>
                {documents.map((document) => (
                  <option key={document.id} value={document.id}>
                    {resolveDocumentTitle(document)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-3 block space-y-1 text-xs text-slate-600">
            <span>Contenu</span>
            <textarea
              className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-500"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Renseigne l'information terrain, la decision prise ou le point a suivre."
              disabled={saving || !notesSchemaReady}
            />
          </label>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {editingNote ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                disabled={saving}
              >
                Annuler
              </button>
            ) : null}
            <button
              type="submit"
              disabled={saving || !notesSchemaReady}
              className={[
                "rounded-xl px-4 py-2 text-sm font-medium",
                saving || !notesSchemaReady ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
              ].join(" ")}
            >
              {saving ? "Enregistrement..." : editingNote ? "Mettre a jour la note" : "Creer la note"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Chargement des notes...
          </div>
        ) : notes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Aucune note chantier enregistree pour le moment.
          </div>
        ) : (
          notes.map((note) => {
            const linkedChangeOrder = note.change_order_id ? changeOrderById.get(note.change_order_id) : undefined;
            const linkedTask = note.task_id ? taskById.get(note.task_id) : undefined;
            const linkedDocument = note.document_id ? documentById.get(note.document_id) : undefined;
            return (
              <article key={note.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-950">{note.title}</h4>
                      <span className={["rounded-full border px-2 py-0.5 text-[11px] font-semibold", noteStatusBadgeClass(note.status)].join(" ")}>
                        {NOTE_STATUS_OPTIONS.find((entry) => entry.value === note.status)?.label ?? note.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {note.author_name || "Auteur non renseigne"} · {formatDate(note.updated_at ?? note.created_at)}
                    </div>
                  </div>

                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(note)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        disabled={deletingId === note.id}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeNote(note)}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
                        disabled={deletingId === note.id}
                      >
                        {deletingId === note.id ? "Suppression..." : "Supprimer"}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.content}</div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                  {linkedTask ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Tache: {resolveTaskTitle(linkedTask)}</span>
                  ) : null}
                  {note.zone_id ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Zone: {zonePathById.get(note.zone_id) ?? "Zone chantier"}</span>
                  ) : null}
                  {linkedChangeOrder ? (
                    <span className={["rounded-full border px-3 py-1", linkedChangeOrder.type_ecart === "travaux_supplementaires" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"].join(" ")}>{linkedChangeOrder.type_ecart === "travaux_supplementaires" ? "TS" : "Imprevu"}: {resolveChangeOrderTitle(linkedChangeOrder)}</span>
                  ) : null}
                  {linkedDocument ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Document: {resolveDocumentTitle(linkedDocument)}</span>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

