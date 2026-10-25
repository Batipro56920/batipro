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
import { AgendaCalendar } from "../agenda/components/AgendaCalendar";
import { AgendaEventDrawer } from "../agenda/components/AgendaEventDrawer";
import { AgendaGoogleCalendarFrame } from "../agenda/components/AgendaGoogleCalendarFrame";
import { AgendaHeader } from "../agenda/components/AgendaHeader";
import { useAgendaData } from "../agenda/hooks/useAgendaData";
import type { AgendaEvent } from "../agenda/types";

type AgendaDisplayMode = "batipro" | "google";

function projectPathForEvent(
  event: AgendaEvent,
  projectPathByTaskId: ReadonlyMap<string, string>,
  projectPathByAppointmentId: ReadonlyMap<string, string>,
) {
  if (event.task) return projectPathByTaskId.get(event.task.id) ?? null;
  if (event.appointment) return projectPathByAppointmentId.get(event.appointment.id) ?? null;
  return null;
}

function buildCalendarSyncEvents(
  events: AgendaEvent[],
  projectPathByTaskId: ReadonlyMap<string, string>,
  projectPathByAppointmentId: ReadonlyMap<string, string>,
): GoogleCalendarSyncEvent[] {
  const syncEvents: GoogleCalendarSyncEvent[] = [];

  for (const event of events) {
    if (!event.date) continue;
    const destination = projectPathForEvent(event, projectPathByTaskId, projectPathByAppointmentId) ?? "/crm/agenda";

    if (event.source === "appointment" && event.appointment?.starts_at) {
      syncEvents.push({
        sourceType: "crm_appointment",
        sourceId: event.appointment.id,
        title: event.title,
        startsAt: event.appointment.starts_at,
        endsAt: event.appointment.ends_at,
        calendarScope: "crm",
        description: event.description,
        url: `${window.location.origin}${destination}`,
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
        url: `${window.location.origin}${destination}`,
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
  projectPathByTaskId,
  projectPathByAppointmentId,
  onTask,
  onAppointment,
  onDone,
  onReschedule,
  onCancel,
  actionBusy,
}: {
  tasks: CrmTaskRow[];
  appointments: CrmAppointmentRow[];
  projectPathByTaskId: ReadonlyMap<string, string>;
  projectPathByAppointmentId: ReadonlyMap<string, string>;
  onTask: () => void;
  onAppointment: () => void;
  onDone: (row: CrmTaskRow) => void;
  onReschedule: (row: CrmTaskRow, dueAt: string) => void;
  onCancel: (row: CrmTaskRow) => void;
  actionBusy: boolean;
}) {
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [displayMode, setDisplayMode] = useState<AgendaDisplayMode>("batipro");
  const [connection, setConnection] = useState<GoogleCalendarConnectionStatus | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const agenda = useAgendaData(tasks, appointments);
  const syncEvents = useMemo(
    () => buildCalendarSyncEvents(agenda.events, projectPathByTaskId, projectPathByAppointmentId),
    [agenda.events, projectPathByAppointmentId, projectPathByTaskId],
  );
  const selectedProjectPath = selectedEvent
    ? projectPathForEvent(selectedEvent, projectPathByTaskId, projectPathByAppointmentId)
    : null;

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
        // Le detail renvoye par Google vaut mille fois mieux qu'un compteur : c'est
        // lui qui dit si c'est un droit refuse, un agenda introuvable ou une date
        // invalide.
        const first = result.errors[0]?.message?.trim();
        setSyncError(
          `${result.errors.length} événement(s) non synchronisé(s)${first ? ` : ${first}` : "."}`,
        );
      }
    } catch (err: any) {
      setSyncError(err?.message ?? "Synchronisation Google Calendar impossible.");
    } finally {
      setSyncBusy(false);
    }
  }

  return (
    <div className="space-y-3">
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
      {syncNotice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{syncNotice}</div> : null}
      {syncError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{syncError}</div> : null}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm shadow-slate-950/[0.03]">
        {(["batipro", "google"] as AgendaDisplayMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setDisplayMode(mode)}
            className={[
              "rounded-xl px-3 py-2 text-sm font-semibold transition",
              displayMode === mode ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50",
            ].join(" ")}
          >
            {mode === "batipro" ? "Agenda Batipro" : "Vue Google Calendar"}
          </button>
        ))}
      </div>
      {displayMode === "google" ? (
        <AgendaGoogleCalendarFrame connection={connection} syncBusy={syncBusy} onConnectGoogle={connectGoogle} />
      ) : (
        <AgendaCalendar events={agenda.events} onSelect={setSelectedEvent} onCreate={onAppointment} />
      )}
      <AgendaEventDrawer
        event={selectedEvent}
        projectPath={selectedProjectPath}
        busy={actionBusy}
        onClose={() => setSelectedEvent(null)}
        onDone={(event) => {
          if (!event.task) return;
          onDone(event.task);
          setSelectedEvent(null);
        }}
        onReschedule={(event, dueAt) => {
          if (!event.task) return;
          onReschedule(event.task, dueAt);
          setSelectedEvent(null);
        }}
        onCancel={(event) => {
          if (!event.task) return;
          if (!window.confirm(`Annuler la tâche "${event.title}" ?`)) return;
          onCancel(event.task);
          setSelectedEvent(null);
        }}
      />
    </div>
  );
}
