import { corsHeaders, getServiceClient, jsonResponse } from "../_shared/communicationAuth.ts";
import { accountAccessToken, type ConnectedAccount } from "../_shared/socialAccounts.ts";
import { fetchPostMetrics } from "../_shared/socialMetrics.ts";

const BATCH = 50;

/**
 * Met a jour les mesures des publications diffusees.
 *
 * Une mesure courante par version, ecrasee a chaque passage : l'historique
 * detaille n'apporterait rien tant que personne ne le lit, et un empilement
 * rendrait tout total faux.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("COMMUNICATION_CRON_SECRET");
  if (!expected) return jsonResponse({ error: "Secret COMMUNICATION_CRON_SECRET manquant sur le serveur." }, 503);
  if (req.headers.get("x-communication-cron") !== expected) return jsonResponse({ error: "Appel non autorisé." }, 401);

  const service = getServiceClient();
  const { data: jobs, error } = await service
    .from("communication_publish_jobs")
    .select("id, organization_id, variant_id, provider_post_id, published_at")
    .eq("status", "published")
    .not("provider_post_id", "is", null)
    .order("published_at", { ascending: false })
    .limit(BATCH);
  if (error) return jsonResponse({ error: error.message }, 500);
  if (!jobs?.length) return jsonResponse({ measured: 0, failed: 0 });

  const tokens = new Map<string, string>();
  let measured = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const { data: variant, error: variantError } = await service
        .from("communication_publication_variants")
        .select("id, social_account_id")
        .eq("id", job.variant_id)
        .single();
      if (variantError) throw new Error(variantError.message);
      if (!variant.social_account_id) throw new Error("Aucun compte rattaché à cette version.");

      const { data: account, error: accountError } = await service
        .from("communication_social_accounts")
        .select("id, organization_id, provider, external_account_id, parent_account_id, display_name, status")
        .eq("id", variant.social_account_id)
        .single();
      if (accountError) throw new Error(accountError.message);

      let token = tokens.get(account.id);
      if (!token) {
        token = await accountAccessToken(service, account as ConnectedAccount);
        tokens.set(account.id, token);
      }

      const metrics = await fetchPostMetrics({
        provider: String(account.provider),
        postId: String(job.provider_post_id),
        accessToken: token,
      });

      const { error: upsertError } = await service.from("communication_post_metrics").upsert({
        organization_id: job.organization_id,
        variant_id: job.variant_id,
        measured_at: new Date().toISOString(),
        ...metrics,
        leads: 0,
        sync_error: null,
      }, { onConflict: "variant_id" });
      if (upsertError) throw new Error(upsertError.message);
      measured += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mesure impossible.";
      // Un compteur absent doit dire pourquoi, pas afficher zéro en silence.
      await service.from("communication_post_metrics").upsert({
        organization_id: job.organization_id,
        variant_id: job.variant_id,
        measured_at: new Date().toISOString(),
        sync_error: message,
      }, { onConflict: "variant_id" });
      failed += 1;
    }
  }

  return jsonResponse({ measured, failed });
});
