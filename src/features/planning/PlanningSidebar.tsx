import type { PlanningEntryRow, PlanningTaskRow, TaskDependencyRow } from "./planning.service";

type Props = {
  selectedEntry: PlanningEntryRow | null;
  selectedTask: PlanningTaskRow | null;
  dependencies: TaskDependencyRow[];
  onToggleLock: () => void;
  onDeleteEntry: () => void;
  onClearSelection: () => void;
  unplannedTasks: PlanningTaskRow[];
  onCreateEntry: (task: PlanningTaskRow) => void;
};

export default function PlanningSidebar({
  selectedEntry,
  selectedTask,
  dependencies,
  onToggleLock,
  onDeleteEntry,
  onClearSelection,
  unplannedTasks,
  onCreateEntry,
}: Props) {
  const taskDeps = selectedTask
    ? dependencies.filter(
        (d) => d.predecessor_task_id === selectedTask.id || d.successor_task_id === selectedTask.id,
      )
    : [];

  return (
    <div className="rounded-2xl border bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm">Détails</div>
        {selectedTask ? (
          <button
            type="button"
            onClick={onClearSelection}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Fermer
          </button>
        ) : null}
      </div>

      {selectedTask && selectedEntry ? (
        <div className="space-y-3">
          <div>
            <div className="text-xs text-slate-500">Tâche</div>
            <div className="text-sm font-medium">{selectedTask.titre}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-slate-500">Lot</div>
              <div>{selectedTask.lot ?? selectedTask.corps_etat ?? "—"}</div>
            </div>
            <div>
              <div className="text-slate-500">Statut</div>
              <div>{selectedTask.status}</div>
            </div>
            <div>
              <div className="text-slate-500">Début</div>
              <div>{selectedEntry.start_date}</div>
            </div>
            <div>
              <div className="text-slate-500">Fin</div>
              <div>{selectedEntry.end_date}</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">Dépendances</div>
            {taskDeps.length === 0 ? (
              <div className="text-xs text-slate-400">Aucune dépendance.</div>
            ) : (
              <ul className="text-xs text-slate-600 list-disc ml-4">
                {taskDeps.map((d) => (
                  <li key={d.id}>
                    {d.predecessor_task_id === selectedTask.id ? "Successeur" : "Prédécesseur"} —{" "}
                    {d.type}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onToggleLock}
              className="rounded-xl border px-3 py-1.5 text-xs hover:bg-slate-50"
            >
              {selectedEntry.is_locked ? "Déverrouiller" : "Verrouiller"}
            </button>
            <button
              type="button"
              onClick={onDeleteEntry}
              className="rounded-xl border border-red-200 text-red-700 px-3 py-1.5 text-xs hover:bg-red-50"
            >
              Supprimer planning
            </button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-500">Sélectionnez une tâche planifiée.</div>
      )}

      <div className="border-t pt-3 space-y-2">
        <div className="text-xs text-slate-500">Tâches non planifiées</div>
        {unplannedTasks.length === 0 ? (
          <div className="text-xs text-slate-400">Toutes les tâches sont planifiées.</div>
        ) : (
          <div className="space-y-2">
            {unplannedTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-2">
                <div className="text-xs truncate">{task.titre}</div>
                <button
                  type="button"
                  onClick={() => onCreateEntry(task)}
                  className="rounded-xl border px-2 py-1 text-xs hover:bg-slate-50"
                >
                  Planifier
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



