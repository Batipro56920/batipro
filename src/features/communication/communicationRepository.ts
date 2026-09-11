import { supabase } from "../../lib/supabaseClient";
import { getCurrentUserProfile } from "../../services/currentUserProfile.service";
import { normalizeChannels } from "./networks";
import type { ApprovalStatus, Campaign, CampaignAsset, CampaignComment, CampaignItem, CampaignStatus, ChantierOption, InboxMessage, InboxThread, InboxThreadStatus, ItemStatus, ItemType, PublicationDraftInput, PublicationMetrics, PublicationVariant, ReviewPublication, SocialAccount, PublishJob, SocialMetricsSummary, SocialNetwork, Workspace } from "./types";

const db = supabase as any;
async function identity() {
  const profile = await getCurrentUserProfile();
  if (!profile?.id || !profile.organization_id) throw new Error("Profil ou organisation introuvable.");
  return { organizationId: profile.organization_id, userId: profile.id, name: profile.display_name ?? profile.email ?? "Équipe" };
}
function fail(error: { message?: string } | null) { if (error) throw new Error(error.message || "Une erreur est survenue."); }
/** Les lignes ecrites avant l'unification portent encore des libelles de canaux. */
function withChannels<T extends { channels?: string[] | null }>(row: T): T {
  return row ? ({ ...row, channels: normalizeChannels(row.channels) } as T) : row;
}

export async function listCampaigns(): Promise<Campaign[]> {
  const { organizationId } = await identity();
  const { data, error } = await db.from("communication_campaigns").select("*").eq("organization_id", organizationId).neq("status", "archived").order("updated_at", { ascending: false });
  fail(error); return (data ?? []) as Campaign[];
}
export async function createCampaign(input: { title: string; objective?: string; audience?: string; brief?: string; channels: string[]; start_date?: string; end_date?: string }): Promise<Campaign> {
  const { organizationId } = await identity();
  const { data, error } = await db.from("communication_campaigns").insert({ organization_id: organizationId, ...input, channels: normalizeChannels(input.channels), objective: input.objective || null, audience: input.audience || null, brief: input.brief || null, start_date: input.start_date || null, end_date: input.end_date || null }).select("*").single();
  fail(error); return withChannels(data) as Campaign;
}
export async function loadWorkspace(id: string): Promise<Workspace> {
  const { organizationId } = await identity();
  const [campaignQ, itemsQ, commentsQ, assetsQ] = await Promise.all([
    db.from("communication_campaigns").select("*").eq("organization_id", organizationId).eq("id", id).single(),
    db.from("communication_campaign_items").select("*").eq("organization_id", organizationId).eq("campaign_id", id).order("sort_order").order("created_at"),
    db.from("communication_campaign_comments").select("id,campaign_id,item_id,body,author_name,created_at").eq("organization_id", organizationId).eq("campaign_id", id).order("created_at"),
    db.from("communication_campaign_assets").select("id,campaign_id,item_id,file_name,mime_type,file_size,storage_path").eq("organization_id", organizationId).eq("campaign_id", id).order("created_at", { ascending: false }),
  ]);
  [campaignQ, itemsQ, commentsQ, assetsQ].forEach((q) => fail(q.error));
  const assets = await Promise.all((assetsQ.data ?? []).map(async (asset: any) => {
    const { data } = await supabase.storage.from("communication-assets").createSignedUrl(asset.storage_path, 3600);
    return { ...asset, signed_url: data?.signedUrl } as CampaignAsset;
  }));
  const items = (itemsQ.data ?? []).map(withChannels) as CampaignItem[];
  const itemIds = items.map((item) => item.id);
  // L'état "validé" ne vit pas sur le contenu mais sur ses versions par réseau :
  // sans elles, la liste ne saurait pas distinguer un brouillon d'un contenu prêt.
  const { data: variantRows } = itemIds.length
    ? await db.from("communication_publication_variants").select("id,organization_id,item_id,social_account_id,network,body,link_url,first_comment,approval_status,approved_at").eq("organization_id", organizationId).in("item_id", itemIds)
    : { data: [] as PublicationVariant[] };
  return {
    campaign: withChannels(campaignQ.data) as Campaign,
    items,
    comments: commentsQ.data as CampaignComment[],
    assets,
    jobs: await listPublishJobs(itemIds),
    variants: (variantRows ?? []) as PublicationVariant[],
  };
}
export async function updateCampaign(id: string, patch: Partial<Pick<Campaign,"title"|"objective"|"audience"|"brief"|"status"|"channels"|"start_date"|"end_date">>) {
  const { organizationId } = await identity();
  const payload = patch.channels ? { ...patch, channels: normalizeChannels(patch.channels) } : patch;
  const { error } = await db.from("communication_campaigns").update(payload).eq("organization_id", organizationId).eq("id", id); fail(error);
}
export async function addItem(campaignId: string, input: { title: string; content?: string; item_type: ItemType; status: ItemStatus; channels: string[]; chantier_id?: string; scheduled_at?: string }): Promise<CampaignItem> {
  const who = await identity();
  const { data, error } = await db.from("communication_campaign_items").insert({ organization_id: who.organizationId, campaign_id: campaignId, ...input, channels: normalizeChannels(input.channels), content: input.content || null, chantier_id: input.chantier_id || null, scheduled_at: input.scheduled_at ? new Date(input.scheduled_at).toISOString() : null, created_by_name: who.name }).select("*").single();
  fail(error); return withChannels(data) as CampaignItem;
}
/**
 * Le tableau ne doit pas contourner la validation.
 *
 * Le sélecteur de colonne permettait de faire passer n'importe quelle carte
 * d'"Idées" à "Publiées" sans accord et sans que les versions par réseau
 * changent d'état. Un contenu pouvait donc être planifié alors que ses
 * variantes étaient encore en brouillon. Les règles ci-dessous sont les mêmes
 * quel que soit l'écran qui déplace la carte.
 */
export async function assertItemTransition(id: string, status: ItemStatus): Promise<{ scheduledAt: string | null }> {
  const { organizationId } = await identity();
  const { data, error } = await db.from("communication_campaign_items").select("id,item_type,status,content,scheduled_at,communication_publication_variants(approval_status)").eq("organization_id", organizationId).eq("id", id).single();
  fail(error);
  const item = data as { item_type: ItemType; status: ItemStatus; content: string | null; scheduled_at: string | null; communication_publication_variants?: Array<{ approval_status: ApprovalStatus }> };
  const variants = item.communication_publication_variants ?? [];
  const approved = variants.length > 0 && variants.every((variant) => variant.approval_status === "approved");

  if (status === "to_review" && !String(item.content ?? "").trim()) {
    throw new Error("Écris le contenu avant de demander la validation.");
  }
  if (status === "scheduled") {
    if (!item.scheduled_at) throw new Error("Donne une date de publication avant de planifier ce contenu.");
    if (variants.length && !approved) throw new Error("Toutes les versions par réseau doivent être validées avant la planification.");
  }
  if (status === "published") {
    if (item.item_type !== "publication") throw new Error("Seule une publication se marque comme publiée. Crée-la depuis le compositeur.");
    if (!variants.length) throw new Error("Cette publication n'a aucune version par réseau.");
    if (!approved) throw new Error("Valide toutes les versions par réseau avant de marquer la publication comme diffusée.");
  }
  return { scheduledAt: item.scheduled_at };
}

export async function updateItemStatus(id: string, status: ItemStatus) {
  const { organizationId } = await identity();
  const { scheduledAt } = await assertItemTransition(id, status);
  const patch: Record<string, unknown> = { status };
  // Une publication diffusée garde la date à laquelle elle l'a été.
  if (status === "published") patch.published_at = new Date().toISOString();
  if (status !== "published" && status !== "scheduled") patch.published_at = null;
  if (status === "published" && !scheduledAt) patch.scheduled_at = new Date().toISOString();
  const { error } = await db.from("communication_campaign_items").update(patch).eq("organization_id", organizationId).eq("id", id);
  fail(error);
}
export async function deleteItem(id: string) { const { organizationId } = await identity(); const { error } = await db.from("communication_campaign_items").delete().eq("organization_id", organizationId).eq("id", id); fail(error); }
export async function addComment(campaignId: string, body: string) { const who = await identity(); const { error } = await db.from("communication_campaign_comments").insert({ organization_id: who.organizationId, campaign_id: campaignId, body, author_name: who.name }); fail(error); }
export async function uploadAssets(campaignId: string, itemId: string, files: File[]) {
  const who = await identity();
  for (const file of files) {
    const safe = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${who.organizationId}/${campaignId}/${itemId}/${crypto.randomUUID()}-${safe}`;
    const uploaded = await supabase.storage.from("communication-assets").upload(path, file, { upsert: false, contentType: file.type }); fail(uploaded.error);
    const { error } = await db.from("communication_campaign_assets").insert({ organization_id: who.organizationId, campaign_id: campaignId, item_id: itemId, storage_path: path, file_name: file.name, mime_type: file.type || null, file_size: file.size }); fail(error);
  }
}
export async function listAllScheduled(): Promise<(CampaignItem & { campaign_title?: string })[]> {
  const { organizationId } = await identity(); const { data, error } = await db.from("communication_campaign_items").select("*, communication_campaigns(title)").eq("organization_id", organizationId).not("scheduled_at", "is", null).order("scheduled_at"); fail(error);
  return (data ?? []).map((row: any) => withChannels({ ...row, campaign_title: row.communication_campaigns?.title })) as (CampaignItem & { campaign_title?: string })[];
}
export async function listAllAssets(): Promise<CampaignAsset[]> {
  const { organizationId } = await identity(); const { data, error } = await db.from("communication_campaign_assets").select("id,campaign_id,item_id,file_name,mime_type,file_size,storage_path").eq("organization_id", organizationId).order("created_at", { ascending: false }); fail(error);
  return Promise.all((data ?? []).map(async (asset: any) => { const { data: signed } = await supabase.storage.from("communication-assets").createSignedUrl(asset.storage_path, 3600); return { ...asset, signed_url: signed?.signedUrl }; }));
}
export async function listChantiers(): Promise<ChantierOption[]> { const { data, error } = await db.from("chantiers").select("id,nom,client").is("deleted_at", null).order("nom"); fail(error); return (data ?? []) as ChantierOption[]; }
export const campaignStatusLabel: Record<CampaignStatus,string> = { draft:"Brouillon",active:"Active",paused:"En pause",completed:"Terminée",archived:"Archivée" };

export async function listSocialAccounts(): Promise<SocialAccount[]> {
  const { organizationId } = await identity();
  const { data, error } = await db.from("communication_social_accounts").select("id,organization_id,provider,external_account_id,display_name,avatar_url,status,scopes,connected_at,updated_at").eq("organization_id", organizationId).order("provider");
  fail(error);
  return (data ?? []) as SocialAccount[];
}

export async function createPublicationDraft(input: PublicationDraftInput): Promise<CampaignItem> {
  const who = await identity();
  const status: ItemStatus = input.submitForReview ? "to_review" : "to_prepare";
  const item = await addItem(input.campaignId, {
    title: input.title,
    content: input.baseContent,
    item_type: "publication",
    status,
    channels: input.variants.map((variant) => variant.network),
    chantier_id: input.chantierId,
    scheduled_at: input.scheduledAt,
  });

  const approvalStatus: ApprovalStatus = input.submitForReview ? "review_requested" : "draft";
  const rows = input.variants.map((variant) => ({
    organization_id: who.organizationId,
    item_id: item.id,
    social_account_id: variant.socialAccountId || null,
    network: variant.network,
    body: variant.body,
    link_url: variant.linkUrl || null,
    first_comment: variant.firstComment || null,
    approval_status: approvalStatus,
  }));
  const { data, error } = await db.from("communication_publication_variants").insert(rows).select("id");
  if (error) {
    await db.from("communication_campaign_items").delete().eq("organization_id", who.organizationId).eq("id", item.id);
    fail(error);
  }
  if (input.submitForReview && data?.length) {
    const events = data.map((variant: { id: string }) => ({ organization_id: who.organizationId, variant_id: variant.id, action: "requested", actor_name: who.name }));
    const result = await db.from("communication_approval_events").insert(events);
    fail(result.error);
  }
  return item;
}

export async function listPublicationVariants(itemId: string): Promise<PublicationVariant[]> {
  const { organizationId } = await identity();
  const { data, error } = await db.from("communication_publication_variants").select("id,organization_id,item_id,social_account_id,network,body,link_url,first_comment,approval_status,approved_at").eq("organization_id", organizationId).eq("item_id", itemId);
  fail(error);
  return (data ?? []) as PublicationVariant[];
}

export async function listInboxThreads(): Promise<InboxThread[]> {
  const { organizationId } = await identity();
  const { data, error } = await db.from("communication_inbox_threads").select("id,kind,contact_name,subject,status,unread,permalink,last_message_at,communication_social_accounts(provider,display_name)").eq("organization_id", organizationId).order("last_message_at", { ascending: false });
  fail(error);
  return (data ?? []).map((row: any) => ({ ...row, unread: row.unread !== false, permalink: row.permalink ?? null, provider: row.communication_social_accounts?.provider, account_name: row.communication_social_accounts?.display_name ?? "Compte" })) as InboxThread[];
}

export async function loadInboxMessages(threadId: string): Promise<InboxMessage[]> {
  const { organizationId } = await identity();
  const { data, error } = await db
    .from("communication_inbox_messages")
    .select("id,direction,body,author_name,sent_at")
    .eq("organization_id", organizationId)
    .eq("thread_id", threadId)
    .order("sent_at");
  fail(error);
  return (data ?? []) as InboxMessage[];
}

/** La réponse part du serveur avec le jeton du compte, jamais du navigateur. */
export async function replyToInboxThread(threadId: string, body: string): Promise<void> {
  await invokeCommunicationFunction("communication-inbox-reply", { threadId, body });
}

export async function updateInboxThreadStatus(threadId: string, status: InboxThreadStatus): Promise<void> {
  const { organizationId } = await identity();
  const { error } = await db
    .from("communication_inbox_threads")
    .update({ status, unread: status === "open" })
    .eq("organization_id", organizationId)
    .eq("id", threadId);
  fail(error);
}

export async function markInboxThreadRead(threadId: string): Promise<void> {
  const { organizationId } = await identity();
  await db.from("communication_inbox_threads").update({ unread: false }).eq("organization_id", organizationId).eq("id", threadId);
}

const EMPTY_SUMMARY: SocialMetricsSummary = { impressions: 0, reach: 0, engagements: 0, clicks: 0, comments: 0, shares: 0, leads: 0 };

/**
 * Mesures des publications, détail compris.
 *
 * Le total seul ne disait pas s'il valait zéro parce que rien n'a marché ou
 * parce que rien n'a encore été publié. Le détail, lui, le dit.
 */
export async function loadMetrics(): Promise<{ summary: SocialMetricsSummary; publications: PublicationMetrics[] }> {
  const { organizationId } = await identity();
  const { data, error } = await db
    .from("communication_post_metrics")
    .select("variant_id,measured_at,sync_error,impressions,reach,engagements,clicks,comments,shares,leads,communication_publication_variants(network,communication_campaign_items(title))")
    .eq("organization_id", organizationId)
    .order("measured_at", { ascending: false });
  fail(error);

  const publications = (data ?? []).map((row: any) => ({
    variantId: String(row.variant_id),
    itemTitle: String(row.communication_publication_variants?.communication_campaign_items?.title ?? "Publication"),
    network: String(row.communication_publication_variants?.network ?? ""),
    measuredAt: row.measured_at ?? null,
    syncError: row.sync_error ?? null,
    impressions: Number(row.impressions ?? 0),
    reach: Number(row.reach ?? 0),
    engagements: Number(row.engagements ?? 0),
    clicks: Number(row.clicks ?? 0),
    comments: Number(row.comments ?? 0),
    shares: Number(row.shares ?? 0),
    leads: Number(row.leads ?? 0),
  })) as PublicationMetrics[];

  const summary = publications.reduce((total, row) => ({
    impressions: total.impressions + row.impressions,
    reach: total.reach + row.reach,
    engagements: total.engagements + row.engagements,
    clicks: total.clicks + row.clicks,
    comments: total.comments + row.comments,
    shares: total.shares + row.shares,
    leads: total.leads + row.leads,
  }), { ...EMPTY_SUMMARY });

  return { summary, publications };
}

export async function listReviewPublications(): Promise<ReviewPublication[]> {
  const { organizationId } = await identity();
  const { data, error } = await db.from("communication_campaign_items").select("*,communication_campaigns(title),communication_publication_variants(id,organization_id,item_id,social_account_id,network,body,link_url,first_comment,approval_status,approved_at)").eq("organization_id", organizationId).eq("status", "to_review").order("updated_at", { ascending: false }); fail(error);
  const itemIds = (data ?? []).map((row: { id: string }) => row.id);
  const assetsQuery = itemIds.length ? await db.from("communication_campaign_assets").select("id,campaign_id,item_id,file_name,mime_type,file_size,storage_path").eq("organization_id", organizationId).in("item_id", itemIds) : { data: [], error: null }; fail(assetsQuery.error);
  const assets = await Promise.all((assetsQuery.data ?? []).map(async (asset: any) => { const { data: signed } = await supabase.storage.from("communication-assets").createSignedUrl(asset.storage_path, 3600); return { ...asset, signed_url: signed?.signedUrl } as CampaignAsset; }));
  return (data ?? []).map((row: any) => ({ ...row, campaign_title: row.communication_campaigns?.title ?? "Campagne", variants: row.communication_publication_variants ?? [], assets: assets.filter((asset) => asset.item_id === row.id) })) as ReviewPublication[];
}

export async function updateReviewPublication(itemId: string, scheduledAt: string | null, variants: Array<{ id: string; body: string }>) {
  const { organizationId } = await identity();
  const itemResult = await db.from("communication_campaign_items").update({ scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null }).eq("organization_id", organizationId).eq("id", itemId); fail(itemResult.error);
  for (const variant of variants) { const result = await db.from("communication_publication_variants").update({ body: variant.body }).eq("organization_id", organizationId).eq("id", variant.id); fail(result.error); }
}

export async function decidePublication(itemId: string, variantIds: string[], decision: "approved" | "changes_requested", scheduledAt: string | null, note?: string) {
  const who = await identity();
  if (!variantIds.length) throw new Error("Aucune variante à traiter.");
  const variantPatch = decision === "approved"
    ? { approval_status: "approved", approved_by: who.userId, approved_at: new Date().toISOString() }
    : { approval_status: "changes_requested", approved_by: null, approved_at: null };
  const { error } = await db.from("communication_publication_variants").update(variantPatch).eq("organization_id", who.organizationId).in("id", variantIds);
  fail(error);
  const events = variantIds.map((variantId) => ({ organization_id: who.organizationId, variant_id: variantId, action: decision, note: note?.trim() || null, actor_name: who.name }));
  const eventResult = await db.from("communication_approval_events").insert(events); fail(eventResult.error);
  const statusResult = await db.from("communication_publication_variants").select("approval_status").eq("organization_id", who.organizationId).eq("item_id", itemId); fail(statusResult.error);
  const allApproved = (statusResult.data ?? []).length > 0 && (statusResult.data ?? []).every((variant: { approval_status: ApprovalStatus }) => variant.approval_status === "approved");
  const nextStatus: ItemStatus = decision === "changes_requested" ? "to_prepare" : allApproved ? (scheduledAt ? "scheduled" : "to_prepare") : "to_review";
  const itemResult = await db.from("communication_campaign_items").update({ status: nextStatus }).eq("organization_id", who.organizationId).eq("id", itemId); fail(itemResult.error);
}

/** Message réel d'une fonction serveur : sans ça on n'affiche qu'un code HTTP. */
async function invokeCommunicationFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return data as T;
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const payload = await context.clone().json();
      const message = String((payload as { error?: unknown })?.error ?? "").trim();
      if (message) throw new Error(message);
    } catch (parsed) {
      if (parsed instanceof Error && parsed.message) throw parsed;
    }
  }
  throw new Error(error.message || "Fonction indisponible.");
}

export type ProviderReadiness = { provider: SocialNetwork; label: string; configured: boolean; missingSecrets: string[] };
export type ConnectionsState = { providers: ProviderReadiness[]; accounts: SocialAccount[] };

export async function loadConnections(): Promise<ConnectionsState> {
  return invokeCommunicationFunction<ConnectionsState>("communication-connections", { action: "status" });
}

export async function disconnectSocialAccount(accountId: string): Promise<ConnectionsState> {
  return invokeCommunicationFunction<ConnectionsState>("communication-connections", { action: "disconnect", accountId });
}

/**
 * Ouvre l'autorisation du réseau. L'URL est construite côté serveur : les
 * identifiants d'application ne descendent jamais dans le navigateur.
 */
export async function startSocialConnection(provider: SocialNetwork): Promise<string> {
  const payload = await invokeCommunicationFunction<{ authUrl?: string }>("communication-oauth-start", {
    provider,
    redirectTo: `${window.location.origin}/communication?vue=connexions`,
  });
  const authUrl = String(payload?.authUrl ?? "");
  if (!authUrl) throw new Error("Le serveur n'a pas renvoyé d'adresse d'autorisation.");
  return authUrl;
}

/**
 * État de diffusion des publications d'une campagne.
 *
 * Une diffusion qui échoue laissait la publication en "planifiée" pour
 * toujours, sans rien dire. Le message du réseau doit remonter jusqu'à la
 * carte, sinon personne ne saura que rien n'est parti.
 */
export async function listPublishJobs(itemIds: string[]): Promise<PublishJob[]> {
  if (!itemIds.length) return [];
  const { organizationId } = await identity();
  const { data, error } = await db
    .from("communication_publish_jobs")
    .select("id,status,scheduled_at,published_at,provider_url,last_error,communication_publication_variants!inner(item_id,network)")
    .eq("organization_id", organizationId)
    .in("communication_publication_variants.item_id", itemIds);
  if (error) return [];
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    itemId: String(row.communication_publication_variants?.item_id ?? ""),
    network: String(row.communication_publication_variants?.network ?? ""),
    status: row.status,
    scheduledAt: row.scheduled_at ?? null,
    publishedAt: row.published_at ?? null,
    providerUrl: row.provider_url ?? null,
    lastError: row.last_error ?? null,
  }));
}

/** Modifie un contenu existant : le tableau ne savait que le créer et le supprimer. */
export async function updateItem(
  id: string,
  patch: { title?: string; content?: string | null; channels?: string[]; chantier_id?: string | null; scheduled_at?: string | null },
): Promise<void> {
  const { organizationId } = await identity();
  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.content !== undefined) payload.content = patch.content || null;
  if (patch.channels !== undefined) payload.channels = normalizeChannels(patch.channels);
  if (patch.chantier_id !== undefined) payload.chantier_id = patch.chantier_id || null;
  if (patch.scheduled_at !== undefined) payload.scheduled_at = patch.scheduled_at ? new Date(patch.scheduled_at).toISOString() : null;
  if (!Object.keys(payload).length) return;
  const { error } = await db.from("communication_campaign_items").update(payload).eq("organization_id", organizationId).eq("id", id);
  fail(error);
}

/**
 * Aligne les versions par réseau sur les réseaux choisis.
 *
 * Une version retirée est supprimée plutôt que laissée orpheline : sinon elle
 * resterait à valider, et la publication ne pourrait plus jamais être planifiée.
 */
export async function saveItemVariants(itemId: string, networks: string[], body: string): Promise<void> {
  const { organizationId } = await identity();
  const wanted = normalizeChannels(networks);

  const [{ data: existing, error: readError }, accounts] = await Promise.all([
    db.from("communication_publication_variants").select("id,network,approval_status").eq("organization_id", organizationId).eq("item_id", itemId),
    listSocialAccounts().catch(() => [] as SocialAccount[]),
  ]);
  fail(readError);

  const rows = (existing ?? []) as Array<{ id: string; network: string; approval_status: ApprovalStatus }>;
  const obsolete = rows.filter((row) => !wanted.includes(row.network as never)).map((row) => row.id);
  if (obsolete.length) {
    const { error } = await db.from("communication_publication_variants").delete().eq("organization_id", organizationId).in("id", obsolete);
    fail(error);
  }

  for (const network of wanted) {
    const current = rows.find((row) => row.network === network);
    if (current) {
      // Retoucher le texte annule la validation : ce qui a été approuvé n'est plus ce qui partirait.
      const { error } = await db.from("communication_publication_variants")
        .update({ body, approval_status: "draft", approved_at: null, approved_by: null })
        .eq("organization_id", organizationId)
        .eq("id", current.id);
      fail(error);
      continue;
    }
    const account = accounts.find((entry) => entry.provider === network && entry.status === "connected");
    const { error } = await db.from("communication_publication_variants").insert({
      organization_id: organizationId,
      item_id: itemId,
      network,
      body,
      social_account_id: account?.id ?? null,
      approval_status: "draft",
    });
    fail(error);
  }

  await updateItem(itemId, { channels: wanted });

  // Retoucher un contenu déjà planifié le ramène en préparation : sinon la
  // diffusion partirait avec un texte que plus personne n'a validé.
  const { data: current } = await db
    .from("communication_campaign_items")
    .select("status")
    .eq("organization_id", organizationId)
    .eq("id", itemId)
    .maybeSingle();
  if (current?.status === "scheduled") await updateItemStatus(itemId, "to_prepare");
}

/** Validation directe par le bureau, sans passer par la file de relecture. */
export async function validateItem(itemId: string): Promise<void> {
  const who = await identity();
  const { data, error } = await db
    .from("communication_publication_variants")
    .select("id")
    .eq("organization_id", who.organizationId)
    .eq("item_id", itemId);
  fail(error);
  const variants = (data ?? []) as Array<{ id: string }>;
  if (!variants.length) throw new Error("Choisis au moins un réseau avant de valider ce contenu.");

  const { error: updateError } = await db.from("communication_publication_variants")
    .update({ approval_status: "approved", approved_by: who.userId, approved_at: new Date().toISOString() })
    .eq("organization_id", who.organizationId)
    .in("id", variants.map((variant) => variant.id));
  fail(updateError);

  const { error: eventError } = await db.from("communication_approval_events").insert(
    variants.map((variant) => ({ organization_id: who.organizationId, variant_id: variant.id, action: "approved", actor_name: who.name })),
  );
  fail(eventError);
}

/** Remet un contenu validé en préparation, par exemple pour le corriger. */
export async function reopenItem(itemId: string): Promise<void> {
  const who = await identity();
  const { error } = await db.from("communication_publication_variants")
    .update({ approval_status: "draft", approved_by: null, approved_at: null })
    .eq("organization_id", who.organizationId)
    .eq("item_id", itemId);
  fail(error);
  await updateItemStatus(itemId, "to_prepare");
}

export async function scheduleItem(itemId: string, scheduledAt: string): Promise<void> {
  if (!scheduledAt) throw new Error("Donne une date de publication.");
  await updateItem(itemId, { scheduled_at: scheduledAt });
  await updateItemStatus(itemId, "scheduled");
}
