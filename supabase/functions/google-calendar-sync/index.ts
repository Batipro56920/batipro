import { addOneHour, corsHeaders, getAuthenticatedUser, getServiceClient, getValidGoogleConnection, jsonResponse } from "../_shared/googleCalendar.ts";

type CalendarScope = "crm" | "chantier" | "direction";

type SyncEvent = {
  sourceType: string;
  sourceId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  calendarScope: CalendarScope;
  description?: string | null;
  location?: string | null;
  url?: string | null;
};

const CALENDAR_TARGETS: Record<CalendarScope, { summary: string; colorId: string }> = {
  crm: { summary: "Batipro - CRM", colorId: "9" },
  chantier: { summary: "Batipro - Chantiers", colorId: "10" },
  direction: { summary: "Batipro - Direction", colorId: "5" },
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function inferCalendarScope(rawScope: unknown, sourceType: string): CalendarScope {
  const scope = cleanText(rawScope);
  if (scope === "crm" || scope === "chantier" || scope === "direction") return scope;
  if (sourceType.startsWith("crm_")) return "crm";
  if (sourceType.startsWith("chantier_")) return "chantier";
  return "direction";
}

function normalizeEvent(raw: any): SyncEvent | null {
  const sourceType = cleanText(raw?.sourceType);
  const sourceId = cleanText(raw?.sourceId);
  const title = cleanText(raw?.title);
  const startsAt = cleanText(raw?.startsAt);
  if (!sourceType || !sourceId || !title || !startsAt) return null;
  return {
    sourceType,
    sourceId,
    title,
    startsAt,
    endsAt: cleanText(raw?.endsAt) || null,
    calendarScope: inferCalendarScope(raw?.calendarScope, sourceType),
    description: cleanText(raw?.description) || null,
    location: cleanText(raw?.location) || null,
    url: cleanText(raw?.url) || null,
  };
}

function buildGoogleEvent(event: SyncEvent) {
  const end = event.endsAt || addOneHour(event.startsAt) || event.startsAt;
  const description = [event.description, event.url ? `Batipro: ${event.url}` : null].filter(Boolean).join("\n\n");
  return {
    summary: event.title,
    description,
    location: event.location ?? undefined,
    start: { dateTime: new Date(event.startsAt).toISOString(), timeZone: "Europe/Paris" },
    end: { dateTime: new Date(end).toISOString(), timeZone: "Europe/Paris" },
  };
}

async function googleRequest(connection: any, path: string, method: "GET" | "POST" | "PUT" | "PATCH", body?: unknown) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message ?? payload?.error_description ?? "Erreur Google Calendar.");
  return payload;
}

async function ensureBusinessCalendar(connection: any, scope: CalendarScope): Promise<string> {
  const target = CALENDAR_TARGETS[scope];
  const list = await googleRequest(connection, "users/me/calendarList", "GET");
  const existing = Array.isArray(list?.items)
    ? list.items.find((item: any) => cleanText(item?.summary) === target.summary)
    : null;

  if (existing?.id) return String(existing.id);

  const created = await googleRequest(connection, "calendars", "POST", {
    summary: target.summary,
    timeZone: "Europe/Paris",
  });
  const calendarId = String(created?.id ?? "");
  if (!calendarId) throw new Error(`Calendrier ${target.summary} introuvable.`);

  await googleRequest(connection, `users/me/calendarList/${encodeURIComponent(calendarId)}`, "PATCH", {
    colorId: target.colorId,
    selected: true,
  }).catch(() => null);

  return calendarId;
}

async function findEventLink(service: any, userId: string, event: SyncEvent) {
  const query = service
    .from("calendar_event_links")
    .select("id, external_event_id, calendar_id, calendar_scope")
    .eq("user_id", userId)
    .eq("provider", "google")
    .eq("source_type", event.sourceType)
    .eq("source_id", event.sourceId)
    .maybeSingle();

  const { data, error } = await query;
  if (!error) return data;

  const message = String(error?.message ?? "").toLowerCase();
  if (!message.includes("calendar_id") && !message.includes("calendar_scope")) throw new Error(error.message);

  const fallback = await service
    .from("calendar_event_links")
    .select("id, external_event_id")
    .eq("user_id", userId)
    .eq("provider", "google")
    .eq("source_type", event.sourceType)
    .eq("source_id", event.sourceId)
    .maybeSingle();

  if (fallback.error) throw new Error(fallback.error.message);
  return fallback.data;
}

async function upsertEventLink(service: any, userId: string, event: SyncEvent, externalEventId: string, calendarId: string) {
  const payload = {
    user_id: userId,
    provider: "google",
    source_type: event.sourceType,
    source_id: event.sourceId,
    calendar_scope: event.calendarScope,
    calendar_id: calendarId,
    external_event_id: externalEventId,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const result = await service.from("calendar_event_links").upsert(payload, { onConflict: "user_id,provider,source_type,source_id" });
  if (!result.error) return;

  const message = String(result.error?.message ?? "").toLowerCase();
  if (!message.includes("calendar_id") && !message.includes("calendar_scope")) throw new Error(result.error.message);

  const { calendar_scope, calendar_id, ...fallbackPayload } = payload;
  const fallback = await service.from("calendar_event_links").upsert(fallbackPayload, { onConflict: "user_id,provider,source_type,source_id" });
  if (fallback.error) throw new Error(fallback.error.message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Méthode non supportée." }, 405);

  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const events = Array.isArray(body?.events) ? body.events.map(normalizeEvent).filter(Boolean).slice(0, 200) as SyncEvent[] : [];
    const service = getServiceClient();
    const connection = await getValidGoogleConnection(user.id);
    const targetCalendars = new Map<CalendarScope, string>();
    let synced = 0;
    let skipped = 0;
    const errors: Array<{ sourceId: string; message: string }> = [];

    for (const event of events) {
      try {
        const googleEvent = buildGoogleEvent(event);
        let calendarId = targetCalendars.get(event.calendarScope);
        if (!calendarId) {
          calendarId = await ensureBusinessCalendar(connection, event.calendarScope);
          targetCalendars.set(event.calendarScope, calendarId);
        }

        const link = await findEventLink(service, user.id, event);
        const linkCalendarId = cleanText(link?.calendar_id) || calendarId;
        let externalEventId = link?.external_event_id ?? null;

        if (externalEventId) {
          await googleRequest(connection, `calendars/${encodeURIComponent(linkCalendarId)}/events/${encodeURIComponent(externalEventId)}`, "PUT", googleEvent);
        } else {
          const created = await googleRequest(connection, `calendars/${encodeURIComponent(calendarId)}/events`, "POST", googleEvent);
          externalEventId = created.id;
        }

        await upsertEventLink(service, user.id, event, externalEventId, calendarId);
        synced += 1;
      } catch (err) {
        errors.push({ sourceId: event.sourceId, message: err instanceof Error ? err.message : "Erreur inconnue." });
      }
    }

    skipped = Math.max(0, (Array.isArray(body?.events) ? body.events.length : 0) - events.length);
    await service
      .from("calendar_connections")
      .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", connection.id);

    return jsonResponse({ synced, skipped, errors });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Synchronisation Google Calendar impossible." }, 400);
  }
});
