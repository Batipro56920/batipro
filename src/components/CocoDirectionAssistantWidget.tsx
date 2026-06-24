import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BarChart3, Bot, Brain, RefreshCw, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import {
  COCO_DIRECTION_QUICK_QUESTIONS,
  askCocoDirectionAssistant,
  isCurrentUserCocoAdmin,
  loadCocoDirectionContext,
  type CocoDirectionChatMessage,
  type CocoDirectionContext,
} from "../services/cocoDirectionAssistant.service";

const WELCOME_MESSAGE: CocoDirectionChatMessage = {
  role: "assistant",
  content: "Bonjour. Je suis Assistant Direction COCO. Je travaille en lecture seule sur les données Batipro disponibles pour anticiper les risques chantier, planning, temps, matériel, commerce et trésorerie quand les données existent.",
};

function formatNumber(value: number, suffix = "") {
  return `${Math.round(value).toLocaleString("fr-FR")}${suffix}`;
}

function summaryCards(context: CocoDirectionContext | null) {
  if (!context) return [];
  return [
    { label: "Chantiers actifs", value: context.summary.activeChantiers, hint: `${context.summary.runningChantiers} en cours` },
    { label: "Retards chantier", value: context.summary.lateChantiers, hint: "Fin prévue dépassée" },
    { label: "Tâches en retard", value: context.summary.lateTasks, hint: `${context.summary.blockedTasks} bloquées / à reprendre` },
    { label: "Temps consommé", value: formatNumber(context.summary.spentHours, " h"), hint: `${formatNumber(context.summary.plannedHours, " h")} prévues` },
    { label: "Devis à relancer", value: context.summary.quotesToFollowUp, hint: `${context.summary.openQuotes} ouverts` },
    { label: "Pipeline estimé", value: formatNumber(context.summary.estimatedPipelineTtc, " €"), hint: "Devis + opportunités" },
  ];
}

function getErrorMessage(error: unknown) {
  const message = String((error as { message?: string } | null)?.message ?? "").trim();
  return message || "Assistant Direction COCO indisponible pour le moment.";
}

export default function CocoDirectionAssistantWidget() {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [context, setContext] = useState<CocoDirectionContext | null>(null);
  const [messages, setMessages] = useState<CocoDirectionChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    isCurrentUserCocoAdmin()
      .then((result) => {
        if (!alive) return;
        setAllowed(result);
        if (result) void refreshContext();
      })
      .catch(() => {
        if (alive) setAllowed(false);
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const cards = useMemo(() => summaryCards(context), [context]);

  async function refreshContext() {
    setLoadingContext(true);
    setError(null);
    try {
      setContext(await loadCocoDirectionContext());
    } catch (err) {
      setError(getErrorMessage(err));
      setContext(null);
    } finally {
      setLoadingContext(false);
    }
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>, forcedPrompt?: string) {
    event?.preventDefault();
    const content = String(forcedPrompt ?? input).trim();
    if (!content || sending) return;

    let activeContext = context;
    if (!activeContext) {
      try {
        activeContext = await loadCocoDirectionContext();
        setContext(activeContext);
      } catch (err) {
        setError(getErrorMessage(err));
        return;
      }
    }

    const nextMessages: CocoDirectionChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const reply = await askCocoDirectionAssistant({ message: content, history: nextMessages, context: activeContext });
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      setMessages((current) => [...current, { role: "assistant", content: message }]);
    } finally {
      setSending(false);
    }
  }

  if (checking || !allowed) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-[calc(100vw-2rem)] sm:bottom-5 sm:left-5">
      {open ? (
        <section className="mb-3 flex h-[min(680px,calc(100dvh-7rem))] w-[min(720px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[#0F2747] px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#0F2747]"><Brain className="h-5 w-5" /></span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">Assistant Direction COCO</div>
                <div className="truncate text-xs text-blue-100">ANTICIPATION · lecture seule · dirigeant/admin</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void refreshContext()} disabled={loadingContext} className="grid h-9 w-9 place-items-center rounded-xl text-blue-100 hover:bg-white/10 disabled:opacity-50" aria-label="Rafraîchir le contexte direction" title="Rafraîchir les données Batipro">
                <RefreshCw className={["h-4 w-4", loadingContext ? "animate-spin" : ""].join(" ")} />
              </button>
              <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl text-blue-100 hover:bg-white/10" aria-label="Fermer Assistant Direction COCO"><X className="h-4 w-4" /></button>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="min-h-0 overflow-y-auto border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r">
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900"><ShieldCheck className="h-4 w-4" /> Recommandations sans modification des données</div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                {cards.map((card) => (
                  <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-[11px] font-medium text-slate-500">{card.label}</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{card.value}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{card.hint}</div>
                  </div>
                ))}
              </div>
              {context?.risks.length ? (
                <div className="mt-3 space-y-2">
                  <div className="text-[11px] font-semibold uppercase text-slate-500">Signaux à surveiller</div>
                  {context.risks.slice(0, 4).map((risk) => (
                    <div key={risk.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                      <div className="font-semibold">{risk.title}</div>
                      <div className="mt-1 leading-5">{risk.detail}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </aside>

            <main className="flex min-h-0 flex-col">
              <div className="border-b border-slate-200 bg-white p-3">
                <div className="flex flex-wrap gap-2">
                  {COCO_DIRECTION_QUICK_QUESTIONS.map((question) => (
                    <button key={question.label} type="button" onClick={() => void sendMessage(undefined, question.prompt)} disabled={sending} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50">{question.label}</button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
                {messages.map((message, index) => {
                  const fromUser = message.role === "user";
                  return (
                    <div key={`${message.role}-${index}`} className={fromUser ? "flex justify-end" : "flex justify-start"}>
                      <div className={["max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6", fromUser ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-800"].join(" ")}>{message.content}</div>
                    </div>
                  );
                })}
                {sending ? <div className="text-xs text-slate-500">Assistant Direction COCO analyse les données...</div> : null}
                {error ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</div> : null}
              </div>

              <form onSubmit={(event) => void sendMessage(event)} className="border-t border-slate-200 bg-white p-3">
                <div className="flex items-end gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Message à Assistant Direction COCO</span>
                    <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={2} className="max-h-28 min-h-12 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Demande une analyse direction, un risque à anticiper, une priorité..." />
                  </label>
                  <button type="submit" disabled={sending || !input.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0F2747] text-white hover:bg-[#173B68] disabled:bg-slate-200 disabled:text-slate-500" aria-label="Envoyer à Assistant Direction COCO"><Send className="h-4 w-4" /></button>
                </div>
              </form>
            </main>
          </div>
        </section>
      ) : null}

      <button type="button" onClick={() => setOpen((value) => !value)} className="ml-auto flex h-12 items-center gap-2 rounded-2xl bg-[#0F2747] px-3 pr-4 text-sm font-semibold text-white shadow-xl shadow-slate-950/20 hover:bg-[#173B68]" aria-label={open ? "Fermer Assistant Direction COCO" : "Ouvrir Assistant Direction COCO"}>
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-[#0F2747]">{open ? <BarChart3 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}</span>
        <span className="hidden sm:inline">Direction COCO</span>
        <Bot className="h-4 w-4 sm:hidden" />
      </button>
    </div>
  );
}
