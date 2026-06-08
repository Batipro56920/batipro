import { supabase } from "../lib/supabaseClient";

export type GoogleCalendarConnectionStatus = {
  connected: boolean;
  calendarEmail: string | null;
  calendarId: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
};

export type GoogleCalendarSyncEvent = {
  sourceType: "crm_task" | "crm_appointment" | "chantier_event";
  sourceId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  description?: string | null;
  location?: string | null;
  url?: string | null;
};

export type GoogleCalendarSyncResult = {
  synced: number;
  skipped: number;
  errors: Array<{ sourceId: string; message: string }>;
};

async function invokeCalendarFunction<T>(name: string, body?: Record<string, unknown>, method?: "GET" | "POST" | "DELETE"): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, {
    method: method ?? "POST",
    body,
  });
  if (error) throw new Error(error.message);
  return data as T;
}

export async function getGoogleCalendarConnectionStatus(): Promise<GoogleCalendarConnectionStatus> {
  return invokeCalendarFunction<GoogleCalendarConnectionStatus>("google-calendar-connection", undefined, "GET");
}

export async function startGoogleCalendarConnection(redirectTo: string): Promise<string> {
  const result = await invokeCalendarFunction<{ authUrl: string }>("google-calendar-auth-url", { redirectTo });
  if (!result.authUrl) throw new Error("URL de connexion Google Calendar introuvable.");
  return result.authUrl;
}

export async function disconnectGoogleCalendar(): Promise<void> {
  await invokeCalendarFunction("google-calendar-connection", undefined, "DELETE");
}

export async function syncGoogleCalendarEvents(events: GoogleCalendarSyncEvent[]): Promise<GoogleCalendarSyncResult> {
  return invokeCalendarFunction<GoogleCalendarSyncResult>("google-calendar-sync", { events });
}
