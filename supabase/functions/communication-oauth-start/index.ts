import { corsHeaders, getCommunicationIdentity, jsonResponse } from "../_shared/communicationAuth.ts";
import { providerAdapter, providerReadiness, redirectUri } from "../_shared/socialProviders.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Méthode non supportée." }, 405);

  try {
    const { service, userId, organizationId } = await getCommunicationIdentity(req);
    const body = await req.json().catch(() => ({}));
    const provider = String(body?.provider ?? "").trim();
    const readiness = providerReadiness().find((entry) => entry.provider === provider);
    if (!readiness) return jsonResponse({ error: `Réseau ${provider} non pris en charge.` }, 400);
    if (!readiness.configured) {
      return jsonResponse({
        error: `Secrets serveur manquants : ${readiness.missingSecrets.join(", ")}.`,
        missingSecrets: readiness.missingSecrets,
      }, 409);
    }

    const adapter = providerAdapter(provider);
    const state = crypto.randomUUID();
    const redirectTo = String(body?.redirectTo ?? "").trim() || null;

    // L'état lie le retour du réseau à l'utilisateur qui a lancé la connexion.
    // Sans lui, n'importe quel code intercepté rattacherait un compte.
    const { error } = await service.from("communication_oauth_states").insert({
      state,
      organization_id: organizationId,
      user_id: userId,
      provider,
      redirect_to: redirectTo,
    });
    if (error) throw new Error(error.message);

    await service.from("communication_oauth_states").delete().lt("expires_at", new Date().toISOString());

    return jsonResponse({ authUrl: adapter.authorizeUrl({ state, redirectUri: redirectUri() }) });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Connexion impossible." }, 400);
  }
});
