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

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token ? token : null;
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function generateToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return base64UrlEncode(bytes);
}

function normalizeString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 200);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_ANON_KEY = requireEnv("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const PUBLIC_APP_URL = requireEnv("PUBLIC_APP_URL");

    const jwt = getBearerToken(req);
    if (!jwt) {
      console.warn("[chantier-access-admin] Missing Authorization header");
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      console.warn("[chantier-access-admin] Invalid JWT", userErr?.message ?? "unknown");
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid JSON" }, 400);

    const chantierId = normalizeString((body as any).chantierId ?? (body as any).chantier_id);
    if (!chantierId) return json({ error: "chantierId required" }, 400);

    const intervenantIdRaw = (body as any).intervenantId ?? (body as any).intervenant_id;
    const intervenantId = normalizeString(intervenantIdRaw) || null;

    const roleRaw = normalizeString((body as any).role ?? "INTERVENANT").toUpperCase();
    const role = roleRaw === "CLIENT" ? "CLIENT" : "INTERVENANT";

    const expiresRaw = (body as any).expiresInDays ?? (body as any).expires_in_days;
    let expiresInDays = Number(expiresRaw);
    if (!Number.isFinite(expiresInDays) || expiresInDays <= 0) expiresInDays = 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    let email = normalizeString((body as any).email).toLowerCase();
    if (!email && intervenantId) {
      const { data: itv, error: itvErr } = await admin
        .from("intervenants")
        .select("email")
        .eq("id", intervenantId)
        .maybeSingle();

      if (itvErr) return json({ error: itvErr.message }, 400);
      email = normalizeString(itv?.email).toLowerCase();
    }

    if (!email) return json({ error: "email required" }, 400);

    const token = generateToken(32);

    const { error: insertErr } = await admin.from("chantier_access").insert({
      chantier_id: chantierId,
      intervenant_id: intervenantId,
      email,
      role,
      token,
      expires_at: expiresAt,
    });

    if (insertErr) return json({ error: insertErr.message }, 400);

    const accessUrl = `${PUBLIC_APP_URL.replace(/\/$/, "")}/acces/${encodeURIComponent(token)}`;
    return json({ token, accessUrl }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
