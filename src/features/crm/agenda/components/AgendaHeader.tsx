import { CalendarPlus, CheckSquare, RefreshCw, Upload } from "lucide-react";
import { Button } from "../../../../components/ui/button";

type CalendarConnectionStatus = {
  connected: boolean;
  calendarEmail: string | null;
  calendarId: string | null;
  lastSyncAt: string | null;
};

type Props = {
  connection?: CalendarConnectionStatus | null;
  syncBusy?: boolean;
  syncDisabled?: boolean;
  onTask: () => void;
  onAppointment: () => void;
  onConnectGoogle?: () => void;
  onDisconnectGoogle?: () => void;
  onSyncGoogle?: () => void;
};

function formatSyncDate(value: string | null | undefined) {
  if (!value) return null;
  return value.slice(0, 16).replace("T", " ");
}

function noop() {}

export function AgendaHeader({
  connection = null,
  syncBusy = false,
  syncDisabled = false,
  onTask,
  onAppointment,
  onConnectGoogle,
  onDisconnectGoogle,
  onSyncGoogle,
}: Props) {
  const connected = connection?.connected === true;
  const calendarLabel = connected ? connection?.calendarEmail || connection?.calendarId || "Batipro - CRM" : "Google non connecté";
  const lastSync = formatSyncDate(connection?.lastSyncAt);
  const googleReady = Boolean(onConnectGoogle && onDisconnectGoogle && onSyncGoogle);
  const handleConnectGoogle = onConnectGoogle ?? noop;
  const handleDisconnectGoogle = onDisconnectGoogle ?? noop;
  const handleSyncGoogle = onSyncGoogle ?? noop;

  return (
    <header className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-950/[0.03]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">Agenda commercial</h2>
            <span className={connected ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700" : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"}>
              {calendarLabel}
            </span>
            {lastSync ? <span className="text-xs text-slate-400">Synchro {lastSync}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
              <Button type="button" variant="secondary" size="md" onClick={handleSyncGoogle} disabled={!googleReady || syncBusy || syncDisabled}>
                <RefreshCw className="h-4 w-4" />
                {syncBusy ? "Synchro..." : "Synchroniser"}
              </Button>
              <Button type="button" variant="ghost" size="md" onClick={handleDisconnectGoogle} disabled={!googleReady || syncBusy}>
                Déconnecter
              </Button>
            </>
          ) : (
            <Button type="button" variant="secondary" size="md" onClick={handleConnectGoogle} disabled={!googleReady || syncBusy}>
              <Upload className="h-4 w-4" />
              Connecter Google
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
