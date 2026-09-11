import { refreshGoogleToken } from "./socialPublish.ts";

export type ConnectedAccount = {
  id: string;
  organization_id: string;
  provider: string;
  external_account_id: string;
  parent_account_id: string | null;
  display_name: string;
  status: string;
};

/**
 * Le jeton utilisable d'un compte, renouvele si besoin.
 *
 * Google expire en une heure : sans renouvellement, toute tache de fond
 * echouerait des la deuxieme heure. Les jetons de page Meta, eux, n'expirent
 * pas tant que l'autorisation tient.
 */
export async function accountAccessToken(service: any, account: ConnectedAccount): Promise<string> {
  if (account.status !== "connected") throw new Error("Compte déconnecté : reconnecte-le dans Connexions.");
  const { data: token, error } = await service
    .from("communication_social_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("social_account_id", account.id)
    .single();
  if (error) throw new Error("Jeton introuvable : reconnecte ce compte.");

  const expired = token.expires_at ? Date.parse(token.expires_at) < Date.now() + 60_000 : false;
  if (!expired) return String(token.access_token ?? "");

  if (token.refresh_token && account.provider === "google_business") {
    const refreshed = await refreshGoogleToken(String(token.refresh_token));
    await service.from("communication_social_tokens")
      .update({ access_token: refreshed.accessToken, expires_at: refreshed.expiresAt, updated_at: new Date().toISOString() })
      .eq("social_account_id", account.id);
    return refreshed.accessToken;
  }
  throw new Error("Autorisation expirée : reconnecte ce compte dans Connexions.");
}

export async function listConnectedAccounts(service: any): Promise<ConnectedAccount[]> {
  const { data, error } = await service
    .from("communication_social_accounts")
    .select("id, organization_id, provider, external_account_id, parent_account_id, display_name, status")
    .eq("status", "connected");
  if (error) throw new Error(error.message);
  return (data ?? []) as ConnectedAccount[];
}

/** Une panne de reseau ne doit pas rester muette dans la fiche du compte. */
export async function recordAccountError(service: any, accountId: string, message: string | null) {
  await service.from("communication_social_accounts")
    .update({ last_error: message, updated_at: new Date().toISOString() })
    .eq("id", accountId);
}
