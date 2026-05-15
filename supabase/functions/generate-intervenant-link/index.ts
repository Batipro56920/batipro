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

function optionalEnv(name: string) {
  return normalizeString(Deno.env.get(name) ?? "");
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
  const configured =
    normalizeBaseUrl(optionalEnv("PUBLIC_APP_URL")) ||
    normalizeBaseUrl(optionalEnv("VITE_PUBLIC_APP_URL"));
  if (configured) return configured;

  const fromOrigin = normalizeBaseUrl(req.headers.get("origin") ?? "");
  if (fromOrigin) return fromOrigin;

  const referer = req.headers.get("referer") ?? "";
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }

  return null;
}

function buildInvitationUrl(req: Request, token: string) {
  const path = `/intervenant/invitation?token=${encodeURIComponent(token)}`;
  const base = resolvePublicAppUrl(req);
  return base ? `${base}${path}` : path;
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

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileErr) return json({ error: profileErr.message }, 500);
    if (String(profile?.role ?? "").toUpperCase() !== "ADMIN") return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid JSON" }, 400);

    const intervenantId = normalizeString((body as any).intervenantId ?? (body as any).intervenant_id);
    if (!intervenantId) return json({ error: "intervenantId required" }, 400);

    const expiresRaw = (body as any).expiresInDays ?? (body as any).expires_in_days;
    let expiresInDays = Number(expiresRaw);
    if (!Number.isFinite(expiresInDays) || expiresInDays <= 0) expiresInDays = 14;
    const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();

    const { data: intervenant, error: intervenantErr } = await admin
      .from("intervenants")
      .select("id, nom, email, user_id")
      .eq("id", intervenantId)
      .maybeSingle();

    if (intervenantErr) return json({ error: intervenantErr.message }, 400);
    if (!intervenant) return json({ error: "intervenant_not_found" }, 404);

    const email = normalizeString(intervenant.email).toLowerCase();
    if (!email || !email.includes("@")) {
      return json({ error: "intervenant_email_required" }, 400);
    }

    if (normalizeString(intervenant.user_id)) {
      return json({ error: "intervenant_account_already_exists" }, 409);
    }

    const token = generateToken(32);

    const { error: revokeErr } = await admin
      .from("intervenant_account_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("intervenant_id", intervenantId)
      .is("used_at", null)
      .is("revoked_at", null);

    if (revokeErr) return json({ error: revokeErr.message }, 400);

    const { error: insertErr } = await admin.from("intervenant_account_invitations").insert({
      intervenant_id: intervenantId,
      email,
      token,
      created_by: userData.user.id,
      expires_at: expiresAt,
    });

    if (insertErr) return json({ error: insertErr.message }, 400);

    const { error: updateIntervenantErr } = await admin
      .from("intervenants")
      .update({ invitation_last_sent_at: new Date().toISOString() })
      .eq("id", intervenantId);

    if (updateIntervenantErr) return json({ error: updateIntervenantErr.message }, 400);

    const accessUrl = buildInvitationUrl(req, token);
    return json(
      {
        token,
        accessUrl,
        intervenantId,
        email,
        expiresAt,
      },
      200,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
