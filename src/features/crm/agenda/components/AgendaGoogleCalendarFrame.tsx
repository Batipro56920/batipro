import { CalendarDays, ExternalLink, Upload } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import type { GoogleCalendarConnectionStatus } from "../../../../services/googleCalendar.service";

function buildGoogleCalendarEmbedUrl(connection: GoogleCalendarConnectionStatus) {
  const source = connection.calendarId && connection.calendarId !== "primary" ? connection.calendarId : connection.calendarEmail || "primary";
  const params = new URLSearchParams({
    height: "720",
    wkst: "2",
    bgcolor: "#ffffff",
    ctz: "Europe/Paris",
    mode: "WEEK",
    showTitle: "0",
    showPrint: "0",
    showTabs: "1",
    showCalendars: "1",
    showTz: "0",
  });
  params.append("src", source);
  return `https://calendar.google.com/calendar/embed?${params.toString()}`;
}

export function AgendaGoogleCalendarFrame({
  connection,
  syncBusy,
  onConnectGoogle,
}: {
  connection: GoogleCalendarConnectionStatus | null;
  syncBusy: boolean;
  onConnectGoogle: () => void;
}) {
  const connected = connection?.connected === true;
  const embedUrl = connected && connection ? buildGoogleCalendarEmbedUrl(connection) : null;

  if (!connected || !embedUrl) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-950/[0.03]">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <CalendarDays className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-950">Vue Google Calendar</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Connecte le compte Google de ce profil pour afficher son calendrier directement dans Batipro.
          </p>
          <Button type="button" variant="primary" size="md" onClick={onConnectGoogle} disabled={syncBusy} className="mt-4">
            <Upload className="h-4 w-4" />
            Connecter Google
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03]">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Vue Google Calendar</h3>
          <p className="mt-0.5 text-xs text-slate-500">Affichage direct du calendrier Google connecté à ce profil.</p>
        </div>
        <a
          href="https://calendar.google.com/calendar/u/0/r"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ExternalLink className="h-4 w-4" />
          Ouvrir Google
        </a>
      </div>
      <iframe
        title="Google Calendar intégré"
        src={embedUrl}
        className="h-[720px] w-full border-0 bg-white"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </section>
  );
}
