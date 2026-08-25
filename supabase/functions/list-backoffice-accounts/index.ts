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
  return token || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 200);
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "Method not allowed" }, 405);

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
    const { data: callerProfile, error: callerErr } = await admin
      .from("profiles")
      .select("role, organization_id")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (callerErr) return json({ error: callerErr.message }, 500);
    if (String(callerProfile?.role ?? "").toUpperCase() !== "ADMIN") return json({ error: "Forbidden" }, 403);

    let query = admin.from("profiles").select("id, role, display_name, allowed_sidebar_groups, organization_id").in("role", ["ADMIN", "BUREAU"]);
    if (callerProfile?.organization_id) query = query.eq("organization_id", callerProfile.organization_id);
    const { data: profiles, error: profilesErr } = await query;
    if (profilesErr) return json({ error: profilesErr.message }, 500);

    const accounts = await Promise.all(
      (profiles ?? []).map(async (profile: any) => {
        const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
        return {
          id: profile.id,
          email: authUser?.user?.email ?? null,
          displayName: profile.display_name ?? null,
          role: profile.role,
          allowedSidebarGroups: profile.allowed_sidebar_groups ?? null,
        };
      }),
    );

    return json({ ok: true, accounts });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
