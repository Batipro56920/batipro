import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * JWT custom signé (HS256).
 * Local: JWT_SECRET
 * Prod: SUPABASE_JWT_SECRET (ou JWT_SECRET)
 */
async function signJwt(payload: Record<string, unknown>) {
  const secret =
    Deno.env.get("JWT_SECRET") ||
    Deno.env.get("SUPABASE_JWT_SECRET");

  if (!secret) throw new Error("Missing JWT_SECRET (or SUPABASE_JWT_SECRET)");

  const header = { alg: "HS256", typ: "JWT" };

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const headerB64 = enc(header);
  const payloadB64 = enc(payload);
  const data = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${sigB64}`;
}

function isExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ⚠️ IMPORTANT : on renvoie toujours 200 (sinon invoke() remonte "non-2xx")
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 200);
  }

  try {
    const body = await req.json().catch(() => ({} as any));

    const token = body?.token;
    const markUsed = Boolean(body?.mark_used ?? false); // optionnel

    if (!token || typeof token !== "string") {
      return json({ ok: false, error: "Invalid token" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return json(
        { ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        200
      );
    }

    // Service role => bypass RLS pour valider le token
    const admin = createClient(supabaseUrl, serviceKey);

    // ✅ IMPORTANT : on lit aussi used_at
    const { data, error } = await admin
      .from("chantier_access")
      .select("id, chantier_id, intervenant_id, role, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (error) return json({ ok: false, error: error.message }, 200);
    if (!data) return json({ ok: false, error: "Token not found" }, 200);

    // Expiration
    const expiresAt = (data as any).expires_at as string | null;
    if (isExpired(expiresAt)) return json({ ok: false, error: "Token expired" }, 200);

    // Déjà utilisé ? (si tu veux du “one-time link”)
    const usedAt = (data as any).used_at as string | null;
    if (usedAt) {
      return json({ ok: false, error: "Token already used" }, 200);
    }

    const accessRole = String((data as any).role ?? "INTERVENANT").toUpperCase();

    // JWT portail (durée limitée)
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 24 * 3600; // 24h

    let jwt: string;
    try {
      jwt = await signJwt({
        aud: "authenticated",
        role: "intervenant",
        iat: now,
        exp,

        // infos utiles
        app_metadata: { role: "INTERVENANT" },
        user_metadata: {
          chantier_id: (data as any).chantier_id,
          intervenant_id: (data as any).intervenant_id,
          access_role: accessRole,
        },

        // champs custom simples (pour filtrage)
        chantier_id: (data as any).chantier_id,
        intervenant_id: (data as any).intervenant_id,
        access_role: accessRole,
      });
    } catch (e) {
      return json({ ok: false, error: (e as Error).message }, 200);
    }

    // Option : marquer le token comme utilisé
    if (markUsed) {
      const { error: updErr } = await admin
        .from("chantier_access")
        .update({ used_at: new Date().toISOString() })
        .eq("id", (data as any).id);

      // On ne bloque pas si l'update échoue, mais on remonte l'info
      if (updErr) {
        return json(
          {
            ok: true,
            warning: "Token valid but failed to mark used",
            warning_detail: updErr.message,
            chantier_id: (data as any).chantier_id,
            intervenant_id: (data as any).intervenant_id,
            access_role: accessRole,
            jwt,
          },
          200
        );
      }
    }

    return json(
      {
        ok: true,
        chantier_id: (data as any).chantier_id,
        intervenant_id: (data as any).intervenant_id,
        access_role: accessRole,
        jwt,
      },
      200
    );
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 200);
  }
});
