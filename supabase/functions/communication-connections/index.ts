import { corsHeaders, getCommunicationIdentity, jsonResponse } from "../_shared/communicationAuth.ts";
import { providerReadiness } from "../_shared/socialProviders.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Méthode non supportée." }, 405);

  try {
    const { service, organizationId } = await getCommunicationIdentity(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "status");

    if (action === "disconnect") {
      const accountId = String(body?.accountId ?? "").trim();
      if (!accountId) return jsonResponse({ error: "Compte manquant." }, 400);
      // Le jeton part avec le compte : rien ne doit survivre à une déconnexion.
      await service.from("communication_social_tokens").delete().eq("organization_id", organizationId).eq("social_account_id", accountId);
      const { error } = await service.from("communication_social_accounts").delete().eq("organization_id", organizationId).eq("id", accountId);
      if (error) throw new Error(error.message);
    }

    const { data, error } = await service
      .from("communication_social_accounts")
      .select("id, provider, external_account_id, display_name, avatar_url, status, parent_account_id, last_error, connected_at")
      .eq("organization_id", organizationId)
      .order("provider");
    if (error) throw new Error(error.message);

    return jsonResponse({ providers: providerReadiness(), accounts: data ?? [] });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Statut des connexions impossible." }, 400);
  }
});
