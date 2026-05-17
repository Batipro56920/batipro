import { useState } from "react";
import type { CrmAppointmentRow, CrmTaskRow } from "../../../services/crm.service";
import { AgendaActionCenter } from "../agenda/components/AgendaActionCenter";
import { AgendaCalendar } from "../agenda/components/AgendaCalendar";
import { AgendaEventDrawer } from "../agenda/components/AgendaEventDrawer";
import { AgendaHeader } from "../agenda/components/AgendaHeader";
import { AgendaKpiGrid } from "../agenda/components/AgendaKpiGrid";
import { useAgendaData } from "../agenda/hooks/useAgendaData";
import type { AgendaEvent } from "../agenda/types";

export default function CrmAgendaSection({
  tasks,
  appointments,
  onTask,
  onAppointment,
  onDone,
}: {
  tasks: CrmTaskRow[];
  appointments: CrmAppointmentRow[];
  onTask: () => void;
  onAppointment: () => void;
  onDone: (row: CrmTaskRow) => void;
}) {
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const agenda = useAgendaData(tasks, appointments);

  return (
    <div className="space-y-5">
      <AgendaHeader onTask={onTask} onAppointment={onAppointment} />
      <AgendaKpiGrid kpis={agenda.kpis} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <AgendaCalendar events={agenda.events} onSelect={setSelectedEvent} onCreate={onAppointment} />
        <AgendaActionCenter today={agenda.todayEvents} overdue={agenda.overdueTasks} week={agenda.weekEvents} relances={agenda.relances} onSelect={setSelectedEvent} />
      </div>
      <AgendaEventDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onDone={(event) => {
          if (event.task) onDone(event.task);
        }}
      />
    </div>
  );
}
