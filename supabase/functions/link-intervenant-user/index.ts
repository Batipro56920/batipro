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

function normalizeString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid JSON" }, 400);

    const tokenAccess = normalizeString((body as any).token_access ?? (body as any).tokenAccess);
    if (!tokenAccess) return json({ error: "token_access required" }, 400);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: access, error: accessErr } = await admin
      .from("chantier_access")
      .select("id, chantier_id, intervenant_id, email, expires_at, used_at")
      .eq("token", tokenAccess)
      .maybeSingle();

    if (accessErr) return json({ error: accessErr.message }, 400);
    if (!access) return json({ error: "Token not found" }, 404);
    if (isExpired((access as any).expires_at)) return json({ error: "Token expired" }, 400);
    if ((access as any).used_at) return json({ error: "Token already used" }, 400);

    const accessEmail = normalizeString((access as any).email).toLowerCase();
    const userEmail = normalizeString(userData.user.email).toLowerCase();
    if (accessEmail && userEmail && accessEmail !== userEmail) {
      return json({ error: "Forbidden" }, 403);
    }

    const intervenantId = (access as any).intervenant_id as string | null;
    if (!intervenantId) return json({ error: "intervenant_id missing" }, 400);

    const { error: linkErr } = await admin
      .from("intervenant_users")
      .upsert(
        {
          user_id: userData.user.id,
          intervenant_id: intervenantId,
        },
        { onConflict: "user_id" },
      );

    if (linkErr) return json({ error: linkErr.message }, 400);

    await admin
      .from("chantier_access")
      .update({ used_at: new Date().toISOString() })
      .eq("id", (access as any).id);

    return json(
      {
        ok: true,
        chantier_id: (access as any).chantier_id,
        intervenant_id: intervenantId,
        user_id: userData.user.id,
      },
      200,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
