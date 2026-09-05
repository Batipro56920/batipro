import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createChantierChangeOrder,
  deleteChantierChangeOrder,
  getChangeOrderStatusOptions,
  listChantierChangeOrders,
  updateChantierChangeOrder,
  type ChantierChangeOrderRow,
  type ChantierChangeOrderStatus,
} from "../../services/chantierChangeOrders.service";
import { listChantierPhotos, type ChantierPhotoRow } from "../../services/chantierPhotos.service";
import { getCurrentUserProfile, isAdminProfile } from "../../services/currentUserProfile.service";
import type { ChantierTaskRow } from "../../services/chantierTasks.service";
import { buildChantierZonePathMap, type ChantierZoneRow } from "../../services/chantierZones.service";

type PilotageTabProps = {
  chantierId: string;
  tasks: ChantierTaskRow[];
  zones: ChantierZoneRow[];
};

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}

function formatMoney(value: number) {
  return `${formatNumber(value)} EUR`;
}

function resolveTaskTitle(task: ChantierTaskRow | undefined) {
  return String((task as any)?.titre_terrain ?? task?.titre ?? "").trim() || "Tache chantier";
}

function resolvePhotoTitle(photo: ChantierPhotoRow | undefined) {
  return String(photo?.titre ?? photo?.description ?? "").trim() || "Photo chantier";
}

function statusBadgeClass(status: ChantierChangeOrderStatus) {
  if (status === "traite") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "en_cours") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function PilotageTab({ chantierId, tasks, zones }: PilotageTabProps) {
  const [searchParams] = useSearchParams();
  const targetedChangeOrderId = searchParams.get("changeOrderId") ?? "";
  const targetedChangeOrderRef = useRef<HTMLElement | null>(null);
  const [rows, setRows] = useState<ChantierChangeOrderRow[]>([]);
  const [photos, setPhotos] = useState<ChantierPhotoRow[]>([]);
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [status, setStatus] = useState<ChantierChangeOrderStatus>("a_analyser");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [impactTemps, setImpactTemps] = useState("");
  const [impactCout, setImpactCout] = useState("");

  const zonePathById = useMemo(() => buildChantierZonePathMap(zones), [zones]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const photoById = useMemo(() => new Map(photos.map((photo) => [photo.id, photo])), [photos]);
  const editingRow = useMemo(() => rows.find((row) => row.id === editingId) ?? null, [rows, editingId]);
  const targetedChangeOrder = useMemo(() => rows.find((row) => row.id === targetedChangeOrderId) ?? null, [rows, targetedChangeOrderId]);
  const targetedChangeOrderMissing = Boolean(targetedChangeOrderId && !loading && !targetedChangeOrder);

  useEffect(() => {
    let alive = true;
    void getCurrentUserProfile().then((profile) => alive && setCanManage(isAdminProfile(profile))).catch(() => alive && setCanManage(false));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    async function refresh() {
      setLoading(true);
      setError(null);
      try {
        const [changeOrdersResult, photosResult] = await Promise.all([
          listChantierChangeOrders(chantierId),
          listChantierPhotos(chantierId),
        ]);
        if (!alive) return;
        setRows(changeOrdersResult.changeOrders);
        setSchemaReady(changeOrdersResult.schemaReady);
        setPhotos(photosResult.photos);
      } catch (e: any) {
        if (!alive) return;
        setRows([]);
        setPhotos([]);
        setError(e?.message ?? "Erreur chargement imprevus.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void refresh();
    return () => { alive = false; };
  }, [chantierId]);

  useEffect(() => {
    if (!targetedChangeOrderId || !targetedChangeOrder || loading) return;
    const frame = window.requestAnimationFrame(() => {
      targetedChangeOrderRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, targetedChangeOrder, targetedChangeOrderId]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setZoneId("");
    setTaskId("");
    setStatus("a_analyser");
    setSelectedPhotoIds([]);
    setImpactTemps("");
    setImpactCout("");
  }

  function startEditing(row: ChantierChangeOrderRow) {
    setEditingId(row.id);
    setTitle(row.titre);
    setDescription(row.description ?? "");
    setZoneId(row.zone_id ?? "");
    setTaskId(row.task_id ?? "");
    setStatus(row.statut);
    setSelectedPhotoIds(row.photo_ids ?? []);
    setImpactTemps(String(row.impact_temps_h || ""));
    setImpactCout(String(row.impact_cout_ht || ""));
  }

  async function saveRow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        chantier_id: chantierId,
        titre: title,
        description,
        zone_id: zoneId || null,
        task_id: taskId || null,
        photo_ids: selectedPhotoIds,
        impact_temps_h: impactTemps,
        impact_cout_ht: impactCout,
        statut: status,
      };
      if (editingRow) {
        const saved = await updateChantierChangeOrder(editingRow.id, payload);
        setRows((current) => current.map((row) => (row.id === saved.id ? saved : row)));
      } else {
        const created = await createChantierChangeOrder(payload);
        setRows((current) => [created, ...current]);
      }
      resetForm();
    } catch (e: any) {
      setError(e?.message ?? "Erreur enregistrement imprevu.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row: ChantierChangeOrderRow) {
    if (!canManage) return;
    if (!window.confirm(`Supprimer \"${row.titre}\" ?`)) return;
    const before = rows;
    setProcessingId(row.id);
    setRows((current) => current.filter((entry) => entry.id !== row.id));
    try {
      await deleteChantierChangeOrder(row.id);
      if (editingId === row.id) resetForm();
    } catch (e: any) {
      setRows(before);
      setError(e?.message ?? "Erreur suppression imprevu.");
    } finally {
      setProcessingId(null);
    }
  }

  async function changeStatus(row: ChantierChangeOrderRow, nextStatus: ChantierChangeOrderStatus) {
    if (!canManage || row.statut === nextStatus) return;
    const before = rows;
    setProcessingId(row.id);
    setRows((current) => current.map((entry) => (entry.id === row.id ? { ...entry, statut: nextStatus } : entry)));
    try {
      const saved = await updateChantierChangeOrder(row.id, { statut: nextStatus });
      setRows((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
    } catch (e: any) {
      setRows(before);
      setError(e?.message ?? "Erreur mise a jour statut.");
    } finally {
      setProcessingId(null);
    }
  }

  function togglePhoto(photoId: string) {
    setSelectedPhotoIds((current) => current.includes(photoId) ? current.filter((id) => id !== photoId) : [...current, photoId]);
  }

  const statusOptions = getChangeOrderStatusOptions("imprevu");
  const perteBudget = rows.reduce((sum, row) => sum + Number(row.impact_cout_ht ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Pilotage</div>
          <h2 className="mt-1 text-base font-semibold text-slate-950">Imprévus</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">Suivi des écarts chantier pour mesurer leur impact financier (temps perdu, surcoût).</p>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Imprévus</div><div className="mt-1.5 text-base font-semibold text-slate-950">{rows.length}</div><div className="mt-0.5 text-xs text-slate-500">Perte estimée {formatMoney(perteBudget)}</div></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Règle</div><div className="mt-1.5 text-sm font-semibold text-slate-950">Les travaux supplémentaires se traitent via un devis rattaché au chantier.</div></div>
      </section>

      {!schemaReady ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">Migration imprevus non appliquee.</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {targetedChangeOrderId ? (
        <div className={[
          "rounded-2xl border px-4 py-3 text-sm",
          targetedChangeOrderMissing ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900",
        ].join(" ")}>
          <div className="font-semibold">
            {targetedChangeOrderMissing ? "Imprevu introuvable" : "Imprevu cible depuis la recherche globale"}
          </div>
          <div className={targetedChangeOrderMissing ? "mt-1 text-amber-800" : "mt-1 text-blue-800"}>
            {targetedChangeOrderMissing
              ? "Le lien pointe vers un element supprime ou non accessible avec les droits actuels."
              : `${targetedChangeOrder?.titre ?? "L'element"} est affiche dans le suivi ci-dessous.`}
          </div>
        </div>
      ) : null}

      {canManage ? (
        <form onSubmit={(event) => void saveRow(event)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre" disabled={saving || !schemaReady} />
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" value={status} onChange={(event) => setStatus(event.target.value as ChantierChangeOrderStatus)} disabled={saving || !schemaReady}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" value={zoneId} onChange={(event) => setZoneId(event.target.value)} disabled={saving || !schemaReady}><option value="">Sans localisation</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zonePathById.get(zone.id) ?? zone.nom}</option>)}</select>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" value={taskId} onChange={(event) => setTaskId(event.target.value)} disabled={saving || !schemaReady}><option value="">Sans tache</option>{tasks.map((task) => <option key={task.id} value={task.id}>{resolveTaskTitle(task)}</option>)}</select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" inputMode="decimal" value={impactTemps} onChange={(event) => setImpactTemps(event.target.value)} placeholder="Temps perdu estime (h)" disabled={saving || !schemaReady} />
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" inputMode="decimal" value={impactCout} onChange={(event) => setImpactCout(event.target.value)} placeholder="Impact budget HT" disabled={saving || !schemaReady} />
          </div>
          {photos.length > 0 ? <div className="flex flex-wrap gap-2">{photos.slice(0, 12).map((photo) => <button key={photo.id} type="button" onClick={() => togglePhoto(photo.id)} className={["rounded-full border px-3 py-1 text-xs", selectedPhotoIds.includes(photo.id) ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600"].join(" ")} disabled={saving || !schemaReady}>{resolvePhotoTitle(photo)}</button>)}</div> : null}
          <textarea className="min-h-[110px] w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description de l'imprevu" disabled={saving || !schemaReady} />
          <div className="flex justify-end gap-2">{editingRow ? <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" disabled={saving}>Annuler</button> : null}<button type="submit" disabled={saving || !schemaReady} className={["rounded-xl px-4 py-2 text-sm font-medium", saving || !schemaReady ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800"].join(" ")}>{saving ? "Enregistrement..." : editingRow ? "Mettre a jour" : "Creer"}</button></div>
        </form>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-slate-950">Suivi</h3>
        <div className="mt-4 space-y-3">{loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Chargement...</div> : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Aucun imprevu.</div> : rows.map((row) => { const options = getChangeOrderStatusOptions("imprevu"); const isTargeted = row.id === targetedChangeOrderId; return <article key={row.id} ref={(node) => { if (isTargeted) targetedChangeOrderRef.current = node; }} className={["rounded-2xl border bg-slate-50 p-4", isTargeted ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"].join(" ")}><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold text-slate-950">{row.titre}</h4>{isTargeted ? <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Cible recherche</span> : null}<span className={["rounded-full border px-2 py-0.5 text-[11px] font-semibold", statusBadgeClass(row.statut)].join(" ")}>{options.find((option) => option.value === row.statut)?.label ?? row.statut}</span></div><div className="mt-1 text-xs text-slate-500">{row.zone_id ? zonePathById.get(row.zone_id) ?? "Sans zone" : "Sans zone"} · {row.task_id ? resolveTaskTitle(taskById.get(row.task_id)) : "Sans tache"}</div></div>{canManage ? <div className="flex flex-wrap gap-2"><button type="button" onClick={() => startEditing(row)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" disabled={processingId === row.id}>Modifier</button><button type="button" onClick={() => void removeRow(row)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100" disabled={processingId === row.id}>{processingId === row.id ? "Traitement..." : "Supprimer"}</button></div> : null}</div>{row.description ? <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{row.description}</div> : null}<div className="mt-4 grid gap-2 md:grid-cols-3"><div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">Photos : <span className="font-semibold text-slate-950">{row.photo_ids.length}</span></div><div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">Temps perdu : <span className="font-semibold text-slate-950">+{formatNumber(row.impact_temps_h)} h</span></div><div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">Impact budget : <span className="font-semibold text-slate-950">{formatMoney(row.impact_cout_ht)}</span></div></div>{row.photo_ids.length > 0 ? <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">{row.photo_ids.slice(0, 4).map((photoId) => <span key={photoId} className="rounded-full border border-slate-200 bg-white px-3 py-1">{resolvePhotoTitle(photoById.get(photoId))}</span>)}</div> : null}<div className="mt-4 flex flex-wrap gap-2">{canManage ? <select value={row.statut} onChange={(event) => void changeStatus(row, event.target.value as ChantierChangeOrderStatus)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500" disabled={processingId === row.id}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : null}</div></article>; })}</div>
      </section>
    </div>
  );
}
