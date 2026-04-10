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
import {
  createDevis,
  createDevisLigne,
  listDevisByChantier,
} from "../../services/devis.service";
import {
  getCurrentUserProfile,
  isAdminProfile,
} from "../../services/currentUserProfile.service";
import {
  createTask,
  type ChantierTaskRow,
} from "../../services/chantierTasks.service";
import {
  buildChantierZonePathMap,
  type ChantierZoneRow,
} from "../../services/chantierZones.service";

type PreparationUnforeseenPanelProps = {
  chantierId: string;
  tasks: ChantierTaskRow[];
  zones: ChantierZoneRow[];
};

const TYPE_OPTIONS: Array<{ value: ChantierChangeOrderType; label: string }> = [
  { value: "imprevu_technique", label: "Imprévu" },
  { value: "travaux_supplementaires", label: "Travaux supplémentaires" },
];

const STATUS_OPTIONS: Array<{ value: ChantierChangeOrderStatus; label: string }> = [
  { value: "a_analyser", label: "À analyser" },
  { value: "a_chiffrer", label: "À chiffrer" },
  { value: "en_attente_validation", label: "En attente validation" },
  { value: "valide", label: "Validé" },
  { value: "refuse", label: "Refusé" },
  { value: "realise", label: "Réalisé" },
];

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}

function formatMoney(value: number) {
  return `${formatNumber(value)} €`;
}

function statusBadgeClass(status: ChantierChangeOrderStatus) {
  if (status === "valide" || status === "realise") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "refuse") return "border-red-200 bg-red-50 text-red-700";
  if (status === "a_chiffrer") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function resolveTaskTitle(task: ChantierTaskRow | undefined) {
  return String(task?.titre_terrain ?? task?.titre ?? "").trim() || "Tâche chantier";
}

export default function PreparationUnforeseenPanel({
  chantierId,
  tasks,
  zones,
}: PreparationUnforeseenPanelProps) {
  const [changeOrders, setChangeOrders] = useState<ChantierChangeOrderRow[]>([]);
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [typeEcart, setTypeEcart] =
    useState<ChantierChangeOrderType>("imprevu_technique");
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [impactTemps, setImpactTemps] = useState("");
  const [impactCout, setImpactCout] = useState("");
  const [statut, setStatut] =
    useState<ChantierChangeOrderStatus>("a_analyser");

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const zonePathById = useMemo(() => buildChantierZonePathMap(zones), [zones]);
  const editingRow = useMemo(
    () => changeOrders.find((row) => row.id === editingId) ?? null,
    [changeOrders, editingId],
  );
  const validatedRows = useMemo(
    () => changeOrders.filter((row) => row.statut === "valide" || row.statut === "realise"),
    [changeOrders],
  );

  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      try {
        const profile = await getCurrentUserProfile();
        if (!alive) return;
        setCanManage(isAdminProfile(profile));
      } catch {
        if (!alive) return;
        setCanManage(false);
      }
    }

    void loadProfile();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function refreshChangeOrders() {
      setLoading(true);
      setError(null);
      try {
        const result = await listChantierChangeOrders(chantierId);
        if (!alive) return;
        setChangeOrders(result.changeOrders);
        setSchemaReady(result.schemaReady);
      } catch (e: any) {
        if (!alive) return;
        setChangeOrders([]);
        setError(e?.message ?? "Erreur chargement imprévus.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void refreshChangeOrders();
    return () => {
      alive = false;
    };
  }, [chantierId]);

  function resetForm() {
    setEditingId(null);
    setTypeEcart("imprevu_technique");
    setTitre("");
    setDescription("");
    setZoneId("");
    setTaskId("");
    setImpactTemps("");
    setImpactCout("");
    setStatut("a_analyser");
  }

  function startEditing(row: ChantierChangeOrderRow) {
    setEditingId(row.id);
    setTypeEcart(row.type_ecart);
    setTitre(row.titre);
    setDescription(row.description ?? "");
    setZoneId(row.zone_id ?? "");
    setTaskId(row.task_id ?? "");
    setImpactTemps(String(row.impact_temps_h || ""));
    setImpactCout(String(row.impact_cout_ht || ""));
    setStatut(row.statut);
  }

  async function recordActivity(
    actionType: string,
    row: ChantierChangeOrderRow,
    reason: string,
  ) {
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
          task_id: row.task_id,
          zone_id: row.zone_id,
          devis_ligne_id: row.devis_ligne_id,
          impact_temps_h: row.impact_temps_h,
          impact_cout_ht: row.impact_cout_ht,
        },
      });
    } catch (e) {
      console.warn("[preparation-unforeseen] activity log failed", e);
    }
  }

  async function saveChangeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;

    setSaving(true);
    setError(null);
    try {
      if (editingRow) {
        const saved = await updateChantierChangeOrder(editingRow.id, {
          type_ecart: typeEcart,
          titre,
          description,
          zone_id: zoneId || null,
          task_id: taskId || null,
          impact_temps_h: impactTemps,
          impact_cout_ht: impactCout,
          statut,
        });
        setChangeOrders((current) =>
          current.map((row) => (row.id === saved.id ? saved : row)),
        );
        await recordActivity("updated", saved, "Imprévu chantier mis à jour");
      } else {
        const created = await createChantierChangeOrder({
          chantier_id: chantierId,
          type_ecart: typeEcart,
          titre,
          description,
          zone_id: zoneId || null,
          task_id: taskId || null,
          impact_temps_h: impactTemps,
          impact_cout_ht: impactCout,
          statut,
        });
        setChangeOrders((current) => [created, ...current]);
        await recordActivity("created", created, "Imprévu chantier déclaré");
      }
      resetForm();
    } catch (e: any) {
      setError(e?.message ?? "Erreur enregistrement imprévu.");
    } finally {
      setSaving(false);
    }
  }

  async function removeChangeOrder(row: ChantierChangeOrderRow) {
    if (!canManage) return;
    if (!window.confirm(`Supprimer l'imprévu "${row.titre}" ?`)) return;

    const before = changeOrders;
    setProcessingId(row.id);
    setChangeOrders((current) => current.filter((entry) => entry.id !== row.id));
    setError(null);
    try {
      await deleteChantierChangeOrder(row.id);
      await recordActivity("deleted", row, "Imprévu chantier supprimé");
      if (editingId === row.id) resetForm();
    } catch (e: any) {
      setChangeOrders(before);
      setError(e?.message ?? "Erreur suppression imprévu.");
    } finally {
      setProcessingId(null);
    }
  }

  async function changeStatus(
    row: ChantierChangeOrderRow,
    nextStatus: ChantierChangeOrderStatus,
  ) {
    if (!canManage || row.statut === nextStatus) return;

    const before = changeOrders;
    setProcessingId(row.id);
    setChangeOrders((current) =>
      current.map((entry) =>
        entry.id === row.id ? { ...entry, statut: nextStatus } : entry,
      ),
    );
    setError(null);
    try {
      const saved = await updateChantierChangeOrder(row.id, { statut: nextStatus });
      setChangeOrders((current) =>
        current.map((entry) => (entry.id === saved.id ? saved : entry)),
      );
      await recordActivity("validated", saved, "Statut imprévu mis à jour");
    } catch (e: any) {
      setChangeOrders(before);
      setError(e?.message ?? "Erreur mise à jour statut imprévu.");
    } finally {
      setProcessingId(null);
    }
  }

  async function createLinkedTask(row: ChantierChangeOrderRow) {
    if (!canManage || row.task_id) return;

    setProcessingId(row.id);
    setError(null);
    try {
      const task = await createTask({
        chantier_id: chantierId,
        titre: row.titre,
        titre_terrain: row.titre,
        description_technique: row.description ?? null,
        zone_id: row.zone_id ?? null,
        temps_prevu_h: row.impact_temps_h || null,
        status: "A_FAIRE",
      });
      const saved = await updateChantierChangeOrder(row.id, {
        task_id: task.id,
      });
      setChangeOrders((current) =>
        current.map((entry) => (entry.id === saved.id ? saved : entry)),
      );
      await recordActivity("created", saved, "Tâche liée créée depuis un imprévu");
    } catch (e: any) {
      setError(e?.message ?? "Erreur création tâche liée.");
    } finally {
      setProcessingId(null);
    }
  }

  async function createAvenant(row: ChantierChangeOrderRow) {
    if (!canManage || row.devis_ligne_id) return;

    setProcessingId(row.id);
    setError(null);
    try {
      const devis = await listDevisByChantier(chantierId);
      const targetDevis =
        devis[0] ??
        (await createDevis({
          chantier_id: chantierId,
          nom: "Avenants chantier",
        }));

      const linkedTask = row.task_id ? taskById.get(row.task_id) : undefined;
      const devisLigne = await createDevisLigne({
        devis_id: targetDevis.id,
        designation: row.titre,
        corps_etat: linkedTask?.lot ?? linkedTask?.corps_etat ?? "Travaux supplémentaires",
        quantite: 1,
        unite: "forfait",
        prix_unitaire_ht: row.impact_cout_ht,
        generer_tache: false,
        titre_tache: linkedTask ? resolveTaskTitle(linkedTask) : row.titre,
      });

      const saved = await updateChantierChangeOrder(row.id, {
        devis_ligne_id: devisLigne.id,
        statut:
          row.statut === "a_analyser" || row.statut === "a_chiffrer"
            ? "en_attente_validation"
            : row.statut,
      });
      setChangeOrders((current) =>
        current.map((entry) => (entry.id === saved.id ? saved : entry)),
      );
      await recordActivity("updated", saved, "Avenant créé depuis un imprévu");
    } catch (e: any) {
      setError(e?.message ?? "Erreur création avenant.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Imprévus chantier
          </div>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">
            Travaux supplémentaires et points à arbitrer
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Déclare un imprévu, chiffre son impact, relie-le à une tâche et prépare
            l’avenant sans sortir de la préparation chantier.
          </p>
        </div>
        {!canManage ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            Consultation seule
          </span>
        ) : null}
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Total imprévus
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {changeOrders.length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Temps validé / réalisé
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            +{formatNumber(validatedRows.reduce((sum, row) => sum + row.impact_temps_h, 0))} h
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Impact budget
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {formatMoney(
              validatedRows.reduce((sum, row) => sum + row.impact_cout_ht, 0),
            )}
          </div>
        </div>
      </section>

      {!schemaReady ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Migration imprévus non appliquée : le bloc reste visible mais non enregistrable.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {canManage ? (
        <form
          onSubmit={(event) => void saveChangeOrder(event)}
          className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4"
        >
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="space-y-1 text-xs text-slate-600">
              <span>Titre</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                value={titre}
                onChange={(event) => setTitre(event.target.value)}
                placeholder="Ex : renfort structure non prévu en cloison"
                disabled={saving || !schemaReady}
              />
            </label>
            <label className="space-y-1 text-xs text-slate-600">
              <span>Type</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                value={typeEcart}
                onChange={(event) =>
                  setTypeEcart(event.target.value as ChantierChangeOrderType)
                }
                disabled={saving || !schemaReady}
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-xs text-slate-600">
              <span>Localisation</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                value={zoneId}
                onChange={(event) => setZoneId(event.target.value)}
                disabled={saving || !schemaReady}
              >
                <option value="">Sans localisation</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zonePathById.get(zone.id) ?? zone.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-600">
              <span>Tâche liée</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                value={taskId}
                onChange={(event) => setTaskId(event.target.value)}
                disabled={saving || !schemaReady}
              >
                <option value="">Sans tâche</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {resolveTaskTitle(task)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-600">
              <span>Statut</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                value={statut}
                onChange={(event) =>
                  setStatut(event.target.value as ChantierChangeOrderStatus)
                }
                disabled={saving || !schemaReady}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs text-slate-600">
              <span>Estimation temps (h)</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                inputMode="decimal"
                value={impactTemps}
                onChange={(event) => setImpactTemps(event.target.value)}
                placeholder="Ex : 6"
                disabled={saving || !schemaReady}
              />
            </label>
            <label className="space-y-1 text-xs text-slate-600">
              <span>Estimation coût HT (€)</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                inputMode="decimal"
                value={impactCout}
                onChange={(event) => setImpactCout(event.target.value)}
                placeholder="Ex : 450"
                disabled={saving || !schemaReady}
              />
            </label>
          </div>

          <label className="mt-3 block space-y-1 text-xs text-slate-600">
            <span>Description</span>
            <textarea
              className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-500"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Décris le contexte terrain, le besoin, l'origine de l'imprévu et la décision attendue."
              disabled={saving || !schemaReady}
            />
          </label>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {editingRow ? (
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
                : editingRow
                  ? "Mettre à jour l'imprévu"
                  : "Créer l'imprévu"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Chargement des imprévus...
          </div>
        ) : changeOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Aucun imprévu ou travail supplémentaire déclaré pour ce chantier.
          </div>
        ) : (
          changeOrders.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-950">{row.titre}</h4>
                    <span
                      className={[
                        "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        statusBadgeClass(row.statut),
                      ].join(" ")}
                    >
                      {STATUS_OPTIONS.find((entry) => entry.value === row.statut)?.label ??
                        row.statut}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {TYPE_OPTIONS.find((entry) => entry.value === row.type_ecart)?.label ??
                        row.type_ecart}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {row.zone_id
                      ? zonePathById.get(row.zone_id) ?? "Localisation inconnue"
                      : "Sans localisation"}{" "}
                    · {row.task_id ? resolveTaskTitle(taskById.get(row.task_id)) : "Sans tâche liée"}
                  </div>
                </div>

                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEditing(row)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      disabled={processingId === row.id}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeChangeOrder(row)}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
                      disabled={processingId === row.id}
                    >
                      {processingId === row.id ? "Traitement..." : "Supprimer"}
                    </button>
                  </div>
                ) : null}
              </div>

              {row.description ? (
                <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {row.description}
                </div>
              ) : null}

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Estimation temps :{" "}
                  <span className="font-semibold text-slate-950">
                    +{formatNumber(row.impact_temps_h)} h
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Estimation coût :{" "}
                  <span className="font-semibold text-slate-950">
                    {formatMoney(row.impact_cout_ht)}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {canManage ? (
                  <select
                    value={row.statut}
                    onChange={(event) =>
                      void changeStatus(
                        row,
                        event.target.value as ChantierChangeOrderStatus,
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                    disabled={processingId === row.id}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : null}

                {canManage && !row.task_id ? (
                  <button
                    type="button"
                    onClick={() => void createLinkedTask(row)}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    disabled={processingId === row.id}
                  >
                    Créer la tâche liée
                  </button>
                ) : null}

                {canManage && !row.devis_ligne_id ? (
                  <button
                    type="button"
                    onClick={() => void createAvenant(row)}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                    disabled={processingId === row.id}
                  >
                    Créer l’avenant
                  </button>
                ) : null}

                {row.task_id ? (
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
                    Tâche liée
                  </span>
                ) : null}

                {row.devis_ligne_id ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                    Avenant créé
                  </span>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
