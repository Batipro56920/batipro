import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function redirectResponse(url: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: url },
  });
}

export function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variable ${name} manquante.`);
  return value;
}

export function getServiceClient() {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

export async function getAuthenticatedUser(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) throw new Error("Utilisateur non authentifié.");
  const client = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error(error?.message ?? "Utilisateur non authentifié.");
  return data.user;
}

export function addOneHour(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  date.setHours(date.getHours() + 1);
  return date.toISOString();
}

export async function refreshGoogleAccessToken(connection: any) {
  const refreshToken = String(connection?.refresh_token ?? "").trim();
  if (!refreshToken) throw new Error("Refresh token Google Calendar absent.");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GOOGLE_CALENDAR_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CALENDAR_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error_description ?? payload?.error ?? "Actualisation Google Calendar impossible.");

  const expiresAt = new Date(Date.now() + Number(payload.expires_in ?? 3600) * 1000).toISOString();
  const service = getServiceClient();
  const { data, error } = await service
    .from("calendar_connections")
    .update({
      access_token: payload.access_token,
      access_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getValidGoogleConnection(userId: string) {
  const service = getServiceClient();
  const { data, error } = await service
    .from("calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Google Calendar n'est pas connecté.");

  const expiresAt = Date.parse(String(data.access_token_expires_at ?? ""));
  if (!Number.isFinite(expiresAt) || expiresAt - Date.now() < 60_000) {
    return refreshGoogleAccessToken(data);
  }
  return data;
}
