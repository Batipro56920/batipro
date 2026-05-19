import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type BusinessDocumentKind = "quote" | "invoice" | "credit_note" | "purchase_order" | "reception_report";
type SourceKind = "quote" | "invoice" | "purchase_order" | "reception_report";

type SendBody = {
  sourceKind?: SourceKind;
  sourceId?: string;
  document?: Record<string, unknown>;
  recipient?: string;
  cc?: string;
  subject?: string;
  message?: string;
  clientLinkBase?: string;
  attachPdf?: boolean;
  requireSignature?: boolean;
  requireValidation?: boolean;
  allowModificationRequest?: boolean;
  autoReminders?: boolean;
  expiresInDays?: number;
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
  return (Deno.env.get(name) ?? "").trim();
}

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeString(value: string) {
  return base64UrlEncode(new TextEncoder().encode(value));
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

function normalizeBaseUrl(value: string | null | undefined) {
  const raw = String(value ?? "").trim().replace(/^['"]|['"]$/g, "");
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return `${parsed.origin}${parsed.pathname === "/" ? "" : parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function resolvePublicAppUrl(req: Request, body: SendBody) {
  return (
    normalizeBaseUrl(body.clientLinkBase) ||
    normalizeBaseUrl(optionalEnv("PUBLIC_APP_URL")) ||
    normalizeBaseUrl(optionalEnv("VITE_PUBLIC_APP_URL")) ||
    normalizeBaseUrl(req.headers.get("origin")) ||
    ""
  );
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
}

function sourceKindFromDocument(kind: BusinessDocumentKind): SourceKind {
  if (kind === "purchase_order") return "purchase_order";
  if (kind === "reception_report") return "reception_report";
  if (kind === "invoice" || kind === "credit_note") return "invoice";
  return "quote";
}

async function createSignedToken(workflowId: string, expiresAt: string, secret: string) {
  const nonce = crypto.randomUUID();
  const payload = base64UrlEncodeString(JSON.stringify({ wid: workflowId, exp: Math.floor(Date.parse(expiresAt) / 1000), nonce }));
  const signature = await hmacSha256(payload, secret);
  return `${payload}.${signature}`;
}

async function sendResendEmail(input: { to: string; cc?: string; subject: string; message: string; clientLink: string }) {
  const apiKey = optionalEnv("RESEND_API_KEY");
  const from = optionalEnv("RESEND_FROM_EMAIL") || "Batipro <onboarding@resend.dev>";
  if (!apiKey) return { skipped: true, error: null };

  const text = `${input.message}\n\nLien securise : ${input.clientLink}`;
  const html = emailHtml(input.message, input.clientLink);
  const payload: Record<string, unknown> = {
    from,
    to: [input.to],
    subject: input.subject,
    text,
    html,
  };
  if (input.cc) payload.cc = input.cc.split(",").map((entry) => entry.trim()).filter(Boolean);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { skipped: false, error: String((result as any).message ?? response.statusText) };
  }
  return { skipped: false, error: null, id: (result as any).id ?? null };
}

function emailHtml(message: string, clientLink: string) {
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");
  const safeLink = escapeHtml(clientLink);
  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6">
      <p>${safeMessage}</p>
      <p><a href="${safeLink}" style="display:inline-block;background:#2563eb;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Ouvrir le document</a></p>
      <p style="font-size:12px;color:#64748b">Lien securise Batipro. Ne transferez pas ce lien sans autorisation.</p>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function updateSourceStatus(admin: any, sourceKind: SourceKind, sourceId: string, status: "sent") {
  const now = new Date().toISOString();
  if (sourceKind === "quote") {
    await admin.from("crm_quotes").update({ statut: "envoye", sent_at: now, updated_at: now }).eq("id", sourceId);
    return;
  }
  if (sourceKind === "invoice") {
    await admin.from("invoices").update({ status, updated_at: now }).eq("id", sourceId);
    return;
  }
  if (sourceKind === "purchase_order") {
    await admin.from("purchase_orders").update({ status, updated_at: now }).eq("id", sourceId);
    return;
  }
  if (sourceKind === "reception_report") {
    await admin.from("reception_reports").update({ status, updated_at: now }).eq("id", sourceId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const tokenSecret = optionalEnv("DOCUMENT_TOKEN_SECRET") || requireEnv("SUPABASE_JWT_SECRET");
    const jwt = getBearerToken(req);
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = (await req.json().catch(() => null)) as SendBody | null;
    if (!body || typeof body !== "object") return json({ error: "Invalid JSON" }, 400);
    if (!body.document || typeof body.document !== "object") return json({ error: "document required" }, 400);

    const document = body.document;
    const documentKind = normalizeString(document.kind) as BusinessDocumentKind;
    const documentNumber = normalizeString(document.number);
    const sourceId = normalizeString(body.sourceId ?? document.id);
    const sourceKind = body.sourceKind ?? sourceKindFromDocument(documentKind);
    const recipientEmail = normalizeEmail(body.recipient ?? (document.recipient as any)?.email);
    const subject = normalizeString(body.subject) || `Document ${documentNumber}`;
    const message = normalizeString(body.message);
    const expiresInDays = Number.isFinite(Number(body.expiresInDays)) ? Math.max(1, Math.min(90, Number(body.expiresInDays))) : 30;
    const tokenExpiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();

    if (!documentNumber) return json({ error: "document.number required" }, 400);
    if (!sourceId) return json({ error: "sourceId required" }, 400);
    if (!recipientEmail || !recipientEmail.includes("@")) return json({ error: "recipient email required" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const now = new Date().toISOString();

    await admin
      .from("document_client_workflows")
      .update({ revoked_at: now, updated_at: now })
      .eq("source_kind", sourceKind)
      .eq("source_id", sourceId)
      .is("revoked_at", null);

    const draftId = crypto.randomUUID();
    const token = await createSignedToken(draftId, tokenExpiresAt, tokenSecret);
    const tokenHash = await sha256Hex(token);

    const { data: workflow, error: insertError } = await admin
      .from("document_client_workflows")
      .insert({
        id: draftId,
        organization_id: userData.user.id,
        source_kind: sourceKind,
        source_id: sourceId,
        document_kind: documentKind,
        document_number: documentNumber,
        document,
        recipient_email: recipientEmail,
        recipient_name: normalizeString((document.recipient as any)?.displayName) || null,
        subject,
        message,
        status: "sent",
        require_signature: Boolean(body.requireSignature),
        require_validation: body.requireValidation !== false,
        allow_modification_request: body.allowModificationRequest !== false,
        auto_reminders: Boolean(body.autoReminders),
        token_hash: tokenHash,
        token_expires_at: tokenExpiresAt,
        created_by: userData.user.id,
      })
      .select("*")
      .single();

    if (insertError) return json({ error: insertError.message }, 400);

    const publicAppUrl = resolvePublicAppUrl(req, body);
    const clientLink = `${publicAppUrl}/documents/client/${encodeURIComponent(token)}`;

    await admin.from("document_client_events").insert({
      workflow_id: workflow.id,
      event_type: "sent",
      actor_type: "user",
      actor_user_id: userData.user.id,
      actor_email: userData.user.email,
      metadata: { attachPdf: Boolean(body.attachPdf), clientLink },
    });

    await updateSourceStatus(admin, sourceKind, sourceId, "sent").catch(() => null);

    const emailResult = await sendResendEmail({ to: recipientEmail, cc: body.cc, subject, message, clientLink });
    await admin.from("document_client_events").insert({
      workflow_id: workflow.id,
      event_type: emailResult.error ? "email_failed" : "email_sent",
      actor_type: "system",
      actor_user_id: userData.user.id,
      metadata: { resendSkipped: Boolean(emailResult.skipped), resendId: (emailResult as any).id ?? null, error: emailResult.error },
    });
    if (emailResult.error) {
      await admin.from("document_client_workflows").update({ last_email_error: emailResult.error, updated_at: new Date().toISOString() }).eq("id", workflow.id);
    }

    return json({ ok: true, workflowId: workflow.id, clientLink, expiresAt: tokenExpiresAt, email: emailResult });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
