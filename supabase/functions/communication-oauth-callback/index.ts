import { getServiceClient, redirectResponse, requiredEnv } from "../_shared/communicationAuth.ts";
import { providerAdapter, redirectUri } from "../_shared/socialProviders.ts";

function withParam(url: string, key: string, value: string) {
  const next = new URL(url);
  next.searchParams.set(key, value);
  return next.toString();
}

Deno.serve(async (req) => {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const denied = requestUrl.searchParams.get("error_description") ?? requestUrl.searchParams.get("error");
  const fallback = `${requiredEnv("APP_BASE_URL").replace(/\/+$/, "")}/communication?vue=connexions`;
  let destination = fallback;

  try {
    if (!state) throw new Error("Retour OAuth incomplet.");
    const service = getServiceClient();
    const { data: stateRow, error: stateError } = await service
      .from("communication_oauth_states")
      .select("state, organization_id, user_id, provider, redirect_to, expires_at")
      .eq("state", state)
      .maybeSingle();
    if (stateError) throw new Error(stateError.message);
    if (!stateRow) throw new Error("Demande de connexion inconnue ou déjà utilisée.");

    destination = stateRow.redirect_to || fallback;
    await service.from("communication_oauth_states").delete().eq("state", state);

    if (Date.parse(stateRow.expires_at) < Date.now()) throw new Error("Demande de connexion expirée, relance-la.");
    if (denied) throw new Error(denied);
    if (!code) throw new Error("Le réseau n'a pas renvoyé de code d'autorisation.");

    const adapter = providerAdapter(String(stateRow.provider));
    const tokens = await adapter.exchange({ code, redirectUri: redirectUri() });
    if (!tokens.accessToken) throw new Error("Le réseau n'a pas renvoyé de jeton.");

    const accounts = await adapter.discoverAccounts(tokens);
    if (!accounts.length) {
      throw new Error("Aucune page administrable trouvée sur ce compte. Vérifie tes droits d'administration.");
    }

    for (const account of accounts) {
      if (!account.externalAccountId) continue;
      const { data: saved, error: accountError } = await service
        .from("communication_social_accounts")
        .upsert({
          organization_id: stateRow.organization_id,
          provider: stateRow.provider,
          external_account_id: account.externalAccountId,
          display_name: account.displayName,
          avatar_url: account.avatarUrl,
          parent_account_id: account.parentAccountId,
          status: "connected",
          scopes: tokens.scopes.length ? tokens.scopes : adapter.scopes,
          connected_by: stateRow.user_id,
          last_error: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id,provider,external_account_id" })
        .select("id")
        .single();
      if (accountError) throw new Error(accountError.message);

      // Une page Facebook publie avec son propre jeton : c'est lui qu'on garde
      // quand le réseau en fournit un, sinon le jeton utilisateur.
      const { error: tokenError } = await service.from("communication_social_tokens").upsert({
        social_account_id: saved.id,
        organization_id: stateRow.organization_id,
        access_token: account.accessToken ?? tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: account.accessToken ? null : tokens.expiresAt,
        scopes: tokens.scopes.length ? tokens.scopes : adapter.scopes,
        updated_at: new Date().toISOString(),
      }, { onConflict: "social_account_id" });
      if (tokenError) throw new Error(tokenError.message);
    }

    return redirectResponse(withParam(destination, "connexion", `${stateRow.provider}:${accounts.length}`));
  } catch (err) {
    return redirectResponse(withParam(destination, "connexion_erreur", err instanceof Error ? err.message : "callback"));
  }
});
