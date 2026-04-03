import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import type { ChantierTaskRow } from "../../services/chantierTasks.service";
import type { ChantierZoneRow } from "../../services/chantierZones.service";
import { appendChantierActivityLog } from "../../services/chantierActivityLog.service";
import {
  createChantierPurchaseRequest,
  deleteChantierPurchaseRequest,
  listChantierPurchaseRequests,
  updateChantierPurchaseRequest,
  type ChantierPurchaseRequestRow,
  type ChantierPurchaseRequestStatus,
} from "../../services/chantierPurchaseRequests.service";

type ApprovisionnementTabProps = {
  chantierId: string;
  tasks: ChantierTaskRow[];
  zones: ChantierZoneRow[];
};

const STATUS_OPTIONS: Array<{ value: ChantierPurchaseRequestStatus; label: string }> = [
  { value: "a_commander", label: "À commander" },
  { value: "commande", label: "Commandé" },
  { value: "livre", label: "Livré" },
  { value: "annule", label: "Annulé" },
];

function statusBadgeClass(status: ChantierPurchaseRequestStatus) {
  if (status === "livre") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "commande") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "annule") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function statusLabel(status: ChantierPurchaseRequestStatus) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "À commander";
}

export default function ApprovisionnementTab({ chantierId, tasks, zones }: ApprovisionnementTabProps) {
  const [requests, setRequests] = useState<ChantierPurchaseRequestRow[]>([]);
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [taskId, setTaskId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [title, setTitle] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [status, setStatus] = useState<ChantierPurchaseRequestStatus>("a_commander");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [comment, setComment] = useState("");

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const zoneById = useMemo(() => new Map(zones.map((zone) => [zone.id, zone.nom])), [zones]);

  const summary = useMemo(() => {
    return {
      total: requests.length,
      toOrder: requests.filter((entry) => entry.statut_commande === "a_commander").length,
      ordered: requests.filter((entry) => entry.statut_commande === "commande").length,
      delivered: requests.filter((entry) => entry.statut_commande === "livre").length,
    };
  }, [requests]);

  async function refreshRequests() {
    setLoading(true);
    setError(null);
    try {
      const result = await listChantierPurchaseRequests(chantierId);
      setRequests(result.requests);
      setSchemaReady(result.schemaReady);
    } catch (err: any) {
      setRequests([]);
      setError(err?.message ?? "Erreur chargement approvisionnement.");
    } finally {
      setLoading(false);
    }
  }

  async function logPurchaseAction(
    actionType: string,
    row: ChantierPurchaseRequestRow,
    reason: string,
    changes: Record<string, unknown>,
  ) {
    try {
      await appendChantierActivityLog({
        chantierId,
        actionType,
        entityType: "approvisionnement",
        entityId: row.id,
        reason,
        changes,
      });
    } catch (err) {
      console.warn("[purchase-log] append failed", err);
    }
  }

  useEffect(() => {
    void refreshRequests();
  }, [chantierId]);

  useEffect(() => {
    if (!taskId) return;
    const selectedTask = taskById.get(taskId);
    if (selectedTask?.zone_id) {
      setZoneId(selectedTask.zone_id);
    }
    if (selectedTask?.titre && !title.trim()) {
      setTitle(selectedTask.titre);
    }
  }, [taskById, taskId, title]);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Titre de demande obligatoire.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await createChantierPurchaseRequest({
        chantier_id: chantierId,
        task_id: taskId || null,
        zone_id: zoneId || null,
        supplier_name: supplierName,
        titre: title,
        quantite: Number(String(quantity).replace(",", ".")) || null,
        unite: unit,
        statut_commande: status,
        livraison_prevue_le: deliveryDate || null,
        recu: status === "livre",
        commentaire: comment,
      });
      setRequests((current) => [saved, ...current]);
      await logPurchaseAction("created", saved, "Demande approvisionnement créée", {
        titre: saved.titre,
        task_id: saved.task_id,
        zone_id: saved.zone_id,
        supplier_name: saved.supplier_name,
        statut_commande: saved.statut_commande,
        livraison_prevue_le: saved.livraison_prevue_le,
      });

      setTaskId("");
      setZoneId("");
      setSupplierName("");
      setTitle("");
      setQuantity("1");
      setUnit("");
      setStatus("a_commander");
      setDeliveryDate("");
      setComment("");
    } catch (err: any) {
      setError(err?.message ?? "Erreur création demande approvisionnement.");
    } finally {
      setSaving(false);
    }
  }

  async function changeRequestStatus(row: ChantierPurchaseRequestRow, nextStatus: ChantierPurchaseRequestStatus) {
    const previous = requests;
    setRequests((current) =>
      current.map((entry) =>
        entry.id === row.id
          ? {
              ...entry,
              statut_commande: nextStatus,
              recu: nextStatus === "livre",
            }
          : entry,
      ),
    );
    try {
      const saved = await updateChantierPurchaseRequest(row.id, {
        statut_commande: nextStatus,
        recu: nextStatus === "livre",
      });
      setRequests((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
      await logPurchaseAction("status_changed", saved, "Statut approvisionnement mis à jour", {
        from_status: row.statut_commande,
        to_status: saved.statut_commande,
        recu: saved.recu,
      });
    } catch (err: any) {
      setRequests(previous);
      setError(err?.message ?? "Erreur mise à jour statut approvisionnement.");
    }
  }

  async function removeRequest(row: ChantierPurchaseRequestRow) {
    const ok = confirm(`Supprimer la demande "${row.titre}" ?`);
    if (!ok) return;

    const previous = requests;
    setRequests((current) => current.filter((entry) => entry.id !== row.id));
    try {
      await deleteChantierPurchaseRequest(row.id);
      await logPurchaseAction("deleted", row, "Demande approvisionnement supprimée", {
        titre: row.titre,
        task_id: row.task_id,
        zone_id: row.zone_id,
      });
    } catch (err: any) {
      setRequests(previous);
      setError(err?.message ?? "Erreur suppression demande approvisionnement.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="font-semibold section-title">Approvisionnement</div>
          <div className="text-sm text-slate-500">
            Suivi des commandes fournisseur liées aux tâches et aux zones du chantier.
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refreshRequests()}
          disabled={loading}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Chargement..." : "Rafraîchir"}
        </button>
      </div>

      {!schemaReady ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Migration approvisionnement non appliquée sur Supabase.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{summary.total}</div>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">À commander</div>
          <div className="mt-2 text-2xl font-semibold text-amber-900">{summary.toOrder}</div>
        </div>
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">Commandé</div>
          <div className="mt-2 text-2xl font-semibold text-blue-900">{summary.ordered}</div>
        </div>
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Livré</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-900">{summary.delivered}</div>
        </div>
      </div>

      <form onSubmit={(event) => void submitRequest(event)} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="text-sm font-semibold text-slate-900">Créer une demande fournisseur</div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <label className="space-y-1 text-xs text-slate-600">
            <div>Tâche liée</div>
            <select
              value={taskId}
              onChange={(event) => setTaskId(event.target.value)}
              disabled={saving || !schemaReady}
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
              disabled={saving || !schemaReady}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            >
              <option value="">Aucune zone</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.nom}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-600">
            <div>Fournisseur</div>
            <input
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
              disabled={saving || !schemaReady}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              placeholder="Ex : Point.P"
            />
          </label>

          <label className="space-y-1 text-xs text-slate-600 lg:col-span-2">
            <div>Désignation</div>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={saving || !schemaReady}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              placeholder="Ex : Rails placo, laine de bois, receveur..."
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs text-slate-600">
              <div>Quantité</div>
              <input
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                disabled={saving || !schemaReady}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                placeholder="1"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-600">
              <div>Unité</div>
              <input
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                disabled={saving || !schemaReady}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                placeholder="U, m², ml"
              />
            </label>
          </div>

          <label className="space-y-1 text-xs text-slate-600">
            <div>Statut</div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ChantierPurchaseRequestStatus)}
              disabled={saving || !schemaReady}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-600">
            <div>Livraison prévue</div>
            <input
              type="date"
              value={deliveryDate}
              onChange={(event) => setDeliveryDate(event.target.value)}
              disabled={saving || !schemaReady}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            />
          </label>

          <label className="space-y-1 text-xs text-slate-600">
            <div>Commentaire</div>
            <input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              disabled={saving || !schemaReady}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              placeholder="Référence, contrainte livraison..."
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={saving || !schemaReady}
            className={[
              "rounded-2xl px-5 py-3 text-sm font-medium",
              saving || !schemaReady ? "bg-slate-200 text-slate-500" : "bg-blue-600 text-white hover:bg-blue-700",
            ].join(" ")}
          >
            {saving ? "Enregistrement..." : "+ Ajouter demande"}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            Chargement des commandes...
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            Aucune demande approvisionnement enregistrée.
          </div>
        ) : (
          requests.map((request) => {
            const linkedTask = request.task_id ? taskById.get(request.task_id) : null;
            const linkedZone = request.zone_id ? zoneById.get(request.zone_id) : null;

            return (
              <article
                key={request.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-slate-950">{request.titre}</h3>
                      <span
                        className={[
                          "rounded-full border px-2 py-1 text-[11px] font-semibold",
                          statusBadgeClass(request.statut_commande),
                        ].join(" ")}
                      >
                        {statusLabel(request.statut_commande)}
                      </span>
                      {request.recu ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                          Reçu
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span>
                        Quantité : {request.quantite ?? "—"}
                        {request.unite ? ` ${request.unite}` : ""}
                      </span>
                      <span>Fournisseur : {request.supplier_name || "—"}</span>
                      {request.livraison_prevue_le ? (
                        <span>
                          Livraison : {new Date(`${request.livraison_prevue_le}T00:00:00`).toLocaleDateString("fr-FR")}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {linkedTask ? <span>Tâche : {linkedTask.titre}</span> : null}
                      {linkedZone ? <span>Zone : {linkedZone}</span> : null}
                    </div>

                    {request.commentaire ? (
                      <p className="mt-3 text-sm text-slate-700">{request.commentaire}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => void changeRequestStatus(request, option.value)}
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {option.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => void removeRequest(request)}
                      className="rounded-2xl border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
