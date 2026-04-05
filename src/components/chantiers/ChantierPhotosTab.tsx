import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { appendChantierActivityLog } from "../../services/chantierActivityLog.service";
import {
  deleteChantierPhoto,
  getChantierPhotoSignedUrl,
  listChantierPhotos,
  uploadChantierPhoto,
  type ChantierPhotoRow,
  type ChantierPhotoType,
} from "../../services/chantierPhotos.service";
import type { ChantierTaskRow } from "../../services/chantierTasks.service";
import { buildChantierZonePathMap, type ChantierZoneRow } from "../../services/chantierZones.service";

type ChantierPhotosTabProps = {
  chantierId: string;
  tasks: ChantierTaskRow[];
  zones: ChantierZoneRow[];
};

const PHOTO_TYPES: Array<{ value: ChantierPhotoType; label: string }> = [
  { value: "avant", label: "Avant" },
  { value: "pendant", label: "Pendant" },
  { value: "apres", label: "Après" },
];

function photoTypeBadgeClass(type: ChantierPhotoType) {
  if (type === "avant") return "border-sky-200 bg-sky-50 text-sky-700";
  if (type === "apres") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function photoTypeLabel(type: ChantierPhotoType) {
  return PHOTO_TYPES.find((entry) => entry.value === type)?.label ?? "Pendant";
}

export default function ChantierPhotosTab({ chantierId, tasks, zones }: ChantierPhotosTabProps) {
  const [photos, setPhotos] = useState<ChantierPhotoRow[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [photoType, setPhotoType] = useState<ChantierPhotoType>("pendant");
  const [taskId, setTaskId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [takenOn, setTakenOn] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [typeFilter, setTypeFilter] = useState<"__ALL__" | ChantierPhotoType>("__ALL__");
  const [zoneFilter, setZoneFilter] = useState("");

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const zonePathById = useMemo(() => buildChantierZonePathMap(zones), [zones]);

  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      if (typeFilter !== "__ALL__" && photo.photo_type !== typeFilter) return false;
      if (zoneFilter && photo.zone_id !== zoneFilter) return false;
      return true;
    });
  }, [photos, typeFilter, zoneFilter]);

  async function refreshPhotos() {
    setLoading(true);
    setError(null);
    try {
      const result = await listChantierPhotos(chantierId);
      setPhotos(result.photos);
      setSchemaReady(result.schemaReady);
    } catch (err: any) {
      setPhotos([]);
      setError(err?.message ?? "Erreur chargement photos.");
    } finally {
      setLoading(false);
    }
  }

  async function logPhotoAction(actionType: string, row: ChantierPhotoRow, reason: string) {
    try {
      await appendChantierActivityLog({
        chantierId,
        actionType,
        entityType: "photo",
        entityId: row.id,
        reason,
        changes: {
          title: row.titre,
          photo_type: row.photo_type,
          task_id: row.task_id,
          zone_id: row.zone_id,
          taken_on: row.taken_on,
        },
      });
    } catch (err) {
      console.warn("[chantier-photos] log failed", err);
    }
  }

  useEffect(() => {
    void refreshPhotos();
  }, [chantierId]);

  useEffect(() => {
    let cancelled = false;

    async function loadUrls() {
      const missing = photos.filter((photo) => photo.storage_path && !photoUrls[photo.id]);
      if (missing.length === 0) return;

      for (const photo of missing) {
        try {
          const signedUrl = await getChantierPhotoSignedUrl(photo.storage_path, photo.storage_bucket, 180);
          if (cancelled) return;
          setPhotoUrls((current) => ({
            ...current,
            [photo.id]: signedUrl,
          }));
        } catch (err) {
          console.warn("[chantier-photos] preview url failed", err);
        }
      }
    }

    void loadUrls();
    return () => {
      cancelled = true;
    };
  }, [photos, photoUrls]);

  useEffect(() => {
    if (!taskId) return;
    const task = taskById.get(taskId);
    if (task?.zone_id) {
      setZoneId(task.zone_id);
    }
    if (task?.titre && !title.trim()) {
      setTitle(task.titre);
    }
  }, [taskById, taskId, title]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    if (nextFile && !title.trim()) {
      setTitle(nextFile.name.replace(/\.[^.]+$/, ""));
    }
  }

  async function submitPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Photo obligatoire.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const saved = await uploadChantierPhoto({
        chantierId,
        file,
        photoType,
        taskId: taskId || null,
        zoneId: zoneId || null,
        titre: title,
        description,
        takenOn: takenOn || null,
      });
      setPhotos((current) => [saved, ...current]);
      await logPhotoAction("created", saved, "Photo chantier ajoutée");

      setFile(null);
      setPhotoType("pendant");
      setTaskId("");
      setZoneId("");
      setTakenOn(new Date().toISOString().slice(0, 10));
      setTitle("");
      setDescription("");
      const fileInput = document.getElementById("chantier-photo-upload-input") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
    } catch (err: any) {
      setError(err?.message ?? "Erreur upload photo.");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(photo: ChantierPhotoRow) {
    const ok = confirm(`Supprimer la photo "${photo.titre || "Sans titre"}" ?`);
    if (!ok) return;

    const previous = photos;
    setPhotos((current) => current.filter((entry) => entry.id !== photo.id));
    setPhotoUrls((current) => {
      const next = { ...current };
      delete next[photo.id];
      return next;
    });

    try {
      await deleteChantierPhoto(photo);
      await logPhotoAction("deleted", photo, "Photo chantier supprimée");
    } catch (err: any) {
      setPhotos(previous);
      setError(err?.message ?? "Erreur suppression photo.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="font-semibold section-title">Photos chantier</div>
          <div className="text-sm text-slate-500">
            Classe les photos avant / pendant / après et rattache-les à une tâche ou à une zone.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as "__ALL__" | ChantierPhotoType)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
          >
            <option value="__ALL__">Toutes</option>
            {PHOTO_TYPES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
          <select
            value={zoneFilter}
            onChange={(event) => setZoneFilter(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
          >
            <option value="">Toutes zones</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zonePathById.get(zone.id) ?? zone.nom}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void refreshPhotos()}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Chargement..." : "Rafraîchir"}
          </button>
        </div>
      </div>

      {!schemaReady ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Migration photos chantier non appliquée sur Supabase.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={(event) => void submitPhoto(event)} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="text-sm font-semibold text-slate-900">Ajouter une photo chantier</div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <label className="space-y-1 text-xs text-slate-600">
            <div>Fichier image</div>
            <input
              id="chantier-photo-upload-input"
              type="file"
              accept="image/*"
              onChange={onFileChange}
              disabled={uploading || !schemaReady}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            />
          </label>

          <label className="space-y-1 text-xs text-slate-600">
            <div>Type</div>
            <select
              value={photoType}
              onChange={(event) => setPhotoType(event.target.value as ChantierPhotoType)}
              disabled={uploading || !schemaReady}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            >
              {PHOTO_TYPES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-600">
            <div>Date photo</div>
            <input
              type="date"
              value={takenOn}
              onChange={(event) => setTakenOn(event.target.value)}
              disabled={uploading || !schemaReady}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            />
          </label>

          <label className="space-y-1 text-xs text-slate-600">
            <div>Tâche</div>
            <select
              value={taskId}
              onChange={(event) => setTaskId(event.target.value)}
              disabled={uploading || !schemaReady}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            >
              <option value="">Aucune tâche</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.titre}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-600">
            <div>Zone</div>
            <select
              value={zoneId}
              onChange={(event) => setZoneId(event.target.value)}
              disabled={uploading || !schemaReady}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            >
              <option value="">Aucune zone</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zonePathById.get(zone.id) ?? zone.nom}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-600">
            <div>Titre court</div>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={uploading || !schemaReady}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              placeholder="Ex : Cloison avant reprise"
            />
          </label>
        </div>

        <label className="mt-3 block space-y-1 text-xs text-slate-600">
          <div>Description</div>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={uploading || !schemaReady}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            placeholder="Commentaire terrain, contrôle, détail..."
          />
        </label>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={uploading || !schemaReady}
            className={[
              "rounded-2xl px-5 py-3 text-sm font-medium",
              uploading || !schemaReady
                ? "bg-slate-200 text-slate-500"
                : "bg-blue-600 text-white hover:bg-blue-700",
            ].join(" ")}
          >
            {uploading ? "Upload..." : "+ Ajouter photo"}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
          Chargement des photos...
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
          Aucune photo chantier.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPhotos.map((photo) => {
            const linkedTask = photo.task_id ? taskById.get(photo.task_id) : null;
            const linkedZone = photo.zone_id ? zonePathById.get(photo.zone_id) ?? null : null;
            const previewUrl = photoUrls[photo.id];

            return (
              <article
                key={photo.id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="aspect-[4/3] bg-slate-100">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={photo.titre || "Photo chantier"}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">
                      Aperçu indisponible
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={[
                        "rounded-full border px-2 py-1 text-[11px] font-semibold",
                        photoTypeBadgeClass(photo.photo_type),
                      ].join(" ")}
                    >
                      {photoTypeLabel(photo.photo_type)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                      {new Date(`${photo.taken_on}T00:00:00`).toLocaleDateString("fr-FR")}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-slate-950">
                    {photo.titre || linkedTask?.titre || "Photo chantier"}
                  </div>

                  {photo.description ? (
                    <div className="text-sm text-slate-600">{photo.description}</div>
                  ) : null}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {linkedTask ? <span>Tâche : {linkedTask.titre}</span> : null}
                    {linkedZone ? <span>Zone : {linkedZone}</span> : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => void removePhoto(photo)}
                    className="rounded-2xl border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
