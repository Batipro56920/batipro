import { corsHeaders, getAuthenticatedUser, getServiceClient, jsonResponse, requiredEnv } from "../_shared/googleCalendar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Méthode non supportée." }, 405);

  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const redirectTo = String(body?.redirectTo ?? "").trim() || requiredEnv("APP_BASE_URL");
    const state = crypto.randomUUID();
    const service = getServiceClient();

    const { error } = await service.from("calendar_oauth_states").insert({
      user_id: user.id,
      state,
      redirect_to: redirectTo,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) throw new Error(error.message);

    const params = new URLSearchParams({
      client_id: requiredEnv("GOOGLE_CALENDAR_CLIENT_ID"),
      redirect_uri: requiredEnv("GOOGLE_CALENDAR_REDIRECT_URI"),
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: "https://www.googleapis.com/auth/calendar.events",
      state,
    });

    return jsonResponse({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Connexion Google Calendar impossible." }, 400);
  }
});
