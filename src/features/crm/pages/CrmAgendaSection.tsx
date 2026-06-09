import { useCallback, useEffect, useMemo, useState } from "react";
import type { CrmAppointmentRow, CrmTaskRow } from "../../../services/crm.service";
import {
  disconnectGoogleCalendar,
  getGoogleCalendarConnectionStatus,
  startGoogleCalendarConnection,
  syncGoogleCalendarEvents,
  type GoogleCalendarConnectionStatus,
  type GoogleCalendarSyncEvent,
} from "../../../services/googleCalendar.service";
import { AgendaActionCenter } from "../agenda/components/AgendaActionCenter";
import { AgendaCalendar } from "../agenda/components/AgendaCalendar";
import { AgendaEventDrawer } from "../agenda/components/AgendaEventDrawer";
import { AgendaHeader } from "../agenda/components/AgendaHeader";
import { AgendaKpiGrid } from "../agenda/components/AgendaKpiGrid";
import { useAgendaData } from "../agenda/hooks/useAgendaData";
import type { AgendaEvent } from "../agenda/types";

function buildCalendarSyncEvents(events: AgendaEvent[]): GoogleCalendarSyncEvent[] {
  const syncEvents: GoogleCalendarSyncEvent[] = [];

  for (const event of events) {
    if (!event.date) continue;

    if (event.source === "appointment" && event.appointment?.starts_at) {
      syncEvents.push({
        sourceType: "crm_appointment",
        sourceId: event.appointment.id,
        title: event.title,
        startsAt: event.appointment.starts_at,
        endsAt: event.appointment.ends_at,
        calendarScope: "crm",
        description: event.description,
        url: `${window.location.origin}/crm/agenda`,
      });
      continue;
    }

    if (event.source === "task" && event.task?.due_at) {
      syncEvents.push({
        sourceType: "crm_task",
        sourceId: event.task.id,
        title: event.title,
        startsAt: event.task.due_at,
        endsAt: null,
        calendarScope: "crm",
        description: event.description,
        url: `${window.location.origin}/crm/agenda`,
      });
    }
  }

  return syncEvents;
}

const DISCONNECTED_GOOGLE_CALENDAR: GoogleCalendarConnectionStatus = {
  connected: false,
  calendarEmail: null,
  calendarId: null,
  connectedAt: null,
  lastSyncAt: null,
};

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
  const [connection, setConnection] = useState<GoogleCalendarConnectionStatus | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const agenda = useAgendaData(tasks, appointments);
  const syncEvents = useMemo(() => buildCalendarSyncEvents(agenda.events), [agenda.events]);

  const refreshConnection = useCallback(async (showError = false) => {
    try {
      setConnection(await getGoogleCalendarConnectionStatus());
    } catch (err: any) {
      setConnection(DISCONNECTED_GOOGLE_CALENDAR);
      if (showError) {
        setSyncError(err?.message ?? "Impossible de vérifier Google Calendar.");
      }
    }
  }, []);

  useEffect(() => {
    void refreshConnection(false);
  }, [refreshConnection]);

  async function connectGoogle() {
    setSyncBusy(true);
    setSyncError(null);
    setSyncNotice(null);
    try {
      const url = await startGoogleCalendarConnection(`${window.location.origin}/crm/agenda`);
      window.location.href = url;
    } catch (err: any) {
      setSyncError(err?.message ?? "Connexion Google Calendar impossible.");
      setSyncBusy(false);
    }
  }

  async function disconnectGoogle() {
    setSyncBusy(true);
    setSyncError(null);
    setSyncNotice(null);
    try {
      await disconnectGoogleCalendar();
      await refreshConnection(true);
      setSyncNotice("Google Calendar déconnecté.");
    } catch (err: any) {
      setSyncError(err?.message ?? "Déconnexion Google Calendar impossible.");
    } finally {
      setSyncBusy(false);
    }
  }

  async function syncGoogle() {
    setSyncBusy(true);
    setSyncError(null);
    setSyncNotice(null);
    try {
      const result = await syncGoogleCalendarEvents(syncEvents);
      await refreshConnection(true);
      setSyncNotice(`${result.synced} événement(s) synchronisé(s) avec Google Calendar${result.skipped ? `, ${result.skipped} ignoré(s)` : ""}.`);
      if (result.errors.length) {
        setSyncError(`${result.errors.length} événement(s) n'ont pas pu être synchronisés.`);
      }
    } catch (err: any) {
      setSyncError(err?.message ?? "Synchronisation Google Calendar impossible.");
    } finally {
      setSyncBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <AgendaHeader
        connection={connection}
        syncBusy={syncBusy}
        syncDisabled={syncEvents.length === 0}
        onTask={onTask}
        onAppointment={onAppointment}
        onConnectGoogle={connectGoogle}
        onDisconnectGoogle={disconnectGoogle}
        onSyncGoogle={syncGoogle}
      />
      {syncNotice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{syncNotice}</div> : null}
      {syncError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{syncError}</div> : null}
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
