import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_GROUPS = new Set(["Pilotage", "Commerce", "Production", "Ressources", "Achats", "Financier", "Paramètres"]);

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

function normalizeAllowedGroups(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const groups = value.map((entry) => normalizeString(entry)).filter((entry) => ALLOWED_GROUPS.has(entry));
  return groups.length > 0 ? groups : null;
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
    const { data: callerProfile, error: callerErr } = await admin.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    if (callerErr) return json({ error: callerErr.message }, 500);
    if (String(callerProfile?.role ?? "").toUpperCase() !== "ADMIN") return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => null);
    const email = normalizeString((body as any)?.email).toLowerCase();
    const displayName = normalizeString((body as any)?.displayName) || email;
    const allowedSidebarGroups = normalizeAllowedGroups((body as any)?.allowedSidebarGroups);
    if (!email || !email.includes("@")) return json({ error: "email_required" }, 400);

    const temporaryPassword = generateTemporaryPassword();
    const metadata = { role: "BUREAU" };
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { display_name: displayName, ...metadata },
      app_metadata: metadata,
    });
    if (createErr || !created.user?.id) return json({ error: createErr?.message ?? "Impossible de creer le compte." }, 400);

    const userId = created.user.id;
    const rollback = async (message: string) => {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      return json({ error: message }, 400);
    };

    const { data: callerOrg, error: callerOrgErr } = await admin.from("profiles").select("organization_id").eq("id", userData.user.id).maybeSingle();
    if (callerOrgErr) return await rollback(callerOrgErr.message);

    const { error: profileUpsertErr } = await admin.from("profiles").upsert({
      id: userId,
      role: "BUREAU",
      display_name: displayName,
      organization_id: callerOrg?.organization_id ?? null,
      allowed_sidebar_groups: allowedSidebarGroups,
    });
    if (profileUpsertErr) return await rollback(profileUpsertErr.message);

    const loginUrl = `${resolvePublicAppUrl(req) ?? ""}/login`;
    const accessUrl = `Identifiant : ${email}\nMot de passe temporaire : ${temporaryPassword}\nConnexion : ${loginUrl}`;

    return json({
      ok: true,
      userId,
      email,
      temporaryPassword,
      loginUrl,
      accessUrl,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
