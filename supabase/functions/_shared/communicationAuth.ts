import { getAuthenticatedUser, getServiceClient } from "./googleCalendar.ts";

export { corsHeaders, getServiceClient, jsonResponse, redirectResponse, requiredEnv } from "./googleCalendar.ts";

/**
 * Qui demande, et pour quelle entreprise.
 *
 * Connecter un compte social engage toute l'entreprise : seuls les profils du
 * bureau y ont droit, et l'organisation vient du profil, jamais du client.
 */
export async function getCommunicationIdentity(req: Request) {
  const user = await getAuthenticatedUser(req);
  const service = getServiceClient();
  const { data, error } = await service
    .from("profiles")
    .select("id, role, organization_id, display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.organization_id) throw new Error("Organisation introuvable pour ce compte.");
  if (!["ADMIN", "BUREAU"].includes(String(data.role))) {
    throw new Error("Seul le bureau peut connecter un compte social.");
  }
  return {
    service,
    userId: String(data.id),
    organizationId: String(data.organization_id),
    name: String(data.display_name ?? "Équipe"),
  };
}
