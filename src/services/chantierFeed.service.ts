import { supabase } from "../lib/supabaseClient";
import { getCurrentUserProfile } from "./currentUserProfile.service";

export type ChantierFeedVisibility = "equipe" | "backoffice";

export type ChantierFeedPostRow = {
  id: string;
  chantier_id: string;
  author_id: string | null;
  author_name: string | null;
  author_role: string | null;
  body: string;
  visibility: ChantierFeedVisibility;
  parent_post_id: string | null;
  created_at: string;
  updated_at: string;
};

const FEED_POST_SELECT = [
  "id",
  "chantier_id",
  "author_id",
  "author_name",
  "author_role",
  "body",
  "visibility",
  "parent_post_id",
  "created_at",
  "updated_at",
].join(", ");

function fromFeedPosts() {
  return (supabase as any).from("chantier_feed_posts");
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeVisibility(value: unknown): ChantierFeedVisibility {
  return String(value ?? "").trim().toLowerCase() === "backoffice" ? "backoffice" : "equipe";
}

function normalizePost(row: Record<string, unknown>): ChantierFeedPostRow {
  return {
    id: String(row.id ?? "").trim(),
    chantier_id: String(row.chantier_id ?? "").trim(),
    author_id: normalizeText(row.author_id),
    author_name: normalizeText(row.author_name),
    author_role: normalizeText(row.author_role),
    body: String(row.body ?? "").trim(),
    visibility: normalizeVisibility(row.visibility),
    parent_post_id: normalizeText(row.parent_post_id),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function isMissingFeedSchemaError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const message = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "42703" || code === "PGRST205") return true;
  return (
    message.includes("chantier_feed_posts") &&
    (message.includes("schema cache") || message.includes("does not exist") || message.includes("could not find"))
  );
}

export async function listChantierFeedPosts(
  chantierId: string,
): Promise<{ posts: ChantierFeedPostRow[]; schemaReady: boolean }> {
  const normalizedChantierId = String(chantierId ?? "").trim();
  if (!normalizedChantierId) throw new Error("chantierId manquant.");

  const { data, error } = await fromFeedPosts()
    .select(FEED_POST_SELECT)
    .eq("chantier_id", normalizedChantierId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingFeedSchemaError(error)) return { posts: [], schemaReady: false };
    throw new Error(error.message);
  }

  return {
    posts: ((data ?? []) as Array<Record<string, unknown>>).map(normalizePost),
    schemaReady: true,
  };
}

export async function createChantierFeedPost(input: {
  chantierId: string;
  body: string;
  visibility: ChantierFeedVisibility;
  parentPostId?: string | null;
}): Promise<ChantierFeedPostRow> {
  const chantierId = String(input.chantierId ?? "").trim();
  const body = String(input.body ?? "").trim();
  if (!chantierId) throw new Error("chantierId manquant.");
  if (!body) throw new Error("Le message est vide.");

  const profile = await getCurrentUserProfile();
  if (!profile?.id) throw new Error("Session utilisateur introuvable.");

  const { data, error } = await fromFeedPosts()
    .insert({
      chantier_id: chantierId,
      author_id: profile.id,
      author_name: profile.display_name ?? profile.email ?? "Utilisateur",
      author_role: profile.role ?? null,
      body,
      visibility: normalizeVisibility(input.visibility),
      parent_post_id: normalizeText(input.parentPostId),
    })
    .select(FEED_POST_SELECT)
    .single();

  if (error) {
    if (isMissingFeedSchemaError(error)) {
      throw new Error("Le SQL du fil chantier n'est pas encore appliqué sur Supabase.");
    }
    throw new Error(error.message);
  }

  return normalizePost((data ?? {}) as Record<string, unknown>);
}
