import { supabase } from "../lib/supabaseClient";
import { deleteDocument, getSignedUrl, uploadDocument } from "./chantierDocuments.service";
import { getCurrentUserProfile } from "./currentUserProfile.service";

export type ChantierFeedVisibility = "equipe" | "backoffice";

export type ChantierFeedAttachmentRow = {
  id: string;
  post_id: string;
  document_id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  signed_url: string | null;
  created_at: string;
};

export type ChantierFeedPostRow = {
  id: string;
  chantier_id: string;
  author_id: string | null;
  author_name: string | null;
  author_role: string | null;
  author_intervenant_id: string | null;
  body: string;
  visibility: ChantierFeedVisibility;
  parent_post_id: string | null;
  attachments: ChantierFeedAttachmentRow[];
  created_at: string;
  updated_at: string;
};

const FEED_POST_SELECT = [
  "id",
  "chantier_id",
  "author_id",
  "author_name",
  "author_role",
  "author_intervenant_id",
  "body",
  "visibility",
  "parent_post_id",
  "created_at",
  "updated_at",
].join(", ");

function fromFeedPosts() {
  return (supabase as any).from("chantier_feed_posts");
}

function fromFeedAttachments() {
  return (supabase as any).from("chantier_feed_attachments");
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
    author_intervenant_id: normalizeText(row.author_intervenant_id),
    body: String(row.body ?? "").trim(),
    visibility: normalizeVisibility(row.visibility),
    parent_post_id: normalizeText(row.parent_post_id),
    attachments: [],
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function isMissingTableError(error: unknown, tableName: string): boolean {
  const code = String((error as any)?.code ?? "");
  const message = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "42703" || code === "PGRST205") return true;
  return (
    message.includes(tableName.toLowerCase()) &&
    (message.includes("schema cache") || message.includes("does not exist") || message.includes("could not find"))
  );
}

async function listAttachmentsByPostIds(
  postIds: string[],
): Promise<{ attachmentsByPostId: Map<string, ChantierFeedAttachmentRow[]>; schemaReady: boolean }> {
  const attachmentsByPostId = new Map<string, ChantierFeedAttachmentRow[]>();
  if (postIds.length === 0) return { attachmentsByPostId, schemaReady: true };

  const { data: linkRows, error: linkError } = await fromFeedAttachments()
    .select("id, post_id, document_id, created_at")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });

  if (linkError) {
    if (isMissingTableError(linkError, "chantier_feed_attachments")) {
      return { attachmentsByPostId, schemaReady: false };
    }
    throw new Error(linkError.message);
  }

  const rows = (linkRows ?? []) as Array<Record<string, unknown>>;
  const documentIds = Array.from(new Set(rows.map((row) => String(row.document_id ?? "")).filter(Boolean)));
  if (documentIds.length === 0) return { attachmentsByPostId, schemaReady: true };

  const { data: documents, error: documentError } = await (supabase as any)
    .from("chantier_documents")
    .select("id, file_name, mime_type, size_bytes, storage_path")
    .in("id", documentIds);

  if (documentError) throw new Error(documentError.message);

  const documentById = new Map(
    ((documents ?? []) as Array<Record<string, unknown>>).map((document) => [
      String(document.id ?? ""),
      document,
    ]),
  );

  await Promise.all(rows.map(async (row) => {
    const postId = String(row.post_id ?? "");
    const documentId = String(row.document_id ?? "");
    const document = documentById.get(documentId);
    if (!postId || !document) return;

    let signedUrl: string | null = null;
    const storagePath = String(document.storage_path ?? "");
    if (storagePath) {
      try {
        signedUrl = await getSignedUrl(storagePath, 15 * 60);
      } catch {
        signedUrl = null;
      }
    }

    const attachment: ChantierFeedAttachmentRow = {
      id: String(row.id ?? ""),
      post_id: postId,
      document_id: documentId,
      file_name: String(document.file_name ?? "Pièce jointe"),
      mime_type: normalizeText(document.mime_type),
      size_bytes: normalizeNumber(document.size_bytes),
      signed_url: signedUrl,
      created_at: String(row.created_at ?? new Date().toISOString()),
    };
    if (!attachmentsByPostId.has(postId)) attachmentsByPostId.set(postId, []);
    attachmentsByPostId.get(postId)?.push(attachment);
  }));

  return { attachmentsByPostId, schemaReady: true };
}

export async function listChantierFeedPosts(
  chantierId: string,
): Promise<{ posts: ChantierFeedPostRow[]; schemaReady: boolean; attachmentsSchemaReady: boolean }> {
  const normalizedChantierId = String(chantierId ?? "").trim();
  if (!normalizedChantierId) throw new Error("chantierId manquant.");

  const { data, error } = await fromFeedPosts()
    .select(FEED_POST_SELECT)
    .eq("chantier_id", normalizedChantierId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingTableError(error, "chantier_feed_posts")) {
      return { posts: [], schemaReady: false, attachmentsSchemaReady: false };
    }
    throw new Error(error.message);
  }

  const posts = ((data ?? []) as Array<Record<string, unknown>>).map(normalizePost);
  const attachmentResult = await listAttachmentsByPostIds(posts.map((post) => post.id));
  return {
    posts: posts.map((post) => ({
      ...post,
      attachments: attachmentResult.attachmentsByPostId.get(post.id) ?? [],
    })),
    schemaReady: true,
    attachmentsSchemaReady: attachmentResult.schemaReady,
  };
}

/** Charge les publications de tous les chantiers visibles par le compte bureau. */
export async function listAllChantierFeedPosts(): Promise<{
  posts: ChantierFeedPostRow[];
  schemaReady: boolean;
  attachmentsSchemaReady: boolean;
}> {
  const { data, error } = await fromFeedPosts()
    .select(FEED_POST_SELECT)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    if (isMissingTableError(error, "chantier_feed_posts")) {
      return { posts: [], schemaReady: false, attachmentsSchemaReady: false };
    }
    throw new Error(error.message);
  }

  const posts = ((data ?? []) as Array<Record<string, unknown>>).map(normalizePost);
  const attachmentResult = await listAttachmentsByPostIds(posts.map((post) => post.id));
  return {
    posts: posts.map((post) => ({
      ...post,
      attachments: attachmentResult.attachmentsByPostId.get(post.id) ?? [],
    })),
    schemaReady: true,
    attachmentsSchemaReady: attachmentResult.schemaReady,
  };
}

function validateFeedFiles(files: File[]): File[] {
  if (files.length > 4) throw new Error("Maximum 4 pièces jointes par publication.");
  for (const file of files) {
    const type = String(file.type ?? "").toLowerCase();
    const name = String(file.name ?? "").toLowerCase();
    const allowed = type.startsWith("image/") || type === "application/pdf" || name.endsWith(".pdf");
    if (!allowed) throw new Error("Seules les images et les PDF sont acceptés.");
    if (!Number.isFinite(file.size) || file.size <= 0) throw new Error("Pièce jointe vide ou invalide.");
    if (file.size > 20 * 1024 * 1024) throw new Error("Pièce jointe trop volumineuse (max 20 Mo).");
  }
  return files;
}

export async function createChantierFeedPost(input: {
  chantierId: string;
  body: string;
  visibility: ChantierFeedVisibility;
  parentPostId?: string | null;
  files?: File[];
}): Promise<ChantierFeedPostRow> {
  const chantierId = String(input.chantierId ?? "").trim();
  const body = String(input.body ?? "").trim();
  const files = validateFeedFiles(input.files ?? []);
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
    if (isMissingTableError(error, "chantier_feed_posts")) {
      throw new Error("Le SQL du fil chantier n'est pas encore appliqué sur Supabase.");
    }
    throw new Error(error.message);
  }

  const post = normalizePost((data ?? {}) as Record<string, unknown>);
  if (files.length === 0) return post;

  const attachments: ChantierFeedAttachmentRow[] = [];
  for (const file of files) {
    const document = await uploadDocument({
      chantierId,
      file,
      title: file.name,
      category: "Fil chantier",
      documentType: String(file.type ?? "").startsWith("image/") ? "PHOTO" : "PDF",
      visibility_mode: post.visibility === "backoffice" ? "RESTRICTED" : "GLOBAL",
      accessIntervenantIds: [],
    });

    const { data: link, error: linkError } = await fromFeedAttachments()
      .insert({
        post_id: post.id,
        document_id: document.id,
      })
      .select("id, post_id, document_id, created_at")
      .single();

    if (linkError) {
      await deleteDocument(document.id, document.storage_path);
      if (isMissingTableError(linkError, "chantier_feed_attachments")) {
        throw new Error("Message publié, mais le SQL des pièces jointes du fil n'est pas appliqué.");
      }
      throw new Error(`Message publié, mais la pièce jointe a échoué : ${linkError.message}`);
    }

    let signedUrl: string | null = null;
    try {
      signedUrl = await getSignedUrl(document.storage_path, 15 * 60);
    } catch {
      signedUrl = null;
    }

    attachments.push({
      id: String(link.id ?? ""),
      post_id: post.id,
      document_id: document.id,
      file_name: String(document.file_name ?? file.name),
      mime_type: normalizeText(document.mime_type),
      size_bytes: normalizeNumber(document.size_bytes),
      signed_url: signedUrl,
      created_at: String(link.created_at ?? new Date().toISOString()),
    });
  }

  return { ...post, attachments };
}
