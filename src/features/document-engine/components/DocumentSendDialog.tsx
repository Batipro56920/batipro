import { Download, Send, X } from "lucide-react";
import { Button } from "../../../components/ui/button";
import type { BusinessDocument } from "../domain/types";

export function DocumentSendDialog({ document, onClose, onDownload, onSend }: { document: BusinessDocument; onClose: () => void; onDownload?: () => void; onSend?: (payload: DocumentSendPayload) => void }) {
  const defaultPayload: DocumentSendPayload = {
    recipient: document.recipient.email ?? "",
    message: `Bonjour,\n\nVeuillez trouver votre document ${document.number}.\n\nCordialement.`,
    attachPdf: true,
    requireSignature: document.kind === "quote" || document.kind === "reception_report",
    requireValidation: document.kind !== "purchase_order",
    autoReminders: true,
  };

  function submit() {
    onSend?.(defaultPayload);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Workflow envoi</div>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Envoyer {document.title.toLowerCase()} {document.number}</h2>
            <p className="mt-1 text-sm text-slate-500">Email, lien securise, validation, signature et relances.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Fermer"><X className="h-4 w-4" /></button>
        </header>
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_260px]">
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Destinataire
              <input className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300" defaultValue={defaultPayload.recipient} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Message
              <textarea className="mt-2 min-h-44 w-full rounded-xl border border-slate-200 p-3 text-sm leading-6 outline-none focus:border-blue-300" defaultValue={defaultPayload.message} />
            </label>
          </div>
          <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
            <SendOption label="PDF en piece jointe" defaultChecked={defaultPayload.attachPdf} />
            <SendOption label="Signature electronique" defaultChecked={defaultPayload.requireSignature} />
            <SendOption label="Demande de validation" defaultChecked={defaultPayload.requireValidation} />
            <SendOption label="Relances automatiques" defaultChecked={defaultPayload.autoReminders} />
          </div>
        </div>
        <footer className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <Button type="button" variant="secondary" onClick={onDownload}><Download className="h-4 w-4" /> PDF</Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="button" variant="success" onClick={submit}><Send className="h-4 w-4" /> Envoyer</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export type DocumentSendPayload = {
  recipient: string;
  message: string;
  attachPdf: boolean;
  requireSignature: boolean;
  requireValidation: boolean;
  autoReminders: boolean;
};

function SendOption({ label, defaultChecked }: { label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">
      <input type="checkbox" defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}
