import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name) ?? "";
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function normalizeString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeBaseUrl(value: string) {
  const raw = normalizeString(value).replace(/^['"]|['"]$/g, "");
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return `${parsed.origin}${parsed.pathname === "/" ? "" : parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function resolvePublicAppUrl(req: Request) {
  const configured = normalizeBaseUrl(Deno.env.get("PUBLIC_APP_URL") ?? "") || normalizeBaseUrl(Deno.env.get("VITE_PUBLIC_APP_URL") ?? "");
  if (configured) return configured;
  const origin = normalizeBaseUrl(req.headers.get("origin") ?? "");
  if (origin) return origin;
  const referer = req.headers.get("referer") ?? "";
  try {
    return referer ? new URL(referer).origin : null;
  } catch {
    return null;
  }
}

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return normalizeString(header.slice(7)) || null;
}

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let password = "";
  for (const byte of bytes) password += alphabet[byte % alphabet.length];
  return password;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 200);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_ANON_KEY = requireEnv("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const jwt = getBearerToken(req);
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: callerProfile, error: callerErr } = await admin.from("profiles").select("role, organization_id").eq("id", userData.user.id).maybeSingle();
    if (callerErr) return json({ error: callerErr.message }, 500);
    if (String(callerProfile?.role ?? "").toUpperCase() !== "ADMIN") return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => null);
    const targetUserId = normalizeString((body as any)?.userId);
    if (!targetUserId) return json({ error: "userId_required" }, 400);

    const { data: targetProfile, error: targetErr } = await admin.from("profiles").select("role, organization_id").eq("id", targetUserId).maybeSingle();
    if (targetErr) return json({ error: targetErr.message }, 500);
    if (!targetProfile) return json({ error: "not_found" }, 404);
    if (callerProfile?.organization_id && targetProfile.organization_id !== callerProfile.organization_id) {
      return json({ error: "Forbidden" }, 403);
    }

    const temporaryPassword = generateTemporaryPassword();
    const { data: updated, error: updateErr } = await admin.auth.admin.updateUserById(targetUserId, { password: temporaryPassword });
    if (updateErr) return json({ error: updateErr.message }, 400);

    const email = updated?.user?.email ?? "";
    const loginUrl = `${resolvePublicAppUrl(req) ?? ""}/login`;
    const accessUrl = `Identifiant : ${email}\nNouveau mot de passe temporaire : ${temporaryPassword}\nConnexion : ${loginUrl}`;

    return json({ ok: true, email, temporaryPassword, loginUrl, accessUrl });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
