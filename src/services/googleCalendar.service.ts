import { supabase } from "../lib/supabaseClient";

export type GoogleCalendarConnectionStatus = {
  connected: boolean;
  calendarEmail: string | null;
  calendarId: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
};

export type GoogleCalendarScope = "crm" | "chantier" | "direction";

export type GoogleCalendarSyncEvent = {
  sourceType: "crm_task" | "crm_appointment" | "chantier_event" | "direction_event";
  sourceId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  calendarScope?: GoogleCalendarScope;
  description?: string | null;
  location?: string | null;
  url?: string | null;
};

export type GoogleCalendarSyncResult = {
  synced: number;
  skipped: number;
  errors: Array<{ sourceId: string; message: string }>;
};

async function invokeCalendarFunction<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: body ?? {} });
  if (error) throw new Error(error.message);
  return data as T;
}

export async function getGoogleCalendarConnectionStatus(): Promise<GoogleCalendarConnectionStatus> {
  return invokeCalendarFunction<GoogleCalendarConnectionStatus>("google-calendar-connection", { action: "status" });
}

export async function startGoogleCalendarConnection(redirectTo: string): Promise<string> {
  const result = await invokeCalendarFunction<{ authUrl: string }>("google-calendar-auth-url", { redirectTo });
  if (!result.authUrl) throw new Error("URL de connexion Google Calendar introuvable.");
  return result.authUrl;
}

export async function disconnectGoogleCalendar(): Promise<void> {
  await invokeCalendarFunction("google-calendar-connection", { action: "disconnect" });
}

export async function syncGoogleCalendarEvents(events: GoogleCalendarSyncEvent[]): Promise<GoogleCalendarSyncResult> {
  return invokeCalendarFunction<GoogleCalendarSyncResult>("google-calendar-sync", { events });
}

/**
 * Pousse un rendez-vous dans l'agenda connecté, sans jamais bloquer ni faire
 * échouer l'enregistrement. Une visite se note souvent en déplacement : un
 * agenda non connecté, un jeton expiré ou un réseau absent ne doivent pas
 * empêcher de la poser dans Batipro. La synchronisation manuelle de l'onglet
 * Agenda sert alors de rattrapage.
 */
export function syncAppointmentInBackground(appointment: {
  id?: string | null;
  titre?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  notes?: string | null;
}): void {
  const sourceId = String(appointment?.id ?? "").trim();
  const startsAt = String(appointment?.starts_at ?? "").trim();
  if (!sourceId || !startsAt) return;

  void syncGoogleCalendarEvents([
    {
      sourceType: "crm_appointment",
      sourceId,
      title: String(appointment?.titre ?? "").trim() || "Rendez-vous",
      startsAt,
      endsAt: appointment?.ends_at ?? null,
      calendarScope: "crm",
      description: appointment?.notes ?? null,
    },
  ]).catch((error) => {
    console.warn("Rendez-vous non synchronisé avec l'agenda", error);
  });
}
