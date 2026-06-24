import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertTriangle, BrainCircuit, ClipboardCheck, Loader2, Lock, Paperclip, RefreshCw, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { getCurrentUserProfile, type CurrentUserProfile } from "../services/currentUserProfile.service";
import {
  COCO_ASSISTANT_ARCHITECTURE,
  COCO_DIRECTION_QUICK_QUESTIONS,
  askCocoDirectionAssistant,
  isCocoAdminProfile,
  listCocoControlledDrafts,
  loadCocoDirectionContext,
  updateCocoControlledDraftStatus,
  type CocoControlledDraftRecord,
  type CocoControlledDraftStatus,
  type CocoDirectionChatMessage,
  type CocoDirectionContext,
} from "../services/cocoDirectionAssistant.service";

type AccessState = "checking" | "allowed" | "denied";
type CocoConversationAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  truncated: boolean;
};

const WELCOME_MESSAGE: CocoDirectionChatMessage = {
  role: "assistant",
  content:
    "Bonjour. Je suis Assistant Direction COCO. Mon role : anticiper les risques entreprise a partir des donnees Batipro disponibles, puis te proposer des priorites claires sans modifier les donnees.",
};

const CONTROLLED_DRAFT_CATEGORIES = [
  { label: "Analyse apres visite", module: "Chiffrage", status: "Pilote actif", detail: "Pre-devis, temps, materiaux, fournisseurs, risques et points a verifier." },
  { label: "Taches chantier", module: "Preparation", status: "Pilote actif", detail: "Taches et zones proposees depuis le devis ou la visite, sans creation automatique." },
  { label: "Planning previsionnel", module: "Preparation", status: "A cadrer", detail: "Projection de charge et jalons, distincte du planning officiel." },
  { label: "Besoins materiaux", module: "Achats", status: "Pilote actif", detail: "Besoins issus du chiffrage, fournisseurs suggeres, commande toujours manuelle." },
  { label: "Actions commerciales", module: "Commercial", status: "A cadrer", detail: "Relances, devis a suivre et periodes creuses en brouillon validable." },
  { label: "Checklist / compte rendu", module: "Suivi", status: "A cadrer", detail: "Syntheses et actions correctives a revoir avant integration metier." },
] as const;

const CONTROLLED_DRAFT_SOURCE_KINDS = [
  "crm_visit_quote_analysis",
  "crm_visit_chantier_tasks_preparation",
  "crm_visit_purchase_order_preparation",
] as const;

const CONTROLLED_DRAFT_NEXT_STATUSES = ["reviewed", "validated", "ignored"] as const;
const ATTACHMENT_MAX_BYTES = 120_000;
const ATTACHMENT_TOTAL_MAX_CHARS = 18_000;
const TEXT_ATTACHMENT_EXTENSIONS = /\.(txt|md|csv|json|log|xml|html|htm|yaml|yml)$/i;

function formatNumber(value: number, suffix = "") {
  return `${Math.round(value).toLocaleString("fr-FR")}${suffix}`;
}

function formatMaybeNumber(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "A verifier";
  return `${Number(value).toLocaleString("fr-FR")}${suffix}`;
}

function formatBytes(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
  if (value >= 1_000) return `${Math.round(value / 1_000).toLocaleString("fr-FR")} Ko`;
  return `${value.toLocaleString("fr-FR")} o`;
}

function getErrorMessage(error: unknown) {
  const message = String((error as { message?: string } | null)?.message ?? "").trim();
  return message || "L'assistant direction n'a pas pu repondre pour le moment.";
}

function canReadAsText(file: File) {
  return file.type.startsWith("text/") || file.type === "application/json" || TEXT_ATTACHMENT_EXTENSIONS.test(file.name);
}

function readFileText(file: File): Promise<CocoConversationAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const truncated = file.size > ATTACHMENT_MAX_BYTES;
    reader.onload = () => {
      resolve({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || "texte",
        size: file.size,
        content: String(reader.result ?? ""),
        truncated,
      });
    };
    reader.onerror = () => reject(new Error(`Lecture impossible : ${file.name}`));
    reader.readAsText(file.slice(0, ATTACHMENT_MAX_BYTES));
  });
}

function buildAttachmentContext(attachments: CocoConversationAttachment[]) {
  let remaining = ATTACHMENT_TOTAL_MAX_CHARS;
  const blocks: string[] = [];
  for (const attachment of attachments) {
    if (remaining <= 0) break;
    const header = `--- Fichier: ${attachment.name} (${attachment.type}, ${formatBytes(attachment.size)}${attachment.truncated ? ", tronque" : ""}) ---`;
    const available = Math.max(0, remaining - header.length - 32);
    const content = attachment.content.slice(0, available);
    blocks.push(`${header}\n${content}${content.length < attachment.content.length ? "\n[Contenu tronque]" : ""}`);
    remaining -= header.length + content.length + 32;
  }
  return blocks.join("\n\n");
}

function buildMessageWithAttachments(message: string, attachments: CocoConversationAttachment[]) {
  const cleanMessage = message.trim() || "Analyse les fichiers transmis et indique les implications utiles pour Batipro.";
  if (!attachments.length) return cleanMessage;
  return `${cleanMessage}\n\n[Fichiers transmis par l'utilisateur a COCO - lecture locale depuis le navigateur, non stockes dans Batipro]\n${buildAttachmentContext(attachments)}`;
}

function displayMessageWithAttachments(message: string, attachments: CocoConversationAttachment[]) {
  const cleanMessage = message.trim() || "Analyse les fichiers transmis.";
  if (!attachments.length) return cleanMessage;
  return `${cleanMessage}\n\nFichiers transmis : ${attachments.map((attachment) => attachment.name).join(", ")}`;
}

function draftStatusLabel(status: CocoControlledDraftStatus) {
  if (status === "reviewed") return "Revu";
  if (status === "validated") return "Pret pour revue metier";
  if (status === "ignored") return "Ignore";
  return "Prepare";
}

function draftStatusActionLabel(status: CocoControlledDraftStatus) {
  if (status === "reviewed") return "Marquer revu";
  if (status === "validated") return "Pret metier";
  if (status === "ignored") return "Ignorer";
  return draftStatusLabel(status);
}

function draftStatusClass(status: CocoControlledDraftStatus) {
  if (status === "validated") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "ignored") return "border-slate-200 bg-slate-100 text-slate-600";
  if (status === "reviewed") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function draftKindLabel(kind: string) {
  if (kind === "tasks") return "Preparation";
  if (kind === "purchase_order") return "Achats";
  if (kind === "visit_quote_analysis") return "Chiffrage";
  if (kind === "planning") return "Planning previsionnel";
  if (kind === "commercial_action") return "Commercial";
  if (kind === "checklist") return "Suivi";
  return "Brouillon";
}

function draftSourceLabel(sourceKind: string) {
  if (sourceKind === "crm_visit_quote_analysis") return "Visite chiffrage";
  if (sourceKind === "crm_visit_chantier_tasks_preparation") return "Preparation chantier";
  if (sourceKind === "crm_visit_purchase_order_preparation") return "Achats fournisseurs";
  return sourceKind;
}

function draftMetrics(record: CocoControlledDraftRecord) {
  const metrics: string[] = [];
  if (record.draft.quoteLines.length) metrics.push(`${record.draft.quoteLines.length} ligne(s) devis`);
  if (record.draft.materialNeeds.length) metrics.push(`${record.draft.materialNeeds.length} besoin(s) materiaux`);
  if (record.draft.chantierTasks.length) metrics.push(`${record.draft.chantierTasks.length} tache(s)`);
  if (record.draft.purchaseOrders.length) metrics.push(`${record.draft.purchaseOrders.length} commande(s)`);
  return metrics.length ? metrics.join(" - ") : "Synthese brouillon";
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

function TextListCard({ title, items, fallback }: { title: string; items: string[]; fallback: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-950">{title}</div>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
          {items.map((item, index) => <li key={`${title}-${index}`}>- {item}</li>)}
        </ul>
      ) : <p className="mt-2 text-xs leading-5 text-slate-500">{fallback}</p>}
    </div>
  );
}

export default function AssistantDirectionPage() {
  const [access, setAccess] = useState<AccessState>("checking");
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null);
  const [context, setContext] = useState<CocoDirectionContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [controlledDrafts, setControlledDrafts] = useState<CocoControlledDraftRecord[]>([]);
  const [controlledDraftsLoading, setControlledDraftsLoading] = useState(false);
  const [controlledDraftsError, setControlledDraftsError] = useState<string | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [updatingDraftId, setUpdatingDraftId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<CocoConversationAttachment[]>([]);
  const [readingAttachments, setReadingAttachments] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
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
        if (isAllowed) {
          void refreshContext();
          void refreshControlledDrafts();
        }
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
  const selectedDraft = useMemo(
    () => controlledDrafts.find((record) => record.id === selectedDraftId) ?? null,
    [controlledDrafts, selectedDraftId],
  );

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

  async function refreshControlledDrafts() {
    setControlledDraftsLoading(true);
    setControlledDraftsError(null);
    try {
      const groups = await Promise.all(
        CONTROLLED_DRAFT_SOURCE_KINDS.map((sourceKind) => listCocoControlledDrafts({ sourceKind, limit: 6 })),
      );
      setControlledDrafts(groups.flat().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 8));
    } catch (err) {
      setControlledDrafts([]);
      setControlledDraftsError(getErrorMessage(err));
    } finally {
      setControlledDraftsLoading(false);
    }
  }

  async function updateControlledDraftStatus(record: CocoControlledDraftRecord, status: CocoControlledDraftStatus) {
    setUpdatingDraftId(record.id);
    setControlledDraftsError(null);
    setControlledDrafts((current) => current.map((entry) => (entry.id === record.id ? { ...entry, status } : entry)));
    try {
      const updated = await updateCocoControlledDraftStatus({ id: record.id, status });
      if (updated) setControlledDrafts((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (err) {
      setControlledDraftsError(getErrorMessage(err));
      void refreshControlledDrafts();
    } finally {
      setUpdatingDraftId(null);
    }
  }

  async function handleAttachmentSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setReadingAttachments(true);
    setAttachmentError(null);
    try {
      const readable = files.filter(canReadAsText);
      const ignored = files.length - readable.length;
      const nextAttachments = await Promise.all(readable.map(readFileText));
      setAttachments((previous) => [...previous, ...nextAttachments].slice(0, 6));
      if (ignored) setAttachmentError(`${ignored} fichier(s) ignores : seuls les fichiers texte, CSV, JSON, Markdown ou logs sont lus directement par COCO.`);
    } catch (err) {
      setAttachmentError(getErrorMessage(err));
    } finally {
      setReadingAttachments(false);
    }
  }

  async function askAssistant(content: string, currentAttachments = attachments) {
    const cleanContent = content.trim();
    if ((!cleanContent && !currentAttachments.length) || sending || access !== "allowed") return;

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

    const apiContent = buildMessageWithAttachments(cleanContent, currentAttachments);
    const displayContent = displayMessageWithAttachments(cleanContent, currentAttachments);
    const nextMessages: CocoDirectionChatMessage[] = [...messages, { role: "user", content: displayContent }];
    setMessages(nextMessages);
    setInput("");
    setAttachments([]);
    setSending(true);
    setError(null);
    setAttachmentError(null);

    try {
      const reply = await askCocoDirectionAssistant({
        message: apiContent,
        history: nextMessages,
        context: activeContext,
      });
      setMessages((previous) => [...previous, { role: "assistant", content: reply }]);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      setMessages((previous) => [...previous, { role: "assistant", content: message }]);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askAssistant(input);
  }

  if (access === "checking") {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Verification de l'acces a l'Assistant Direction COCO...</div>;
  }

  if (access === "denied") {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-amber-700"><Lock className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-semibold">Acces reserve aux administrateurs</h1>
            <p className="mt-2 text-sm leading-6">Assistant Direction COCO est reserve au role admin/dirigeant Batipro. Le profil actuel{profile?.email ? ` (${profile.email})` : ""} n'a pas l'autorisation necessaire.</p>
            <p className="mt-2 text-sm leading-6">Verifier que la ligne du compte dans <code>profiles</code> possede bien <code>role = ADMIN</code> et que la permission <code>assistant_coco_direction</code> n'est pas desactivee.</p>
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
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700"><BrainCircuit className="h-4 w-4" /> Assistant Direction COCO</div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Anticipation entreprise</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Bras droit IA du dirigeant : chantiers, planning, temps, materiel, devis, charge, marge et tresorerie quand les donnees existent.</p>
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
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Productivite controlee</div>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">COCO peut analyser les donnees reelles, preparer des brouillons et pre-remplir la reflexion metier. Validation, envoi, creation definitive, suppression, planning officiel et commandes restent reserves a l'admin.</p>
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

      {selectedDraft ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Revue de brouillon COCO</div>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">{selectedDraft.draft.title}</h2>
              <p className="mt-1 text-xs text-slate-500">{draftKindLabel(selectedDraft.kind)} - {draftSourceLabel(selectedDraft.sourceKind)} - {new Date(selectedDraft.createdAt).toLocaleString("fr-FR")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={["inline-flex h-9 items-center rounded-lg border px-3 text-xs font-semibold", draftStatusClass(selectedDraft.status)].join(" ")}>{draftStatusLabel(selectedDraft.status)}</span>
              {CONTROLLED_DRAFT_NEXT_STATUSES.map((status) => (
                <button key={status} type="button" onClick={() => void updateControlledDraftStatus(selectedDraft, status)} disabled={updatingDraftId === selectedDraft.id || selectedDraft.status === status} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                  {updatingDraftId === selectedDraft.id ? "..." : draftStatusActionLabel(status)}
                </button>
              ))}
              <button type="button" onClick={() => setSelectedDraftId(null)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Fermer</button>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
            Cette revue reste un espace de controle. Changer le statut ne cree aucun devis final, aucune tache chantier, aucun planning officiel et aucune commande fournisseur.
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            <TextListCard title="Sources" items={selectedDraft.draft.sourceSummary} fallback="Aucune source detaillee." />
            <TextListCard title="Hypotheses" items={selectedDraft.draft.hypotheses} fallback="Aucune hypothese detaillee." />
            <TextListCard title="Points a verifier" items={selectedDraft.draft.pointsToVerify} fallback="Aucun point specifique." />
            <TextListCard title="Risques" items={selectedDraft.draft.risks} fallback="Aucun risque specifique." />
          </div>

          {selectedDraft.draft.quoteLines.length ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950">Lignes de pre-devis proposees</div>
              <div className="divide-y divide-slate-100">
                {selectedDraft.draft.quoteLines.map((line, index) => (
                  <div key={`${line.title}-${index}`} className="grid gap-2 p-4 text-sm lg:grid-cols-[minmax(0,1fr)_110px_110px_130px]">
                    <div>
                      <div className="font-semibold text-slate-950">{line.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{line.lot ?? "Lot a confirmer"} - Source: {line.source}</div>
                    </div>
                    <div className="text-slate-600">{formatMaybeNumber(line.quantity)} {line.unit ?? "u"}</div>
                    <div className="text-slate-600">{formatMaybeNumber(line.estimatedHours, " h")}</div>
                    <div className="font-semibold text-slate-950">{formatMaybeNumber(line.totalHt, " EUR HT")}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {selectedDraft.draft.chantierTasks.length ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950">Taches chantier proposees</div>
              <div className="divide-y divide-slate-100">
                {selectedDraft.draft.chantierTasks.map((task) => (
                  <div key={`${task.suggestedOrder}-${task.title}`} className="grid gap-2 p-4 text-sm lg:grid-cols-[52px_minmax(0,1fr)_110px_110px]">
                    <div className="text-xs font-semibold text-slate-400">#{task.suggestedOrder}</div>
                    <div>
                      <div className="font-semibold text-slate-950">{task.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{task.lot ?? "Lot a confirmer"}{task.templateTitle ? ` - ${task.templateTitle}` : ""}</div>
                    </div>
                    <div className="text-slate-600">{formatMaybeNumber(task.quantity)} {task.unit ?? ""}</div>
                    <div className="text-slate-600">{formatMaybeNumber(task.estimatedHours, " h")}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {selectedDraft.draft.materialNeeds.length ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {selectedDraft.draft.materialNeeds.map((need, index) => (
                <div key={`${need.designation}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="font-semibold text-slate-950">{need.designation}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatMaybeNumber(need.quantity)} {need.unit ?? ""} - {need.supplierName ?? "Fournisseur a choisir"}</div>
                </div>
              ))}
            </div>
          ) : null}

          {selectedDraft.draft.purchaseOrders.length ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950">Bons de commande fournisseurs brouillons</div>
              <div className="divide-y divide-slate-100">
                {selectedDraft.draft.purchaseOrders.map((order, index) => (
                  <div key={`${order.title}-${index}`} className="p-4 text-sm">
                    <div className="font-semibold text-slate-950">{order.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{order.supplierName ?? "Fournisseur a choisir"}{order.supplierCity ? ` - ${order.supplierCity}` : ""}</div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {order.lines.map((line, lineIndex) => (
                        <div key={`${line.designation}-${lineIndex}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="font-semibold text-slate-950">{line.designation}</div>
                          <div className="mt-1 text-xs text-slate-500">{formatMaybeNumber(line.quantity)} {line.unit ?? ""} - Source: {line.sourceMaterialNeed}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {selectedDraft.draft.proposedActions.length ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {selectedDraft.draft.proposedActions.map((action, index) => (
                <div key={`${action.label}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <div className="font-semibold text-slate-950">{action.label}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{action.module} - {action.detail}</div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-h-[620px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">Conversation direction</div>
              <div className="text-xs text-slate-500">Contexte Batipro reel charge en lecture seule a chaque question.</div>
            </div>
            <button type="button" onClick={() => void refreshContext()} disabled={loadingContext || sending} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
              <RefreshCw className={["h-3.5 w-3.5", loadingContext ? "animate-spin" : ""].join(" ")} /> Rafraichir
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
            {messages.map((message, index) => {
              const fromUser = message.role === "user";
              return (
                <div key={`${message.role}-${index}`} className={fromUser ? "flex justify-end" : "flex justify-start"}>
                  <div className={["max-w-[88%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-6", fromUser ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-800"].join(" ")}>{message.content}</div>
                </div>
              );
            })}
            {sending || loadingContext ? <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {sending ? "L'assistant direction analyse les donnees Batipro..." : "Chargement du contexte Batipro..."}</div> : null}
            {error ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</div> : null}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3">
            {attachments.length ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                    <Paperclip className="h-3 w-3 shrink-0" />
                    <span className="truncate">{attachment.name}</span>
                    <span className="shrink-0 text-slate-400">{formatBytes(attachment.size)}</span>
                    <button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))} className="grid h-5 w-5 place-items-center rounded hover:bg-slate-200" aria-label={`Retirer ${attachment.name}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {attachmentError ? <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{attachmentError}</div> : null}
            <div className="flex items-end gap-2">
              <label className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" title="Ajouter un fichier texte a transmettre a COCO">
                {readingAttachments ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                <input type="file" multiple accept=".txt,.md,.csv,.json,.log,.xml,.html,.htm,.yaml,.yml,text/*,application/json" onChange={(event) => void handleAttachmentSelection(event)} className="sr-only" />
              </label>
              <label className="min-w-0 flex-1">
                <span className="sr-only">Question a l'Assistant Direction COCO</span>
                <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={3} className="max-h-40 min-h-16 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder={suggestedPrompt} />
              </label>
              <button type="submit" disabled={sending || loadingContext || readingAttachments || (!input.trim() && !attachments.length)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-950 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500" aria-label="Envoyer a l'assistant direction"><Send className="h-4 w-4" /></button>
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
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><ClipboardCheck className="h-4 w-4 text-blue-600" /> Brouillons controles</div>
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
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><ClipboardCheck className="h-4 w-4 text-emerald-600" /> Brouillons recents</div>
              <button type="button" onClick={() => void refreshControlledDrafts()} disabled={controlledDraftsLoading} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                <RefreshCw className={["h-3 w-3", controlledDraftsLoading ? "animate-spin" : ""].join(" ")} /> Actualiser
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Suivi dirigeant des propositions IA historisees. Les boutons changent uniquement le statut du brouillon et ne creent ni devis, ni tache, ni planning, ni commande.</p>
            {controlledDraftsError ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">{controlledDraftsError}</div> : null}
            <div className="mt-3 space-y-2">
              {controlledDraftsLoading && !controlledDrafts.length ? <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement des brouillons...</div> : null}
              {!controlledDraftsLoading && !controlledDrafts.length ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">Aucun brouillon controle historise pour le moment.</div> : null}
              {controlledDrafts.map((record) => (
                <div key={record.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-950">{record.draft.title}</div>
                      <div className="mt-1 text-[11px] font-medium text-blue-700">{draftKindLabel(record.kind)} - {draftSourceLabel(record.sourceKind)}</div>
                    </div>
                    <span className={["shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold", draftStatusClass(record.status)].join(" ")}>{draftStatusLabel(record.status)}</span>
                  </div>
                  <div className="mt-2 text-[11px] leading-5 text-slate-500">{draftMetrics(record)}<br />{new Date(record.createdAt).toLocaleString("fr-FR")}</div>
                  {record.draft.pointsToVerify.length ? <div className="mt-2 max-h-10 overflow-hidden text-[11px] leading-5 text-amber-700">A verifier: {record.draft.pointsToVerify.join(" - ")}</div> : null}
                  <div className="mt-3 grid grid-cols-2 gap-1">
                    <button type="button" onClick={() => setSelectedDraftId(record.id)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">Details</button>
                    <button type="button" onClick={() => void updateControlledDraftStatus(record, "reviewed")} disabled={updatingDraftId === record.id || record.status === "reviewed"} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                      {updatingDraftId === record.id ? "..." : "Marquer revu"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Sparkles className="h-4 w-4 text-blue-600" /> Questions rapides</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {COCO_DIRECTION_QUICK_QUESTIONS.map((question) => (
                <button key={question.label} type="button" onClick={() => void askAssistant(question.prompt)} disabled={sending || loadingContext} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60">{question.label}</button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm shadow-slate-950/[0.03]">
            <div className="flex items-center gap-2 font-semibold text-slate-950"><AlertTriangle className="h-4 w-4 text-amber-500" /> Points analyses</div>
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
