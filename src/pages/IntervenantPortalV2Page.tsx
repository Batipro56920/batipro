import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
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
  Search,
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
type FeedbackTone = "neutral" | "blue" | "green" | "amber" | "red";
type TaskItem = { chantier: IntervenantChantier; task: IntervenantTask };
type SiteData = {
  tasks: IntervenantTask[];
  documents: IntervenantDocument[];
  timeEntries: IntervenantTimeEntry[];
  feedbacks: IntervenantTerrainFeedback[];
  reserves: IntervenantReserve[];
  infoRequests: IntervenantInformationRequest[];
  consignes: IntervenantConsigne[];
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
const HIDDEN_DOC_WORDS = ["devis", "facture", "doe", "administratif"];
const PLAN_DOC_WORDS = ["plan", "croquis", "photo technique"];

function todayIsoDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatHours(value: number | null | undefined): string {
  const numberValue = Number(value ?? 0);
  return `${Number.isFinite(numberValue) ? Math.round(numberValue * 100) / 100 : 0} h`;
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
  return status === "EN_COURS" || task.quality_status === "en_cours" ? "En cours" : "A faire";
}

function taskStatusTone(task: IntervenantTask): FeedbackTone {
  if (isTaskDone(task)) return "green";
  if (task.quality_status === "a_reprendre") return "red";
  const status = String(task.status ?? "").toUpperCase();
  return status === "EN_COURS" || task.quality_status === "en_cours" ? "blue" : "amber";
}

function taskSort(a: IntervenantTask, b: IntervenantTask): number {
  const doneDelta = Number(isTaskDone(a)) - Number(isTaskDone(b));
  if (doneDelta !== 0) return doneDelta;
  const aDate = taskDate(a);
  const bDate = taskDate(b);
  const aTime = aDate ? Date.parse(`${aDate}T00:00:00`) : Number.MAX_SAFE_INTEGER;
  const bTime = bDate ? Date.parse(`${bDate}T00:00:00`) : Number.MAX_SAFE_INTEGER;
  return aTime - bTime || a.order_index - b.order_index || a.titre.localeCompare(b.titre, "fr");
}

function documentText(document: IntervenantDocument): string {
  return [document.title, document.file_name, document.category, document.document_type].filter(Boolean).join(" ").toLowerCase();
}

function hasAnyWord(value: string, words: string[]): boolean {
  return words.some((word) => value.includes(word));
}

function isVisibleFieldDocument(document: IntervenantDocument): boolean {
  return !hasAnyWord(documentText(document), HIDDEN_DOC_WORDS);
}

function isPlanDocument(document: IntervenantDocument): boolean {
  return isVisibleFieldDocument(document) && hasAnyWord(documentText(document), PLAN_DOC_WORDS);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return String((error as { message?: string } | null)?.message ?? fallback).trim() || fallback;
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: FeedbackTone }) {
  const tones: Record<FeedbackTone, string> = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[1rem] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ${className}`}>{children}</section>;
}

const inputClass = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

export default function IntervenantPortalV2Page() {
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
  const [allTasksBySite, setAllTasksBySite] = useState<Record<string, IntervenantTask[]>>({});
  const [reloadTick, setReloadTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTask, setActiveTask] = useState<IntervenantTask | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("infos");
  const [savingAction, setSavingAction] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [timeHours, setTimeHours] = useState("");
  const [timeComment, setTimeComment] = useState("");
  const [remarkText, setRemarkText] = useState("");
  const [signalType, setSignalType] = useState<"blocage" | "materiel" | "materiaux" | "information">("blocage");
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
        if (!alive) return;
        setToken("");
        setBootError("Colle ton lien d'acces intervenant pour ouvrir le portail.");
        setBootLoading(false);
        return;
      }
      try {
        setToken(candidateToken);
        if (legacyToken) persistIntervenantToken(legacyToken);
        else clearStoredIntervenantToken();
        const [sessionData, chantierRows] = await Promise.all([intervenantSession(candidateToken), intervenantGetChantiers(candidateToken)]);
        if (!alive) return;
        const ids = new Set(chantierRows.map((chantier) => chantier.id));
        const storedChantierId = readStoredIntervenantChantierId();
        const nextChantierId =
          (queryChantierId && ids.has(queryChantierId) ? queryChantierId : "") ||
          (storedChantierId && ids.has(storedChantierId) ? storedChantierId : "") ||
          sessionData.default_chantier_id ||
          sessionData.chantier_id ||
          chantierRows[0]?.id ||
          "";
        setSessionInfo(sessionData);
        setChantiers(chantierRows);
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
    async function loadAllTasks() {
      const results = await Promise.allSettled(chantiers.map(async (chantier) => ({ chantier, tasks: await intervenantGetTasks(token, chantier.id) })));
      if (!alive) return;
      const next: Record<string, IntervenantTask[]> = {};
      results.forEach((result) => {
        if (result.status === "fulfilled") next[result.value.chantier.id] = result.value.tasks.sort(taskSort);
      });
      setAllTasksBySite(next);
    }
    void loadAllTasks();
    return () => { alive = false; };
  }, [bootError, bootLoading, chantiers, reloadTick, token]);

  useEffect(() => {
    if (!token || !selectedChantierId || bootLoading || bootError) return;
    let alive = true;
    async function loadSite() {
      setSiteLoading(true);
      setSiteError(null);
      const results = await Promise.allSettled([
        intervenantGetTasks(token, selectedChantierId),
        intervenantGetDocuments(token, selectedChantierId),
        intervenantTimeList(token, selectedChantierId),
        intervenantTerrainFeedbackList(token, selectedChantierId),
        intervenantReserveList(token, selectedChantierId),
        intervenantInformationRequestList(token, selectedChantierId),
        intervenantConsigneList(token, selectedChantierId),
      ]);
      if (!alive) return;
      setSiteData({
        tasks: results[0].status === "fulfilled" ? results[0].value.sort(taskSort) : [],
        documents: results[1].status === "fulfilled" ? results[1].value : [],
        timeEntries: results[2].status === "fulfilled" ? results[2].value : [],
        feedbacks: results[3].status === "fulfilled" ? results[3].value : [],
        reserves: results[4].status === "fulfilled" ? results[4].value : [],
        infoRequests: results[5].status === "fulfilled" ? results[5].value : [],
        consignes: results[6].status === "fulfilled" ? results[6].value : [],
      });
      const failed = results.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
      setSiteError(failed ? getErrorMessage(failed.reason, "Certaines donnees chantier n'ont pas pu etre chargees.") : null);
      setSiteLoading(false);
    }
    void loadSite();
    return () => { alive = false; };
  }, [bootError, bootLoading, reloadTick, selectedChantierId, token]);

  const selectedChantier = useMemo(() => chantiers.find((chantier) => chantier.id === selectedChantierId) ?? chantiers[0] ?? null, [chantiers, selectedChantierId]);
  const allTaskItems = useMemo<TaskItem[]>(() => chantiers.flatMap((chantier) => (allTasksBySite[chantier.id] ?? []).map((task) => ({ chantier, task }))), [allTasksBySite, chantiers]);
  const todayTasks = useMemo(() => allTaskItems.filter((item) => taskDate(item.task) === today && !isTaskDone(item.task)).sort((a, b) => taskSort(a.task, b.task)), [allTaskItems, today]);
  const weekTasks = useMemo(() => allTaskItems.filter((item) => { const date = taskDate(item.task); return !!date && date > today && date <= weekEnd && !isTaskDone(item.task); }).sort((a, b) => taskSort(a.task, b.task)), [allTaskItems, today, weekEnd]);
  const laterTasks = useMemo(() => allTaskItems.filter((item) => { const date = taskDate(item.task); return (!date || date > weekEnd) && !isTaskDone(item.task); }).sort((a, b) => taskSort(a.task, b.task)), [allTaskItems, weekEnd]);
  const doneTasks = useMemo(() => siteData.tasks.filter(isTaskDone), [siteData.tasks]);
  const siteTodoTasks = useMemo(() => siteData.tasks.filter((task) => !isTaskDone(task)), [siteData.tasks]);
  const todayHours = useMemo(() => siteData.timeEntries.filter((entry) => entry.work_date === today).reduce((sum, entry) => sum + Number(entry.duration_hours ?? 0), 0), [siteData.timeEntries, today]);
  const planDocuments = useMemo(() => siteData.documents.filter(isPlanDocument), [siteData.documents]);
  const usefulDocuments = useMemo(() => siteData.documents.filter((document) => isVisibleFieldDocument(document) && !isPlanDocument(document)), [siteData.documents]);
  const alerts = useMemo(() => [
    ...siteData.feedbacks.filter((feedback) => feedback.status !== "traite" && ["blocage", "anomalie"].includes(feedback.category)).map((feedback) => ({ id: feedback.id, title: feedback.title, meta: "Retour terrain", tone: "red" as FeedbackTone })),
    ...siteData.reserves.filter((reserve) => reserve.status !== "LEVEE").map((reserve) => ({ id: reserve.id, title: reserve.title, meta: "Reserve active", tone: reserve.priority === "URGENTE" ? "red" as FeedbackTone : "amber" as FeedbackTone })),
    ...siteData.infoRequests.filter((request) => request.status !== "traitee").map((request) => ({ id: request.id, title: request.subject, meta: "Information demandee", tone: "amber" as FeedbackTone })),
  ].slice(0, 6), [siteData.feedbacks, siteData.infoRequests, siteData.reserves]);
  const mainConstraint = alerts[0]?.title ?? siteData.consignes.find((consigne) => consigne.priority !== "normale")?.title ?? "Aucune contrainte critique";
  const filteredChantiers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return chantiers;
    return chantiers.filter((chantier) => [chantier.nom, chantier.adresse, chantier.client].filter(Boolean).join(" ").toLowerCase().includes(query));
  }, [chantiers, searchQuery]);

  function selectChantier(chantierId: string) {
    setSelectedChantierId(chantierId);
    persistIntervenantChantierId(chantierId);
    setActiveTab("chantiers");
  }

  function openTask(task: IntervenantTask) {
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
    if (!nextToken) return setBootError("Lien d'acces invalide.");
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
    if (!Number.isFinite(hours) || hours <= 0) return setActionMessage("Saisis une duree valide.");
    void runTaskAction(() => intervenantTimeCreate(token, { chantier_id: activeTask.chantier_id, task_id: activeTask.id, work_date: todayIsoDate(), duration_hours: hours, note: timeComment.trim() || null }), "Temps ajoute.");
    setTimeHours("");
    setTimeComment("");
  }

  function submitRemark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeTask || !remarkText.trim()) return;
    void runTaskAction(() => intervenantTerrainFeedbackCreate(token, { chantier_id: activeTask.chantier_id, category: "observation_chantier", urgency: "normale", title: `Remarque - ${activeTask.titre}`, description: remarkText.trim() }).then(() => undefined), "Remarque envoyee.");
    setRemarkText("");
  }

  function submitSignal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeTask) return;
    const comment = signalComment.trim();
    const action = signalType === "materiel" || signalType === "materiaux"
      ? () => intervenantMaterielCreate(token, { chantier_id: activeTask.chantier_id, task_id: activeTask.id, titre: signalType === "materiaux" ? `Manque materiaux - ${activeTask.titre}` : `Manque materiel - ${activeTask.titre}`, commentaire: comment || null })
      : signalType === "information"
        ? () => intervenantInformationRequestCreate(token, { chantier_id: activeTask.chantier_id, request_date: todayIsoDate(), subject: `Information manquante - ${activeTask.titre}`, message: comment || "Information manquante pour avancer." }).then(() => undefined)
        : () => intervenantTerrainFeedbackCreate(token, { chantier_id: activeTask.chantier_id, category: "blocage", urgency: "urgente", title: `Blocage - ${activeTask.titre}`, description: comment || "Blocage signale depuis le portail terrain." }).then(() => undefined);
    void runTaskAction(action, "Signalement envoye.");
    setSignalComment("");
  }

  function submitPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeTask || !photoFile) return;
    const file = photoFile;
    void runTaskAction(async () => {
      const feedback = await intervenantTerrainFeedbackCreate(token, { chantier_id: activeTask.chantier_id, category: "observation_chantier", urgency: "normale", title: `Photo - ${activeTask.titre}`, description: "Photo ajoutee depuis le portail terrain." });
      await intervenantTerrainFeedbackUploadPhoto(token, { chantier_id: activeTask.chantier_id, feedback_id: feedback.id, file });
    }, "Photo ajoutee.");
    setPhotoFile(null);
  }

  function completeTask() {
    if (!token || !activeTask) return;
    void runTaskAction(() => intervenantUpdateTaskStatus(token, activeTask.id, "FAIT"), "Tache marquee terminee.");
  }

  if (bootLoading) return <FullPageMessage text="Chargement du portail terrain..." loading />;
  if (bootError && !token) return <AccessForm error={bootError} value={accessLinkInput} onChange={setAccessLinkInput} onSubmit={submitAccessLink} />;

  return (
    <div className="min-h-dvh bg-slate-50 pb-[calc(5rem+var(--safe-bottom))] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Portail terrain</div>
            <h1 className="truncate text-lg font-semibold text-slate-950">{sessionInfo?.intervenant.nom || "Intervenant"}</h1>
          </div>
          <button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600" onClick={logoutIntervenant} type="button" aria-label="Se deconnecter"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4">
        {siteError ? <div className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{siteError}</div> : null}
        {activeTab === "accueil" ? <HomeView selectedChantier={todayTasks[0]?.chantier ?? selectedChantier} tasks={todayTasks} todayHours={todayHours} mainConstraint={mainConstraint} alerts={alerts} onOpenTask={openTask} /> : null}
        {activeTab === "chantiers" ? <SitesView chantiers={filteredChantiers} selectedChantier={selectedChantier} siteLoading={siteLoading} query={searchQuery} setQuery={setSearchQuery} selectChantier={selectChantier} tasks={siteTodoTasks} doneTasks={doneTasks} consignes={siteData.consignes} documents={siteData.documents} planDocuments={planDocuments} usefulDocuments={usefulDocuments} feedbacks={siteData.feedbacks} reserves={siteData.reserves} allTasksBySite={allTasksBySite} onOpenTask={openTask} /> : null}
        {activeTab === "taches" ? <TasksView todayTasks={todayTasks} weekTasks={weekTasks} laterTasks={laterTasks} onOpenTask={openTask} /> : null}
        {activeTab === "temps" ? <TimeView tasks={[...todayTasks, ...(selectedChantier ? siteTodoTasks.map((task) => ({ chantier: selectedChantier, task })) : [])].filter((item, index, rows) => rows.findIndex((row) => row.task.id === item.task.id) === index)} entries={siteData.timeEntries} onOpenTask={openTask} /> : null}
        {activeTab === "retours" ? <FeedbacksView feedbacks={siteData.feedbacks} reserves={siteData.reserves} requests={siteData.infoRequests} /> : null}
      </main>
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      {activeTask ? <TaskDrawer task={activeTask} chantier={chantiers.find((chantier) => chantier.id === activeTask.chantier_id) ?? selectedChantier} documents={siteData.documents.filter(isVisibleFieldDocument)} entries={siteData.timeEntries.filter((entry) => entry.task_id === activeTask.id)} drawerTab={drawerTab} setDrawerTab={setDrawerTab} close={() => setActiveTask(null)} saving={savingAction} actionMessage={actionMessage} timeHours={timeHours} setTimeHours={setTimeHours} timeComment={timeComment} setTimeComment={setTimeComment} submitTime={submitTime} remarkText={remarkText} setRemarkText={setRemarkText} submitRemark={submitRemark} signalType={signalType} setSignalType={setSignalType} signalComment={signalComment} setSignalComment={setSignalComment} submitSignal={submitSignal} photoFile={photoFile} setPhotoFile={setPhotoFile} submitPhoto={submitPhoto} completeTask={completeTask} /> : null}
    </div>
  );
}

function FullPageMessage({ loading = false, text }: { loading?: boolean; text: string }) {
  return <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4"><Card className="flex w-full max-w-md items-center justify-center gap-3 text-center text-sm font-semibold text-slate-700">{loading ? <Loader2 className="h-5 w-5 animate-spin text-blue-700" /> : null}{text}</Card></div>;
}

function AccessForm({ error, onChange, onSubmit, value }: { error: string; onChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; value: string }) {
  return <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4"><Card className="w-full max-w-md"><h1 className="text-lg font-semibold text-slate-950">Portail employe Batipro</h1><p className="mt-2 text-sm text-slate-500">{error}</p><form className="mt-5 space-y-3" onSubmit={onSubmit}><input className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Coller le lien recu" /><button className="w-full rounded-2xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white" type="submit">Ouvrir le portail</button></form></Card></div>;
}

function HomeView({ alerts, mainConstraint, onOpenTask, selectedChantier, tasks, todayHours }: { alerts: Array<{ id: string; title: string; meta: string; tone: FeedbackTone }>; mainConstraint: string; onOpenTask: (task: IntervenantTask) => void; selectedChantier: IntervenantChantier | null; tasks: TaskItem[]; todayHours: number }) {
  return <><Card className="bg-gradient-to-br from-blue-50 via-white to-slate-50"><div className="grid gap-3 sm:grid-cols-4"><Metric title="Chantier" value={selectedChantier?.nom ?? "Aucun"} icon={<Building2 className="h-4 w-4" />} /><Metric title="Taches" value={String(tasks.length)} icon={<ListChecks className="h-4 w-4" />} /><Metric title="Temps" value={formatHours(todayHours)} icon={<Clock3 className="h-4 w-4" />} /><Metric title="Contrainte" value={mainConstraint} icon={<AlertTriangle className="h-4 w-4" />} /></div></Card><Card><SectionTitle title="Taches du jour" subtitle="Titre, chantier, zone, contrainte, temps prevu et statut." /> <TaskList items={tasks} empty="Aucune tache planifiee aujourd'hui." onOpenTask={onOpenTask} /></Card><Card><SectionTitle title="Alertes utiles" subtitle="Blocages, attentes, documents importants ou manques." /><div className="mt-4 space-y-2">{alerts.length ? alerts.map((alert) => <div key={alert.id} className="rounded-[1rem] border border-slate-200 bg-slate-50/80 px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold text-slate-950">{alert.title}</div><div className="mt-1 text-xs text-slate-500">{alert.meta}</div></div><Badge tone={alert.tone}>A voir</Badge></div></div>) : <Empty>Aucune alerte active.</Empty>}</div></Card></>;
}

function SitesView({ allTasksBySite, chantiers, consignes, documents, doneTasks, feedbacks, onOpenTask, planDocuments, query, reserves, selectChantier, selectedChantier, setQuery, siteLoading, tasks, usefulDocuments }: { allTasksBySite: Record<string, IntervenantTask[]>; chantiers: IntervenantChantier[]; consignes: IntervenantConsigne[]; documents: IntervenantDocument[]; doneTasks: IntervenantTask[]; feedbacks: IntervenantTerrainFeedback[]; onOpenTask: (task: IntervenantTask) => void; planDocuments: IntervenantDocument[]; query: string; reserves: IntervenantReserve[]; selectChantier: (id: string) => void; selectedChantier: IntervenantChantier | null; setQuery: (value: string) => void; siteLoading: boolean; tasks: IntervenantTask[]; usefulDocuments: IntervenantDocument[] }) {
  return <><Card><div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"><Search className="h-4 w-4 text-slate-400" /><input className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un chantier" /></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{chantiers.map((chantier) => { const rows = allTasksBySite[chantier.id] ?? []; const done = rows.filter(isTaskDone).length; const percent = rows.length ? Math.round((done / rows.length) * 100) : Math.round(chantier.avancement ?? 0); return <button key={chantier.id} type="button" onClick={() => selectChantier(chantier.id)} className={`rounded-[1rem] border p-4 text-left ${selectedChantier?.id === chantier.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}><div className="text-sm font-semibold text-slate-950">{chantier.nom}</div><div className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{chantier.adresse ?? "Adresse non renseignee"}</div><div className="mt-3 flex flex-wrap gap-2"><Badge tone="blue">{chantier.status ?? "Statut non renseigne"}</Badge><Badge>{Math.max(0, rows.length - done)} taches restantes</Badge></div><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-700" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div></button>; })}</div></Card>{selectedChantier ? <Card><SectionTitle title={selectedChantier.nom} subtitle="Detail chantier alimente par les donnees admin visibles." />{siteLoading ? <p className="mt-3 text-sm text-slate-500">Chargement du chantier...</p> : null}<div className="mt-4 grid gap-3 sm:grid-cols-2"><InfoLine label="Adresse" value={selectedChantier.adresse ?? "-"} /><InfoLine label="Statut" value={selectedChantier.status ?? "-"} /><InfoLine label="Responsables" value={selectedChantier.client ?? "Non renseigne"} /><InfoLine label="Contraintes acces" value={consignes[0]?.description ?? "Aucune contrainte visible"} /></div><Block title="Consignes" empty="Aucune consigne visible.">{consignes.slice(0, 4).map((consigne) => <NoteRow key={consigne.id} title={consigne.title} text={consigne.description} tone={consigne.priority === "urgente" ? "red" : consigne.priority === "importante" ? "amber" : "neutral"} />)}</Block><Block title="Taches chantier" empty="Aucune tache visible."><SmallTaskGroup title="Aujourd'hui" tasks={tasks.filter((task) => taskDate(task) === todayIsoDate())} chantier={selectedChantier} onOpenTask={onOpenTask} /><SmallTaskGroup title="Cette semaine" tasks={tasks.filter((task) => { const date = taskDate(task); return !!date && date >= todayIsoDate() && date <= addDaysIso(todayIsoDate(), 6); })} chantier={selectedChantier} onOpenTask={onOpenTask} /><SmallTaskGroup title="Terminees" tasks={doneTasks.slice(0, 5)} chantier={selectedChantier} onOpenTask={onOpenTask} /></Block><DocumentBlock title="Plans chantier" documents={planDocuments} empty="Aucun plan, croquis ou photo technique visible." /><DocumentBlock title="Documents utiles" documents={usefulDocuments} empty="Aucun document technique visible." /><Block title="Retours terrain recents" empty="Aucun retour recent.">{[...feedbacks.map((feedback) => ({ id: feedback.id, title: feedback.title, text: feedback.description })), ...reserves.map((reserve) => ({ id: reserve.id, title: reserve.title, text: reserve.description ?? "" }))].slice(0, 5).map((row) => <NoteRow key={row.id} title={row.title} text={row.text} tone="blue" />)}</Block>{documents.length === 0 && !siteLoading ? <Empty>Aucun document visible pour ce chantier.</Empty> : null}</Card> : null}</>;
}

function TasksView({ laterTasks, onOpenTask, todayTasks, weekTasks }: { laterTasks: TaskItem[]; onOpenTask: (task: IntervenantTask) => void; todayTasks: TaskItem[]; weekTasks: TaskItem[] }) {
  return <Card><SectionTitle title="Taches" subtitle="Aujourd'hui, cette semaine, puis plus tard, regroupe par chantier." /><TaskPeriod title="Aujourd'hui" items={todayTasks} onOpenTask={onOpenTask} /><TaskPeriod title="Cette semaine" items={weekTasks} onOpenTask={onOpenTask} /><TaskPeriod title="Plus tard" items={laterTasks} onOpenTask={onOpenTask} /></Card>;
}

function TimeView({ entries, onOpenTask, tasks }: { entries: IntervenantTimeEntry[]; onOpenTask: (task: IntervenantTask) => void; tasks: TaskItem[] }) {
  return <Card><SectionTitle title="Temps" subtitle="Ajouter du temps par tache. Pas de pointage." /><div className="mt-4 space-y-3">{tasks.length ? tasks.slice(0, 14).map((item) => { const taskEntries = entries.filter((entry) => entry.task_id === item.task.id); const total = taskEntries.reduce((sum, entry) => sum + Number(entry.duration_hours ?? 0), 0); return <button key={item.task.id} type="button" onClick={() => onOpenTask(item.task)} className="w-full rounded-[1rem] border border-slate-200 bg-slate-50/80 px-4 py-3 text-left"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold text-slate-950">{item.task.titre}</div><div className="mt-1 text-xs text-slate-500">{item.chantier.nom}</div></div><Plus className="h-4 w-4 text-blue-700" /></div><div className="mt-3 grid grid-cols-3 gap-2"><InfoLine label="Prevu" value={formatHours(item.task.temps_prevu_h)} /><InfoLine label="Cumule" value={formatHours(total || item.task.temps_reel_h)} /><InfoLine label="Saisies" value={String(taskEntries.length)} /></div></button>; }) : <Empty>Aucune tache disponible.</Empty>}</div></Card>;
}

function FeedbacksView({ feedbacks, requests, reserves }: { feedbacks: IntervenantTerrainFeedback[]; requests: IntervenantInformationRequest[]; reserves: IntervenantReserve[] }) {
  return <Card><SectionTitle title="Retours" subtitle="Remarques, blocages, photos, reserves et demandes d'information." /><div className="mt-4 space-y-3">{feedbacks.map((feedback) => <NoteRow key={feedback.id} title={feedback.title} text={feedback.description} tone={feedback.urgency === "urgente" || feedback.urgency === "critique" ? "red" : "blue"} />)}{reserves.map((reserve) => <NoteRow key={reserve.id} title={reserve.title} text={reserve.description ?? reserve.status} tone={reserve.priority === "URGENTE" ? "red" : "amber"} />)}{requests.map((request) => <NoteRow key={request.id} title={request.subject} text={request.message} tone="blue" />)}{feedbacks.length + reserves.length + requests.length === 0 ? <Empty>Aucun retour terrain.</Empty> : null}</div></Card>;
}

function TaskDrawer({ actionMessage, chantier, close, completeTask, documents, drawerTab, entries, photoFile, remarkText, saving, setDrawerTab, setPhotoFile, setRemarkText, setSignalComment, setSignalType, setTimeComment, setTimeHours, signalComment, signalType, submitPhoto, submitRemark, submitSignal, submitTime, task, timeComment, timeHours }: { actionMessage: string | null; chantier: IntervenantChantier | null; close: () => void; completeTask: () => void; documents: IntervenantDocument[]; drawerTab: DrawerTab; entries: IntervenantTimeEntry[]; photoFile: File | null; remarkText: string; saving: boolean; setDrawerTab: (tab: DrawerTab) => void; setPhotoFile: (file: File | null) => void; setRemarkText: (value: string) => void; setSignalComment: (value: string) => void; setSignalType: (value: "blocage" | "materiel" | "materiaux" | "information") => void; setTimeComment: (value: string) => void; setTimeHours: (value: string) => void; signalComment: string; signalType: "blocage" | "materiel" | "materiaux" | "information"; submitPhoto: (event: FormEvent<HTMLFormElement>) => void; submitRemark: (event: FormEvent<HTMLFormElement>) => void; submitSignal: (event: FormEvent<HTMLFormElement>) => void; submitTime: (event: FormEvent<HTMLFormElement>) => void; task: IntervenantTask; timeComment: string; timeHours: string }) {
  const totalTime = entries.reduce((sum, entry) => sum + Number(entry.duration_hours ?? 0), 0);
  return <div className="fixed inset-0 z-50 bg-slate-950/35"><div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-hidden rounded-t-[1.25rem] bg-white shadow-[0_-20px_60px_rgba(15,23,42,0.24)] sm:left-auto sm:right-4 sm:top-4 sm:h-[calc(100dvh-2rem)] sm:w-[440px] sm:rounded-[1.25rem]"><div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4"><div className="min-w-0"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">{chantier?.nom ?? "Chantier"}</div><h2 className="mt-1 text-base font-semibold text-slate-950">{task.titre}</h2></div><button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500" type="button" onClick={close}><X className="h-4 w-4" /></button></div><div className="flex gap-2 border-b border-slate-200 px-4 py-3"><button className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${drawerTab === "infos" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"}`} type="button" onClick={() => setDrawerTab("infos")}>Informations</button><button className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${drawerTab === "actions" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"}`} type="button" onClick={() => setDrawerTab("actions")}>Actions terrain</button></div><div className="h-[calc(92dvh-9rem)] overflow-y-auto px-4 py-4 sm:h-[calc(100dvh-11rem)]">{drawerTab === "infos" ? <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><InfoLine label="Chantier" value={chantier?.nom ?? "-"} /><InfoLine label="Zone" value={task.zone_nom ?? "-"} /><InfoLine label="Lot" value={task.lot ?? task.corps_etat ?? "-"} /><InfoLine label="Statut" value={taskStatusLabel(task)} /><InfoLine label="Quantite" value={task.quantite === null ? "-" : `${task.quantite} ${task.unite ?? ""}`} /><InfoLine label="Realise" value={task.quantite_realisee === null ? "-" : `${task.quantite_realisee} ${task.unite ?? ""}`} /><InfoLine label="Temps prevu" value={formatHours(task.temps_prevu_h)} /><InfoLine label="Temps passe" value={formatHours(totalTime || task.temps_reel_h)} /></div><InfoLine label="Contraintes" value={task.reprise_reason ?? task.etape_metier ?? "Aucune contrainte visible"} /><InfoLine label="Dependances" value={task.date_debut || task.date_fin ? `${formatDate(task.date_debut)} -> ${formatDate(task.date_fin)}` : "Non renseignees"} /><DocumentBlock title="Documents lies" documents={documents} empty="Aucun document visible." /></div> : <div className="space-y-4">{actionMessage ? <div className="rounded-[1rem] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{actionMessage}</div> : null}<ActionForm title="Ajouter temps" onSubmit={submitTime} saving={saving}><input className={inputClass} inputMode="decimal" value={timeHours} onChange={(event) => setTimeHours(event.target.value)} placeholder="Duree ex : 1,5" /><textarea className={inputClass} value={timeComment} onChange={(event) => setTimeComment(event.target.value)} rows={2} placeholder="Commentaire optionnel" /></ActionForm><ActionForm title="Ajouter photo" onSubmit={submitPhoto} saving={saving} disabled={!photoFile}><input className={inputClass} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} /></ActionForm><ActionForm title="Ajouter remarque" onSubmit={submitRemark} saving={saving} disabled={!remarkText.trim()}><textarea className={inputClass} value={remarkText} onChange={(event) => setRemarkText(event.target.value)} rows={3} placeholder="Remarque terrain" /></ActionForm><ActionForm title="Signaler" onSubmit={submitSignal} saving={saving}><select className={inputClass} value={signalType} onChange={(event) => setSignalType(event.target.value as "blocage" | "materiel" | "materiaux" | "information")}><option value="blocage">Blocage</option><option value="materiel">Manque materiel</option><option value="materiaux">Manque materiaux</option><option value="information">Manque information</option></select><textarea className={inputClass} value={signalComment} onChange={(event) => setSignalComment(event.target.value)} rows={3} placeholder="Precision utile pour l'admin" /></ActionForm><button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" type="button" onClick={completeTask} disabled={saving}><CheckCircle2 className="h-4 w-4" />Marquer terminee</button></div>}</div></div></div>;
}

function BottomNav({ activeTab, setActiveTab }: { activeTab: PortalTab; setActiveTab: (tab: PortalTab) => void }) {
  const tabs: Array<{ id: PortalTab; label: string; icon: React.ReactNode }> = [{ id: "accueil", label: "Accueil", icon: <Home className="h-5 w-5" /> }, { id: "chantiers", label: "Chantiers", icon: <Building2 className="h-5 w-5" /> }, { id: "taches", label: "Taches", icon: <ListChecks className="h-5 w-5" /> }, { id: "temps", label: "Temps", icon: <Clock3 className="h-5 w-5" /> }, { id: "retours", label: "Retours", icon: <MessageSquareWarning className="h-5 w-5" /> }];
  return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[var(--safe-bottom)] pt-2 backdrop-blur"><div className="mx-auto grid max-w-5xl grid-cols-5 gap-1">{tabs.map((tab) => <button key={tab.id} className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold ${activeTab === tab.id ? "bg-blue-700 text-white" : "text-slate-500"}`} type="button" onClick={() => setActiveTab(tab.id)}>{tab.icon}<span className="truncate">{tab.label}</span></button>)}</div></nav>;
}

function SectionTitle({ subtitle, title }: { subtitle?: string; title: string }) { return <div><h2 className="text-base font-semibold text-slate-950">{title}</h2>{subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}</div>; }
function Empty({ children }: { children: React.ReactNode }) { return <div className="rounded-[1rem] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-500">{children}</div>; }
function Metric({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) { return <div className="rounded-[1rem] border border-slate-200 bg-white/80 p-3"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{icon}{title}</div><div className="mt-2 line-clamp-2 text-sm font-semibold text-slate-950">{value}</div></div>; }
function InfoLine({ label, value }: { label: string; value: string }) { return <div className="rounded-[1rem] border border-slate-200 bg-slate-50/80 px-3 py-2"><div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div><div className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</div></div>; }
function NoteRow({ text, title, tone }: { text: string; title: string; tone: FeedbackTone }) { return <div className="rounded-[1rem] border border-slate-200 bg-slate-50/80 px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold text-slate-950">{title}</div>{text ? <p className="mt-1 text-sm text-slate-600">{text}</p> : null}</div><Badge tone={tone}>Suivi</Badge></div></div>; }
function Block({ children, empty, title }: { children: React.ReactNode; empty: string; title: string }) { const hasChildren = Array.isArray(children) ? children.some(Boolean) : Boolean(children); return <div className="mt-5 space-y-3"><div className="text-sm font-semibold text-slate-950">{title}</div>{hasChildren ? children : <Empty>{empty}</Empty>}</div>; }
function DocumentBlock({ documents, empty, title }: { documents: IntervenantDocument[]; empty: string; title: string }) { return <Block title={title} empty={empty}>{documents.slice(0, 8).map((document) => <div key={document.id} className="flex items-start gap-3 rounded-[1rem] border border-slate-200 bg-slate-50/80 px-4 py-3"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" /><div><div className="text-sm font-semibold text-slate-950">{document.title ?? document.file_name ?? "Document"}</div><div className="mt-1 text-xs text-slate-500">{[document.category, document.document_type].filter(Boolean).join(" - ") || "Document chantier"}</div></div></div>)}</Block>; }
function TaskList({ empty, items, onOpenTask }: { empty: string; items: TaskItem[]; onOpenTask: (task: IntervenantTask) => void }) { return <div className="mt-4 space-y-3">{items.length ? items.map((item) => <TaskCard key={item.task.id} item={item} onOpenTask={onOpenTask} />) : <Empty>{empty}</Empty>}</div>; }
function TaskCard({ item, onOpenTask }: { item: TaskItem; onOpenTask: (task: IntervenantTask) => void }) { return <button className="w-full rounded-[1rem] border border-slate-200 bg-slate-50/80 px-4 py-3 text-left" type="button" onClick={() => onOpenTask(item.task)}><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold text-slate-950">{item.task.titre}</div><div className="mt-1 text-xs text-slate-500">{item.chantier.nom}</div></div><Badge tone={taskStatusTone(item.task)}>{taskStatusLabel(item.task)}</Badge></div><div className="mt-3 grid gap-2 text-xs sm:grid-cols-4"><InfoLine label="Zone" value={item.task.zone_nom ?? "-"} /><InfoLine label="Lot" value={item.task.lot ?? item.task.corps_etat ?? "-"} /><InfoLine label="Prevu" value={formatHours(item.task.temps_prevu_h)} /><InfoLine label="Date" value={formatDate(taskDate(item.task))} /></div></button>; }
function SmallTaskGroup({ chantier, onOpenTask, tasks, title }: { chantier: IntervenantChantier; onOpenTask: (task: IntervenantTask) => void; tasks: IntervenantTask[]; title: string }) { return tasks.length ? <div className="space-y-2"><div className="text-sm font-semibold text-slate-950">{title}</div>{tasks.map((task) => <TaskCard key={task.id} item={{ chantier, task }} onOpenTask={onOpenTask} />)}</div> : null; }
function TaskPeriod({ items, onOpenTask, title }: { items: TaskItem[]; onOpenTask: (task: IntervenantTask) => void; title: string }) { const groups = items.reduce<Record<string, TaskItem[]>>((acc, item) => ({ ...acc, [item.chantier.id]: [...(acc[item.chantier.id] ?? []), item] }), {}); return <div className="mt-5"><div className="text-sm font-semibold text-slate-950">{title}</div><div className="mt-3 space-y-3">{Object.values(groups).length ? Object.values(groups).map((group) => <div key={group[0].chantier.id} className="space-y-2"><div className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">{group[0].chantier.nom}</div>{group.map((item) => <TaskCard key={item.task.id} item={item} onOpenTask={onOpenTask} />)}</div>) : <Empty>Aucune tache.</Empty>}</div></div>; }
function ActionForm({ children, disabled = false, onSubmit, saving, title }: { children: React.ReactNode; disabled?: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean; title: string }) { return <form className="space-y-3 rounded-[1rem] border border-slate-200 bg-slate-50/80 p-4" onSubmit={onSubmit}><SectionTitle title={title} />{children}<button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={saving || disabled}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : title === "Ajouter photo" ? <Camera className="h-4 w-4" /> : null}{title}</button></form>; }
