import { CalendarPlus, CheckSquare, RefreshCw, Upload } from "lucide-react";
import { Button } from "../../../../components/ui/button";

type CalendarConnectionStatus = {
  connected: boolean;
  calendarEmail: string | null;
  calendarId: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
};

type Props = {
  connection: CalendarConnectionStatus | null;
  syncBusy: boolean;
  syncDisabled: boolean;
  onTask: () => void;
  onAppointment: () => void;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
  onSyncGoogle: () => void;
};

function formatSyncDate(value: string | null | undefined) {
  if (!value) return null;
  return value.slice(0, 16).replace("T", " ");
}

export function AgendaHeader({
  connection,
  syncBusy,
  syncDisabled,
  onTask,
  onAppointment,
  onConnectGoogle,
  onDisconnectGoogle,
  onSyncGoogle,
}: Props) {
  const connected = connection?.connected === true;
  const calendarLabel = connection?.calendarEmail || connection?.calendarId || "Agenda principal";
  const lastSync = formatSyncDate(connection?.lastSyncAt);

  return (
    <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.03]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">CRM</div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Agenda commercial</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Pilotez vos rendez-vous, relances et tâches commerciales, puis synchronisez-les avec Google Calendar.
          </p>
          <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className={connected ? "font-semibold text-emerald-700" : "font-semibold text-slate-700"}>
              {connected ? "Google Calendar connecté" : "Google Calendar non connecté"}
            </span>
            {connected ? <span>{calendarLabel}</span> : null}
            {lastSync ? <span>Dernière synchro {lastSync}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
          <Button type="button" variant="secondary" size="md" onClick={onTask}>
            <CheckSquare className="h-4 w-4" />
            Tâche
          </Button>
          <Button type="button" variant="primary" size="md" onClick={onAppointment}>
            <CalendarPlus className="h-4 w-4" />
            RDV
          </Button>
          {connected ? (
            <>
              <Button type="button" variant="secondary" size="md" onClick={onSyncGoogle} disabled={syncBusy || syncDisabled}>
                <RefreshCw className="h-4 w-4" />
                {syncBusy ? "Synchro..." : "Synchroniser"}
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={onDisconnectGoogle} disabled={syncBusy}>
                Déconnecter
              </Button>
            </>
          ) : (
            <Button type="button" variant="secondary" size="md" onClick={onConnectGoogle} disabled={syncBusy}>
              <Upload className="h-4 w-4" />
              Connecter Google
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
