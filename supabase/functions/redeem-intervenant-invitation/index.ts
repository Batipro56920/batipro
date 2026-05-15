import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type InvitationRow = {
  id: string;
  intervenant_id: string;
  email: string;
  token: string;
  expires_at: string | null;
  used_at: string | null;
  revoked_at: string | null;
  linked_user_id: string | null;
  intervenant?: {
    id: string;
    nom: string | null;
    email: string | null;
    telephone: string | null;
    entreprise: string | null;
    metier: string | null;
    notes: string | null;
    user_id: string | null;
  } | null;
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

function isExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  const timestamp = Date.parse(expiresAt);
  if (Number.isNaN(timestamp)) return false;
  return timestamp <= Date.now();
}

async function loadInvitation(admin: ReturnType<typeof createClient>, token: string) {
  const { data, error } = await admin
    .from("intervenant_account_invitations")
    .select(
      "id, intervenant_id, email, token, expires_at, used_at, revoked_at, linked_user_id, intervenant:intervenants(id, nom, email, telephone, entreprise, metier, notes, user_id)",
    )
    .eq("token", token)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as InvitationRow | null;
}

function ensureInvitationIsUsable(invitation: InvitationRow | null) {
  if (!invitation) {
    throw new Error("Invitation introuvable.");
  }
  if (invitation.revoked_at) {
    throw new Error("Cette invitation a ete revoquee.");
  }
  if (invitation.used_at) {
    throw new Error("Cette invitation a deja ete utilisee.");
  }
  if (isExpired(invitation.expires_at)) {
    throw new Error("Cette invitation a expire.");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 200);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid JSON" }, 400);

    const mode = normalizeString((body as any).mode || "preview").toLowerCase();
    const token = normalizeString((body as any).token);
    if (!token) return json({ error: "token required" }, 400);

    const invitation = await loadInvitation(admin, token);
    ensureInvitationIsUsable(invitation);

    const intervenant = invitation?.intervenant ?? null;
    if (!intervenant) return json({ error: "Intervenant introuvable." }, 404);

    if (mode === "preview") {
      return json(
        {
          ok: true,
          invitation: {
            intervenantId: invitation!.intervenant_id,
            email: invitation!.email,
            expiresAt: invitation!.expires_at,
            alreadyLinked: Boolean(intervenant.user_id || invitation!.linked_user_id),
            intervenant: {
              id: intervenant.id,
              nom: intervenant.nom,
              email: intervenant.email,
              telephone: intervenant.telephone,
              entreprise: intervenant.entreprise,
              metier: intervenant.metier,
              notes: intervenant.notes,
            },
          },
        },
        200,
      );
    }

    if (mode !== "redeem") return json({ error: "Unsupported mode" }, 400);

    if (normalizeString(intervenant.user_id) || normalizeString(invitation!.linked_user_id)) {
      return json({ error: "Ce compte intervenant existe deja." }, 409);
    }

    const password = normalizeString((body as any).password);
    if (password.length < 8) {
      return json({ error: "Le mot de passe doit contenir au moins 8 caracteres." }, 400);
    }

    const email = normalizeString(invitation!.email).toLowerCase();
    const userMetadata = {
      display_name: normalizeString(intervenant.nom) || email,
      role: "INTERVENANT",
      intervenant_id: intervenant.id,
    };
    const appMetadata = {
      role: "INTERVENANT",
      intervenant_id: intervenant.id,
    };

    const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
      app_metadata: appMetadata,
    });

    if (createErr || !createdUser.user?.id) {
      const message = createErr?.message ?? "Impossible de creer le compte intervenant.";
      return json({ error: message }, 400);
    }

    const userId = createdUser.user.id;

    const { error: profileErr } = await admin.from("profiles").upsert({
      id: userId,
      role: "INTERVENANT",
      display_name: normalizeString(intervenant.nom) || email,
    });

    if (profileErr) return json({ error: profileErr.message }, 400);

    const { error: updateIntervenantErr } = await admin
      .from("intervenants")
      .update({ user_id: userId })
      .eq("id", intervenant.id);

    if (updateIntervenantErr) return json({ error: updateIntervenantErr.message }, 400);

    const { error: linkErr } = await admin
      .from("intervenant_users")
      .upsert({ user_id: userId, intervenant_id: intervenant.id }, { onConflict: "user_id" });

    if (linkErr) return json({ error: linkErr.message }, 400);

    const nowIso = new Date().toISOString();

    const { error: markUsedErr } = await admin
      .from("intervenant_account_invitations")
      .update({ used_at: nowIso, linked_user_id: userId })
      .eq("id", invitation!.id);

    if (markUsedErr) return json({ error: markUsedErr.message }, 400);

    await admin
      .from("intervenant_account_invitations")
      .update({ revoked_at: nowIso })
      .eq("intervenant_id", intervenant.id)
      .is("used_at", null)
      .is("revoked_at", null);

    return json(
      {
        ok: true,
        userId,
        intervenantId: intervenant.id,
        email,
      },
      200,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
