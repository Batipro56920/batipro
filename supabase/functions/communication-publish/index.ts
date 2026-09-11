import { corsHeaders, getServiceClient, jsonResponse } from "../_shared/communicationAuth.ts";
import { accountAccessToken, type ConnectedAccount } from "../_shared/socialAccounts.ts";
import { publishToNetwork } from "../_shared/socialPublish.ts";

const MAX_ATTEMPTS = 3;
const BATCH = 10;
const MEDIA_TTL_SECONDS = 3600;

/**
 * Vide la file des publications dues.
 *
 * Appelee par la planification, sans utilisateur connecte : elle s'authentifie
 * avec la cle de service et ne traite que des travaux deja valides et
 * programmes. Un echec n'arrete pas le lot, il est reessaye puis abandonne avec
 * le message du reseau, visible dans la campagne.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Vider la file n'appartient pas aux utilisateurs : seul l'appelant qui
  // connait le secret de planification peut declencher une diffusion.
  const expected = Deno.env.get("COMMUNICATION_CRON_SECRET");
  if (!expected) return jsonResponse({ error: "Secret COMMUNICATION_CRON_SECRET manquant sur le serveur." }, 503);
  if (req.headers.get("x-communication-cron") !== expected) return jsonResponse({ error: "Appel non autorisé." }, 401);

  const service = getServiceClient();
  const now = new Date().toISOString();

  const { data: jobs, error } = await service
    .from("communication_publish_jobs")
    .select("id, organization_id, variant_id, attempts, scheduled_at")
    .eq("status", "queued")
    .lte("scheduled_at", now)
    .order("scheduled_at")
    .limit(BATCH);
  if (error) return jsonResponse({ error: error.message }, 500);
  if (!jobs?.length) return jsonResponse({ processed: 0, published: 0, failed: 0 });

  let published = 0;
  let failed = 0;

  for (const job of jobs) {
    await service.from("communication_publish_jobs").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", job.id);
    try {
      const { data: variant, error: variantError } = await service
        .from("communication_publication_variants")
        .select("id, item_id, network, body, link_url, approval_status, social_account_id, communication_campaign_items(title)")
        .eq("id", job.variant_id)
        .single();
      if (variantError) throw new Error(variantError.message);
      if (variant.approval_status !== "approved") throw new Error("Version non validée : diffusion annulée.");
      if (!variant.social_account_id) throw new Error("Aucun compte social rattaché à cette version.");

      const { data: account, error: accountError } = await service
        .from("communication_social_accounts")
        .select("id, organization_id, provider, external_account_id, parent_account_id, display_name, status")
        .eq("id", variant.social_account_id)
        .single();
      if (accountError) throw new Error(accountError.message);
      const accessToken = await accountAccessToken(service, account as ConnectedAccount);

      // Les médias vivent dans un dépôt privé : le réseau va les chercher
      // lui-même, il lui faut donc une adresse signée et temporaire.
      const { data: assets } = await service
        .from("communication_campaign_assets")
        .select("storage_path, mime_type")
        .eq("item_id", variant.item_id)
        .order("created_at");
      const mediaUrls: string[] = [];
      const videoUrls: string[] = [];
      for (const asset of assets ?? []) {
        const mime = String(asset.mime_type ?? "");
        const isImage = mime.startsWith("image/");
        const isVideo = mime.startsWith("video/");
        if (!isImage && !isVideo) continue;
        const { data: signed } = await service.storage.from("communication-assets").createSignedUrl(asset.storage_path, MEDIA_TTL_SECONDS);
        if (!signed?.signedUrl) continue;
        (isVideo ? videoUrls : mediaUrls).push(signed.signedUrl);
      }

      const result = await publishToNetwork({
        provider: String(account.provider),
        // YouTube veut un titre court distinct de la description.
        title: String((variant as { communication_campaign_items?: { title?: string } }).communication_campaign_items?.title ?? ""),
        externalAccountId: String(account.external_account_id),
        parentAccountId: account.parent_account_id ? String(account.parent_account_id) : null,
        accessToken,
        body: String(variant.body ?? ""),
        linkUrl: variant.link_url ? String(variant.link_url) : null,
        mediaUrls,
        videoUrls,
      });

      await service.from("communication_publish_jobs").update({
        status: "published",
        provider_post_id: result.postId || null,
        provider_url: result.url,
        published_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      published += 1;

      // La publication n'est diffusée que lorsque tous ses réseaux sont partis.
      const { data: siblings } = await service
        .from("communication_publish_jobs")
        .select("status, communication_publication_variants!inner(item_id)")
        .eq("communication_publication_variants.item_id", variant.item_id);
      const pending = (siblings ?? []).filter((row: { status: string }) => ["queued", "processing"].includes(row.status));
      if (!pending.length) {
        await service.from("communication_campaign_items")
          .update({ status: "published", published_at: new Date().toISOString() })
          .eq("id", variant.item_id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Diffusion impossible.";
      const attempts = Number(job.attempts ?? 0) + 1;
      const giveUp = attempts >= MAX_ATTEMPTS;
      await service.from("communication_publish_jobs").update({
        status: giveUp ? "failed" : "queued",
        attempts,
        last_error: message,
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      if (giveUp) failed += 1;
    }
  }

  return jsonResponse({ processed: jobs.length, published, failed });
});
