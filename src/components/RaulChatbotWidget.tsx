import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, FileText, HardHat, Paperclip, Send, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { prepareRaulAttachments, RAUL_FILE_ACCEPT, type RaulAttachment } from "./raulAttachments";
import {
  getCurrentProfileFeaturePermissions,
  hasProfileFeaturePermission,
} from "../services/profileFeaturePermissions.service";

type RaulChatMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: Array<{ name: string; mime_type: string }>;
};

const WELCOME_MESSAGE: RaulChatMessage = {
  role: "assistant",
  content: "Bonjour, je suis Raul. Je peux t'aider sur Batipro, les chantiers, les devis, les tâches ou l'organisation terrain.",
};

function getErrorMessage(error: unknown) {
  const message = String((error as { message?: string } | null)?.message ?? "").trim();
  return message || "Raul n'a pas pu répondre pour le moment.";
}

function RaulAvatar({ compact = false }: { compact?: boolean }) {
  return (
    <span className={["grid shrink-0 place-items-center rounded-xl border border-yellow-300 bg-yellow-400 text-slate-950 shadow-sm shadow-yellow-950/10", compact ? "h-8 w-8" : "h-9 w-9"].join(" ")} aria-hidden="true">
      <HardHat className={compact ? "h-4 w-4" : "h-5 w-5"} />
    </span>
  );
}

export default function RaulChatbotWidget() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<RaulChatMessage[]>([WELCOME_MESSAGE]);
  const [attachments, setAttachments] = useState<RaulAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    async function checkAccess() {
      try {
        const result = await getCurrentProfileFeaturePermissions();
        if (!alive) return;
        setAllowed(hasProfileFeaturePermission(result.permissions, "chatbot_raul", result.role));
      } catch {
        if (alive) setAllowed(false);
      } finally {
        if (alive) setCheckingAccess(false);
      }
    }
    void checkAccess();
    return () => { alive = false; };
  }, []);

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    event.target.value = "";
    if (!files?.length) return;
    const prepared = await prepareRaulAttachments(files, attachments.length);
    if (prepared.attachments.length) setAttachments((prev) => [...prev, ...prepared.attachments]);
    if (prepared.errors.length) setError(prepared.errors.join(" "));
    else setError(null);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if ((!content && attachments.length === 0) || sending) return;
    const displayContent = content || (attachments.some((item) => item.mime_type.startsWith("image/")) ? "Analyse cette photo." : "Analyse ce fichier.");
    const sentAttachments = attachments;
    const nextMessages: RaulChatMessage[] = [...messages, { role: "user", content: displayContent, attachments: sentAttachments.map(({ name, mime_type }) => ({ name, mime_type })) }];
    setMessages(nextMessages);
    setInput("");
    setAttachments([]);
    setSending(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("raul-chatbot", {
        body: { message: displayContent, history: nextMessages.slice(-10), attachments: sentAttachments },
      });
      if (invokeError) throw invokeError;
      const reply = String((data as { reply?: string } | null)?.reply ?? "").trim();
      if (!reply) throw new Error("Réponse vide de Raul.");
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
    } finally {
      setSending(false);
    }
  }

  if (checkingAccess || !allowed) return null;

  return (
    <div className="fixed bottom-24 right-3 z-40 max-w-[calc(100vw-1.5rem)] sm:right-5 lg:bottom-24">
      {open ? (
        <section className="mb-3 flex h-[min(560px,calc(100dvh-9rem))] w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-950 px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-3"><RaulAvatar /><div className="min-w-0"><div className="truncate text-sm font-semibold">Raul</div><div className="truncate text-xs text-slate-300">Assistant chantier Batipro</div></div></div>
            <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl text-slate-200 hover:bg-white/10" aria-label="Fermer Raul"><X className="h-4 w-4" /></button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {messages.map((message, index) => {
              const fromUser = message.role === "user";
              return <div key={`${message.role}-${index}`} className={fromUser ? "flex justify-end" : "flex justify-start"}><div className={["max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6", fromUser ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-800"].join(" ")}>
                {message.attachments?.map((item, attachmentIndex) => <div key={`${item.name}-${attachmentIndex}`} className="mb-1 flex items-center gap-1 text-xs opacity-80">{item.mime_type.startsWith("image/") ? <Camera className="h-3 w-3" /> : <FileText className="h-3 w-3" />}<span className="truncate">{item.name}</span></div>)}
                {message.content}
              </div></div>;
            })}
            {sending ? <div className="text-xs text-slate-500">Raul analyse et rédige une réponse...</div> : null}
            {error ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</div> : null}
          </div>
          <form onSubmit={sendMessage} className="border-t border-slate-200 bg-white p-3">
            {attachments.length ? <div className="mb-2 flex flex-wrap gap-2">{attachments.map((item, index) => <span key={`${item.name}-${index}`} className="flex max-w-full items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">{item.mime_type.startsWith("image/") ? <Camera className="h-3 w-3" /> : <FileText className="h-3 w-3" />}<span className="max-w-48 truncate">{item.name}</span><button type="button" onClick={() => setAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Retirer ${item.name}`}><X className="h-3 w-3" /></button></span>)}</div> : null}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={addFiles} />
            <input ref={fileInputRef} type="file" accept={RAUL_FILE_ACCEPT} multiple className="hidden" onChange={addFiles} />
            <div className="mb-2 flex gap-2">
              <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"><Camera className="h-4 w-4" />Photo</button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"><Paperclip className="h-4 w-4" />Fichier</button>
            </div>
            <div className="flex items-end gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Message à Raul</span><textarea value={input} onChange={(event) => setInput(event.target.value)} rows={2} className="max-h-28 min-h-12 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Écris à Raul..." /></label><button type="submit" disabled={sending || (!input.trim() && attachments.length === 0)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500" aria-label="Envoyer à Raul"><Send className="h-4 w-4" /></button></div>
          </form>
        </section>
      ) : null}
      <button type="button" onClick={() => setOpen((value) => !value)} title="Raul" className="ml-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white shadow-xl shadow-slate-950/20 hover:bg-slate-800" aria-label={open ? "Fermer Raul" : "Ouvrir Raul"}><RaulAvatar compact /></button>
    </div>
  );
}
