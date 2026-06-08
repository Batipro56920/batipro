import { getServiceClient, redirectResponse, requiredEnv } from "../_shared/googleCalendar.ts";

function withParam(url: string, key: string, value: string) {
  const next = new URL(url);
  next.searchParams.set(key, value);
  return next.toString();
}

Deno.serve(async (req) => {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const fallbackRedirect = requiredEnv("APP_BASE_URL");

  try {
    if (!code || !state) throw new Error("Code OAuth Google manquant.");
    const service = getServiceClient();
    const { data: stateRow, error: stateError } = await service
      .from("calendar_oauth_states")
      .select("*")
      .eq("state", state)
      .maybeSingle();

    if (stateError) throw new Error(stateError.message);
    if (!stateRow || Date.parse(stateRow.expires_at) < Date.now()) throw new Error("Connexion Google expirée.");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: requiredEnv("GOOGLE_CALENDAR_CLIENT_ID"),
        client_secret: requiredEnv("GOOGLE_CALENDAR_CLIENT_SECRET"),
        redirect_uri: requiredEnv("GOOGLE_CALENDAR_REDIRECT_URI"),
        grant_type: "authorization_code",
        code,
      }),
    });

    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokenPayload?.error_description ?? tokenPayload?.error ?? "Échange OAuth Google impossible.");
    if (!tokenPayload.refresh_token) throw new Error("Google n'a pas renvoyé de refresh token. Déconnecte puis reconnecte avec consentement.");

    const expiresAt = new Date(Date.now() + Number(tokenPayload.expires_in ?? 3600) * 1000).toISOString();
    const { error: upsertError } = await service.from("calendar_connections").upsert(
      {
        user_id: stateRow.user_id,
        provider: "google",
        calendar_id: "primary",
        calendar_email: null,
        access_token: tokenPayload.access_token,
        refresh_token: tokenPayload.refresh_token,
        access_token_expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );
    if (upsertError) throw new Error(upsertError.message);

    await service.from("calendar_oauth_states").delete().eq("state", state);
    return redirectResponse(withParam(stateRow.redirect_to ?? fallbackRedirect, "google_calendar", "connected"));
  } catch (err) {
    return redirectResponse(withParam(fallbackRedirect, "google_calendar_error", err instanceof Error ? err.message : "callback"));
  }
});
