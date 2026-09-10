export type CampaignStatus = "draft" | "active" | "paused" | "completed" | "archived";
export type ItemStatus = "idea" | "to_prepare" | "to_review" | "scheduled" | "published";
export type ItemType = "idea" | "publication" | "mockup" | "task";

export type Campaign = {
  id: string; organization_id: string; title: string; objective: string | null; audience: string | null;
  brief: string | null; status: CampaignStatus; channels: string[]; start_date: string | null;
  end_date: string | null; created_at: string; updated_at: string;
};
export type CampaignItem = {
  id: string; organization_id: string; campaign_id: string; title: string; content: string | null;
  item_type: ItemType; status: ItemStatus; channels: string[]; chantier_id: string | null;
  scheduled_at: string | null; created_by_name: string | null; created_at: string;
};
export type CampaignComment = { id: string; campaign_id: string; item_id: string | null; body: string; author_name: string | null; created_at: string };
export type CampaignAsset = { id: string; campaign_id: string; item_id: string | null; file_name: string; mime_type: string | null; file_size: number | null; signed_url?: string };
export type ChantierOption = { id: string; nom: string; client: string | null };
export type Workspace = { campaign: Campaign; items: CampaignItem[]; comments: CampaignComment[]; assets: CampaignAsset[] };
