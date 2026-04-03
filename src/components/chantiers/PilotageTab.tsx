import { useEffect, useMemo, useState, type FormEvent } from "react";

import { appendChantierActivityLog } from "../../services/chantierActivityLog.service";
import {
  createChantierChangeOrder,
  deleteChantierChangeOrder,
  listChantierChangeOrders,
  updateChantierChangeOrder,
  type ChantierChangeOrderRow,
  type ChantierChangeOrderStatus,
  type ChantierChangeOrderType,
} from "../../services/chantierChangeOrders.service";
import type { ChantierTaskRow } from "../../services/chantierTasks.service";
import type { ChantierZoneRow } from "../../services/chantierZones.service";

type PilotageTabProps = {
  chantierId: string;
  tasks: ChantierTaskRow[];
  zones: ChantierZoneRow[];
  heuresPrevuesChantier: number;
};

const CHANGE_ORDER_TYPES: Array<{ value: ChantierChangeOrderType; label: string }> = [
  { value: "travaux_supplementaires", label: "Travaux supplémentaires" },
  { value: "modification_client", label: "Modification client" },
  { value: "imprevu_technique", label: "Imprévu technique" },
  { value: "temps_supplementaire", label: "Temps supplémentaire" },
  { value: "materiau_non_prevu", label: "Matériau non prévu" },
];

const STATUS_OPTIONS: Array<{ value: ChantierChangeOrderStatus; label: string }> = [
  { value: "a_valider", label: "À valider" },
  { value: "valide", label: "Validé" },
  { value: "refuse", label: "Refusé" },
  { value: "integre", label: "Intégré" },
];

function taskQualityLabel(status: string | null | undefined) {
  if (status === "valide_admin") return "Validé admin";
  if (status === "termine_intervenant") return "Terminé intervenant";
  if (status === "a_reprendre") return "À reprendre";
  if (status === "en_cours") return "En cours";
  return "À faire";
}

function statusBadgeClass(status: ChantierChangeOrderStatus) {
  if (status === "valide" || status === "integre") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "refuse") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}

function formatMoney(value: number) {
  return `${formatNumber(value)} €`;
}

function resolveTaskTitle(task: ChantierTaskRow | undefined) {
  return String(task?.titre ?? "").trim() || "Tâche non renseignée";
}

function resolveZoneName(zone: ChantierZoneRow | undefined) {
  return String(zone?.nom ?? "").trim() || "Zone non renseignée";
}

export default function PilotageTab({ chantierId, tasks, zones, heuresPrevuesChantier }: PilotageTabProps) {
  const [changeOrders, setChangeOrders] = useState<ChantierChangeOrderRow[]>([]);
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [taskId, setTaskId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [typeEcart, setTypeEcart] = useState<ChantierChangeOrderType>("imprevu_technique");
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [impactTemps, setImpactTemps] = useState("");
  const [impactCout, setImpactCout] = useState("");
  const [statut, setStatut] = useState<ChantierChangeOrderStatus>("a_valider");

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const zoneById = useMemo(() => new Map(zones.map((zone) => [zone.id, zone])), [zones]);

  const totalTempsPrevuTaches = useMemo(
    () => tasks.reduce((sum, task) => sum + (Number(task.temps_prevu_h ?? 0) || 0), 0),
    [tasks],
  );
  const totalTempsRealise = useMemo(
    () => tasks.reduce((sum, task) => sum + (Number(task.temps_reel_h ?? 0) || 0), 0),
    [tasks],
  );
  const totalTempsPrevu = heuresPrevuesChantier > 0 ? heuresPrevuesChantier : totalTempsPrevuTaches;
  const totalTempsRestant = Math.max(0, totalTempsPrevu - totalTempsRealise);

  const retardTaches = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks.filter((task) => {
      if (!task.date_fin) return false;
      if (task.status === "FAIT") return false;
      const timestamp = Date.parse(`${task.date_fin}T00:00:00`);
      return Number.isFinite(timestamp) && timestamp < today.getTime();
    }).length;
  }, [tasks]);

  const tachesAReprendre = useMemo(
    () => tasks.filter((task) => task.quality_status === "a_reprendre").length,
    [tasks],
  );
  const ecartsValides = useMemo(
    () => changeOrders.filter((row) => row.statut === "valide" || row.statut === "integre"),
    [changeOrders],
  );
  const impactTempsValide = useMemo(
    () => ecartsValides.reduce((sum, row) => sum + row.impact_temps_h, 0),
    [ecartsValides],
  );
  const impactCoutValide = useMemo(
    () => ecartsValides.reduce((sum, row) => sum + row.impact_cout_ht, 0),
    [ecartsValides],
  );
  const coutMainOeuvrePrevu = useMemo(
    () => tasks.reduce((sum, task) => sum + (Number((task as any).cout_mo_prevu_ht ?? 0) || 0), 0),
    [tasks],
  );
  const coutMainOeuvreReel = useMemo(
    () => tasks.reduce((sum, task) => sum + (Number((task as any).cout_mo_reel_ht ?? 0) || 0), 0),
    [tasks],
  );
  const coutDerive = Math.max(0, coutMainOeuvreReel - (coutMainOeuvrePrevu + impactCoutValide));

  const pilotageRows = useMemo(() => {
    return [...tasks]
      .map((task) => {
        const tempsPrevu = Number(task.temps_prevu_h ?? 0) || 0;
        const tempsReel = Number(task.temps_reel_h ?? 0) || 0;
        return {
          id: task.id,
          titre: resolveTaskTitle(task),
          lot: String(task.corps_etat ?? task.lot ?? "—").trim() || "—",
          zone: task.zone_id ? resolveZoneName(zoneById.get(task.zone_id)) : "—",
          tempsPrevu,
          tempsReel,
          tempsRestant: Math.max(0, tempsPrevu - tempsReel),
          statutQualite: task.quality_status,
          depassement: tempsPrevu > 0 && tempsReel > tempsPrevu,
        };
      })
      .sort((a, b) => Number(b.depassement) - Number(a.depassement) || b.tempsReel - a.tempsReel);
  }, [tasks, zoneById]);

  async function refreshChangeOrders() {
    setLoading(true);
    setError(null);
    try {
      const result = await listChantierChangeOrders(chantierId);
      setChangeOrders(result.changeOrders);
      setSchemaReady(result.schemaReady);
    } catch (e: any) {
      setChangeOrders([]);
      setError(e?.message ?? "Erreur chargement pilotage.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshChangeOrders();
  }, [chantierId]);

  function resetForm() {
    setTaskId("");
    setZoneId("");
    setTypeEcart("imprevu_technique");
    setTitre("");
    setDescription("");
    setImpactTemps("");
    setImpactCout("");
    setStatut("a_valider");
  }

  async function recordChangeOrderActivity(actionType: string, row: ChantierChangeOrderRow, reason: string) {
    try {
      await appendChantierActivityLog({
        chantierId,
        actionType,
        entityType: "change_order",
        entityId: row.id,
        reason,
        changes: {
          titre: row.titre,
          statut: row.statut,
          type_ecart: row.type_ecart,
          impact_temps_h: row.impact_temps_h,
          impact_cout_ht: row.impact_cout_ht,
          task_id: row.task_id,
          zone_id: row.zone_id,
        },
      });
    } catch (e) {
      console.warn("[pilotage] activity log failed", e);
    }
  }

  async function saveChangeOrder(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createChantierChangeOrder({
        chantier_id: chantierId,
        task_id: taskId || null,
        zone_id: zoneId || null,
        type_ecart: typeEcart,
        titre,
        description,
        impact_temps_h: impactTemps,
        impact_cout_ht: impactCout,
        statut,
      });
      setChangeOrders((current) => [created, ...current]);
      await recordChangeOrderActivity("created", created, "Écart chantier créé");
      resetForm();
    } catch (e: any) {
      setError(e?.message ?? "Erreur création écart chantier.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(row: ChantierChangeOrderRow, nextStatus: ChantierChangeOrderStatus) {
    const before = changeOrders;
    setChangeOrders((current) => current.map((item) => (item.id === row.id ? { ...item, statut: nextStatus } : item)));
    try {
      const saved = await updateChantierChangeOrder(row.id, { statut: nextStatus });
      setChangeOrders((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      await recordChangeOrderActivity("validated", saved, "Statut d'écart mis à jour");
    } catch (e: any) {
      setChangeOrders(before);
      setError(e?.message ?? "Erreur mise à jour statut écart.");
    }
  }

  async function removeChangeOrder(row: ChantierChangeOrderRow) {
    if (!window.confirm(`Supprimer l'écart "${row.titre}" ?`)) return;
    const before = changeOrders;
    setDeletingId(row.id);
    setChangeOrders((current) => current.filter((item) => item.id !== row.id));
    setError(null);
    try {
      await deleteChantierChangeOrder(row.id);
      await recordChangeOrderActivity("deleted", row, "Écart chantier supprimé");
    } catch (e: any) {
      setChangeOrders(before);
      setError(e?.message ?? "Erreur suppression écart chantier.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Temps prévu</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{formatNumber(totalTempsPrevu)} h</div>
          <div className="mt-1 text-xs text-slate-500">Base chantier + tâches</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Temps réalisé</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{formatNumber(totalTempsRealise)} h</div>
          <div className="mt-1 text-xs text-slate-500">Reste {formatNumber(totalTempsRestant)} h</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Écarts validés</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">+{formatNumber(impactTempsValide)} h</div>
          <div className="mt-1 text-xs text-slate-500">Impact coût {formatMoney(impactCoutValide)}</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Alertes</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{retardTaches + tachesAReprendre}</div>
          <div className="mt-1 text-xs text-slate-500">
            {retardTaches} retard · {tachesAReprendre} à reprendre · dérive {formatMoney(coutDerive)}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Travaux supplémentaires</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Déclarer un écart chantier</h2>

          {!schemaReady ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Migration pilotage non appliquée : la table `chantier_change_orders` est indisponible.
            </div>
          ) : null}

          {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <form className="mt-5 space-y-4" onSubmit={(e) => void saveChangeOrder(e)}>
            <label className="block space-y-1 text-xs text-slate-600">
              <span>Titre</span>
              <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex : reprise cloison non prévue" disabled={saving} />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Type d'écart</span>
                <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" value={typeEcart} onChange={(e) => setTypeEcart(e.target.value as ChantierChangeOrderType)} disabled={saving}>
                  {CHANGE_ORDER_TYPES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
                </select>
              </label>
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Statut</span>
                <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" value={statut} onChange={(e) => setStatut(e.target.value as ChantierChangeOrderStatus)} disabled={saving}>
                  {STATUS_OPTIONS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
                </select>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Tâche liée</span>
                <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" value={taskId} onChange={(e) => setTaskId(e.target.value)} disabled={saving}>
                  <option value="">Sans tâche</option>
                  {tasks.map((task) => <option key={task.id} value={task.id}>{resolveTaskTitle(task)}</option>)}
                </select>
              </label>
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Zone</span>
                <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" value={zoneId} onChange={(e) => setZoneId(e.target.value)} disabled={saving}>
                  <option value="">Sans zone</option>
                  {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.nom}</option>)}
                </select>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Impact temps (h)</span>
                <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" inputMode="decimal" value={impactTemps} onChange={(e) => setImpactTemps(e.target.value)} placeholder="ex: 6" disabled={saving} />
              </label>
              <label className="block space-y-1 text-xs text-slate-600">
                <span>Impact coût HT (€)</span>
                <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" inputMode="decimal" value={impactCout} onChange={(e) => setImpactCout(e.target.value)} placeholder="ex: 450" disabled={saving} />
              </label>
            </div>

            <label className="block space-y-1 text-xs text-slate-600">
              <span>Description</span>
              <textarea className="min-h-[96px] w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Pourquoi cet écart existe, impact terrain, décision attendue..." disabled={saving} />
            </label>

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300">
                {saving ? "Enregistrement..." : "Créer l'écart"}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Tableau de bord</div>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Temps et dérive par tâche</h2>
              </div>
              <div className="text-xs text-slate-500">{pilotageRows.length} tâche{pilotageRows.length > 1 ? "s" : ""}</div>
            </div>

            <div className="mt-4 space-y-3">
              {pilotageRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">Aucune tâche à piloter pour ce chantier.</div>
              ) : (
                pilotageRows.slice(0, 20).map((task) => (
                  <div key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-950">{task.titre}</div>
                        <div className="mt-1 text-xs text-slate-500">{task.lot} · {task.zone}</div>
                      </div>
                      <span className={["inline-flex self-start rounded-full border px-2 py-0.5 text-[11px] font-semibold", task.statutQualite === "a_reprendre" ? "border-red-200 bg-red-50 text-red-700" : task.statutQualite === "valide_admin" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-700"].join(" ")}>
                        {taskQualityLabel(task.statutQualite)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      <div className="rounded-xl bg-white px-3 py-2"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Prévu</div><div className="mt-1 text-sm font-semibold text-slate-900">{formatNumber(task.tempsPrevu)} h</div></div>
                      <div className="rounded-xl bg-white px-3 py-2"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Réalisé</div><div className={["mt-1 text-sm font-semibold", task.depassement ? "text-red-700" : "text-slate-900"].join(" ")}>{formatNumber(task.tempsReel)} h</div></div>
                      <div className="rounded-xl bg-white px-3 py-2"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Restant</div><div className="mt-1 text-sm font-semibold text-slate-900">{formatNumber(task.tempsRestant)} h</div></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Écarts chantier</div>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Suivi et validation</h2>
              </div>
              <button type="button" onClick={() => void refreshChangeOrders()} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" disabled={loading}>
                {loading ? "Chargement..." : "Rafraîchir"}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Chargement des écarts...</div>
              ) : changeOrders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">Aucun écart chantier déclaré.</div>
              ) : (
                changeOrders.map((row) => (
                  <article key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-950">{row.titre}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {CHANGE_ORDER_TYPES.find((entry) => entry.value === row.type_ecart)?.label ?? row.type_ecart} · {row.task_id ? resolveTaskTitle(taskById.get(row.task_id)) : "Sans tâche"} · {row.zone_id ? resolveZoneName(zoneById.get(row.zone_id)) : "Sans zone"}
                        </div>
                      </div>
                      <span className={["inline-flex self-start rounded-full border px-2 py-0.5 text-[11px] font-semibold", statusBadgeClass(row.statut)].join(" ")}>
                        {STATUS_OPTIONS.find((entry) => entry.value === row.statut)?.label ?? row.statut}
                      </span>
                    </div>

                    {row.description ? <p className="mt-3 text-sm text-slate-600">{row.description}</p> : null}

                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      <div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">Impact temps : <span className="font-semibold text-slate-950">+{formatNumber(row.impact_temps_h)} h</span></div>
                      <div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">Impact coût : <span className="font-semibold text-slate-950">{formatMoney(row.impact_cout_ht)}</span></div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => void changeStatus(row, "valide")} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700" disabled={deletingId === row.id}>Valider</button>
                      <button type="button" onClick={() => void changeStatus(row, "integre")} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100" disabled={deletingId === row.id}>Intégrer</button>
                      <button type="button" onClick={() => void changeStatus(row, "refuse")} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100" disabled={deletingId === row.id}>Refuser</button>
                      <button type="button" onClick={() => void removeChangeOrder(row)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50" disabled={deletingId === row.id}>{deletingId === row.id ? "Suppression..." : "Supprimer"}</button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
