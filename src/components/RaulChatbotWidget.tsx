import { useEffect, useState, type FormEvent } from "react";
import { Bot, MessageCircle, Send, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  getCurrentProfileFeaturePermissions,
  hasProfileFeaturePermission,
} from "../services/profileFeaturePermissions.service";

type RaulChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const WELCOME_MESSAGE: RaulChatMessage = {
  role: "assistant",
  content: "Bonjour, je suis Raul. Je peux t'aider sur Batipro, les chantiers, les devis, les tâches ou l'organisation terrain.",
};

function getErrorMessage(error: unknown) {
  const message = String((error as { message?: string } | null)?.message ?? "").trim();
  return message || "Raul n'a pas pu répondre pour le moment.";
}

export default function RaulChatbotWidget() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<RaulChatMessage[]>([WELCOME_MESSAGE]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function checkAccess() {
      try {
        const result = await getCurrentProfileFeaturePermissions();
        if (!alive) return;
        setAllowed(hasProfileFeaturePermission(result.permissions, "chatbot_raul", result.role));
      } catch {
        if (!alive) return;
        setAllowed(false);
      } finally {
        if (alive) setCheckingAccess(false);
      }
    }

    void checkAccess();

    return () => {
      alive = false;
    };
  }, []);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

    const nextMessages: RaulChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("raul-chatbot", {
        body: {
          message: content,
          history: nextMessages.slice(-10),
        },
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
    <div className="fixed bottom-4 right-4 z-50 max-w-[calc(100vw-2rem)] sm:bottom-5 sm:right-5">
      {open ? (
        <section className="mb-3 flex h-[min(560px,calc(100dvh-7rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-950 px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500 text-white">
                <Bot className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">Raul</div>
                <div className="truncate text-xs text-slate-300">Assistant Batipro</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-200 hover:bg-white/10"
              aria-label="Fermer Raul"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {messages.map((message, index) => {
              const fromUser = message.role === "user";
              return (
                <div key={`${message.role}-${index}`} className={fromUser ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={[
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6",
                      fromUser ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-800",
                    ].join(" ")}
                  >
                    {message.content}
                  </div>
                </div>
              );
            })}
            {sending ? <div className="text-xs text-slate-500">Raul rédige une réponse...</div> : null}
            {error ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</div> : null}
          </div>

          <form onSubmit={sendMessage} className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Message à Raul</span>
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={2}
                  className="max-h-28 min-h-12 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Écris à Raul..."
                />
              </label>
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500"
                aria-label="Envoyer à Raul"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="ml-auto flex h-12 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-xl shadow-slate-950/20 hover:bg-slate-800"
        aria-label={open ? "Fermer Raul" : "Ouvrir Raul"}
      >
        <MessageCircle className="h-5 w-5" />
        Raul
      </button>
    </div>
  );
}
