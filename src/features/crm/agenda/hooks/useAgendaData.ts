import { useMemo } from "react";
import type { CrmAppointmentRow, CrmTaskRow } from "../../../../services/crm.service";
import type { AgendaEvent, AgendaEventKind } from "../types";

function dateKey(value: string | null | undefined) {
  return value ? value.slice(0, 10) : null;
}

export function useAgendaData(tasks: CrmTaskRow[], appointments: CrmAppointmentRow[]) {
  const today = new Date().toISOString().slice(0, 10);
  const weekLimit = new Date();
  weekLimit.setDate(weekLimit.getDate() + 7);
  const weekLimitKey = weekLimit.toISOString().slice(0, 10);

  const events = useMemo<AgendaEvent[]>(() => [
    ...tasks.map((task) => {
      const taskDate = dateKey(task.due_at);
      const done = task.statut === "terminee";
      const overdue = !done && taskDate !== null && taskDate < today;
      const kind: AgendaEventKind = done ? "done" : overdue || task.priorite === "haute" ? "urgent" : task.type === "relance" ? "relance" : "task";
      return {
        id: `task-${task.id}`,
        title: task.titre,
        type: task.type,
        date: taskDate,
        description: task.description,
        priority: task.priorite,
        status: task.statut,
        kind,
        source: "task" as const,
        task,
      };
    }),
    ...appointments.map((appointment) => ({
      id: `appointment-${appointment.id}`,
      title: appointment.titre,
      type: appointment.type,
      date: dateKey(appointment.starts_at),
      description: appointment.notes ?? appointment.compte_rendu,
      priority: null,
      status: appointment.statut,
      kind: "rdv" as const,
      source: "appointment" as const,
      appointment,
    })),
  ], [appointments, tasks, today]);

  const todayEvents = events.filter((event) => event.date === today);
  const overdueTasks = events.filter((event) => event.source === "task" && event.status !== "terminee" && event.date !== null && event.date < today);
  const weekEvents = events.filter((event) => event.date !== null && event.date >= today && event.date <= weekLimitKey);
  const relances = events.filter((event) => event.kind === "relance" && event.status !== "terminee");

  return {
    events,
    today,
    todayEvents,
    overdueTasks,
    weekEvents,
    relances,
    kpis: {
      tasksToday: todayEvents.filter((event) => event.source === "task").length,
      appointmentsToday: todayEvents.filter((event) => event.source === "appointment").length,
      relancesDue: relances.length,
      overdue: overdueTasks.length,
      week: weekEvents.length,
    },
  };
}
