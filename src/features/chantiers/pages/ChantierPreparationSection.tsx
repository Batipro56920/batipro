import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import DevisImportDrawer, { type DevisImportResult } from "../../../components/chantiers/DevisImportDrawer";
import PreparationChecklistTab from "../../../components/chantiers/PreparationChecklistTab";
import {
  createTask,
  deleteTasksByIds,
  getTasksByChantierIdDetailed,
  type ChantierTaskRow,
} from "../../../services/chantierTasks.service";
import { replaceTaskAssignees } from "../../../services/chantierTaskAssignees.service";
import { getCurrentUserProfile, isAdminProfile } from "../../../services/currentUserProfile.service";
import {
  listDevisByChantier,
  listDevisLignes,
  type DevisLigneRow,
  type DevisRow,
} from "../../../services/devis.service";
import {
  listIntervenantsByChantierId,
  type IntervenantRow,
} from "../../../services/intervenants.service";

type ToastState = { type: "ok" | "error"; msg: string } | null;
type DrawerKey = "tasks" | "quotes" | "checklist" | null;

function toNumberOrNull(value: string) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function displayTaskTitle(task: ChantierTaskRow) {
  return String(task.titre_terrain ?? "").trim() || String(task.titre ?? "").trim() || "Tache chantier";
}

function displayTaskLot(task: ChantierTaskRow) {
  return String(task.lot ?? task.corps_etat ?? "").trim() || "A classer";
}

function getTaskProgress(task: ChantierTaskRow) {
  const expected = Number(task.temps_prevu_h ?? 0);
  const done = Number(task.temps_reel_h ?? 0);
  if (!Number.isFinite(expected) || expected <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((done / expected) * 100)));
}

function canCurrentRoleDeleteTasks(role: string | null | undefined) {
  const normalized = String(role ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return ["ADMIN", "DIRIGEANT", "DIRECTION", "CONDUCTEUR_DE_TRAVAUX"].includes(normalized);
}

function Drawer({ title, subtitle, onClose, children }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 p-4" onClick={onClose}>
      <aside
        className="ml-auto h-full w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-5 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Preparation chantier
            </div>
            <div className="mt-1 text-xl font-semibold text-slate-950">{title}</div>
            {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Fermer
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

export default function ChantierPreparationSection({ chantierId }: { chantierId: string }) {
  const [tasks, setTasks] = useState<ChantierTaskRow[]>([]);
  const [intervenants, setIntervenants] = useState<IntervenantRow[]>([]);
  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [activeDevisId, setActiveDevisId] = useState<string | null>(null);
  const [devisLignes, setDevisLignes] = useState<DevisLigneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [devisLinesLoading, setDevisLinesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [activeDrawer, setActiveDrawer] = useState<DrawerKey>(null);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [devisImportOpen, setDevisImportOpen] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [canDeleteTasks, setCanDeleteTasks] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskLot, setTaskLot] = useState("");
  const [taskQty, setTaskQty] = useState("1");
  const [taskUnit, setTaskUnit] = useState("");
  const [taskHours, setTaskHours] = useState("1");
  const [taskIntervenantId, setTaskIntervenantId] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let alive = true;
    async function loadProfileRights() {
      try {
        const profile = await getCurrentUserProfile();
        if (!alive) return;
        setCanDeleteTasks(isAdminProfile(profile) || canCurrentRoleDeleteTasks(profile?.role));
      } catch {
        if (alive) setCanDeleteTasks(false);
      }
    }
    void loadProfileRights();
    return () => {
      alive = false;
    };
  }, []);

  async function refreshPreparationData(preferredDevisId?: string | null) {
    setLoading(true);
    setError(null);
    try {
      const [taskResult, intervenantRows, devisRows] = await Promise.all([
        getTasksByChantierIdDetailed(chantierId),
        listIntervenantsByChantierId(chantierId),
        listDevisByChantier(chantierId),
      ]);
      setTasks(taskResult.tasks);
      setIntervenants(intervenantRows);
      setDevis(devisRows);
      if (preferredDevisId !== undefined) {
        setActiveDevisId(preferredDevisId);
      }
    } catch (err: any) {
      setError(err?.message ?? "Erreur chargement preparation chantier.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshPreparationData();
  }, [chantierId]);

  useEffect(() => {
    let alive = true;

    async function loadLines() {
      if (!activeDevisId) {
        setDevisLignes([]);
        return;
      }
      setDevisLinesLoading(true);
      try {
        const rows = await listDevisLignes(activeDevisId);
        if (!alive) return;
        setDevisLignes(rows);
      } catch (err: any) {
        if (!alive) return;
        setToast({ type: "error", msg: err?.message ?? "Erreur chargement lignes devis." });
        setDevisLignes([]);
      } finally {
        if (alive) setDevisLinesLoading(false);
      }
    }

    void loadLines();
    return () => {
      alive = false;
    };
  }, [activeDevisId]);

  const taskStats = useMemo(() => {
    return {
      todo: tasks.filter((task) => task.status === "A_FAIRE").length,
      running: tasks.filter((task) => task.status === "EN_COURS").length,
      done: tasks.filter((task) => task.status === "FAIT").length,
    };
  }, [tasks]);

  const lastDevis = devis[0] ?? null;

  function resetTaskDraft() {
    setTaskTitle("");
    setTaskLot("");
    setTaskQty("1");
    setTaskUnit("");
    setTaskHours("1");
    setTaskIntervenantId("");
  }

  async function saveTask(event: FormEvent) {
    event.preventDefault();
    const title = taskTitle.trim();
    const lot = taskLot.trim();
    const qty = toNumberOrNull(taskQty) ?? 1;
    const hours = taskHours.trim() ? toNumberOrNull(taskHours) : null;
    const assignedIds = taskIntervenantId ? [taskIntervenantId] : [];

    if (!title) {
      setToast({ type: "error", msg: "Intitule de tache obligatoire." });
      return;
    }
    if (qty <= 0) {
      setToast({ type: "error", msg: "Quantite invalide." });
      return;
    }
    if (taskHours.trim() && (hours === null || hours <= 0)) {
      setToast({ type: "error", msg: "Temps prevu invalide." });
      return;
    }

    setSavingTask(true);
    try {
      const created = await createTask({
        chantier_id: chantierId,
        titre: title,
        titre_terrain: title,
        corps_etat: lot || null,
        lot: lot || null,
        status: "A_FAIRE",
        quality_status: "a_faire",
        admin_validation_status: "non_verifie",
        intervenant_id: taskIntervenantId || null,
        quantite: qty,
        unite: taskUnit.trim() || null,
        temps_prevu_h: hours,
        order_index: tasks.length,
      });
      if (assignedIds.length > 0) {
        await replaceTaskAssignees(created.id, assignedIds);
      }
      await refreshPreparationData();
      resetTaskDraft();
      setTaskDrawerOpen(false);
      setActiveDrawer("tasks");
      setToast({ type: "ok", msg: "Tache ajoutee au chantier." });
    } catch (err: any) {
      setToast({ type: "error", msg: err?.message ?? "Erreur ajout tache." });
    } finally {
      setSavingTask(false);
    }
  }

  async function deleteTask(task: ChantierTaskRow) {
    if (!canDeleteTasks) {
      setToast({ type: "error", msg: "Suppression reservee aux profils admin et conducteur de travaux." });
      return;
    }

    const title = displayTaskTitle(task);
    const confirmed = window.confirm(
      `Supprimer la tache "${title}" ?\n\nCette action retire la tache du chantier. Elle est reservee aux profils admin et conducteur de travaux.`,
    );
    if (!confirmed) return;

    setDeletingTaskId(task.id);
    try {
      await deleteTasksByIds([task.id]);
      await refreshPreparationData(activeDevisId);
      setToast({ type: "ok", msg: "Tache supprimee." });
    } catch (err: any) {
      setToast({ type: "error", msg: err?.message ?? "Suppression impossible pour cette tache." });
    } finally {
      setDeletingTaskId(null);
    }
  }

  async function onDevisImported(result: DevisImportResult) {
    await refreshPreparationData(result.devisId);
    setActiveDrawer("quotes");
    setToast({
      type: "ok",
      msg: `Devis importe: ${result.linesInserted} ligne(s), ${result.tasksCreated} tache(s) creee(s).`,
    });
  }

  const chapterCards = [
    {
      key: "tasks" as const,
      title: "Taches",
      value: `${tasks.length}`,
      helper: `${taskStats.todo} a faire | ${taskStats.running} en cours | ${taskStats.done} terminees`,
      action: "Gerer",
    },
    {
      key: "quotes" as const,
      title: "Devis",
      value: `${devis.length}`,
      helper: lastDevis ? `Dernier import: ${lastDevis.nom}` : "Aucun devis importe",
      action: "Lire",
    },
    {
      key: "checklist" as const,
      title: "Checklist",
      value: "Prep",
      helper: "Points de preparation operationnelle du chantier",
      action: "Ouvrir",
    },
  ];

  return (
    <div className="space-y-5">
      {toast ? (
        <div
          className={[
            "fixed bottom-6 right-6 z-50 rounded-xl border px-4 py-3 text-sm shadow-lg",
            toast.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800",
          ].join(" ")}
        >
          {toast.msg}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
              Preparation chantier
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-950">Organiser avant execution</div>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Taches, devis, checklist et localisation restent en preparation. Les formulaires s'ouvrent dans des panneaux dedies.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTaskDrawerOpen(true)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Creer une tache
            </button>
            <button
              type="button"
              onClick={() => setDevisImportOpen(true)}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
            >
              Importer devis
            </button>
          </div>
        </div>
        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {chapterCards.map((card) => (
          <article key={card.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{card.title}</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{loading ? "..." : card.value}</div>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawer(card.key)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
              >
                {card.action}
              </button>
            </div>
            <div className="mt-3 text-sm text-slate-500">{loading ? "Chargement..." : card.helper}</div>
          </article>
        ))}
      </section>

      {activeDrawer === "tasks" ? (
        <Drawer
          title="Taches chantier"
          subtitle="Creation, lecture et suppression controlee des taches avant execution terrain."
          onClose={() => setActiveDrawer(null)}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-slate-500">
              {canDeleteTasks
                ? "Suppression disponible pour admin et conducteur de travaux."
                : "Suppression reservee aux profils admin et conducteur de travaux."}
            </div>
            <button
              type="button"
              onClick={() => setTaskDrawerOpen(true)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Creer une tache
            </button>
          </div>
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucune tache preparee.
              </div>
            ) : (
              tasks.map((task) => {
                const progress = getTaskProgress(task);
                const assigned = task.intervenant_id
                  ? intervenants.find((intervenant) => intervenant.id === task.intervenant_id)?.nom ?? "Intervenant"
                  : "Non affecte";
                return (
                  <article key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-950">{displayTaskTitle(task)}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>Lot: {displayTaskLot(task)}</span>
                          <span>Intervenant: {assigned}</span>
                          <span>
                            Quantite: {task.quantite ?? "-"}{task.unite ? ` ${task.unite}` : ""}
                          </span>
                          <span>Temps prevu: {task.temps_prevu_h ?? "-"} h</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <div className="min-w-[110px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          {progress === null ? "Avancement -" : `${progress}%`}
                        </div>
                        {canDeleteTasks ? (
                          <button
                            type="button"
                            onClick={() => void deleteTask(task)}
                            disabled={deletingTaskId === task.id}
                            className="rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            {deletingTaskId === task.id ? "Suppression..." : "Supprimer"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </Drawer>
      ) : null}

      {activeDrawer === "quotes" ? (
        <Drawer
          title="Lecteur devis"
          subtitle="Lecture des devis importes et des lignes qui generent les taches."
          onClose={() => setActiveDrawer(null)}
        >
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => setDevisImportOpen(true)}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
            >
              Importer devis
            </button>
          </div>
          <div className="space-y-3">
            {devis.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucun devis importe sur ce chantier.
              </div>
            ) : (
              devis.map((row) => {
                const opened = activeDevisId === row.id;
                return (
                  <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <button
                      type="button"
                      onClick={() => setActiveDevisId(opened ? null : row.id)}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <span>
                        <span className="block font-semibold text-slate-950">{row.nom || "Devis chantier"}</span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {row.created_at ? new Date(row.created_at).toLocaleDateString("fr-FR") : "Date inconnue"}
                        </span>
                      </span>
                      <span className="rounded-xl border border-slate-200 px-3 py-1 text-xs text-slate-600">
                        {opened ? "Fermer" : "Lire"}
                      </span>
                    </button>

                    {opened ? (
                      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                        {devisLinesLoading ? (
                          <div className="text-sm text-slate-500">Chargement des lignes...</div>
                        ) : devisLignes.length === 0 ? (
                          <div className="text-sm text-slate-500">Aucune ligne de devis.</div>
                        ) : (
                          devisLignes.map((line) => (
                            <div key={line.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                              <div className="font-medium text-slate-950">{line.designation}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {(line.corps_etat ?? "Lot non renseigne")} | {line.quantite ?? "-"} {line.unite ?? ""}
                                {line.generer_tache ? " | tache generee" : ""}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </Drawer>
      ) : null}

      {activeDrawer === "checklist" ? (
        <Drawer
          title="Checklist preparation"
          subtitle="Points de controle a valider avant execution."
          onClose={() => setActiveDrawer(null)}
        >
          <PreparationChecklistTab chantierId={chantierId} />
        </Drawer>
      ) : null}

      {taskDrawerOpen ? (
        <Drawer
          title="Creation manuelle"
          subtitle="Ajouter une tache de preparation sans passer par la production."
          onClose={() => setTaskDrawerOpen(false)}
        >
          <form onSubmit={saveTask} className="space-y-4">
            <label className="block space-y-1 text-sm text-slate-700">
              <span>Intitule de la tache</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="Ex: Pose receveur douche"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1 text-sm text-slate-700">
                <span>Lot</span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={taskLot}
                  onChange={(event) => setTaskLot(event.target.value)}
                  placeholder="Ex: Plomberie"
                />
              </label>
              <label className="block space-y-1 text-sm text-slate-700">
                <span>Intervenant</span>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={taskIntervenantId}
                  onChange={(event) => setTaskIntervenantId(event.target.value)}
                >
                  <option value="">Non affecte</option>
                  {intervenants.map((intervenant) => (
                    <option key={intervenant.id} value={intervenant.id}>
                      {intervenant.nom}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="block space-y-1 text-sm text-slate-700">
                <span>Quantite</span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  inputMode="decimal"
                  value={taskQty}
                  onChange={(event) => setTaskQty(event.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm text-slate-700">
                <span>Unite</span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={taskUnit}
                  onChange={(event) => setTaskUnit(event.target.value)}
                  placeholder="m2, u, h..."
                />
              </label>
              <label className="block space-y-1 text-sm text-slate-700">
                <span>Temps prevu (h)</span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  inputMode="decimal"
                  value={taskHours}
                  onChange={(event) => setTaskHours(event.target.value)}
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setTaskDrawerOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
                disabled={savingTask}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
                disabled={savingTask}
              >
                {savingTask ? "Creation..." : "Creer la tache"}
              </button>
            </div>
          </form>
        </Drawer>
      ) : null}

      <DevisImportDrawer
        open={devisImportOpen}
        chantierId={chantierId}
        intervenants={intervenants}
        onClose={() => setDevisImportOpen(false)}
        onImported={onDevisImported}
      />
    </div>
  );
}
