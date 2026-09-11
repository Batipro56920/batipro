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
  scheduled_at: string | null; published_at: string | null; created_by_name: string | null; created_at: string;
};
export type CampaignComment = { id: string; campaign_id: string; item_id: string | null; body: string; author_name: string | null; created_at: string };
export type CampaignAsset = { id: string; campaign_id: string; item_id: string | null; file_name: string; mime_type: string | null; file_size: number | null; signed_url?: string };
export type ChantierOption = { id: string; nom: string; client: string | null };
export type PublishJobStatus = "queued" | "processing" | "published" | "failed" | "cancelled";
export type PublishJob = {
  id: string;
  itemId: string;
  network: string;
  status: PublishJobStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  providerUrl: string | null;
  lastError: string | null;
};
export type Workspace = { campaign: Campaign; items: CampaignItem[]; comments: CampaignComment[]; assets: CampaignAsset[]; jobs: PublishJob[] };

export type SocialNetwork = "facebook" | "instagram" | "linkedin" | "google_business" | "tiktok" | "youtube";
export type ApprovalStatus = "draft" | "review_requested" | "changes_requested" | "approved";
export type SocialAccountStatus = "connected" | "expired" | "revoked";

export type SocialAccount = {
  id: string;
  organization_id: string;
  provider: SocialNetwork;
  external_account_id: string;
  display_name: string;
  avatar_url: string | null;
  status: SocialAccountStatus;
  parent_account_id: string | null;
  last_error: string | null;
  scopes: string[];
  connected_at: string;
  updated_at: string;
};

export type PublicationVariant = {
  id: string;
  organization_id: string;
  item_id: string;
  social_account_id: string | null;
  network: SocialNetwork;
  body: string | null;
  link_url: string | null;
  first_comment: string | null;
  approval_status: ApprovalStatus;
  approved_at: string | null;
};

export type PublicationDraftInput = {
  campaignId: string;
  title: string;
  baseContent: string;
  scheduledAt?: string;
  chantierId?: string;
  variants: Array<{
    network: SocialNetwork;
    socialAccountId?: string;
    body: string;
    linkUrl?: string;
    firstComment?: string;
  }>;
  submitForReview: boolean;
};

export type InboxThreadStatus = "open" | "pending" | "closed";
export type InboxThread = {
  id: string;
  provider: SocialNetwork;
  kind: "message" | "comment" | "mention" | "review";
  contact_name: string | null;
  subject: string | null;
  status: InboxThreadStatus;
  unread: boolean;
  permalink: string | null;
  last_message_at: string;
  account_name: string;
};

export type InboxMessage = {
  id: string;
  direction: "inbound" | "outbound" | "internal_note";
  body: string;
  author_name: string | null;
  sent_at: string;
};

export type PublicationMetrics = {
  variantId: string;
  itemTitle: string;
  network: string;
  measuredAt: string | null;
  syncError: string | null;
} & SocialMetricsSummary;

export type SocialMetricsSummary = {
  impressions: number;
  reach: number;
  engagements: number;
  clicks: number;
  comments: number;
  shares: number;
  leads: number;
};

export type ReviewPublication = CampaignItem & {
  campaign_title: string;
  variants: PublicationVariant[];
  assets: CampaignAsset[];
};
