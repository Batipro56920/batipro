import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { IntervenantRow } from "../../services/intervenants.service";
import PlanningGanttView from "./PlanningGanttView";
import PlanningTeamView from "./PlanningTeamView";
import PlanningSidebar from "./PlanningSidebar";
import PlanningToolbar from "./PlanningToolbar";
import {
  checkDependencyViolations,
  checkIntervenantConflicts,
  computeSequentialSchedule,
  getPeriodRange,
  type PlanningPeriod,
  formatDate,
  parseDate,
  addDays,
} from "./planning.utils";
import {
  createPlanningEntry,
  deletePlanningEntry,
  getDependencies,
  getPlanningEntries,
  getPlanningTasks,
  updatePlanningEntry,
  type PlanningEntryRow,
  type PlanningTaskRow,
  type TaskDependencyRow,
} from "./planning.service";

type Props = {
  chantierId: string;
  chantierName?: string | null;
  intervenants: IntervenantRow[];
};

const DAY_WIDTH = 40;

export default function PlanningPage({ chantierId, chantierName, intervenants }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<PlanningEntryRow[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependencyRow[]>([]);
  const [tasks, setTasks] = useState<PlanningTaskRow[]>([]);

  const [viewMode, setViewMode] = useState<"gantt" | "team">("gantt");
  const [period, setPeriod] = useState<PlanningPeriod>("week");
  const [anchorDate] = useState(new Date());

  const [lotFilter, setLotFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [intervenantFilter, setIntervenantFilter] = useState("");
  const [skipWeekends, setSkipWeekends] = useState(false);

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const exportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [taskRows, entryRows, depRows] = await Promise.all([
          getPlanningTasks(chantierId),
          getPlanningEntries(chantierId),
          getDependencies(chantierId),
        ]);
        if (!alive) return;
        setTasks(taskRows);
        setEntries(entryRows);
        setDependencies(depRows);
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message ?? "Erreur chargement planning.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    if (chantierId) load();
    return () => {
      alive = false;
    };
  }, [chantierId]);

  const { start: viewStart, days: viewDays } = useMemo(
    () => getPeriodRange(anchorDate, period),
    [anchorDate, period],
  );

  const entryByTask = useMemo(() => {
    const map = new Map<string, PlanningEntryRow>();
    for (const entry of entries) map.set(entry.task_id, entry);
    return map;
  }, [entries]);

  const taskTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) map.set(task.id, task.titre);
    return map;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const lotValue = task.lot ?? task.corps_etat ?? "";
      if (lotFilter && lotValue !== lotFilter) return false;
      if (zoneFilter && (task as any).zone !== zoneFilter) return false;

      if (intervenantFilter) {
        const entry = entryByTask.get(task.id);
        const assigned = entry?.assigned_intervenant_ids ?? [];
        if (!assigned.includes(intervenantFilter)) return false;
      }
      return true;
    });
  }, [tasks, lotFilter, zoneFilter, intervenantFilter, entryByTask]);

  const filteredEntries = useMemo(() => {
    const taskIds = new Set(filteredTasks.map((t) => t.id));
    return entries.filter((e) => taskIds.has(e.task_id));
  }, [entries, filteredTasks]);

  const selectedEntry = selectedEntryId ? entries.find((e) => e.id === selectedEntryId) ?? null : null;
  const selectedTask = selectedEntry ? tasks.find((t) => t.id === selectedEntry.task_id) ?? null : null;

  const conflictEntryIds = useMemo(() => {
    const conflicts = checkIntervenantConflicts(entries);
    const ids = new Set<string>();
    for (const c of conflicts) c.entries.forEach((id) => ids.add(id));
    return ids;
  }, [entries]);

  const violatedEntryIds = useMemo(() => {
    return new Set(checkDependencyViolations(entries, dependencies));
  }, [entries, dependencies]);

  const lotOptions = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      const value = t.lot ?? t.corps_etat ?? "";
      if (value) set.add(value);
    });
    return Array.from(set).sort().map((value) => ({ value, label: value }));
  }, [tasks]);

  const zoneOptions = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t: any) => {
      if (t.zone) set.add(t.zone);
    });
    return Array.from(set).sort().map((value) => ({ value, label: value }));
  }, [tasks]);

  const intervenantOptions = useMemo(
    () => intervenants.map((i) => ({ value: i.id, label: i.nom })),
    [intervenants],
  );

  const unplannedTasks = useMemo(
    () => filteredTasks.filter((t) => !entryByTask.has(t.id)),
    [filteredTasks, entryByTask],
  );

  const selectEntry = (entry: PlanningEntryRow) => setSelectedEntryId(entry.id);

  async function handleCreateEntry(task: PlanningTaskRow) {
    try {
      const start = task.date_debut ? parseDate(task.date_debut) : new Date();
      const end = task.date_fin ? parseDate(task.date_fin) : addDays(start, 1);
      const created = await createPlanningEntry({
        chantier_id: chantierId,
        task_id: task.id,
        start_date: formatDate(start),
        end_date: formatDate(end),
        assigned_intervenant_ids: task.intervenant_id ? [task.intervenant_id] : [],
      });
      setEntries((prev) => [...prev, created]);
      setSelectedEntryId(created.id);
    } catch (err: any) {
      setError(err?.message ?? "Erreur création planning.");
    }
  }

  async function handleUpdateEntryDates(entryId: string, start: string, end: string) {
    try {
      const updated = await updatePlanningEntry(entryId, { start_date: start, end_date: end });
      setEntries((prev) => prev.map((e) => (e.id === entryId ? updated : e)));
    } catch (err: any) {
      setError(err?.message ?? "Erreur mise à jour planning.");
    }
  }

  async function handleUpdateEntry(entryId: string, start: string, end: string, assignedIds: string[]) {
    try {
      const updated = await updatePlanningEntry(entryId, {
        start_date: start,
        end_date: end,
        assigned_intervenant_ids: assignedIds,
      });
      setEntries((prev) => prev.map((e) => (e.id === entryId ? updated : e)));
    } catch (err: any) {
      setError(err?.message ?? "Erreur mise à jour planning.");
    }
  }

  async function handleToggleLock() {
    if (!selectedEntry) return;
    try {
      const updated = await updatePlanningEntry(selectedEntry.id, { is_locked: !selectedEntry.is_locked });
      setEntries((prev) => prev.map((e) => (e.id === selectedEntry.id ? updated : e)));
    } catch (err: any) {
      setError(err?.message ?? "Erreur verrouillage.");
    }
  }

  async function handleDeleteEntry() {
    if (!selectedEntry) return;
    if (!confirm("Supprimer ce planning ?")) return;
    try {
      await deletePlanningEntry(selectedEntry.id);
      setEntries((prev) => prev.filter((e) => e.id !== selectedEntry.id));
      setSelectedEntryId(null);
    } catch (err: any) {
      setError(err?.message ?? "Erreur suppression planning.");
    }
  }

  async function handleAutoSchedule() {
    try {
      const { updates } = computeSequentialSchedule(entries, dependencies, new Date(), { skipWeekends });
      if (updates.length === 0) return;
      for (const update of updates) {
        await updatePlanningEntry(update.id, { start_date: update.start, end_date: update.end });
      }
      const refreshed = await getPlanningEntries(chantierId);
      setEntries(refreshed);
    } catch (err: any) {
      setError(err?.message ?? "Erreur replanification.");
    }
  }

  async function handleExportPdf() {
    const node = exportRef.current;
    if (!node) return;
    try {
      const canvas = await html2canvas(node, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`planning-${chantierName ?? chantierId}.pdf`);
    } catch (err: any) {
      setError(err?.message ?? "Erreur export PDF.");
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">Chargement planning...</div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PlanningToolbar
        period={period}
        onPeriodChange={setPeriod}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        lotFilter={lotFilter}
        zoneFilter={zoneFilter}
        intervenantFilter={intervenantFilter}
        lotOptions={lotOptions}
        zoneOptions={zoneOptions}
        intervenantOptions={intervenantOptions}
        onLotFilterChange={setLotFilter}
        onZoneFilterChange={setZoneFilter}
        onIntervenantFilterChange={setIntervenantFilter}
        onAutoSchedule={handleAutoSchedule}
        onExportPdf={handleExportPdf}
        skipWeekends={skipWeekends}
        onSkipWeekendsChange={setSkipWeekends}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div ref={exportRef} className="space-y-4">
          {viewMode === "gantt" ? (
            <PlanningGanttView
              tasks={filteredTasks}
              entries={filteredEntries}
              viewStart={viewStart}
              viewDays={viewDays}
              dayWidth={DAY_WIDTH}
              conflictEntryIds={conflictEntryIds}
              violatedEntryIds={violatedEntryIds}
              onSelectEntry={selectEntry}
              onCreateEntry={handleCreateEntry}
              onUpdateEntryDates={handleUpdateEntryDates}
            />
          ) : (
            <PlanningTeamView
              intervenants={intervenants}
              entries={filteredEntries}
              viewStart={viewStart}
              viewDays={viewDays}
              dayWidth={DAY_WIDTH}
              conflictEntryIds={conflictEntryIds}
              taskTitleById={taskTitleById}
              onSelectEntry={selectEntry}
              onUpdateEntry={handleUpdateEntry}
            />
          )}
        </div>

        <PlanningSidebar
          selectedEntry={selectedEntry}
          selectedTask={selectedTask}
          dependencies={dependencies}
          onToggleLock={handleToggleLock}
          onDeleteEntry={handleDeleteEntry}
          onClearSelection={() => setSelectedEntryId(null)}
          unplannedTasks={unplannedTasks}
          onCreateEntry={handleCreateEntry}
        />
      </div>
    </div>
  );
}



