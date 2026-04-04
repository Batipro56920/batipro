import { supabase } from "../lib/supabaseClient";

export type ChantierMessageStatus = "envoyee" | "traitee";

export type ChantierMessageRow = {
  id: string;
  chantier_id: string;
  intervenant_id: string;
  intervenant_nom: string | null;
  request_date: string;
  subject: string;
  message: string;
  status: ChantierMessageStatus;
  admin_reply: string | null;
  admin_replied_by: string | null;
  admin_replied_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const MESSAGE_SELECT = [
  "id",
  "chantier_id",
  "intervenant_id",
  "request_date",
  "subject",
  "message",
  "status",
  "admin_reply",
  "admin_replied_by",
  "admin_replied_at",
  "created_at",
  "updated_at",
].join(", ");

function fromInformationRequests() {
  return (supabase as any).from("intervenant_information_requests");
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeStatus(value: unknown): ChantierMessageStatus {
  return String(value ?? "").trim().toLowerCase() === "traitee" ? "traitee" : "envoyee";
}

function mapMessageRow(row: Record<string, unknown>, intervenantNameById: Map<string, string>): ChantierMessageRow {
  const intervenantId = String(row.intervenant_id ?? "").trim();

  return {
    id: String(row.id ?? "").trim(),
    chantier_id: String(row.chantier_id ?? "").trim(),
    intervenant_id: intervenantId,
    intervenant_nom: intervenantNameById.get(intervenantId) ?? null,
    request_date: String(row.request_date ?? "").trim(),
    subject: String(row.subject ?? "Demande d'information").trim() || "Demande d'information",
    message: String(row.message ?? "").trim(),
    status: normalizeStatus(row.status),
    admin_reply: normalizeText(row.admin_reply),
    admin_replied_by: normalizeText(row.admin_replied_by),
    admin_replied_at: normalizeText(row.admin_replied_at),
    created_at: normalizeText(row.created_at),
    updated_at: normalizeText(row.updated_at),
  };
}

function isMissingMessagingSchemaError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();

  if (code === "42P01" || code === "42703" || code === "PGRST205") return true;

  return (
    msg.includes("intervenant_information_requests") ||
    msg.includes("admin_reply") ||
    msg.includes("row-level security") ||
    msg.includes("permission denied") ||
    msg.includes("schema cache") ||
    msg.includes("could not find") ||
    msg.includes("does not exist")
  );
}

async function enrichMessages(rows: Array<Record<string, unknown>>): Promise<ChantierMessageRow[]> {
  const intervenantIds = Array.from(
    new Set(rows.map((row) => String(row.intervenant_id ?? "").trim()).filter(Boolean)),
  );

  const intervenantNameById = new Map<string, string>();

  if (intervenantIds.length > 0) {
    const { data, error } = await (supabase as any)
      .from("intervenants")
      .select("id, nom")
      .in("id", intervenantIds);

    if (error) throw new Error(error.message);

    for (const intervenant of (data ?? []) as Array<Record<string, unknown>>) {
      intervenantNameById.set(
        String(intervenant.id ?? "").trim(),
        String(intervenant.nom ?? "Intervenant").trim() || "Intervenant",
      );
    }
  }

  return rows.map((row) => mapMessageRow(row, intervenantNameById));
}

export async function listChantierMessagesByChantierId(
  chantierId: string,
): Promise<{ messages: ChantierMessageRow[]; schemaReady: boolean }> {
  const nextChantierId = String(chantierId ?? "").trim();
  if (!nextChantierId) throw new Error("chantierId manquant.");

  const { data, error } = await fromInformationRequests()
    .select(MESSAGE_SELECT)
    .eq("chantier_id", nextChantierId)
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingMessagingSchemaError(error)) {
      return { messages: [], schemaReady: false };
    }
    throw new Error(error.message);
  }

  return {
    messages: await enrichMessages((data ?? []) as Array<Record<string, unknown>>),
    schemaReady: true,
  };
}

export async function updateChantierMessage(input: {
  id: string;
  chantier_id: string;
  status: ChantierMessageStatus;
  admin_reply?: string | null;
}): Promise<ChantierMessageRow> {
  const messageId = String(input.id ?? "").trim();
  const chantierId = String(input.chantier_id ?? "").trim();
  const adminReply = normalizeText(input.admin_reply);

  if (!messageId || !chantierId) throw new Error("Message chantier introuvable.");

  const { data: userResult } = await supabase.auth.getUser();
  const payload = {
    status: normalizeStatus(input.status),
    admin_reply: adminReply,
    admin_replied_by: adminReply ? userResult.user?.id ?? null : null,
    admin_replied_at: adminReply ? new Date().toISOString() : null,
  };

  const { data, error } = await fromInformationRequests()
    .update(payload)
    .eq("id", messageId)
    .eq("chantier_id", chantierId)
    .select(MESSAGE_SELECT)
    .single();

  if (error) {
    if (isMissingMessagingSchemaError(error)) {
      throw new Error("Migration messagerie non appliquée sur Supabase.");
    }
    throw new Error(error.message);
  }

  const [message] = await enrichMessages([(data ?? {}) as Record<string, unknown>]);
  if (!message) throw new Error("Message chantier introuvable.");
  return message;
}
