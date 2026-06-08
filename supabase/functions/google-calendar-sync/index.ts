import { addOneHour, corsHeaders, getAuthenticatedUser, getServiceClient, getValidGoogleConnection, jsonResponse } from "../_shared/googleCalendar.ts";

type SyncEvent = {
  sourceType: string;
  sourceId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  description?: string | null;
  location?: string | null;
  url?: string | null;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
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
    start: { dateTime: new Date(event.startsAt).toISOString() },
    end: { dateTime: new Date(end).toISOString() },
  };
}

async function googleRequest(connection: any, path: string, method: "POST" | "PUT", body: unknown) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message ?? payload?.error_description ?? "Erreur Google Calendar.");
  return payload;
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
    let synced = 0;
    let skipped = 0;
    const errors: Array<{ sourceId: string; message: string }> = [];

    for (const event of events) {
      try {
        const googleEvent = buildGoogleEvent(event);
        const { data: link } = await service
          .from("calendar_event_links")
          .select("id, external_event_id")
          .eq("user_id", user.id)
          .eq("provider", "google")
          .eq("source_type", event.sourceType)
          .eq("source_id", event.sourceId)
          .maybeSingle();

        let externalEventId = link?.external_event_id ?? null;
        if (externalEventId) {
          await googleRequest(connection, `calendars/${encodeURIComponent(connection.calendar_id)}/events/${encodeURIComponent(externalEventId)}`, "PUT", googleEvent);
        } else {
          const created = await googleRequest(connection, `calendars/${encodeURIComponent(connection.calendar_id)}/events`, "POST", googleEvent);
          externalEventId = created.id;
        }

        await service.from("calendar_event_links").upsert(
          {
            user_id: user.id,
            provider: "google",
            source_type: event.sourceType,
            source_id: event.sourceId,
            external_event_id: externalEventId,
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider,source_type,source_id" },
        );
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
