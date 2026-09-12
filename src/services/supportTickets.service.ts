import { supabase } from "../lib/supabaseClient";
import { getCurrentUserProfile, isAdminProfile } from "./currentUserProfile.service";

const db = supabase as any;

export type SupportTicketCategory = "bug" | "problem" | "improvement";
export type SupportTicketStatus = "new" | "in_progress" | "waiting_user" | "resolved" | "closed";
export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";

export type SupportTicket = {
  id: string;
  organization_id: string;
  created_by: string;
  reporter_name: string | null;
  reporter_email: string | null;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  title: string;
  description: string;
  steps_to_reproduce: string | null;
  expected_result: string | null;
  page_url: string | null;
  user_agent: string | null;
  resolution_summary: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportTicketMessage = {
  id: string;
  ticket_id: string;
  author_id: string;
  author_name: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
};

export type SupportTicketAttachment = {
  id: string;
  ticket_id: string;
  message_id: string | null;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string;
  signed_url?: string;
  created_at: string;
};

export type SupportTicketDetail = {
  ticket: SupportTicket;
  messages: SupportTicketMessage[];
  attachments: SupportTicketAttachment[];
};

async function identity() {
  const profile = await getCurrentUserProfile();
  if (!profile?.id || !profile.organization_id) throw new Error("Profil ou organisation introuvable.");
  return {
    profile,
    organizationId: profile.organization_id,
    userId: profile.id,
    name: profile.display_name ?? profile.email ?? "Utilisateur Batipro",
    email: profile.email,
    isAdmin: isAdminProfile(profile),
  };
}

function fail(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "Une erreur est survenue.");
}

export async function getSupportIdentity() {
  const current = await identity();
  return { isAdmin: current.isAdmin, name: current.name };
}

export async function listSupportTickets(): Promise<SupportTicket[]> {
  const { organizationId } = await identity();
  const { data, error } = await db
    .from("support_tickets")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  fail(error);
  return (data ?? []) as SupportTicket[];
}

export async function createSupportTicket(input: {
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  title: string;
  description: string;
  stepsToReproduce?: string;
  expectedResult?: string;
  pageUrl?: string;
  userAgent?: string;
  files?: File[];
}): Promise<SupportTicket> {
  const who = await identity();
  const { data, error } = await db.from("support_tickets").insert({
    organization_id: who.organizationId,
    created_by: who.userId,
    reporter_name: who.name,
    reporter_email: who.email,
    category: input.category,
    priority: input.priority,
    title: input.title.trim(),
    description: input.description.trim(),
    steps_to_reproduce: input.stepsToReproduce?.trim() || null,
    expected_result: input.expectedResult?.trim() || null,
    page_url: input.pageUrl?.trim() || null,
    user_agent: input.userAgent?.trim() || null,
  }).select("*").single();
  fail(error);
  const ticket = data as SupportTicket;
  if (input.files?.length) await uploadSupportAttachments(ticket.id, input.files);
  return ticket;
}

export async function loadSupportTicket(ticketId: string): Promise<SupportTicketDetail> {
  const { organizationId } = await identity();
  const [ticketResult, messagesResult, attachmentsResult] = await Promise.all([
    db.from("support_tickets").select("*").eq("organization_id", organizationId).eq("id", ticketId).single(),
    db.from("support_ticket_messages").select("*").eq("organization_id", organizationId).eq("ticket_id", ticketId).order("created_at"),
    db.from("support_ticket_attachments").select("*").eq("organization_id", organizationId).eq("ticket_id", ticketId).order("created_at"),
  ]);
  fail(ticketResult.error); fail(messagesResult.error); fail(attachmentsResult.error);
  const attachments = await Promise.all((attachmentsResult.data ?? []).map(async (attachment: SupportTicketAttachment) => {
    const { data } = await supabase.storage.from("support-tickets").createSignedUrl(attachment.storage_path, 3600);
    return { ...attachment, signed_url: data?.signedUrl };
  }));
  return { ticket: ticketResult.data as SupportTicket, messages: (messagesResult.data ?? []) as SupportTicketMessage[], attachments };
}

export async function updateSupportTicket(ticketId: string, patch: {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  resolutionSummary?: string;
}) {
  const { organizationId, isAdmin } = await identity();
  if (!isAdmin) throw new Error("Seul un administrateur peut modifier le traitement du ticket.");
  const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) {
    values.status = patch.status;
    values.resolved_at = patch.status === "resolved" || patch.status === "closed" ? new Date().toISOString() : null;
  }
  if (patch.priority) values.priority = patch.priority;
  if (patch.resolutionSummary !== undefined) values.resolution_summary = patch.resolutionSummary.trim() || null;
  const { error } = await db.from("support_tickets").update(values).eq("organization_id", organizationId).eq("id", ticketId);
  fail(error);
}

export async function addSupportTicketMessage(ticketId: string, body: string, options?: { internal?: boolean; files?: File[] }) {
  const who = await identity();
  if (options?.internal && !who.isAdmin) throw new Error("Seul un administrateur peut ajouter une note interne.");
  const { data, error } = await db.from("support_ticket_messages").insert({
    organization_id: who.organizationId,
    ticket_id: ticketId,
    author_id: who.userId,
    author_name: who.name,
    body: body.trim(),
    is_internal: Boolean(options?.internal),
  }).select("id").single();
  fail(error);
  if (options?.files?.length) await uploadSupportAttachments(ticketId, options.files, String(data.id));
}

async function uploadSupportAttachments(ticketId: string, files: File[], messageId?: string) {
  const who = await identity();
  for (const file of files) {
    if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name} dépasse la limite de 15 Mo.`);
    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${who.organizationId}/${ticketId}/${crypto.randomUUID()}-${safeName}`;
    const upload = await supabase.storage.from("support-tickets").upload(storagePath, file, { contentType: file.type, upsert: false });
    fail(upload.error);
    const { error } = await db.from("support_ticket_attachments").insert({
      organization_id: who.organizationId,
      ticket_id: ticketId,
      message_id: messageId ?? null,
      uploaded_by: who.userId,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size,
    });
    fail(error);
  }
}
