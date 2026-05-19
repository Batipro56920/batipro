import { supabase } from "../../../lib/supabaseClient";
import type { BusinessDocument } from "../domain/types";
import type { DocumentSendPayload } from "../components/DocumentSendDialog";

export type ClientWorkflowStatus = "sent" | "viewed" | "accepted" | "refused" | "modification_requested" | "expired";
export type ClientWorkflowAction = "view" | "accept" | "refuse" | "request_modification";

export type ClientWorkflowRecord = {
  id: string;
  source_kind: string;
  source_id: string;
  document_kind: string;
  document_number: string;
  document: BusinessDocument;
  recipient_email: string;
  recipient_name: string | null;
  status: ClientWorkflowStatus;
  require_signature: boolean;
  require_validation: boolean;
  allow_modification_request: boolean;
  token_expires_at: string;
  sent_at: string;
  viewed_at: string | null;
  accepted_at: string | null;
  refused_at: string | null;
  modification_requested_at: string | null;
  signed_at: string | null;
  signer_name: string | null;
  client_comment: string | null;
};

export type ClientWorkflowEvent = {
  event_type: string;
  actor_type: string;
  actor_email: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

export type SendBusinessDocumentResult = {
  workflowId: string;
  clientLink: string;
  expiresAt: string;
  email?: {
    skipped?: boolean;
    error?: string | null;
    id?: string | null;
  };
};

const EXPECTED_SUPABASE_URL = "https://vhwtpwmzaidmlvqcyfep.supabase.co";

export async function sendBusinessDocument(document: BusinessDocument, payload: DocumentSendPayload): Promise<SendBusinessDocumentResult> {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  console.info("[DocumentWorkflow] invoking send-business-document", {
    supabaseUrl,
    expectedSupabaseUrl: EXPECTED_SUPABASE_URL,
    matchesExpectedProject: supabaseUrl === EXPECTED_SUPABASE_URL,
    documentKind: document.kind,
    documentId: document.id,
    documentNumber: document.number,
    recipient: payload.recipient,
  });
  if (supabaseUrl !== EXPECTED_SUPABASE_URL) {
    console.error("[DocumentWorkflow] VITE_SUPABASE_URL does not target the expected Supabase project", {
      actual: supabaseUrl,
      expected: EXPECTED_SUPABASE_URL,
    });
  }

  const { data, error } = await supabase.functions.invoke("send-business-document", {
    body: {
      sourceKind: sourceKindFromDocument(document),
      sourceId: document.id,
      document,
      ...payload,
      clientLinkBase: typeof window !== "undefined" ? window.location.origin : undefined,
    },
  });

  if (error) {
    console.error("[DocumentWorkflow] send-business-document invoke error", {
      message: error.message,
      name: error.name,
      context: error.context,
      details: error,
    });
    throw new Error(error.message);
  }
  if (!data?.ok) {
    console.error("[DocumentWorkflow] send-business-document returned error", data);
    throw new Error(data?.error ?? "Envoi du document impossible.");
  }
  console.info("[DocumentWorkflow] send-business-document success", data);
  return data as SendBusinessDocumentResult;
}

export async function accessClientDocument(token: string, action: ClientWorkflowAction = "view", input: { comment?: string; signerName?: string } = {}) {
  const { data, error } = await supabase.functions.invoke("document-client-access", {
    body: {
      token,
      action,
      comment: input.comment,
      signerName: input.signerName,
    },
  });

  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "Acces document impossible.");
  return data as { workflow: ClientWorkflowRecord; document: BusinessDocument; events: ClientWorkflowEvent[] };
}

function sourceKindFromDocument(document: BusinessDocument) {
  if (document.kind === "purchase_order") return "purchase_order";
  if (document.kind === "reception_report") return "reception_report";
  if (document.kind === "invoice" || document.kind === "credit_note") return "invoice";
  return "quote";
}
