import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Download, Link2, Send, X } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { getDocumentTemplate } from "../domain/documentTemplates";
import type { BusinessDocument } from "../domain/types";
import { sendBusinessDocument, type SendBusinessDocumentResult } from "../infrastructure/clientWorkflowRepository";

export function DocumentSendDialog({
  document,
  onClose,
  onDownload,
  onSend,
}: {
  document: BusinessDocument;
  onClose: () => void;
  onDownload?: () => void;
  onSend?: (payload: DocumentSendPayload) => void | Promise<void>;
}) {
  const template = getDocumentTemplate(document);
  const clientLink = useMemo(() => buildClientLink(document), [document]);
  const [payload, setPayload] = useState<DocumentSendPayload>({
    recipient: document.recipient.email ?? "",
    cc: "",
    subject: `${template.label} ${document.number}`,
    message: `Bonjour,\n\nVeuillez trouver votre ${template.label.toLowerCase()} ${document.number}.\n\nVous pouvez le consulter via le lien client et nous retourner votre validation.\n\nCordialement.`,
    clientLink,
    attachPdf: true,
    requireSignature: document.kind === "quote" || document.kind === "reception_report",
    requireValidation: document.kind !== "purchase_order",
    allowModificationRequest: true,
    autoReminders: true,
  });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendBusinessDocumentResult | null>(null);

  async function submit() {
    setSending(true);
    setError(null);
    setFeedback(null);
    setResult(null);
    try {
      console.info("[DocumentSendDialog] submit clicked", {
        documentKind: document.kind,
        documentId: document.id,
        documentNumber: document.number,
        recipient: payload.recipient,
      });
      const nextResult = await sendBusinessDocument(document, payload);
      setResult(nextResult);
      setPayload((prev) => ({ ...prev, clientLink: nextResult.clientLink }));
      setFeedback(nextResult.email?.skipped ? "Lien client cree. Resend n'est pas configure, aucun email SMTP n'a ete envoye." : "Document envoye et workflow client active.");
      if (onSend) {
        await onSend({ ...payload, clientLink: nextResult.clientLink });
      }
      setSent(true);
    } catch (err) {
      console.error("[DocumentSendDialog] send-business-document failed", {
        documentKind: document.kind,
        documentId: document.id,
        documentNumber: document.number,
        recipient: payload.recipient,
        error: err,
      });
      setError(err instanceof Error ? err.message : "Envoi du document impossible.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Workflow client</div>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Envoyer {template.label.toLowerCase()} {document.number}</h2>
            <p className="mt-1 text-sm text-slate-500">Email, lien client, consultation, validation, refus et préparation signature.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Fermer"><X className="h-4 w-4" /></button>
        </header>

        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_290px]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Destinataire">
                <input className={inputClass} value={payload.recipient} onChange={(event) => setPayload((prev) => ({ ...prev, recipient: event.target.value }))} placeholder="client@email.fr" />
              </Field>
              <Field label="Copie">
                <input className={inputClass} value={payload.cc} onChange={(event) => setPayload((prev) => ({ ...prev, cc: event.target.value }))} placeholder="optionnel" />
              </Field>
            </div>
            <Field label="Objet">
              <input className={inputClass} value={payload.subject} onChange={(event) => setPayload((prev) => ({ ...prev, subject: event.target.value }))} />
            </Field>
            <Field label="Message">
              <textarea className={`${inputClass} min-h-44 py-3 leading-6`} value={payload.message} onChange={(event) => setPayload((prev) => ({ ...prev, message: event.target.value }))} />
            </Field>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Link2 className="h-4 w-4" /> Lien client sécurisé</div>
              <div className="mt-2 break-all rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">{payload.clientLink}</div>
              <p className="mt-2 text-xs text-slate-500">Le lien final est retourné par la fonction Edge après création du workflow client.</p>
            </div>
            {sent ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{feedback ?? "Workflow client active."}</div> : null}
            {result ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <div className="font-semibold">Lien client cree</div>
                <a className="mt-2 block break-all text-xs font-medium underline" href={result.clientLink} target="_blank" rel="noreferrer">{result.clientLink}</a>
                <div className="mt-2 text-xs">Workflow: {result.workflowId} · Expiration: {new Date(result.expiresAt).toLocaleString("fr-FR")}</div>
                {result.email?.error ? <div className="mt-2 text-xs text-red-700">Erreur email Resend: {result.email.error}</div> : null}
              </div>
            ) : null}
            {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div> : null}
          </div>

          <aside className="space-y-3 rounded-2xl bg-slate-50 p-4">
            <SendOption checked={payload.attachPdf} onChange={(attachPdf) => setPayload((prev) => ({ ...prev, attachPdf }))} label="PDF en pièce jointe" />
            <SendOption checked={payload.requireSignature} onChange={(requireSignature) => setPayload((prev) => ({ ...prev, requireSignature }))} label="Signature électronique" />
            <SendOption checked={payload.requireValidation} onChange={(requireValidation) => setPayload((prev) => ({ ...prev, requireValidation }))} label="Demande de validation" />
            <SendOption checked={payload.allowModificationRequest} onChange={(allowModificationRequest) => setPayload((prev) => ({ ...prev, allowModificationRequest }))} label="Demande de modification" />
            <SendOption checked={payload.autoReminders} onChange={(autoReminders) => setPayload((prev) => ({ ...prev, autoReminders }))} label="Relances automatiques" />
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
              Le client pourra consulter, accepter, refuser ou demander une modification via le portail client prévu.
            </div>
          </aside>
        </div>

        <footer className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <Button type="button" variant="secondary" onClick={onDownload}><Download className="h-4 w-4" /> PDF</Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="button" variant="success" disabled={sending} onClick={() => void submit()}><Send className="h-4 w-4" /> {sending ? "Envoi..." : "Préparer l'envoi"}</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export type DocumentSendPayload = {
  recipient: string;
  cc?: string;
  subject: string;
  message: string;
  clientLink: string;
  attachPdf: boolean;
  requireSignature: boolean;
  requireValidation: boolean;
  allowModificationRequest: boolean;
  autoReminders: boolean;
};

const inputClass = "mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}{children}</label>;
}

function SendOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function buildClientLink(document: BusinessDocument) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const token = btoa(`${document.kind}:${document.id ?? document.number}`).replace(/=+$/g, "");
  return `${base}/documents/client/${encodeURIComponent(token)}`;
}
