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
  isAdminProfile,
} from "../../services/currentUserProfile.service";

const NOTE_STATUS_OPTIONS: Array<{ value: ChantierPreparationNoteStatus; label: string }> = [
  { value: "actif", label: "Actif" },
  { value: "traite", label: "Traité" },
  { value: "archive", label: "Archivé" },
];

function formatDate(value: string | null) {
  if (!value) return "—";
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

type PreparationNotesPanelProps = {
  chantierId: string;
};

export default function PreparationNotesPanel({
  chantierId,
}: PreparationNotesPanelProps) {
  const [notes, setNotes] = useState<ChantierPreparationNoteRow[]>([]);
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [authorId, setAuthorId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<ChantierPreparationNoteStatus>("actif");

  const editingNote = useMemo(
    () => notes.find((note) => note.id === editingId) ?? null,
    [editingId, notes],
  );

  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      try {
        const profile = await getCurrentUserProfile();
        if (!alive) return;
        setCanManage(isAdminProfile(profile));
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

    async function refreshNotes() {
      setLoading(true);
      setError(null);
      try {
        const result = await listChantierPreparationNotes(chantierId);
        if (!alive) return;
        setNotes(result.notes);
        setSchemaReady(result.schemaReady);
      } catch (e: any) {
        if (!alive) return;
        setNotes([]);
        setError(e?.message ?? "Erreur chargement notes.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void refreshNotes();
    return () => {
      alive = false;
    };
  }, [chantierId]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setContent("");
    setStatus("actif");
  }

  function startEditing(note: ChantierPreparationNoteRow) {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setStatus(note.status);
  }

  async function recordNoteActivity(
    actionType: string,
    row: ChantierPreparationNoteRow,
    reason: string,
  ) {
    try {
      await appendChantierActivityLog({
        chantierId,
        actionType,
        entityType: "preparation_note",
        entityId: row.id,
        reason,
        changes: {
          title: row.title,
          status: row.status,
        },
      });
    } catch (e) {
      console.warn("[preparation-notes] activity log failed", e);
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
          author_id: authorId,
          author_name: authorName,
        });
        setNotes((current) =>
          current.map((note) => (note.id === saved.id ? saved : note)),
        );
        await recordNoteActivity("updated", saved, "Note préparation mise à jour");
      } else {
        const created = await createChantierPreparationNote({
          chantier_id: chantierId,
          title,
          content,
          status,
          author_id: authorId,
          author_name: authorName,
        });
        setNotes((current) => [created, ...current]);
        await recordNoteActivity("created", created, "Note préparation créée");
      }
      resetForm();
    } catch (e: any) {
      setError(e?.message ?? "Erreur enregistrement note.");
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
      await recordNoteActivity("deleted", note, "Note préparation supprimée");
      if (editingId === note.id) resetForm();
    } catch (e: any) {
      setNotes(before);
      setError(e?.message ?? "Erreur suppression note.");
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
          <h3 className="mt-1 text-lg font-semibold text-slate-950">
            Informations utiles à conserver
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Centralise les points importants, décisions terrain et informations à
            suivre sans les perdre dans le dashboard.
          </p>
        </div>
        {!canManage ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            Consultation seule
          </span>
        ) : null}
      </div>

      {!schemaReady ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Migration notes préparation non appliquée : le bloc reste visible mais non enregistrable.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {canManage ? (
        <form
          onSubmit={(event) => void saveNote(event)}
          className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4"
        >
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="space-y-1 text-xs text-slate-600">
              <span>Titre</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex : validation client sur l'accès côté cour"
                disabled={saving || !schemaReady}
              />
            </label>
            <label className="space-y-1 text-xs text-slate-600">
              <span>Statut</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as ChantierPreparationNoteStatus)
                }
                disabled={saving || !schemaReady}
              >
                {NOTE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
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
              placeholder="Renseigne l'information terrain, la décision prise ou le point à surveiller."
              disabled={saving || !schemaReady}
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
              disabled={saving || !schemaReady}
              className={[
                "rounded-xl px-4 py-2 text-sm font-medium",
                saving || !schemaReady
                  ? "bg-slate-300 text-slate-700"
                  : "bg-slate-900 text-white hover:bg-slate-800",
              ].join(" ")}
            >
              {saving
                ? "Enregistrement..."
                : editingNote
                  ? "Mettre à jour la note"
                  : "Créer la note"}
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
            Aucune note chantier enregistrée pour le moment.
          </div>
        ) : (
          notes.map((note) => (
            <article
              key={note.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-950">{note.title}</h4>
                    <span
                      className={[
                        "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        noteStatusBadgeClass(note.status),
                      ].join(" ")}
                    >
                      {NOTE_STATUS_OPTIONS.find((entry) => entry.value === note.status)?.label ??
                        note.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {note.author_name || "Auteur non renseigné"} ·{" "}
                    {formatDate(note.updated_at ?? note.created_at)}
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

              <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {note.content}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
