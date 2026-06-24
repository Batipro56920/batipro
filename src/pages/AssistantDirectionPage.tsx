import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, BrainCircuit, Loader2, Lock, Send, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUserProfile, isAdminProfile, type CurrentUserProfile } from "../services/currentUserProfile.service";

type DirectionMessage = {
  role: "user" | "assistant";
  content: string;
};

type AccessState = "checking" | "allowed" | "denied";

const QUICK_QUESTIONS = [
  "Point hebdomadaire entreprise",
  "Carnet de commandes suffisant ?",
  "Devis à relancer",
  "Chantiers à risque",
  "Chantiers en retard ou susceptibles de l’être",
  "Tâches bloquées ou en dérive",
  "Avancement réel vs prévu",
  "Charge planning à venir",
  "Besoins humains",
  "Besoins matériel",
  "Impact des retards sur les prochains chantiers",
  "Prévision CA",
  "Priorités de la semaine",
];

const WELCOME_MESSAGE: DirectionMessage = {
  role: "assistant",
  content:
    "Bonjour COCO. Je suis l’Assistant Direction COCO. Mon rôle : anticiper les risques entreprise à partir des données Batipro disponibles, puis te proposer des priorités claires sans modifier les données.",
};

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function envCocoEmails(): Set<string> {
  return new Set(
    String(import.meta.env.VITE_COCO_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => normalize(value))
      .filter(Boolean),
  );
}

function isCocoAdminProfile(profile: CurrentUserProfile | null): boolean {
  if (!isAdminProfile(profile)) return false;
  const email = normalize(profile?.email);
  const displayName = normalize(profile?.display_name);
  const allowedEmails = envCocoEmails();
  if (email && allowedEmails.has(email)) return true;
  return displayName.includes("coco") || email.includes("coco") || displayName.includes("corentin") || email.includes("corentin");
}

function getErrorMessage(error: unknown) {
  const message = String((error as { message?: string } | null)?.message ?? "").trim();
  return message || "L’assistant direction n’a pas pu répondre pour le moment.";
}

export default function AssistantDirectionPage() {
  const [access, setAccess] = useState<AccessState>("checking");
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<DirectionMessage[]>([WELCOME_MESSAGE]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function checkAccess() {
      try {
        const currentProfile = await getCurrentUserProfile();
        if (!alive) return;
        setProfile(currentProfile);
        setAccess(isCocoAdminProfile(currentProfile) ? "allowed" : "denied");
      } catch {
        if (!alive) return;
        setAccess("denied");
      }
    }

    void checkAccess();
    return () => {
      alive = false;
    };
  }, []);

  const suggestedPrompt = useMemo(() => QUICK_QUESTIONS[0], []);

  async function askAssistant(content: string) {
    const cleanContent = content.trim();
    if (!cleanContent || sending || access !== "allowed") return;

    const nextMessages: DirectionMessage[] = [...messages, { role: "user", content: cleanContent }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("assistant-direction-coco", {
        body: {
          message: cleanContent,
          history: nextMessages.slice(-10),
        },
      });

      if (invokeError) throw invokeError;
      const reply = String((data as { reply?: string } | null)?.reply ?? "").trim();
      if (!reply) throw new Error("Réponse vide de l’assistant direction.");
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askAssistant(input);
  }

  if (access === "checking") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Vérification de l’accès à l’Assistant Direction COCO...
      </div>
    );
  }

  if (access === "denied") {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-amber-700">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Accès réservé au compte admin COCO</h1>
            <p className="mt-2 text-sm leading-6">
              Cette page est limitée au dirigeant/admin COCO. Le profil actuel
              {profile?.email ? ` (${profile.email})` : ""} n’est pas reconnu comme compte COCO.
            </p>
            <p className="mt-2 text-sm leading-6">
              Pour autoriser explicitement le compte COCO, renseigner `VITE_COCO_ADMIN_EMAILS` côté front et `COCO_ADMIN_EMAILS` côté Supabase Function avec l’email admin concerné.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                <BrainCircuit className="h-4 w-4" /> Assistant Direction COCO
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Anticipation entreprise</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Bras droit IA du dirigeant : chantiers, planning, temps, matériel, devis, charge, marge et trésorerie quand les données existent.
              </p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <div className="font-semibold">Garde-fou</div>
              <div className="mt-1 text-xs leading-5">Analyse et recommande uniquement. Aucune donnée Batipro n’est modifiée sans validation humaine.</div>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-h-[620px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03]">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-950">Conversation direction</div>
            <div className="text-xs text-slate-500">Contexte Batipro réel chargé à chaque question.</div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
            {messages.map((message, index) => {
              const fromUser = message.role === "user";
              return (
                <div key={`${message.role}-${index}`} className={fromUser ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={[
                      "max-w-[88%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-6",
                      fromUser ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-800",
                    ].join(" ")}
                  >
                    {message.content}
                  </div>
                </div>
              );
            })}
            {sending ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> L’assistant direction analyse les données Batipro...
              </div>
            ) : null}
            {error ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Question à l’Assistant Direction COCO</span>
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={3}
                  className="max-h-40 min-h-16 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder={suggestedPrompt}
                />
              </label>
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-950 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500"
                aria-label="Envoyer à l’assistant direction"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Sparkles className="h-4 w-4 text-blue-600" /> Questions rapides
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void askAssistant(question)}
                  disabled={sending}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm shadow-slate-950/[0.03]">
            <div className="flex items-center gap-2 font-semibold text-slate-950">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Points analysés
            </div>
            <ul className="mt-3 space-y-2 text-slate-600">
              <li>Avancement prévu vs réel des chantiers</li>
              <li>Temps prévu, temps passé et dérives</li>
              <li>Planning, retards et impact sur les prochains chantiers</li>
              <li>Matériel, achats, fournisseurs et relances</li>
              <li>Devis, prospection, carnet de commandes et CA prévisionnel</li>
              <li>Charge équipe, besoin de sous-traitance ou d’embauche</li>
              <li>Marge et trésorerie quand les données existent</li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}
