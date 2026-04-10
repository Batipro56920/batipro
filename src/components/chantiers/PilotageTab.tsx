import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  createChantierChangeOrder,
  deleteChantierChangeOrder,
  getChangeOrderStatusOptions,
  listChantierChangeOrders,
  normalizeChangeOrderType,
  updateChantierChangeOrder,
  type ChantierChangeOrderRow,
  type ChantierChangeOrderStatus,
  type ChantierChangeOrderType,
} from "../../services/chantierChangeOrders.service";
import { listChantierPhotos, type ChantierPhotoRow } from "../../services/chantierPhotos.service";
import { createDevis, createDevisLigne, listDevisByChantier } from "../../services/devis.service";
import { getCurrentUserProfile, isAdminProfile } from "../../services/currentUserProfile.service";
import { createTask, type ChantierTaskRow } from "../../services/chantierTasks.service";
import { buildChantierZonePathMap, type ChantierZoneRow } from "../../services/chantierZones.service";

type PilotageTabProps = {
  chantierId: string;
  tasks: ChantierTaskRow[];
  zones: ChantierZoneRow[];
};

type ChangeOrderFilter = "all" | ChantierChangeOrderType;

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

function typeBadgeClass(type: ChantierChangeOrderType) {
  return type === "travaux_supplementaires"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function statusBadgeClass(type: ChantierChangeOrderType, status: ChantierChangeOrderStatus) {
  if (type === "travaux_supplementaires") {
    if (["valide_client", "termine", "facture"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (status === "refuse") return "border-red-200 bg-red-50 text-red-700";
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (status === "traite") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "en_cours") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function PilotageTab({ chantierId, tasks, zones }: PilotageTabProps) {
  const [rows, setRows] = useState<ChantierChangeOrderRow[]>([]);
  const [photos, setPhotos] = useState<ChantierPhotoRow[]>([]);
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [filterType, setFilterType] = useState<ChangeOrderFilter>("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [typeEcart, setTypeEcart] = useState<ChantierChangeOrderType>("imprevu");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [status, setStatus] = useState<ChantierChangeOrderStatus>("a_analyser");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [impactTemps, setImpactTemps] = useState("");
  const [impactCout, setImpactCout] = useState("");
  const [quantite, setQuantite] = useState("");
  const [unite, setUnite] = useState("forfait");
  const [prixUnitaireHt, setPrixUnitaireHt] = useState("");
  const [tvaRate, setTvaRate] = useState("20");

  const zonePathById = useMemo(() => buildChantierZonePathMap(zones), [zones]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const photoById = useMemo(() => new Map(photos.map((photo) => [photo.id, photo])), [photos]);
  const editingRow = useMemo(() => rows.find((row) => row.id === editingId) ?? null, [rows, editingId]);
  const filteredRows = useMemo(() => rows.filter((row) => filterType === "all" || normalizeChangeOrderType(row.type_ecart) === filterType), [rows, filterType]);
  const imprevus = useMemo(() => rows.filter((row) => normalizeChangeOrderType(row.type_ecart) === "imprevu"), [rows]);
  const tsRows = useMemo(() => rows.filter((row) => normalizeChangeOrderType(row.type_ecart) === "travaux_supplementaires"), [rows]);

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
        setError(e?.message ?? "Erreur chargement imprevus / TS.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void refresh();
    return () => { alive = false; };
  }, [chantierId]);

  useEffect(() => {
    const options = getChangeOrderStatusOptions(typeEcart);
    if (!options.some((option) => option.value === status)) {
      setStatus(options[0]?.value ?? (typeEcart === "travaux_supplementaires" ? "a_chiffrer" : "a_analyser"));
    }
  }, [status, typeEcart]);

  function resetForm() {
    setEditingId(null);
    setTypeEcart("imprevu");
    setTitle("");
    setDescription("");
    setZoneId("");
    setTaskId("");
    setStatus("a_analyser");
    setSelectedPhotoIds([]);
    setImpactTemps("");
    setImpactCout("");
    setQuantite("");
    setUnite("forfait");
    setPrixUnitaireHt("");
    setTvaRate("20");
  }

  function startEditing(row: ChantierChangeOrderRow) {
    const nextType = normalizeChangeOrderType(row.type_ecart);
    setEditingId(row.id);
    setTypeEcart(nextType);
    setTitle(row.titre);
    setDescription(row.description ?? "");
    setZoneId(row.zone_id ?? "");
    setTaskId(row.task_id ?? "");
    setStatus(row.statut);
    setSelectedPhotoIds(row.photo_ids ?? []);
    setImpactTemps(String(row.impact_temps_h || ""));
    setImpactCout(String(row.impact_cout_ht || ""));
    setQuantite(String(row.quantite || ""));
    setUnite(row.unite ?? "forfait");
    setPrixUnitaireHt(String(row.prix_unitaire_ht || ""));
    setTvaRate(String(row.tva_rate || "20"));
  }

  async function saveRow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        chantier_id: chantierId,
        type_ecart: typeEcart,
        titre: title,
        description,
        zone_id: zoneId || null,
        task_id: taskId || null,
        photo_ids: selectedPhotoIds,
        impact_temps_h: impactTemps,
        impact_cout_ht: impactCout,
        quantite,
        unite,
        prix_unitaire_ht: prixUnitaireHt,
        tva_rate: tvaRate,
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
      setError(e?.message ?? "Erreur enregistrement imprevu / TS.");
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
      setError(e?.message ?? "Erreur suppression imprevu / TS.");
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

  async function createLinkedTask(row: ChantierChangeOrderRow) {
    if (!canManage || row.task_id) return;
    setProcessingId(row.id);
    try {
      const task = await createTask({
        chantier_id: chantierId,
        titre: row.titre,
        titre_terrain: row.titre,
        description_technique: row.description ?? null,
        zone_id: row.zone_id ?? null,
        temps_prevu_h: normalizeChangeOrderType(row.type_ecart) === "imprevu" ? row.impact_temps_h : null,
        montant_total_devis_ht: normalizeChangeOrderType(row.type_ecart) === "travaux_supplementaires" ? row.total_ht : null,
        status: "A_FAIRE",
      });
      const saved = await updateChantierChangeOrder(row.id, { task_id: task.id });
      setRows((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
    } catch (e: any) {
      setError(e?.message ?? "Erreur creation tache liee.");
    } finally {
      setProcessingId(null);
    }
  }

  async function createAvenant(row: ChantierChangeOrderRow) {
    if (!canManage || normalizeChangeOrderType(row.type_ecart) !== "travaux_supplementaires" || row.devis_ligne_id) return;
    setProcessingId(row.id);
    try {
      const devisList = await listDevisByChantier(chantierId);
      const targetDevis = devisList[0] ?? (await createDevis({ chantier_id: chantierId, nom: "Avenants chantier" }));
      const task = row.task_id ? taskById.get(row.task_id) : undefined;
      const devisLigne = await createDevisLigne({
        devis_id: targetDevis.id,
        designation: row.titre,
        corps_etat: task?.lot ?? task?.corps_etat ?? "Travaux supplementaires",
        quantite: row.quantite || 1,
        unite: row.unite ?? "forfait",
        prix_unitaire_ht: row.prix_unitaire_ht || row.total_ht || row.impact_cout_ht,
        tva_rate: row.tva_rate || 20,
        generer_tache: false,
        titre_tache: task ? resolveTaskTitle(task) : row.titre,
      });
      const saved = await updateChantierChangeOrder(row.id, {
        devis_ligne_id: devisLigne.id,
        statut: row.statut === "a_chiffrer" ? "en_attente_validation_client" : row.statut,
      });
      setRows((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
    } catch (e: any) {
      setError(e?.message ?? "Erreur creation avenant.");
    } finally {
      setProcessingId(null);
    }
  }

  function togglePhoto(photoId: string) {
    setSelectedPhotoIds((current) => current.includes(photoId) ? current.filter((id) => id !== photoId) : [...current, photoId]);
  }

  const currentStatusOptions = getChangeOrderStatusOptions(typeEcart);
  const perteBudget = imprevus.reduce((sum, row) => sum + Number(row.impact_cout_ht ?? 0), 0);
  const tsValidesHt = tsRows.filter((row) => ["valide_client", "en_cours", "termine", "facture"].includes(row.statut)).reduce((sum, row) => sum + Number(row.total_ht ?? row.impact_cout_ht ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Pilotage</div>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Imprevus / Travaux supplementaires</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">Un seul module pour distinguer les pertes internes chantier des travaux a refacturer au client.</p>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Imprevus</div><div className="mt-2 text-2xl font-semibold text-slate-950">{imprevus.length}</div><div className="mt-1 text-xs text-slate-500">Perte estimee {formatMoney(perteBudget)}</div></div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Travaux supplementaires</div><div className="mt-2 text-2xl font-semibold text-slate-950">{tsRows.length}</div><div className="mt-1 text-xs text-slate-500">Potentiel facture {formatMoney(tsValidesHt)}</div></div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Regle</div><div className="mt-2 text-sm font-semibold text-slate-950">Un TS ne part pas en execution sans validation client.</div></div>
      </section>

      {!schemaReady ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">Migration imprevus / TS non appliquee.</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {canManage ? (
        <form onSubmit={(event) => void saveRow(event)} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre" disabled={saving || !schemaReady} />
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" value={typeEcart} onChange={(event) => setTypeEcart(event.target.value as ChantierChangeOrderType)} disabled={saving || !schemaReady}><option value="imprevu">Imprevu</option><option value="travaux_supplementaires">Travaux supplementaires</option></select>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" value={zoneId} onChange={(event) => setZoneId(event.target.value)} disabled={saving || !schemaReady}><option value="">Sans localisation</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zonePathById.get(zone.id) ?? zone.nom}</option>)}</select>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" value={taskId} onChange={(event) => setTaskId(event.target.value)} disabled={saving || !schemaReady}><option value="">Sans tache</option>{tasks.map((task) => <option key={task.id} value={task.id}>{resolveTaskTitle(task)}</option>)}</select>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" value={status} onChange={(event) => setStatus(event.target.value as ChantierChangeOrderStatus)} disabled={saving || !schemaReady}>{currentStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          </div>
          {typeEcart === "imprevu" ? (
            <div className="grid gap-3 md:grid-cols-2"><input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" inputMode="decimal" value={impactTemps} onChange={(event) => setImpactTemps(event.target.value)} placeholder="Temps perdu estime (h)" disabled={saving || !schemaReady} /><input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" inputMode="decimal" value={impactCout} onChange={(event) => setImpactCout(event.target.value)} placeholder="Impact budget HT" disabled={saving || !schemaReady} /></div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" inputMode="decimal" value={quantite} onChange={(event) => setQuantite(event.target.value)} placeholder="Quantite" disabled={saving || !schemaReady} /><input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" value={unite} onChange={(event) => setUnite(event.target.value)} placeholder="Unite" disabled={saving || !schemaReady} /><input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" inputMode="decimal" value={prixUnitaireHt} onChange={(event) => setPrixUnitaireHt(event.target.value)} placeholder="Prix unitaire HT" disabled={saving || !schemaReady} /><input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" inputMode="decimal" value={tvaRate} onChange={(event) => setTvaRate(event.target.value)} placeholder="TVA" disabled={saving || !schemaReady} /></div>
          )}
          {photos.length > 0 ? <div className="flex flex-wrap gap-2">{photos.slice(0, 12).map((photo) => <button key={photo.id} type="button" onClick={() => togglePhoto(photo.id)} className={["rounded-full border px-3 py-1 text-xs", selectedPhotoIds.includes(photo.id) ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600"].join(" ")} disabled={saving || !schemaReady}>{resolvePhotoTitle(photo)}</button>)}</div> : null}
          <textarea className="min-h-[110px] w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500" value={description} onChange={(event) => setDescription(event.target.value)} placeholder={typeEcart === "imprevu" ? "Description de l'imprevu" : "Description du TS"} disabled={saving || !schemaReady} />
          {typeEcart === "travaux_supplementaires" ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Validation client obligatoire avant execution.</div> : null}
          <div className="flex justify-end gap-2">{editingRow ? <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" disabled={saving}>Annuler</button> : null}<button type="submit" disabled={saving || !schemaReady} className={["rounded-xl px-4 py-2 text-sm font-medium", saving || !schemaReady ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800"].join(" ")}>{saving ? "Enregistrement..." : editingRow ? "Mettre a jour" : "Creer"}</button></div>
        </form>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold text-slate-950">Suivi</h3><div className="flex flex-wrap gap-2">{[{ value: "all", label: "Tous" },{ value: "imprevu", label: "Imprevus" },{ value: "travaux_supplementaires", label: "Travaux supplementaires" }].map((entry) => <button key={entry.value} type="button" onClick={() => setFilterType(entry.value as ChangeOrderFilter)} className={["rounded-full border px-3 py-2 text-xs font-medium", filterType === entry.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-700"].join(" ")}>{entry.label}</button>)}</div></div>
        <div className="mt-4 space-y-3">{loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Chargement...</div> : filteredRows.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Aucune entree.</div> : filteredRows.map((row) => { const currentType = normalizeChangeOrderType(row.type_ecart); const statusOptions = getChangeOrderStatusOptions(currentType); return <article key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold text-slate-950">{row.titre}</h4><span className={["rounded-full border px-2 py-0.5 text-[11px] font-semibold", typeBadgeClass(currentType)].join(" ")}>{currentType === "travaux_supplementaires" ? "Travaux supplementaires" : "Imprevu"}</span><span className={["rounded-full border px-2 py-0.5 text-[11px] font-semibold", statusBadgeClass(currentType, row.statut)].join(" ")}>{statusOptions.find((option) => option.value === row.statut)?.label ?? row.statut}</span></div><div className="mt-1 text-xs text-slate-500">{row.zone_id ? zonePathById.get(row.zone_id) ?? "Sans zone" : "Sans zone"} · {row.task_id ? resolveTaskTitle(taskById.get(row.task_id)) : "Sans tache"}</div></div>{canManage ? <div className="flex flex-wrap gap-2"><button type="button" onClick={() => startEditing(row)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" disabled={processingId === row.id}>Modifier</button><button type="button" onClick={() => void removeRow(row)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100" disabled={processingId === row.id}>{processingId === row.id ? "Traitement..." : "Supprimer"}</button></div> : null}</div>{row.description ? <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{row.description}</div> : null}<div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">Photos : <span className="font-semibold text-slate-950">{row.photo_ids.length}</span></div>{currentType === "imprevu" ? <><div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">Temps perdu : <span className="font-semibold text-slate-950">+{formatNumber(row.impact_temps_h)} h</span></div><div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">Impact budget : <span className="font-semibold text-slate-950">{formatMoney(row.impact_cout_ht)}</span></div><div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">Lecture : <span className="font-semibold text-amber-700">Perte interne</span></div></> : <><div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">Total HT : <span className="font-semibold text-slate-950">{formatMoney(row.total_ht)}</span></div><div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">Total TTC : <span className="font-semibold text-slate-950">{formatMoney(row.total_ttc)}</span></div><div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">Lecture : <span className="font-semibold text-emerald-700">Gain facturable</span></div></>}</div>{row.photo_ids.length > 0 ? <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">{row.photo_ids.slice(0, 4).map((photoId) => <span key={photoId} className="rounded-full border border-slate-200 bg-white px-3 py-1">{resolvePhotoTitle(photoById.get(photoId))}</span>)}</div> : null}<div className="mt-4 flex flex-wrap gap-2">{canManage ? <select value={row.statut} onChange={(event) => void changeStatus(row, event.target.value as ChantierChangeOrderStatus)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500" disabled={processingId === row.id}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : null}{canManage && !row.task_id ? <button type="button" onClick={() => void createLinkedTask(row)} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100" disabled={processingId === row.id}>Creer la tache liee</button> : null}{canManage && currentType === "travaux_supplementaires" && !row.devis_ligne_id ? <button type="button" onClick={() => void createAvenant(row)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100" disabled={processingId === row.id}>Generer l'avenant</button> : null}{currentType === "travaux_supplementaires" && ["a_chiffrer", "en_attente_validation_client"].includes(row.statut) ? <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">Validation client requise</span> : null}{row.devis_ligne_id ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Avenant cree</span> : null}</div></article>; })}</div>
      </section>
    </div>
  );
}

