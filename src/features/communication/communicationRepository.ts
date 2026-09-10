import { supabase } from "../../lib/supabaseClient";
import { getCurrentUserProfile } from "../../services/currentUserProfile.service";
import type { Campaign, CampaignAsset, CampaignComment, CampaignItem, CampaignStatus, ChantierOption, ItemStatus, ItemType, Workspace } from "./types";

const db = supabase as any;
async function identity() {
  const profile = await getCurrentUserProfile();
  if (!profile?.id || !profile.organization_id) throw new Error("Profil ou organisation introuvable.");
  return { organizationId: profile.organization_id, userId: profile.id, name: profile.display_name ?? profile.email ?? "Équipe" };
}
function fail(error: { message?: string } | null) { if (error) throw new Error(error.message || "Une erreur est survenue."); }

export async function listCampaigns(): Promise<Campaign[]> {
  const { organizationId } = await identity();
  const { data, error } = await db.from("communication_campaigns").select("*").eq("organization_id", organizationId).neq("status", "archived").order("updated_at", { ascending: false });
  fail(error); return (data ?? []) as Campaign[];
}
export async function createCampaign(input: { title: string; objective?: string; audience?: string; brief?: string; channels: string[]; start_date?: string; end_date?: string }): Promise<Campaign> {
  const { organizationId } = await identity();
  const { data, error } = await db.from("communication_campaigns").insert({ organization_id: organizationId, ...input, objective: input.objective || null, audience: input.audience || null, brief: input.brief || null, start_date: input.start_date || null, end_date: input.end_date || null }).select("*").single();
  fail(error); return data as Campaign;
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
  return { campaign: campaignQ.data as Campaign, items: itemsQ.data as CampaignItem[], comments: commentsQ.data as CampaignComment[], assets };
}
export async function updateCampaign(id: string, patch: Partial<Pick<Campaign,"title"|"objective"|"audience"|"brief"|"status"|"channels"|"start_date"|"end_date">>) {
  const { organizationId } = await identity(); const { error } = await db.from("communication_campaigns").update(patch).eq("organization_id", organizationId).eq("id", id); fail(error);
}
export async function addItem(campaignId: string, input: { title: string; content?: string; item_type: ItemType; status: ItemStatus; channels: string[]; chantier_id?: string; scheduled_at?: string }): Promise<CampaignItem> {
  const who = await identity();
  const { data, error } = await db.from("communication_campaign_items").insert({ organization_id: who.organizationId, campaign_id: campaignId, ...input, content: input.content || null, chantier_id: input.chantier_id || null, scheduled_at: input.scheduled_at ? new Date(input.scheduled_at).toISOString() : null, created_by_name: who.name }).select("*").single();
  fail(error); return data as CampaignItem;
}
export async function updateItemStatus(id: string, status: ItemStatus) { const { organizationId } = await identity(); const { error } = await db.from("communication_campaign_items").update({ status }).eq("organization_id", organizationId).eq("id", id); fail(error); }
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
  return (data ?? []).map((row: any) => ({ ...row, campaign_title: row.communication_campaigns?.title })) as (CampaignItem & { campaign_title?: string })[];
}
export async function listAllAssets(): Promise<CampaignAsset[]> {
  const { organizationId } = await identity(); const { data, error } = await db.from("communication_campaign_assets").select("id,campaign_id,item_id,file_name,mime_type,file_size,storage_path").eq("organization_id", organizationId).order("created_at", { ascending: false }); fail(error);
  return Promise.all((data ?? []).map(async (asset: any) => { const { data: signed } = await supabase.storage.from("communication-assets").createSignedUrl(asset.storage_path, 3600); return { ...asset, signed_url: signed?.signedUrl }; }));
}
export async function listChantiers(): Promise<ChantierOption[]> { const { data, error } = await db.from("chantiers").select("id,nom,client").is("deleted_at", null).order("nom"); fail(error); return (data ?? []) as ChantierOption[]; }
export const campaignStatusLabel: Record<CampaignStatus,string> = { draft:"Brouillon",active:"Active",paused:"En pause",completed:"Terminée",archived:"Archivée" };
