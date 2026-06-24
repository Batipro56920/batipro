import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  Clock3,
  FileText,
  Home,
  ListChecks,
  Loader2,
  LogOut,
  MapPin,
  MessageSquareWarning,
  Plus,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  intervenantConsigneList,
  intervenantGetChantiers,
  intervenantGetDocuments,
  intervenantGetTasks,
  intervenantInformationRequestCreate,
  intervenantInformationRequestList,
  intervenantMaterielCreate,
  intervenantReserveList,
  intervenantSession,
  intervenantTerrainFeedbackCreate,
  intervenantTerrainFeedbackList,
  intervenantTerrainFeedbackUploadPhoto,
  intervenantTimeCreate,
  intervenantTimeList,
  intervenantUpdateTaskStatus,
  type IntervenantChantier,
  type IntervenantConsigne,
  type IntervenantDocument,
  type IntervenantInformationRequest,
  type IntervenantReserve,
  type IntervenantSessionInfo,
  type IntervenantTask,
  type IntervenantTerrainFeedback,
  type IntervenantTimeEntry,
} from "../services/intervenantPortal.service";
import {
  AUTH_SESSION_PORTAL_TOKEN,
  clearStoredIntervenantSession,
  clearStoredIntervenantToken,
  extractIntervenantToken,
  persistIntervenantChantierId,
  persistIntervenantToken,
  readStoredIntervenantChantierId,
  readStoredIntervenantToken,
} from "../utils/intervenantSession";

type PortalTab = "accueil" | "chantiers" | "taches" | "temps" | "retours";
type DrawerTab = "infos" | "actions";
type Tone = "neutral" | "blue" | "green" | "amber" | "red";
type SignalType = "blocage" | "materiel" | "materiaux" | "information";
type TaskItem = { chantier: IntervenantChantier; task: IntervenantTask };
type LoadResult<T> = { data: T; error: string | null };

type SiteData = {
  tasks: IntervenantTask[];
  documents: IntervenantDocument[];
  timeEntries: IntervenantTimeEntry[];
  feedbacks: IntervenantTerrainFeedback[];
  reserves: IntervenantReserve[];
  infoRequests: IntervenantInformationRequest[];
  consignes: IntervenantConsigne[];
};

type AlertItem = {
  id: string;
  title: string;
  text: string;
  tone: Tone;
  kind: string;
};

const EMPTY_SITE_DATA: SiteData = {
  tasks: [],
  documents: [],
  timeEntries: [],
  feedbacks: [],
  reserves: [],
  infoRequests: [],
  consignes: [],
};

const DOC_ADMIN_WORDS = ["devis", "facture", "doe", "administratif", "comptable", "avoir"];
const DOC_PLAN_WORDS = ["plan", "croquis", "photo technique", "photo-technique"];
const DOC_USEFUL_WORDS = ["notice", "procedure", "procédure", "technique", "fiche", "pose", "materiau", "matériau", "securite", "sécurité"];
const inputClass = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

function todayIsoDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function formatHours(value: number | null | undefined): string {
  const hours = Number(value ?? 0);
  if (!Number.isFinite(hours) || hours <= 0) return "0 h";
  return `${Math.round(hours * 100) / 100} h`;
}

function compactText(...values: Array<string | null | undefined>): string {
  return values.map((value) => String(value ?? "").trim()).filter(Boolean).join(" ");
}

function taskDate(task: IntervenantTask): string | null {
  return task.date_debut ?? task.date ?? task.date_fin;
}

function isTaskDone(task: IntervenantTask): boolean {
  const status = String(task.status ?? "").toUpperCase();
  return ["FAIT", "TERMINE", "DONE", "COMPLETED"].includes(status) || ["termine_intervenant", "valide_admin"].includes(task.quality_status);
}

function taskStatusLabel(task: IntervenantTask): string {
  if (isTaskDone(task)) return "Terminee";
  if (task.quality_status === "a_reprendre") return "A reprendre";
  const status = String(task.status ?? "").toUpperCase();
  if (status === "EN_COURS" || task.quality_status === "en_cours") return "En cours";
  return "A faire";
}

function taskTone(task: IntervenantTask): Tone {
  if (isTaskDone(task)) return "green";
  if (task.quality_status === "a_reprendre") return "red";
  const status = String(task.status ?? "").toUpperCase();
  return status === "EN_COURS" || task.quality_status === "en_cours" ? "blue" : "amber";
}

function taskConstraint(task: IntervenantTask, consignes: IntervenantConsigne[] = []): string {
  const taskConsigne = consignes.find((consigne) => consigne.task_id === task.id || (!!task.zone_id && consigne.zone_id === task.zone_id));
  return task.reprise_reason ?? taskConsigne?.title ?? task.etape_metier ?? "Aucune contrainte visible";
}

function sortTasks(a: IntervenantTask, b: IntervenantTask): number {
  const doneDelta = Number(isTaskDone(a)) - Number(isTaskDone(b));
  if (doneDelta !== 0) return doneDelta;
  const ad = taskDate(a);
  const bd = taskDate(b);
  const at = ad ? Date.parse(`${ad}T00:00:00`) : Number.MAX_SAFE_INTEGER;
  const bt = bd ? Date.parse(`${bd}T00:00:00`) : Number.MAX_SAFE_INTEGER;
  return at - bt || a.order_index - b.order_index || a.titre.localeCompare(b.titre, "fr");
}

function documentSearchText(document: IntervenantDocument): string {
  return compactText(document.title, document.file_name, document.category, document.document_type).toLowerCase();
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function isFieldDocument(document: IntervenantDocument): boolean {
  return !includesAny(documentSearchText(document), DOC_ADMIN_WORDS);
}

function isPlanDocument(document: IntervenantDocument): boolean {
  const text = documentSearchText(document);
  return isFieldDocument(document) && includesAny(text, DOC_PLAN_WORDS);
}

function isUsefulDocument(document: IntervenantDocument): boolean {
  const text = documentSearchText(document);
  return isFieldDocument(document) && !isPlanDocument(document) && (includesAny(text, DOC_USEFUL_WORDS) || !text);
}

function taskDocuments(task: IntervenantTask, documents: IntervenantDocument[]): IntervenantDocument[] {
  const taskWords = compactText(task.titre, task.zone_nom, task.lot, task.corps_etat).toLowerCase().split(/\s+/).filter((word) => word.length > 3);
  const matched = documents.filter((document) => {
    const text = documentSearchText(document);
    return taskWords.some((word) => text.includes(word));
  });
  return matched.length ? matched : documents;
}

function photoCount(feedbacks: IntervenantTerrainFeedback[], task?: IntervenantTask): number {
  return feedbacks
    .filter((feedback) => !task || feedback.title.toLowerCase().includes(task.titre.toLowerCase()) || feedback.description.toLowerCase().includes(task.titre.toLowerCase()))
    .reduce((sum, feedback) => sum + feedback.attachments.length, 0);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return String((error as { message?: string } | null)?.message ?? fallback).trim() || fallback;
}

async function safeLoad<T>(loader: () => Promise<T>, fallback: T, label: string): Promise<LoadResult<T>> {
  try {
    return { data: await loader(), error: null };
  } catch (error) {
    return { data: fallback, error: getErrorMessage(error, label) };
  }
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
  };
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] ${className}`}>{children}</section>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">{children}</div>;
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-base font-semibold text-slate-950">{title}</h2>;
}

export default function IntervenantPortalV2FinalPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryToken = useMemo(() => new URLSearchParams(location.search).get("token")?.trim() ?? "", [location.search]);
  const queryChantierId = useMemo(() => new URLSearchParams(location.search).get("chantier_id")?.trim() ?? "", [location.search]);
  const today = useMemo(() => todayIsoDate(), []);
  const weekEnd = useMemo(() => addDaysIso(today, 6), [today]);

  const [token, setToken] = useState("");
  const [sessionInfo, setSessionInfo] = useState<IntervenantSessionInfo | null>(null);
  const [chantiers, setChantiers] = useState<IntervenantChantier[]>([]);
  const [selectedChantierId, setSelectedChantierId] = useState("");
  const [activeTab, setActiveTab] = useState<PortalTab>("accueil");
  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [accessLinkInput, setAccessLinkInput] = useState("");
  const [siteLoading, setSiteLoading] = useState(false);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [siteData, setSiteData] = useState<SiteData>(EMPTY_SITE_DATA);
  const [tasksBySite, setTasksBySite] = useState<Record<string, IntervenantTask[]>>({});
  const [reloadTick, setReloadTick] = useState(0);
  const [activeTask, setActiveTask] = useState<IntervenantTask | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("infos");
  const [savingAction, setSavingAction] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [timeHours, setTimeHours] = useState("");
  const [timeComment, setTimeComment] = useState("");
  const [remarkText, setRemarkText] = useState("");
  const [signalType, setSignalType] = useState<SignalType>("blocage");
  const [signalComment, setSignalComment] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      setBootLoading(true);
      setBootError(null);
      const storedToken = readStoredIntervenantToken();
      const legacyToken = extractIntervenantToken(queryToken || storedToken);
      const { data: { session } } = await supabase.auth.getSession();
      const candidateToken = legacyToken || (session?.user ? AUTH_SESSION_PORTAL_TOKEN : "");

      if (!candidateToken) {
        if (alive) {
          setToken("");
          setBootError("Colle ton lien d'acces intervenant pour ouvrir le portail.");
          setBootLoading(false);
        }
        return;
      }

      try {
        setToken(candidateToken);
        if (legacyToken) persistIntervenantToken(legacyToken);
        else clearStoredIntervenantToken();

        const [sessionData, chantierRows] = await Promise.all([
          intervenantSession(candidateToken),
          intervenantGetChantiers(candidateToken),
        ]);
        if (!alive) return;

        const rows = chantierRows.length ? chantierRows : sessionData.chantiers;
        const chantierIds = new Set(rows.map((chantier) => chantier.id));
        const storedChantierId = readStoredIntervenantChantierId();
        const nextChantierId =
          (queryChantierId && chantierIds.has(queryChantierId) ? queryChantierId : "") ||
          (storedChantierId && chantierIds.has(storedChantierId) ? storedChantierId : "") ||
          sessionData.default_chantier_id ||
          sessionData.chantier_id ||
          rows[0]?.id ||
          "";

        setSessionInfo(sessionData);
        setChantiers(rows);
        setSelectedChantierId(nextChantierId);
        if (nextChantierId) persistIntervenantChantierId(nextChantierId);
        if (queryToken) navigate("/intervenant", { replace: true });
      } catch (error) {
        if (!alive) return;
        clearStoredIntervenantSession();
        setToken("");
        setBootError(getErrorMessage(error, "Portail intervenant indisponible."));
      } finally {
        if (alive) setBootLoading(false);
      }
    }

    void bootstrap();
    return () => { alive = false; };
  }, [navigate, queryChantierId, queryToken]);

  useEffect(() => {
    if (!token || bootLoading || bootError || chantiers.length === 0) return;
    let alive = true;

    async function loadTasksOverview() {
      const results = await Promise.all(
        chantiers.map((chantier) =>
          safeLoad(() => intervenantGetTasks(token, chantier.id), [] as IntervenantTask[], "Chargement taches impossible.").then((result) => ({ chantier, result })),
        ),
      );
      if (!alive) return;
      const next: Record<string, IntervenantTask[]> = {};
      results.forEach(({ chantier, result }) => {
        next[chantier.id] = result.data.sort(sortTasks);
      });
      setTasksBySite(next);
    }

    void loadTasksOverview();
    return () => { alive = false; };
  }, [bootError, bootLoading, chantiers, reloadTick, token]);

  useEffect(() => {
    if (!token || !selectedChantierId || bootLoading || bootError) return;
    let alive = true;

    async function loadSelectedSite() {
      setSiteLoading(true);
      setSiteError(null);
      const [tasks, documents, timeEntries, feedbacks, reserves, infoRequests, consignes] = await Promise.all([
        safeLoad(() => intervenantGetTasks(token, selectedChantierId), [] as IntervenantTask[], "Taches indisponibles."),
        safeLoad(() => intervenantGetDocuments(token, selectedChantierId), [] as IntervenantDocument[], "Documents indisponibles."),
        safeLoad(() => intervenantTimeList(token, selectedChantierId), [] as IntervenantTimeEntry[], "Temps indisponible."),
        safeLoad(() => intervenantTerrainFeedbackList(token, selectedChantierId), [] as IntervenantTerrainFeedback[], "Retours indisponibles."),
        safeLoad(() => intervenantReserveList(token, selectedChantierId), [] as IntervenantReserve[], "Reserves indisponibles."),
        safeLoad(() => intervenantInformationRequestList(token, selectedChantierId), [] as IntervenantInformationRequest[], "Demandes indisponibles."),
        safeLoad(() => intervenantConsigneList(token, selectedChantierId), [] as IntervenantConsigne[], "Consignes indisponibles."),
      ]);
      if (!alive) return;
      setSiteData({
        tasks: tasks.data.sort(sortTasks),
        documents: documents.data,
        timeEntries: timeEntries.data,
        feedbacks: feedbacks.data,
        reserves: reserves.data,
        infoRequests: infoRequests.data,
        consignes: consignes.data,
      });
      setSiteError([tasks, documents, timeEntries, feedbacks, reserves, infoRequests, consignes].map((result) => result.error).find(Boolean) ?? null);
      setSiteLoading(false);
    }

    void loadSelectedSite();
    return () => { alive = false; };
  }, [bootError, bootLoading, reloadTick, selectedChantierId, token]);

  const selectedChantier = useMemo(() => chantiers.find((chantier) => chantier.id === selectedChantierId) ?? chantiers[0] ?? null, [chantiers, selectedChantierId]);
  const fieldDocuments = useMemo(() => siteData.documents.filter(isFieldDocument), [siteData.documents]);
  const planDocuments = useMemo(() => fieldDocuments.filter(isPlanDocument), [fieldDocuments]);
  const usefulDocuments = useMemo(() => fieldDocuments.filter(isUsefulDocument), [fieldDocuments]);
  const todoTasks = useMemo(() => siteData.tasks.filter((task) => !isTaskDone(task)), [siteData.tasks]);
  const doneTasks = useMemo(() => siteData.tasks.filter(isTaskDone), [siteData.tasks]);
  const allTaskItems = useMemo<TaskItem[]>(() => chantiers.flatMap((chantier) => (tasksBySite[chantier.id] ?? []).map((task) => ({ chantier, task }))), [chantiers, tasksBySite]);
  const todayTasks = useMemo(() => allTaskItems.filter((item) => taskDate(item.task) === today && !isTaskDone(item.task)).sort((a, b) => sortTasks(a.task, b.task)), [allTaskItems, today]);
  const weekTasks = useMemo(() => allTaskItems.filter((item) => {
    const date = taskDate(item.task);
    return !!date && date > today && date <= weekEnd && !isTaskDone(item.task);
  }).sort((a, b) => sortTasks(a.task, b.task)), [allTaskItems, today, weekEnd]);
  const laterTasks = useMemo(() => allTaskItems.filter((item) => {
    const date = taskDate(item.task);
    return (!date || date > weekEnd) && !isTaskDone(item.task);
  }).sort((a, b) => sortTasks(a.task, b.task)), [allTaskItems, weekEnd]);
  const todayHours = useMemo(() => siteData.timeEntries.filter((entry) => entry.work_date === today).reduce((sum, entry) => sum + Number(entry.duration_hours ?? 0), 0), [siteData.timeEntries, today]);
  const alerts = useMemo<AlertItem[]>(() => {
    const feedbackAlerts = siteData.feedbacks
      .filter((feedback) => feedback.status !== "traite" && ["blocage", "anomalie"].includes(feedback.category))
      .map((feedback) => ({ id: feedback.id, title: feedback.title, text: feedback.description, tone: feedback.urgency === "urgente" || feedback.urgency === "critique" ? "red" as Tone : "amber" as Tone, kind: "Blocage" }));
    const reserveAlerts = siteData.reserves
      .filter((reserve) => reserve.status !== "LEVEE")
      .map((reserve) => ({ id: reserve.id, title: reserve.title, text: reserve.description ?? reserve.status, tone: reserve.priority === "URGENTE" ? "red" as Tone : "amber" as Tone, kind: "Reserve" }));
    const infoAlerts = siteData.infoRequests
      .filter((request) => request.status !== "traitee")
      .map((request) => ({ id: request.id, title: request.subject, text: request.message, tone: "amber" as Tone, kind: "Information" }));
    const docAlerts = planDocuments.slice(0, 1).map((document) => ({ id: document.id, title: document.title ?? document.file_name ?? "Document important", text: compactText(document.category, document.document_type) || "Document chantier", tone: "blue" as Tone, kind: "Document" }));
    return [...feedbackAlerts, ...reserveAlerts, ...infoAlerts, ...docAlerts].slice(0, 6);
  }, [planDocuments, siteData.feedbacks, siteData.infoRequests, siteData.reserves]);
  const mainConstraint = alerts[0]?.title ?? siteData.consignes.find((consigne) => consigne.priority !== "normale")?.title ?? "Aucune contrainte critique";

  function selectChantier(chantierId: string) {
    setSelectedChantierId(chantierId);
    persistIntervenantChantierId(chantierId);
    setActiveTab("chantiers");
  }

  function openTask(task: IntervenantTask) {
    setSelectedChantierId(task.chantier_id);
    persistIntervenantChantierId(task.chantier_id);
    setActiveTask(task);
    setDrawerTab("infos");
    setActionMessage(null);
    setTimeHours("");
    setTimeComment("");
    setRemarkText("");
    setSignalComment("");
    setPhotoFile(null);
  }

  async function logoutIntervenant() {
    const authSession = token === AUTH_SESSION_PORTAL_TOKEN;
    clearStoredIntervenantSession();
    if (authSession) await supabase.auth.signOut().catch(() => undefined);
    navigate("/", { replace: true });
  }

  function submitAccessLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextToken = extractIntervenantToken(accessLinkInput);
    if (!nextToken) {
      setBootError("Lien d'acces invalide.");
      return;
    }
    persistIntervenantToken(nextToken);
    navigate(`/intervenant?token=${encodeURIComponent(nextToken)}`, { replace: true });
  }

  async function runTaskAction(action: () => Promise<void>, success: string) {
    setSavingAction(true);
    setActionMessage(null);
    try {
      await action();
      setActionMessage(success);
      setReloadTick((value) => value + 1);
    } catch (error) {
      setActionMessage(getErrorMessage(error, "Action impossible."));
    } finally {
      setSavingAction(false);
    }
  }

  function submitTime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeTask) return;
    const hours = Number(timeHours.replace(",", "."));
    if (!Number.isFinite(hours) || hours <= 0) {
      setActionMessage("Saisis une duree valide.");
      return;
    }
    void runTaskAction(
      () => intervenantTimeCreate(token, { chantier_id: activeTask.chantier_id, task_id: activeTask.id, work_date: todayIsoDate(), duration_hours: hours, note: timeComment.trim() || null }),
      "Temps ajoute.",
    );
    setTimeHours("");
    setTimeComment("");
  }

  function submitRemark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeTask || !remarkText.trim()) return;
    const task = activeTask;
    void runTaskAction(
      () => intervenantTerrainFeedbackCreate(token, { chantier_id: task.chantier_id, category: "observation_chantier", urgency: "normale", title: `Remarque - ${task.titre}`, description: remarkText.trim() }).then(() => undefined),
      "Remarque envoyee.",
    );
    setRemarkText("");
  }

  function submitSignal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeTask) return;
    const task = activeTask;
    const comment = signalComment.trim();
    const action = signalType === "materiel" || signalType === "materiaux"
      ? () => intervenantMaterielCreate(token, { chantier_id: task.chantier_id, task_id: task.id, titre: signalType === "materiaux" ? `Manque materiaux - ${task.titre}` : `Manque materiel - ${task.titre}`, commentaire: comment || null })
      : signalType === "information"
        ? () => intervenantInformationRequestCreate(token, { chantier_id: task.chantier_id, request_date: todayIsoDate(), subject: `Information manquante - ${task.titre}`, message: comment || "Information manquante pour avancer." }).then(() => undefined)
        : () => intervenantTerrainFeedbackCreate(token, { chantier_id: task.chantier_id, category: "blocage", urgency: "urgente", title: `Blocage - ${task.titre}`, description: comment || "Blocage signale depuis le portail terrain." }).then(() => undefined);
    void runTaskAction(action, "Signalement envoye.");
    setSignalComment("");
  }

  function submitPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeTask || !photoFile) return;
    const task = activeTask;
    const file = photoFile;
    void runTaskAction(async () => {
      const feedback = await intervenantTerrainFeedbackCreate(token, { chantier_id: task.chantier_id, category: "observation_chantier", urgency: "normale", title: `Photo - ${task.titre}`, description: "Photo ajoutee depuis le portail terrain." });
      await intervenantTerrainFeedbackUploadPhoto(token, { chantier_id: task.chantier_id, feedback_id: feedback.id, file });
    }, "Photo ajoutee.");
    setPhotoFile(null);
  }

  function completeTask() {
    if (!token || !activeTask) return;
    void runTaskAction(() => intervenantUpdateTaskStatus(token, activeTask.id, "FAIT"), "Tache marquee terminee.");
  }

  if (bootLoading) return <FullPageMessage text="Chargement du portail terrain..." loading />;
  if (bootError && !token) return <AccessForm error={bootError} value={accessLinkInput} onChange={setAccessLinkInput} onSubmit={submitAccessLink} />;

  const currentTask = activeTask ? siteData.tasks.find((task) => task.id === activeTask.id) ?? activeTask : null;
  const currentTaskChantier = currentTask ? chantiers.find((chantier) => chantier.id === currentTask.chantier_id) ?? selectedChantier : selectedChantier;

  return (
    <div className="min-h-dvh bg-slate-50 pb-[calc(5rem+var(--safe-bottom))] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Portail terrain</div>
            <h1 className="truncate text-lg font-semibold text-slate-950">{sessionInfo?.intervenant.nom || "Intervenant"}</h1>
          </div>
          <button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600" onClick={logoutIntervenant} type="button" aria-label="Se deconnecter">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4">
        {siteError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{siteError}</div> : null}
        {activeTab === "accueil" ? <HomeView alerts={alerts} mainConstraint={mainConstraint} onOpenTask={openTask} selectedChantier={todayTasks[0]?.chantier ?? selectedChantier} tasks={todayTasks} todayHours={todayHours} /> : null}
        {activeTab === "chantiers" ? <SitesView allTasksBySite={tasksBySite} chantiers={chantiers} consignes={siteData.consignes} doneTasks={doneTasks} feedbacks={siteData.feedbacks} onOpenTask={openTask} planDocuments={planDocuments} reserves={siteData.reserves} selectChantier={selectChantier} selectedChantier={selectedChantier} siteLoading={siteLoading} tasks={todoTasks} usefulDocuments={usefulDocuments} /> : null}
        {activeTab === "taches" ? <TasksView laterTasks={laterTasks} onOpenTask={openTask} todayTasks={todayTasks} weekTasks={weekTasks} /> : null}
        {activeTab === "temps" ? <TimeView entries={siteData.timeEntries} onOpenTask={openTask} selectedChantier={selectedChantier} tasks={[...todayTasks, ...(selectedChantier ? todoTasks.map((task) => ({ chantier: selectedChantier, task })) : [])].filter((item, index, rows) => rows.findIndex((row) => row.task.id === item.task.id) === index)} /> : null}
        {activeTab === "retours" ? <FeedbacksView feedbacks={siteData.feedbacks} requests={siteData.infoRequests} reserves={siteData.reserves} /> : null}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      {currentTask ? (
        <TaskDrawer
          actionMessage={actionMessage}
          chantier={currentTaskChantier}
          close={() => setActiveTask(null)}
          completeTask={completeTask}
          consignes={siteData.consignes}
          documents={taskDocuments(currentTask, fieldDocuments)}
          drawerTab={drawerTab}
          entries={siteData.timeEntries.filter((entry) => entry.task_id === currentTask.id)}
          feedbacks={siteData.feedbacks}
          photoFile={photoFile}
          remarkText={remarkText}
          saving={savingAction}
          setDrawerTab={setDrawerTab}
          setPhotoFile={setPhotoFile}
          setRemarkText={setRemarkText}
          setSignalComment={setSignalComment}
          setSignalType={setSignalType}
          setTimeComment={setTimeComment}
          setTimeHours={setTimeHours}
          signalComment={signalComment}
          signalType={signalType}
          submitPhoto={submitPhoto}
          submitRemark={submitRemark}
          submitSignal={submitSignal}
          submitTime={submitTime}
          task={currentTask}
          timeComment={timeComment}
          timeHours={timeHours}
        />
      ) : null}
    </div>
  );
}

function FullPageMessage({ loading = false, text }: { loading?: boolean; text: string }) {
  return <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4"><Card className="flex w-full max-w-md items-center justify-center gap-3 text-center text-sm font-semibold text-slate-700">{loading ? <Loader2 className="h-5 w-5 animate-spin text-blue-700" /> : null}{text}</Card></div>;
}

function AccessForm({ error, onChange, onSubmit, value }: { error: string; onChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; value: string }) {
  return <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4"><Card className="w-full max-w-md"><h1 className="text-lg font-semibold text-slate-950">Portail employe Batipro</h1><p className="mt-2 text-sm text-slate-500">{error}</p><form className="mt-5 space-y-3" onSubmit={onSubmit}><input className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Coller le lien recu" /><button className="w-full rounded-2xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white" type="submit">Ouvrir le portail</button></form></Card></div>;
}

function HomeView({ alerts, mainConstraint, onOpenTask, selectedChantier, tasks, todayHours }: { alerts: AlertItem[]; mainConstraint: string; onOpenTask: (task: IntervenantTask) => void; selectedChantier: IntervenantChantier | null; tasks: TaskItem[]; todayHours: number }) {
  return <><Card><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric title="Chantier" value={selectedChantier?.nom ?? "Aucun"} icon={<Building2 className="h-4 w-4" />} /><Metric title="Taches" value={String(tasks.length)} icon={<ListChecks className="h-4 w-4" />} /><Metric title="Temps" value={formatHours(todayHours)} icon={<Clock3 className="h-4 w-4" />} /><Metric title="Contrainte" value={mainConstraint} icon={<AlertTriangle className="h-4 w-4" />} /></div></Card><Card><SectionHeader title="Taches du jour" /><TaskList items={tasks} empty="Aucune tache planifiee aujourd'hui." onOpenTask={onOpenTask} /></Card><Card><SectionHeader title="Alertes utiles" /><div className="mt-4 space-y-2">{alerts.length ? alerts.map((alert) => <NoteRow key={alert.id} title={alert.title} text={alert.text} tone={alert.tone} label={alert.kind} />) : <Empty>Aucune alerte active.</Empty>}</div></Card></>;
}

function SitesView({ allTasksBySite, chantiers, consignes, doneTasks, feedbacks, onOpenTask, planDocuments, reserves, selectChantier, selectedChantier, siteLoading, tasks, usefulDocuments }: { allTasksBySite: Record<string, IntervenantTask[]>; chantiers: IntervenantChantier[]; consignes: IntervenantConsigne[]; doneTasks: IntervenantTask[]; feedbacks: IntervenantTerrainFeedback[]; onOpenTask: (task: IntervenantTask) => void; planDocuments: IntervenantDocument[]; reserves: IntervenantReserve[]; selectChantier: (id: string) => void; selectedChantier: IntervenantChantier | null; siteLoading: boolean; tasks: IntervenantTask[]; usefulDocuments: IntervenantDocument[] }) {
  return <><Card><SectionHeader title="Chantiers" /><div className="mt-4 grid gap-3 sm:grid-cols-2">{chantiers.map((chantier) => { const rows = allTasksBySite[chantier.id] ?? []; const done = rows.filter(isTaskDone).length; const percent = rows.length ? Math.round((done / rows.length) * 100) : Math.round(chantier.avancement ?? 0); return <button key={chantier.id} type="button" onClick={() => selectChantier(chantier.id)} className={`rounded-2xl border p-4 text-left transition ${selectedChantier?.id === chantier.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200"}`}><div className="text-sm font-semibold text-slate-950">{chantier.nom}</div><div className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{chantier.adresse ?? "Adresse non renseignee"}</div><div className="mt-3 flex flex-wrap gap-2"><Badge tone="blue">{chantier.status ?? "Statut non renseigne"}</Badge><Badge>{Math.max(0, rows.length - done)} restantes</Badge></div><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-700" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div></button>; })}</div></Card>{selectedChantier ? <Card><SectionHeader title={selectedChantier.nom} />{siteLoading ? <p className="mt-3 text-sm text-slate-500">Chargement du chantier...</p> : null}<div className="mt-4 grid gap-3 sm:grid-cols-2"><InfoLine label="Adresse" value={selectedChantier.adresse ?? "-"} /><InfoLine label="Statut" value={selectedChantier.status ?? "-"} /><InfoLine label="Responsable" value={selectedChantier.client ?? "Non renseigne"} /><InfoLine label="Contraintes acces" value={consignes[0]?.description ?? "Aucune contrainte visible"} /></div><Block title="Consignes" empty="Aucune consigne visible.">{consignes.slice(0, 4).map((consigne) => <NoteRow key={consigne.id} title={consigne.title} text={consigne.description} tone={consigne.priority === "urgente" ? "red" : consigne.priority === "importante" ? "amber" : "neutral"} label="Consigne" />)}</Block><Block title="Taches chantier" empty="Aucune tache visible."><SmallTaskGroup title="Aujourd'hui" tasks={tasks.filter((task) => taskDate(task) === todayIsoDate())} chantier={selectedChantier} onOpenTask={onOpenTask} /><SmallTaskGroup title="Cette semaine" tasks={tasks.filter((task) => { const date = taskDate(task); return !!date && date >= todayIsoDate() && date <= addDaysIso(todayIsoDate(), 6); })} chantier={selectedChantier} onOpenTask={onOpenTask} /><SmallTaskGroup title="Terminees" tasks={doneTasks.slice(0, 5)} chantier={selectedChantier} onOpenTask={onOpenTask} /></Block><DocumentBlock title="Plans chantier" documents={planDocuments} empty="Aucun plan, croquis ou photo technique visible." /><DocumentBlock title="Documents utiles" documents={usefulDocuments} empty="Aucun document technique visible." /><Block title="Retours terrain recents" empty="Aucun retour recent.">{[...feedbacks.map((feedback) => ({ id: feedback.id, title: feedback.title, text: feedback.description, tone: feedback.urgency === "urgente" || feedback.urgency === "critique" ? "red" as Tone : "blue" as Tone })), ...reserves.map((reserve) => ({ id: reserve.id, title: reserve.title, text: reserve.description ?? "", tone: reserve.priority === "URGENTE" ? "red" as Tone : "amber" as Tone }))].slice(0, 5).map((row) => <NoteRow key={row.id} title={row.title} text={row.text} tone={row.tone} label="Suivi" />)}</Block></Card> : null}</>;
}

function TasksView({ laterTasks, onOpenTask, todayTasks, weekTasks }: { laterTasks: TaskItem[]; onOpenTask: (task: IntervenantTask) => void; todayTasks: TaskItem[]; weekTasks: TaskItem[] }) {
  return <Card><SectionHeader title="Taches" /><TaskPeriod title="Aujourd'hui" items={todayTasks} onOpenTask={onOpenTask} /><TaskPeriod title="Cette semaine" items={weekTasks} onOpenTask={onOpenTask} /><TaskPeriod title="Plus tard" items={laterTasks} onOpenTask={onOpenTask} /></Card>;
}

function TimeView({ entries, onOpenTask, selectedChantier, tasks }: { entries: IntervenantTimeEntry[]; onOpenTask: (task: IntervenantTask) => void; selectedChantier: IntervenantChantier | null; tasks: TaskItem[] }) {
  return <Card><SectionHeader title="Temps" /><div className="mt-4 space-y-3">{tasks.length ? tasks.slice(0, 18).map((item) => { const taskEntries = entries.filter((entry) => entry.task_id === item.task.id); const total = taskEntries.reduce((sum, entry) => sum + Number(entry.duration_hours ?? 0), 0); return <button key={item.task.id} type="button" onClick={() => onOpenTask(item.task)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold text-slate-950">{item.task.titre}</div><div className="mt-1 text-xs text-slate-500">{item.chantier.nom}</div></div><Plus className="h-4 w-4 text-blue-700" /></div><div className="mt-3 grid grid-cols-3 gap-2"><InfoLine label="Prevu" value={formatHours(item.task.temps_prevu_h)} /><InfoLine label="Cumule" value={formatHours(total || item.task.temps_reel_h)} /><InfoLine label="Saisies" value={String(taskEntries.length)} /></div>{taskEntries.length ? <div className="mt-3 space-y-1">{taskEntries.slice(0, 3).map((entry) => <div key={entry.id} className="flex justify-between gap-3 text-xs text-slate-500"><span>{formatDate(entry.work_date)}</span><span>{formatHours(entry.duration_hours)}</span></div>)}</div> : null}</button>; }) : <Empty>{selectedChantier ? "Aucune tache disponible." : "Aucun chantier selectionne."}</Empty>}</div></Card>;
}

function FeedbacksView({ feedbacks, requests, reserves }: { feedbacks: IntervenantTerrainFeedback[]; requests: IntervenantInformationRequest[]; reserves: IntervenantReserve[] }) {
  return <Card><SectionHeader title="Retours" /><div className="mt-4 space-y-3">{feedbacks.map((feedback) => <NoteRow key={feedback.id} title={feedback.title} text={feedback.description} tone={feedback.urgency === "urgente" || feedback.urgency === "critique" ? "red" : "blue"} label={feedback.category} />)}{reserves.map((reserve) => <NoteRow key={reserve.id} title={reserve.title} text={reserve.description ?? reserve.status} tone={reserve.priority === "URGENTE" ? "red" : "amber"} label="Reserve" />)}{requests.map((request) => <NoteRow key={request.id} title={request.subject} text={request.message} tone="blue" label="Information" />)}{feedbacks.length + reserves.length + requests.length === 0 ? <Empty>Aucun retour terrain.</Empty> : null}</div></Card>;
}

function TaskDrawer(props: {
  actionMessage: string | null;
  chantier: IntervenantChantier | null;
  close: () => void;
  completeTask: () => void;
  consignes: IntervenantConsigne[];
  documents: IntervenantDocument[];
  drawerTab: DrawerTab;
  entries: IntervenantTimeEntry[];
  feedbacks: IntervenantTerrainFeedback[];
  photoFile: File | null;
  remarkText: string;
  saving: boolean;
  setDrawerTab: (tab: DrawerTab) => void;
  setPhotoFile: (file: File | null) => void;
  setRemarkText: (value: string) => void;
  setSignalComment: (value: string) => void;
  setSignalType: (value: SignalType) => void;
  setTimeComment: (value: string) => void;
  setTimeHours: (value: string) => void;
  signalComment: string;
  signalType: SignalType;
  submitPhoto: (event: FormEvent<HTMLFormElement>) => void;
  submitRemark: (event: FormEvent<HTMLFormElement>) => void;
  submitSignal: (event: FormEvent<HTMLFormElement>) => void;
  submitTime: (event: FormEvent<HTMLFormElement>) => void;
  task: IntervenantTask;
  timeComment: string;
  timeHours: string;
}) {
  const totalTime = props.entries.reduce((sum, entry) => sum + Number(entry.duration_hours ?? 0), 0);
  const referencePhotos = props.feedbacks.filter((feedback) => feedback.attachments.length > 0 && feedback.title.toLowerCase().includes(props.task.titre.toLowerCase()));
  const linkedPlans = props.documents.filter(isPlanDocument);
  const linkedDocs = props.documents.filter((document) => isFieldDocument(document) && !isPlanDocument(document));

  return <div className="fixed inset-0 z-50 bg-slate-950/35"><div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-hidden rounded-t-3xl bg-white shadow-[0_-20px_60px_rgba(15,23,42,0.24)] sm:left-auto sm:right-4 sm:top-4 sm:h-[calc(100dvh-2rem)] sm:w-[460px] sm:rounded-3xl"><div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4"><div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">{props.chantier?.nom ?? "Chantier"}</div><h2 className="mt-1 text-base font-semibold text-slate-950">{props.task.titre}</h2></div><button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500" type="button" onClick={props.close} aria-label="Fermer"><X className="h-4 w-4" /></button></div><div className="flex gap-2 border-b border-slate-200 px-4 py-3"><button className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${props.drawerTab === "infos" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"}`} type="button" onClick={() => props.setDrawerTab("infos")}>Informations</button><button className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${props.drawerTab === "actions" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"}`} type="button" onClick={() => props.setDrawerTab("actions")}>Actions terrain</button></div><div className="h-[calc(92dvh-9rem)] overflow-y-auto px-4 py-4 sm:h-[calc(100dvh-11rem)]">{props.drawerTab === "infos" ? <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><InfoLine label="Chantier" value={props.chantier?.nom ?? "-"} /><InfoLine label="Zone" value={props.task.zone_nom ?? "-"} /><InfoLine label="Lot" value={props.task.lot ?? props.task.corps_etat ?? "-"} /><InfoLine label="Statut" value={taskStatusLabel(props.task)} /><InfoLine label="Quantite" value={props.task.quantite === null ? "-" : `${props.task.quantite} ${props.task.unite ?? ""}`} /><InfoLine label="Realise" value={props.task.quantite_realisee === null ? "-" : `${props.task.quantite_realisee} ${props.task.unite ?? ""}`} /><InfoLine label="Temps prevu" value={formatHours(props.task.temps_prevu_h)} /><InfoLine label="Temps passe" value={formatHours(totalTime || props.task.temps_reel_h)} /></div><InfoLine label="Description" value={props.task.etape_metier ?? props.task.titre} /><InfoLine label="Contraintes" value={taskConstraint(props.task, props.consignes)} /><InfoLine label="Dependances" value={props.task.date_debut || props.task.date_fin ? `${formatDate(props.task.date_debut)} -> ${formatDate(props.task.date_fin)}` : "Non renseignees"} /><InfoLine label="Remarques admin" value={props.task.reprise_reason ?? "Aucune remarque admin visible"} /><DocumentBlock title="Plans lies" documents={linkedPlans} empty="Aucun plan lie visible." /><DocumentBlock title="Documents lies" documents={linkedDocs} empty="Aucun document lie visible." /><Block title="Photos reference" empty="Aucune photo reference visible.">{referencePhotos.map((feedback) => <NoteRow key={feedback.id} title={feedback.title} text={`${feedback.attachments.length} photo(s)`} tone="blue" label="Photo" />)}</Block></div> : <div className="space-y-4">{props.actionMessage ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{props.actionMessage}</div> : null}<ActionForm title="Ajouter temps" onSubmit={props.submitTime} saving={props.saving}><input className={inputClass} inputMode="decimal" value={props.timeHours} onChange={(event) => props.setTimeHours(event.target.value)} placeholder="Duree ex : 1,5" /><textarea className={inputClass} value={props.timeComment} onChange={(event) => props.setTimeComment(event.target.value)} rows={2} placeholder="Commentaire optionnel" /></ActionForm><ActionForm title="Ajouter photo" onSubmit={props.submitPhoto} saving={props.saving} disabled={!props.photoFile}><input className={inputClass} type="file" accept="image/*" capture="environment" onChange={(event) => props.setPhotoFile(event.target.files?.[0] ?? null)} /></ActionForm><ActionForm title="Ajouter remarque" onSubmit={props.submitRemark} saving={props.saving} disabled={!props.remarkText.trim()}><textarea className={inputClass} value={props.remarkText} onChange={(event) => props.setRemarkText(event.target.value)} rows={3} placeholder="Remarque terrain" /></ActionForm><ActionForm title="Signaler" onSubmit={props.submitSignal} saving={props.saving}><select className={inputClass} value={props.signalType} onChange={(event) => props.setSignalType(event.target.value as SignalType)}><option value="blocage">Blocage</option><option value="materiel">Manque materiel</option><option value="materiaux">Manque materiaux</option><option value="information">Manque information</option></select><textarea className={inputClass} value={props.signalComment} onChange={(event) => props.setSignalComment(event.target.value)} rows={3} placeholder="Precision utile pour l'admin" /></ActionForm><button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" type="button" onClick={props.completeTask} disabled={props.saving}><CheckCircle2 className="h-4 w-4" />Marquer terminee</button></div>}</div></div></div>;
}

function BottomNav({ activeTab, setActiveTab }: { activeTab: PortalTab; setActiveTab: (tab: PortalTab) => void }) {
  const tabs: Array<{ id: PortalTab; label: string; icon: ReactNode }> = [
    { id: "accueil", label: "Accueil", icon: <Home className="h-5 w-5" /> },
    { id: "chantiers", label: "Chantiers", icon: <Building2 className="h-5 w-5" /> },
    { id: "taches", label: "Taches", icon: <ListChecks className="h-5 w-5" /> },
    { id: "temps", label: "Temps", icon: <Clock3 className="h-5 w-5" /> },
    { id: "retours", label: "Retours", icon: <MessageSquareWarning className="h-5 w-5" /> },
  ];
  return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[var(--safe-bottom)] pt-2 backdrop-blur"><div className="mx-auto grid max-w-5xl grid-cols-5 gap-1">{tabs.map((tab) => <button key={tab.id} className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold ${activeTab === tab.id ? "bg-blue-700 text-white" : "text-slate-500"}`} type="button" onClick={() => setActiveTab(tab.id)}>{tab.icon}<span className="truncate">{tab.label}</span></button>)}</div></nav>;
}

function Metric({ icon, title, value }: { icon: ReactNode; title: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{icon}{title}</div><div className="mt-2 line-clamp-2 text-sm font-semibold text-slate-950">{value}</div></div>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"><div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div><div className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</div></div>;
}

function NoteRow({ label, text, title, tone }: { label: string; text: string; title: string; tone: Tone }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-sm font-semibold text-slate-950">{title}</div>{text ? <p className="mt-1 text-sm text-slate-600">{text}</p> : null}</div><Badge tone={tone}>{label}</Badge></div></div>;
}

function Block({ children, empty, title }: { children: ReactNode; empty: string; title: string }) {
  const hasChildren = Array.isArray(children) ? children.some(Boolean) : Boolean(children);
  return <div className="mt-5 space-y-3"><div className="text-sm font-semibold text-slate-950">{title}</div>{hasChildren ? children : <Empty>{empty}</Empty>}</div>;
}

function DocumentBlock({ documents, empty, title }: { documents: IntervenantDocument[]; empty: string; title: string }) {
  return <Block title={title} empty={empty}>{documents.slice(0, 8).map((document) => <div key={document.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" /><div><div className="text-sm font-semibold text-slate-950">{document.title ?? document.file_name ?? "Document"}</div><div className="mt-1 text-xs text-slate-500">{compactText(document.category, document.document_type) || "Document chantier"}</div></div></div>)}</Block>;
}

function TaskList({ empty, items, onOpenTask }: { empty: string; items: TaskItem[]; onOpenTask: (task: IntervenantTask) => void }) {
  return <div className="mt-4 space-y-3">{items.length ? items.map((item) => <TaskCard key={item.task.id} item={item} onOpenTask={onOpenTask} />) : <Empty>{empty}</Empty>}</div>;
}

function TaskCard({ item, onOpenTask }: { item: TaskItem; onOpenTask: (task: IntervenantTask) => void }) {
  return <button className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-blue-200" type="button" onClick={() => onOpenTask(item.task)}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-sm font-semibold text-slate-950">{item.task.titre}</div><div className="mt-1 text-xs text-slate-500">{item.chantier.nom}</div></div><Badge tone={taskTone(item.task)}>{taskStatusLabel(item.task)}</Badge></div><div className="mt-3 grid gap-2 text-xs sm:grid-cols-4"><InfoLine label="Zone" value={item.task.zone_nom ?? "-"} /><InfoLine label="Lot" value={item.task.lot ?? item.task.corps_etat ?? "-"} /><InfoLine label="Prevu" value={formatHours(item.task.temps_prevu_h)} /><InfoLine label="Contrainte" value={taskConstraint(item.task)} /></div><div className="mt-3 flex flex-wrap gap-2"><Badge>{formatHours(item.task.temps_reel_h)} passe</Badge><Badge>{item.task.quantite === null ? "Quantite -" : `${item.task.quantite} ${item.task.unite ?? ""}`}</Badge><Badge>{formatDate(taskDate(item.task))}</Badge></div></button>;
}

function SmallTaskGroup({ chantier, onOpenTask, tasks, title }: { chantier: IntervenantChantier; onOpenTask: (task: IntervenantTask) => void; tasks: IntervenantTask[]; title: string }) {
  return tasks.length ? <div className="space-y-2"><div className="text-sm font-semibold text-slate-950">{title}</div>{tasks.map((task) => <TaskCard key={task.id} item={{ chantier, task }} onOpenTask={onOpenTask} />)}</div> : null;
}

function TaskPeriod({ items, onOpenTask, title }: { items: TaskItem[]; onOpenTask: (task: IntervenantTask) => void; title: string }) {
  const groups = items.reduce<Record<string, TaskItem[]>>((acc, item) => {
    const current = acc[item.chantier.id] ?? [];
    return { ...acc, [item.chantier.id]: [...current, item] };
  }, {});
  return <div className="mt-5"><div className="text-sm font-semibold text-slate-950">{title}</div><div className="mt-3 space-y-3">{Object.values(groups).length ? Object.values(groups).map((group) => <div key={group[0].chantier.id} className="space-y-2"><div className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">{group[0].chantier.nom}</div>{group.map((item) => <TaskCard key={item.task.id} item={item} onOpenTask={onOpenTask} />)}</div>) : <Empty>Aucune tache.</Empty>}</div></div>;
}

function ActionForm({ children, disabled = false, onSubmit, saving, title }: { children: ReactNode; disabled?: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean; title: string }) {
  return <form className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={onSubmit}><SectionHeader title={title} />{children}<button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={saving || disabled}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : title === "Ajouter photo" ? <Camera className="h-4 w-4" /> : null}{title}</button></form>;
}
