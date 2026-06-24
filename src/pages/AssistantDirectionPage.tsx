import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, BrainCircuit, ClipboardCheck, Loader2, Lock, RefreshCw, Send, ShieldCheck, Sparkles } from "lucide-react";
import { getCurrentUserProfile, type CurrentUserProfile } from "../services/currentUserProfile.service";
import {
  COCO_ASSISTANT_ARCHITECTURE,
  COCO_DIRECTION_QUICK_QUESTIONS,
  askCocoDirectionAssistant,
  isCocoAdminProfile,
  loadCocoDirectionContext,
  type CocoDirectionChatMessage,
  type CocoDirectionContext,
} from "../services/cocoDirectionAssistant.service";

type AccessState = "checking" | "allowed" | "denied";

const WELCOME_MESSAGE: CocoDirectionChatMessage = {
  role: "assistant",
  content:
    "Bonjour. Je suis Assistant Direction COCO. Mon role : anticiper les risques entreprise a partir des donnees Batipro disponibles, puis te proposer des priorites claires sans modifier les donnees.",
};

const CONTROLLED_DRAFT_CATEGORIES = [
  { label: "Analyse apres visite", module: "Chiffrage", status: "Pilote actif", detail: "Pré-devis, temps, matériaux, fournisseurs, risques et points à vérifier." },
  { label: "Taches chantier", module: "Preparation", status: "A cadrer", detail: "Taches et zones proposées depuis le devis ou la visite, sans creation automatique." },
  { label: "Planning previsionnel", module: "Preparation", status: "A cadrer", detail: "Projection de charge et jalons, distincte du planning officiel." },
  { label: "Besoins materiaux", module: "Achats", status: "Pilote actif", detail: "Besoins issus du chiffrage, fournisseurs suggérés, commande toujours manuelle." },
  { label: "Actions commerciales", module: "Commercial", status: "A cadrer", detail: "Relances, devis à suivre et périodes creuses en brouillon validable." },
  { label: "Checklist / compte rendu", module: "Suivi", status: "A cadrer", detail: "Synthèses et actions correctives à revoir avant intégration métier." },
] as const;

function formatNumber(value: number, suffix = "") {
  return `${Math.round(value).toLocaleString("fr-FR")}${suffix}`;
}

function getErrorMessage(error: unknown) {
  const message = String((error as { message?: string } | null)?.message ?? "").trim();
  return message || "L'assistant direction n'a pas pu repondre pour le moment.";
}

function buildSummaryCards(context: CocoDirectionContext | null) {
  if (!context) return [];
  return [
    { label: "Chantiers actifs", value: context.summary.activeChantiers, hint: `${context.summary.runningChantiers} en cours` },
    { label: "Retards chantier", value: context.summary.lateChantiers, hint: "Fin prevue depassee" },
    { label: "Taches en retard", value: context.summary.lateTasks, hint: `${context.summary.blockedTasks} bloquees / a reprendre` },
    { label: "Temps consomme", value: formatNumber(context.summary.spentHours, " h"), hint: `${formatNumber(context.summary.plannedHours, " h")} prevues` },
    { label: "Devis a relancer", value: context.summary.quotesToFollowUp, hint: `${context.summary.openQuotes} ouverts` },
    { label: "Pipeline estime", value: formatNumber(context.summary.estimatedPipelineTtc, " EUR"), hint: "Devis + opportunites" },
  ];
}

export default function AssistantDirectionPage() {
  const [access, setAccess] = useState<AccessState>("checking");
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null);
  const [context, setContext] = useState<CocoDirectionContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<CocoDirectionChatMessage[]>([WELCOME_MESSAGE]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function checkAccess() {
      try {
        const currentProfile = await getCurrentUserProfile();
        if (!alive) return;
        setProfile(currentProfile);
        const isAllowed = isCocoAdminProfile(currentProfile);
        setAccess(isAllowed ? "allowed" : "denied");
        if (isAllowed) void refreshContext();
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

  const suggestedPrompt = useMemo(() => COCO_DIRECTION_QUICK_QUESTIONS[0]?.label ?? "Point hebdomadaire entreprise", []);
  const summaryCards = useMemo(() => buildSummaryCards(context), [context]);

  async function refreshContext() {
    setLoadingContext(true);
    setError(null);
    try {
      setContext(await loadCocoDirectionContext());
    } catch (err) {
      setContext(null);
      setError(getErrorMessage(err));
    } finally {
      setLoadingContext(false);
    }
  }

  async function askAssistant(content: string) {
    const cleanContent = content.trim();
    if (!cleanContent || sending || access !== "allowed") return;

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

    const nextMessages: CocoDirectionChatMessage[] = [...messages, { role: "user", content: cleanContent }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const reply = await askCocoDirectionAssistant({
        message: cleanContent,
        history: nextMessages,
        context: activeContext,
      });
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
        Verification de l'acces a l'Assistant Direction COCO...
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
            <h1 className="text-lg font-semibold">Acces reserve aux administrateurs</h1>
            <p className="mt-2 text-sm leading-6">
              Assistant Direction COCO est reserve au role admin/dirigeant Batipro. Le profil actuel
              {profile?.email ? ` (${profile.email})` : ""} n'a pas l'autorisation necessaire.
            </p>
            <p className="mt-2 text-sm leading-6">
              Verifier que la ligne du compte dans <code>profiles</code> possede bien <code>role = ADMIN</code> et que la permission <code>assistant_coco_direction</code> n'est pas desactivee.
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
                Bras droit IA du dirigeant : chantiers, planning, temps, materiel, devis, charge, marge et tresorerie quand les donnees existent.
              </p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <div className="font-semibold">Garde-fou</div>
              <div className="mt-1 text-xs leading-5">Analyse, prepare et propose uniquement. Aucune donnee Batipro n'est modifiee sans validation humaine.</div>
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Productivite controlee
            </div>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
              COCO peut analyser les donnees reelles, preparer des brouillons et pre-remplir la reflexion metier. Validation, envoi, creation definitive, suppression, planning officiel et commandes restent reserves a l'admin.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Validation admin obligatoire</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {COCO_ASSISTANT_ARCHITECTURE.map((assistant) => (
            <div key={assistant.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-950">{assistant.label}</div>
              <p className="mt-1 text-xs leading-5 text-slate-600">{assistant.scope}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-h-[620px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">Conversation direction</div>
              <div className="text-xs text-slate-500">Contexte Batipro reel charge en lecture seule a chaque question.</div>
            </div>
            <button
              type="button"
              onClick={() => void refreshContext()}
              disabled={loadingContext || sending}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={["h-3.5 w-3.5", loadingContext ? "animate-spin" : ""].join(" ")} /> Rafraichir
            </button>
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
            {sending || loadingContext ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> {sending ? "L'assistant direction analyse les donnees Batipro..." : "Chargement du contexte Batipro..."}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Question a l'Assistant Direction COCO</span>
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
                disabled={sending || loadingContext || !input.trim()}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-950 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500"
                aria-label="Envoyer a l'assistant direction"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>

        <aside className="space-y-4">
          {summaryCards.length ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
              <div className="text-sm font-semibold text-slate-950">Lecture rapide</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {summaryCards.map((card) => (
                  <div key={card.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-medium text-slate-500">{card.label}</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{card.value}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{card.hint}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <ClipboardCheck className="h-4 w-4 text-blue-600" /> Brouillons controles
            </div>
            <div className="mt-3 space-y-2">
              {CONTROLLED_DRAFT_CATEGORIES.map((draft) => (
                <div key={`${draft.module}-${draft.label}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 text-xs font-semibold text-slate-950">{draft.label}</div>
                    <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">{draft.status}</span>
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-blue-700">{draft.module}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{draft.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Sparkles className="h-4 w-4 text-blue-600" /> Questions rapides
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {COCO_DIRECTION_QUICK_QUESTIONS.map((question) => (
                <button
                  key={question.label}
                  type="button"
                  onClick={() => void askAssistant(question.prompt)}
                  disabled={sending || loadingContext}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {question.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm shadow-slate-950/[0.03]">
            <div className="flex items-center gap-2 font-semibold text-slate-950">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Points analyses
            </div>
            <ul className="mt-3 space-y-2 text-slate-600">
              <li>Avancement prevu vs reel des chantiers</li>
              <li>Temps prevu, temps passe et derives</li>
              <li>Planning, retards et impact sur les prochains chantiers</li>
              <li>Materiel, achats, fournisseurs et relances</li>
              <li>Devis, prospection, carnet de commandes et CA previsionnel</li>
              <li>Charge equipe, besoin de sous-traitance ou d'embauche</li>
              <li>Marge et tresorerie quand les donnees existent</li>
            </ul>
          </div>

          {context?.risks.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm shadow-slate-950/[0.03]">
              <div className="font-semibold">Signaux detectes</div>
              <div className="mt-3 space-y-2">
                {context.risks.slice(0, 5).map((risk) => (
                  <div key={risk.id} className="rounded-lg bg-white/70 p-3">
                    <div className="font-semibold">{risk.title}</div>
                    <div className="mt-1 text-xs leading-5">{risk.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
