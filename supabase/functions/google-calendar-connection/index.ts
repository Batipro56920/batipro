import { corsHeaders, getAuthenticatedUser, getServiceClient, jsonResponse } from "../_shared/googleCalendar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET", "DELETE"].includes(req.method)) return jsonResponse({ error: "Méthode non supportée." }, 405);

  try {
    const user = await getAuthenticatedUser(req);
    const service = getServiceClient();

    if (req.method === "DELETE") {
      await service.from("calendar_event_links").delete().eq("user_id", user.id).eq("provider", "google");
      await service.from("calendar_connections").delete().eq("user_id", user.id).eq("provider", "google");
      return jsonResponse({ connected: false, calendarEmail: null, calendarId: null, connectedAt: null, lastSyncAt: null });
    }

    const { data, error } = await service
      .from("calendar_connections")
      .select("calendar_id, calendar_email, connected_at, last_sync_at")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .maybeSingle();

    if (error) throw new Error(error.message);
    return jsonResponse({
      connected: Boolean(data),
      calendarEmail: data?.calendar_email ?? null,
      calendarId: data?.calendar_id ?? null,
      connectedAt: data?.connected_at ?? null,
      lastSyncAt: data?.last_sync_at ?? null,
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Statut Google Calendar impossible." }, 400);
  }
});
