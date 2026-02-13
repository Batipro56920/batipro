import { useMemo, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { PlanningEntryRow } from "./planning.service";
import { addDays, diffDays, formatDate, parseDate } from "./planning.utils";
import type { IntervenantRow } from "../../services/intervenants.service";

type Props = {
  intervenants: IntervenantRow[];
  entries: PlanningEntryRow[];
  viewStart: Date;
  viewDays: Date[];
  dayWidth: number;
  conflictEntryIds: Set<string>;
  taskTitleById: Map<string, string>;
  onSelectEntry: (entry: PlanningEntryRow) => void;
  onUpdateEntry: (entryId: string, start: string, end: string, assignedIds: string[]) => void;
};

type TeamBarProps = {
  entry: PlanningEntryRow;
  title: string;
  left: number;
  width: number;
  conflict: boolean;
  onSelect: () => void;
};

function TeamBar({ entry, title, left, width, conflict, onSelect }: TeamBarProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `move:${entry.id}`,
    disabled: !!entry.is_locked,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={[
        "absolute top-1/2 -translate-y-1/2 h-[28px] rounded-lg flex items-center px-2 text-xs text-white",
        conflict ? "bg-red-500/60" : "bg-slate-800",
        entry.is_locked ? "opacity-70" : "",
      ].join(" ")}
      style={{
        left,
        width,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
    >
      <span className="truncate">{title}</span>
      {conflict ? <span className="ml-1">⚠️</span> : null}
    </div>
  );
}

function TeamRow({
  id,
  label,
  children,
  dayWidth,
  viewDays,
}: {
  id: string;
  label: string;
  children?: ReactNode;
  dayWidth: number;
  viewDays: Date[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="grid" style={{ gridTemplateColumns: "220px 1fr" }}>
      <div className="border-r px-3 py-2 text-xs">{label}</div>
      <div ref={setNodeRef} className="relative" style={{ height: 40, background: isOver ? "#f8fafc" : "" }}>
        <div className="absolute inset-0 flex">
          {viewDays.map((day) => (
            <div key={day.toISOString()} className="border-r" style={{ width: dayWidth }} />
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

export default function PlanningTeamView({
  intervenants,
  entries,
  viewStart,
  viewDays,
  dayWidth,
  conflictEntryIds,
  taskTitleById,
  onSelectEntry,
  onUpdateEntry,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const entryByRow = useMemo(() => {
    const map = new Map<string, PlanningEntryRow[]>();
    for (const entry of entries) {
      const assigned = entry.assigned_intervenant_ids?.[0] ?? "unassigned";
      const list = map.get(assigned) ?? [];
      list.push(entry);
      map.set(assigned, list);
    }
    return map;
  }, [entries]);

  const handleDragEnd = (event: DragEndEvent) => {
    const id = String(event.active.id);
    if (!id.startsWith("move:")) return;
    const entryId = id.replace("move:", "");
    const entry = entries.find((e) => e.id === entryId);
    if (!entry || entry.is_locked) return;

    const daysDelta = Math.round(event.delta.x / dayWidth);
    const nextStart = addDays(parseDate(entry.start_date), daysDelta);
    const nextEnd = addDays(parseDate(entry.end_date), daysDelta);

    let assignedIds = entry.assigned_intervenant_ids ?? [];
    const overId = event.over?.id ? String(event.over.id) : "";
    if (overId.startsWith("row:")) {
      const target = overId.replace("row:", "");
      assignedIds = target === "unassigned" ? [] : [target];
    }

    onUpdateEntry(entry.id, formatDate(nextStart), formatDate(nextEnd), assignedIds);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="border rounded-2xl overflow-hidden bg-white">
        <div className="grid" style={{ gridTemplateColumns: "220px 1fr" }}>
          <div className="border-r bg-slate-50 px-3 py-2 text-xs text-slate-500">Équipe</div>
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
        </div>

        <div className="divide-y">
          <TeamRow id="row:unassigned" label="Non assigné" dayWidth={dayWidth} viewDays={viewDays}>
            {(entryByRow.get("unassigned") ?? []).map((entry) => {
              const start = parseDate(entry.start_date);
              const end = parseDate(entry.end_date);
              const duration = Math.max(1, diffDays(start, end) + 1);
              const leftDays = diffDays(viewStart, start);
              if (leftDays + duration < 0 || leftDays > viewDays.length) return null;
              return (
                <TeamBar
                  key={entry.id}
                  entry={entry}
                  title={taskTitleById.get(entry.task_id) ?? entry.task_id.slice(0, 6)}
                  left={leftDays * dayWidth}
                  width={duration * dayWidth}
                  conflict={conflictEntryIds.has(entry.id)}
                  onSelect={() => onSelectEntry(entry)}
                />
              );
            })}
          </TeamRow>

          {intervenants.map((intervenant) => (
            <TeamRow
              key={intervenant.id}
              id={`row:${intervenant.id}`}
              label={intervenant.nom}
              dayWidth={dayWidth}
              viewDays={viewDays}
            >
              {(entryByRow.get(intervenant.id) ?? []).map((entry) => {
                const start = parseDate(entry.start_date);
                const end = parseDate(entry.end_date);
                const duration = Math.max(1, diffDays(start, end) + 1);
                const leftDays = diffDays(viewStart, start);
                if (leftDays + duration < 0 || leftDays > viewDays.length) return null;
                return (
                <TeamBar
                  key={entry.id}
                  entry={entry}
                  title={taskTitleById.get(entry.task_id) ?? entry.task_id.slice(0, 6)}
                  left={leftDays * dayWidth}
                  width={duration * dayWidth}
                  conflict={conflictEntryIds.has(entry.id)}
                  onSelect={() => onSelectEntry(entry)}
                />
                );
              })}
            </TeamRow>
          ))}
        </div>
      </div>
    </DndContext>
  );
}
