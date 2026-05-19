import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ClientAction = "view" | "accept" | "refuse" | "request_modification";

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
  return (Deno.env.get(name) ?? "").trim();
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifySignedToken(token: string, secret: string) {
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;
  const expected = await hmacSha256(payloadB64, secret);
  if (expected !== signature) return null;
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as { wid?: string; exp?: number };
  if (!payload.wid || !payload.exp) return null;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return { ...payload, expired: true };
  return { ...payload, expired: false };
}

function requestIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    null
  );
}

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
}

function nextStateForAction(action: ClientAction) {
  if (action === "accept") return { status: "accepted", event: "accepted", timestampColumn: "accepted_at", signed: true };
  if (action === "refuse") return { status: "refused", event: "refused", timestampColumn: "refused_at", signed: false };
  if (action === "request_modification") return { status: "modification_requested", event: "modification_requested", timestampColumn: "modification_requested_at", signed: false };
  return { status: "viewed", event: "viewed", timestampColumn: "viewed_at", signed: false };
}

async function updateSourceStatus(admin: any, workflow: any, status: string) {
  const now = new Date().toISOString();
  const sourceKind = String(workflow.source_kind);
  const sourceId = String(workflow.source_id);

  if (sourceKind === "quote") {
    const patch: Record<string, unknown> = { updated_at: now };
    if (status === "viewed") {
      patch.statut = "vu";
      patch.viewed_at = workflow.viewed_at ?? now;
    }
    if (status === "accepted") {
      patch.statut = "accepte";
      patch.signature_status = "signe";
      patch.accepted_at = now;
      patch.signatory_name = workflow.signer_name;
      patch.client_comment = workflow.client_comment;
    }
    if (status === "refused") {
      patch.statut = "refuse";
      patch.refused_at = now;
      patch.client_comment = workflow.client_comment;
    }
    if (status === "modification_requested") {
      patch.statut = "negociation";
      patch.client_comment = workflow.client_comment;
    }
    await admin.from("crm_quotes").update(patch).eq("id", sourceId);
    return;
  }

  if (sourceKind === "invoice" && ["viewed", "accepted", "refused"].includes(status)) {
    await admin.from("invoices").update({ status: status === "accepted" ? "sent" : status, updated_at: now }).eq("id", sourceId);
    return;
  }

  if (sourceKind === "purchase_order" && status === "accepted") {
    await admin.from("purchase_orders").update({ status: "confirmed", updated_at: now }).eq("id", sourceId);
    return;
  }

  if (sourceKind === "reception_report" && ["accepted", "refused"].includes(status)) {
    await admin.from("reception_reports").update({ status: status === "accepted" ? "signed" : "refused", updated_at: now }).eq("id", sourceId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 200);

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const tokenSecret = optionalEnv("DOCUMENT_TOKEN_SECRET") || requireEnv("SUPABASE_JWT_SECRET");
    const body = await req.json().catch(() => ({}));
    const token = normalizeString((body as any).token);
    const action = (normalizeString((body as any).action) || "view") as ClientAction;
    const comment = normalizeString((body as any).comment);
    const signerName = normalizeString((body as any).signerName);

    if (!token) return json({ ok: false, error: "Token required" }, 200);
    if (!["view", "accept", "refuse", "request_modification"].includes(action)) {
      return json({ ok: false, error: "Invalid action" }, 200);
    }

    const payload = await verifySignedToken(token, tokenSecret);
    if (!payload) return json({ ok: false, error: "Invalid token" }, 200);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const tokenHash = await sha256Hex(token);
    const { data: workflow, error } = await admin
      .from("document_client_workflows")
      .select("*")
      .eq("id", payload.wid)
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error) return json({ ok: false, error: error.message }, 200);
    if (!workflow) return json({ ok: false, error: "Token not found" }, 200);
    if (workflow.revoked_at) return json({ ok: false, error: "Token revoked" }, 200);

    const now = new Date().toISOString();
    const isDbExpired = workflow.token_expires_at && Date.parse(workflow.token_expires_at) <= Date.now();
    if (payload.expired || isDbExpired) {
      await admin.from("document_client_workflows").update({ status: "expired", updated_at: now }).eq("id", workflow.id);
      await admin.from("document_client_events").insert({
        workflow_id: workflow.id,
        event_type: "expired",
        actor_type: "system",
        metadata: {},
      });
      return json({ ok: false, error: "Token expired" }, 200);
    }

    const state = nextStateForAction(action);
    const ip = requestIp(req);
    const userAgent = req.headers.get("user-agent");
    const shouldOnlyMarkViewed = action === "view" && workflow.viewed_at;
    const patch: Record<string, unknown> = {
      updated_at: now,
    };

    if (!shouldOnlyMarkViewed) {
      patch.status = state.status;
      patch[state.timestampColumn] = now;
      if (action !== "view" && comment) patch.client_comment = comment;
      if (state.signed) {
        patch.signed_at = now;
        patch.signer_name = signerName || workflow.recipient_name || workflow.recipient_email;
        patch.signer_ip = ip;
        patch.signer_user_agent = userAgent;
      }
    }

    if (action === "view" && !workflow.viewed_at) {
      patch.viewed_at = now;
      patch.status = workflow.status === "sent" ? "viewed" : workflow.status;
    }

    const { data: updated, error: updateError } = await admin
      .from("document_client_workflows")
      .update(patch)
      .eq("id", workflow.id)
      .select("*")
      .single();

    if (updateError) return json({ ok: false, error: updateError.message }, 200);

    await admin.from("document_client_events").insert({
      workflow_id: workflow.id,
      event_type: state.event,
      actor_type: "client",
      actor_email: workflow.recipient_email,
      ip,
      user_agent: userAgent,
      metadata: { comment, signerName },
    });

    await updateSourceStatus(admin, updated, String(updated.status)).catch(() => null);

    const { data: events } = await admin
      .from("document_client_events")
      .select("event_type, actor_type, actor_email, created_at, metadata")
      .eq("workflow_id", workflow.id)
      .order("created_at", { ascending: false })
      .limit(20);

    return json({ ok: true, workflow: updated, document: updated.document, events: events ?? [] }, 200);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, 200);
  }
});
