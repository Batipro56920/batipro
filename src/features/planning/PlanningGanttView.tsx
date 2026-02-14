import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import type { PlanningEntryRow, PlanningTaskRow } from "./planning.service";
import { addDays, diffDays, formatDate, parseDate } from "./planning.utils";

type Props = {
  tasks: PlanningTaskRow[];
  entries: PlanningEntryRow[];
  viewStart: Date;
  viewDays: Date[];
  dayWidth: number;
  conflictEntryIds: Set<string>;
  violatedEntryIds: Set<string>;
  onSelectEntry: (entry: PlanningEntryRow) => void;
  onCreateEntry: (task: PlanningTaskRow) => void;
  onUpdateEntryDates: (entryId: string, start: string, end: string) => void;
};

type BarProps = {
  entry: PlanningEntryRow;
  title: string;
  left: number;
  width: number;
  conflict: boolean;
  violated: boolean;
  onSelect: () => void;
};

function DraggableBar({
  entry,
  title,
  left,
  width,
  conflict,
  violated,
  onSelect,
}: BarProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `move:${entry.id}`,
    disabled: !!entry.is_locked,
  });

  const {
    attributes: leftAttr,
    listeners: leftListeners,
    setNodeRef: leftRef,
    transform: leftTransform,
  } = useDraggable({
    id: `resize-left:${entry.id}`,
    disabled: !!entry.is_locked,
  });

  const {
    attributes: rightAttr,
    listeners: rightListeners,
    setNodeRef: rightRef,
    transform: rightTransform,
  } = useDraggable({
    id: `resize-right:${entry.id}`,
    disabled: !!entry.is_locked,
  });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      className={[
        "absolute top-1/2 -translate-y-1/2 h-[28px] rounded-lg flex items-center px-2 text-xs text-white",
        conflict ? "bg-red-500/60" : "bg-slate-800",
        violated ? "ring-2 ring-amber-300" : "",
        entry.is_locked ? "opacity-70" : "",
      ].join(" ")}
      style={{
        left,
        width,
        ...style,
      }}
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      <span className="truncate">{title}</span>
      {conflict || violated ? <span className="ml-1">⚠️</span> : null}
      <div
        ref={leftRef}
        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize"
        style={{
          transform: leftTransform ? `translate3d(${leftTransform.x}px, 0, 0)` : undefined,
        }}
        {...leftAttr}
        {...leftListeners}
      />
      <div
        ref={rightRef}
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
        style={{
          transform: rightTransform ? `translate3d(${rightTransform.x}px, 0, 0)` : undefined,
        }}
        {...rightAttr}
        {...rightListeners}
      />
    </div>
  );
}

export default function PlanningGanttView({
  tasks,
  entries,
  viewStart,
  viewDays,
  dayWidth,
  conflictEntryIds,
  violatedEntryIds,
  onSelectEntry,
  onCreateEntry,
  onUpdateEntryDates,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const tasksByLot = useMemo(() => {
    const map = new Map<string, PlanningTaskRow[]>();
    for (const task of tasks) {
      const group = task.lot ?? task.corps_etat ?? "Sans lot";
      const list = map.get(group) ?? [];
      list.push(task);
      map.set(group, list);
    }
    return Array.from(map.entries());
  }, [tasks]);

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

  const handleDragEnd = (event: DragEndEvent) => {
    const id = String(event.active.id);
    const isMove = id.startsWith("move:");
    const isResizeLeft = id.startsWith("resize-left:");
    const isResizeRight = id.startsWith("resize-right:");
    if (!isMove && !isResizeLeft && !isResizeRight) return;

    const entryId = id.split(":")[1];
    const entry = entries.find((e) => e.id === entryId);
    if (!entry || entry.is_locked) return;

    const daysDelta = Math.round(event.delta.x / dayWidth);
    if (!daysDelta) return;

    const start = parseDate(entry.start_date);
    const end = parseDate(entry.end_date);
    let nextStart = start;
    let nextEnd = end;

    if (isMove) {
      nextStart = addDays(start, daysDelta);
      nextEnd = addDays(end, daysDelta);
    } else if (isResizeLeft) {
      nextStart = addDays(start, daysDelta);
      if (nextStart > end) nextStart = end;
    } else if (isResizeRight) {
      nextEnd = addDays(end, daysDelta);
      if (nextEnd < start) nextEnd = start;
    }

    onUpdateEntryDates(entry.id, formatDate(nextStart), formatDate(nextEnd));
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="border rounded-2xl overflow-hidden bg-white">
        <div className="grid" style={{ gridTemplateColumns: "320px 1fr" }}>
          <div className="border-r bg-slate-50">
            <div className="px-3 py-2 text-xs text-slate-500 border-b">Tâches</div>
            <div className="divide-y">
              {tasksByLot.map(([lot, list]) => (
                <div key={lot} className="px-3 py-2">
                  <div className="text-xs font-semibold text-slate-700">{lot}</div>
                  <div className="mt-2 space-y-2">
                    {list.map((task) => {
                      const entry = entryByTask.get(task.id);
                      return (
                        <div key={task.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate">{task.titre}</span>
                          {entry ? null : (
                            <button
                              type="button"
                              onClick={() => onCreateEntry(task)}
                              className="rounded-xl border px-2 py-1 text-[11px] hover:bg-slate-50"
                            >
                              Planifier
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-auto">
            <div className="min-w-full">
              <div className="flex border-b bg-white sticky top-0 z-10">
                {viewDays.map((day) => (
                  <div
                    key={day.toISOString()}
                    className="border-r text-xs text-slate-500 py-2 text-center"
                    style={{ width: dayWidth }}
                  >
                    {day.getDate()}/{day.getMonth() + 1}
                  </div>
                ))}
              </div>

              <div className="divide-y">
                {tasks.map((task) => {
                  const entry = entryByTask.get(task.id);
                  const rowHeight = 38;
                  return (
                    <div key={task.id} className="relative" style={{ height: rowHeight }}>
                      <div className="absolute inset-0 flex">
                        {viewDays.map((day) => (
                          <div
                            key={day.toISOString()}
                            className="border-r"
                            style={{ width: dayWidth }}
                          />
                        ))}
                      </div>
                      {entry ? (() => {
                        const start = parseDate(entry.start_date);
                        const end = parseDate(entry.end_date);
                        const duration = Math.max(1, diffDays(start, end) + 1);
                        const leftDays = diffDays(viewStart, start);
                        const width = duration * dayWidth;
                        if (leftDays + duration < 0 || leftDays > viewDays.length) return null;
                        return (
                          <DraggableBar
                            key={entry.id}
                            entry={entry}
                            title={taskTitleById.get(entry.task_id) ?? entry.task_id.slice(0, 6)}
                            left={leftDays * dayWidth}
                            width={width}
                            conflict={conflictEntryIds.has(entry.id)}
                            violated={violatedEntryIds.has(entry.id)}
                            onSelect={() => onSelectEntry(entry)}
                          />
                        );
                      })() : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
}
