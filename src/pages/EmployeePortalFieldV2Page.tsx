import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Building2, Camera, CheckCircle2, ChevronRight, Clock3, FileText, Home, ListChecks, Loader2, LogOut, MapPin, MessageSquare, PackageOpen, Send, X } from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import {
  intervenantConsigneList,
  intervenantGetChantiers,
  intervenantGetDocuments,
  intervenantGetTasks,
  intervenantInformationRequestCreate,
  intervenantInformationRequestList,
  intervenantMaterielCreate,
  intervenantMaterielList,
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
  type IntervenantMateriel,
  type IntervenantReserve,
  type IntervenantSessionInfo,
  type IntervenantTask,
  type IntervenantTerrainFeedback,
  type IntervenantTimeEntry,
} from "../services/intervenantPortal.service";
import { AUTH_SESSION_PORTAL_TOKEN, clearStoredIntervenantSession, clearStoredIntervenantToken, extractIntervenantToken, persistIntervenantChantierId, persistIntervenantToken, readStoredIntervenantChantierId, readStoredIntervenantToken } from "../utils/intervenantSession";

type PortalTab = "accueil" | "chantiers" | "taches" | "temps" | "retours";
type DrawerTab = "infos" | "actions";
type SignalKind = "blocage" | "materiel" | "materiaux" | "information";
type Tone = "neutral" | "blue" | "green" | "amber" | "red";

type SiteData = {
  tasks: IntervenantTask[];
  documents: IntervenantDocument[];
  timeEntries: IntervenantTimeEntry[];
  feedbacks: IntervenantTerrainFeedback[];
  reserves: IntervenantReserve[];
  informationRequests: IntervenantInformationRequest[];
  materiels: IntervenantMateriel[];
  consignes: IntervenantConsigne[];
};

type TaskContext = { chantier: IntervenantChantier; data: SiteData; task: IntervenantTask };
type AlertItem = { id: string; label: string; title: string; text: string; tone: Tone };
type TaskExtra = IntervenantTask & { description?: string | null; description_complete?: string | null; dependances?: string | null; remarques_admin?: string | null };

const EMPTY_SITE_DATA: SiteData = { tasks: [], documents: [], timeEntries: [], feedbacks: [], reserves: [], informationRequests: [], materiels: [], consignes: [] };
const ADMIN_DOCUMENT_WORDS = ["devis", "facture", "doe", "administratif", "comptable", "avoir", "contrat", "assurance"];
const PLAN_DOCUMENT_WORDS = ["plan", "plans", "croquis", "schema", "photo technique", "photo-technique"];
const USEFUL_DOCUMENT_WORDS = ["notice", "procedure", "technique", "fiche", "pose", "materiau", "materiaux", "securite", "mode operatoire"];
const OPEN_MATERIEL_STATUSES = new Set(["en_attente", "validee"]);
const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

function todayIsoDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function addDaysIso(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function normalize(value: unknown) {
  return String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function compact(...values: Array<string | number | null | undefined>) {
  return values.map((value) => String(value ?? "").trim()).filter(Boolean).join(" ");
}
function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
function formatHours(value: number | null | undefined) {
  const hours = Number(value ?? 0);
  return Number.isFinite(hours) && hours > 0 ? `${Math.round(hours * 100) / 100} h` : "0 h";
}
function parseHours(value: string) {
  const text = value.trim();
  if (!text || /[,.]$/.test(text) || /^-/.test(text)) return null;
  const normalized = text.includes(",") ? text.replace(/\s/g, "").replace(/\./g, "").replace(",", ".") : text.replace(/\s/g, "");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const hours = Number(normalized);
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}
function taskExtra(task: IntervenantTask): TaskExtra { return task as TaskExtra; }
function taskDate(task: IntervenantTask) { return task.date_debut ?? task.date ?? task.date_fin; }
function isTaskDone(task: IntervenantTask) {
  const status = String(task.status ?? "").toUpperCase();
  return ["FAIT", "TERMINE", "DONE", "COMPLETED"].includes(status) || ["termine_intervenant", "valide_admin"].includes(task.quality_status);
}
function taskStatusLabel(task: IntervenantTask) {
  if (isTaskDone(task)) return "Terminee";
  if (task.quality_status === "a_reprendre") return "A reprendre";
  if (String(task.status ?? "").toUpperCase() === "EN_COURS" || task.quality_status === "en_cours") return "En cours";
  return "A faire";
}
function taskTone(task: IntervenantTask): Tone {
  if (isTaskDone(task)) return "green";
  if (task.quality_status === "a_reprendre") return "red";
  if (String(task.status ?? "").toUpperCase() === "EN_COURS" || task.quality_status === "en_cours") return "blue";
  return "amber";
}
function taskConstraint(task: IntervenantTask, consignes: IntervenantConsigne[] = []) {
  const consigne = consignes.find((row) => row.task_id === task.id || (!!task.zone_id && row.zone_id === task.zone_id) || row.applies_to_all);
  return compact(task.contraintes, task.reprise_reason, consigne?.title, task.etape_metier) || "Aucune contrainte visible";
}
function taskDescription(task: IntervenantTask) {
  const extra = taskExtra(task);
  return compact(extra.description_complete, extra.description, task.description_technique, task.points_controle, task.etape_metier, task.titre);
}
function sortTasks(a: IntervenantTask, b: IntervenantTask) {
  const doneDelta = Number(isTaskDone(a)) - Number(isTaskDone(b));
  if (doneDelta !== 0) return doneDelta;
  const at = taskDate(a) ? Date.parse(`${taskDate(a)}T00:00:00`) : Number.MAX_SAFE_INTEGER;
  const bt = taskDate(b) ? Date.parse(`${taskDate(b)}T00:00:00`) : Number.MAX_SAFE_INTEGER;
  return at - bt || a.order_index - b.order_index || a.titre.localeCompare(b.titre, "fr");
}
function documentSearchText(document: IntervenantDocument) { return normalize(compact(document.title, document.file_name, document.category, document.document_type)); }
function includesAny(text: string, words: string[]) { return words.some((word) => text.includes(normalize(word))); }
function isFieldDocument(document: IntervenantDocument) { return !includesAny(documentSearchText(document), ADMIN_DOCUMENT_WORDS); }
function isPlanDocument(document: IntervenantDocument) { return isFieldDocument(document) && includesAny(documentSearchText(document), PLAN_DOCUMENT_WORDS); }
function isUsefulDocument(document: IntervenantDocument) {
  const text = documentSearchText(document);
  return isFieldDocument(document) && !isPlanDocument(document) && (includesAny(text, USEFUL_DOCUMENT_WORDS) || text.length > 0);
}
function taskDocuments(task: IntervenantTask, documents: IntervenantDocument[]) {
  const fieldDocuments = documents.filter(isFieldDocument);
  const words = normalize(compact(task.titre, task.zone_nom, task.lot, task.corps_etat)).split(/\s+/).filter((word) => word.length > 3);
  const matched = fieldDocuments.filter((document) => words.some((word) => documentSearchText(document).includes(word)));
  return matched.length ? matched : fieldDocuments;
}
function taskPhotoCount(task: IntervenantTask, feedbacks: IntervenantTerrainFeedback[]) {
  const title = normalize(task.titre);
  return feedbacks.filter((feedback) => normalize(`${feedback.title} ${feedback.description}`).includes(title)).reduce((sum, feedback) => sum + feedback.attachments.length, 0);
}
function taskTimeTotal(task: IntervenantTask, entries: IntervenantTimeEntry[]) {
  return entries.filter((entry) => entry.task_id === task.id).reduce((sum, entry) => sum + Number(entry.duration_hours ?? 0), 0);
}
function chantierProgress(data: SiteData, chantier: IntervenantChantier) {
  const explicit = Number(chantier.avancement ?? NaN);
  if (Number.isFinite(explicit)) return Math.max(0, Math.min(100, Math.round(explicit)));
  return data.tasks.length ? Math.round((data.tasks.filter(isTaskDone).length / data.tasks.length) * 100) : 0;
}
function splitTasks(items: TaskContext[], today: string, weekEnd: string) {
  const todayTasks = items.filter((item) => taskDate(item.task) === today && !isTaskDone(item.task)).sort((a, b) => sortTasks(a.task, b.task));
  const weekTasks = items.filter((item) => { const date = taskDate(item.task); return !!date && date > today && date <= weekEnd && !isTaskDone(item.task); }).sort((a, b) => sortTasks(a.task, b.task));
  const laterTasks = items.filter((item) => { const date = taskDate(item.task); return (!date || date > weekEnd) && !isTaskDone(item.task); }).sort((a, b) => sortTasks(a.task, b.task));
  return { todayTasks, weekTasks, laterTasks };
}
function errorMessage(error: unknown, fallback: string) { return String((error as { message?: string } | null)?.message ?? fallback).trim() || fallback; }
async function safeLoad<T>(loader: () => Promise<T>, fallback: T, label: string) {
  try { return { data: await loader(), error: null as string | null }; }
  catch (error) { return { data: fallback, error: errorMessage(error, label) }; }
}
async function loadSiteData(token: string, chantierId: string) {
  const [tasks, documents, timeEntries, feedbacks, reserves, informationRequests, materiels, consignes] = await Promise.all([
    safeLoad(() => intervenantGetTasks(token, chantierId), [] as IntervenantTask[], "Taches indisponibles."),
    safeLoad(() => intervenantGetDocuments(token, chantierId), [] as IntervenantDocument[], "Documents indisponibles."),
    safeLoad(() => intervenantTimeList(token, chantierId), [] as IntervenantTimeEntry[], "Temps indisponible."),
    safeLoad(() => intervenantTerrainFeedbackList(token, chantierId), [] as IntervenantTerrainFeedback[], "Retours indisponibles."),
    safeLoad(() => intervenantReserveList(token, chantierId), [] as IntervenantReserve[], "Reserves indisponibles."),
    safeLoad(() => intervenantInformationRequestList(token, chantierId), [] as IntervenantInformationRequest[], "Demandes indisponibles."),
    safeLoad(() => intervenantMaterielList(token, chantierId), [] as IntervenantMateriel[], "Materiel indisponible."),
    safeLoad(() => intervenantConsigneList(token, chantierId), [] as IntervenantConsigne[], "Consignes indisponibles."),
  ]);
  return {
    data: { tasks: tasks.data.sort(sortTasks), documents: documents.data, timeEntries: timeEntries.data, feedbacks: feedbacks.data, reserves: reserves.data, informationRequests: informationRequests.data, materiels: materiels.data, consignes: consignes.data },
    error: [tasks, documents, timeEntries, feedbacks, reserves, informationRequests, materiels, consignes].map((result) => result.error).find(Boolean) ?? null,
  };
}

export default function EmployeePortalFieldV2Page() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryToken = query.get("token")?.trim() ?? "";
  const queryChantierId = query.get("chantier_id")?.trim() ?? "";
  const today = useMemo(() => todayIsoDate(), []);
  const weekEnd = useMemo(() => addDaysIso(today, 6), [today]);

  const [token, setToken] = useState("");
  const [sessionInfo, setSessionInfo] = useState<IntervenantSessionInfo | null>(null);
  const [chantiers, setChantiers] = useState<IntervenantChantier[]>([]);
  const [dataByChantier, setDataByChantier] = useState<Record<string, SiteData>>({});
  const [selectedChantierId, setSelectedChantierId] = useState("");
  const [activeTab, setActiveTab] = useState<PortalTab>("accueil");
  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [accessLinkInput, setAccessLinkInput] = useState("");
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [activeTask, setActiveTask] = useState<IntervenantTask | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("infos");
  const [savingAction, setSavingAction] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [timeHours, setTimeHours] = useState("");
  const [timeComment, setTimeComment] = useState("");
  const [remarkText, setRemarkText] = useState("");
  const [signalKind, setSignalKind] = useState<SignalKind>("blocage");
  const [signalComment, setSignalComment] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    let alive = true;
    async function bootstrap() {
      setBootLoading(true);
      setBootError(null);
      const legacyToken = extractIntervenantToken(queryToken || readStoredIntervenantToken());
      const sessionResult = await supabase.auth.getSession();
      const candidateToken = legacyToken || (sessionResult.data.session?.user ? AUTH_SESSION_PORTAL_TOKEN : "");
      if (!candidateToken) {
        if (alive) { setToken(""); setBootError("Colle ton lien d'acces intervenant pour ouvrir le portail terrain."); setBootLoading(false); }
        return;
      }
      try {
        setToken(candidateToken);
        if (legacyToken) persistIntervenantToken(legacyToken); else clearStoredIntervenantToken();
        const [sessionData, chantierRows] = await Promise.all([intervenantSession(candidateToken), intervenantGetChantiers(candidateToken)]);
        if (!alive) return;
        const rows = chantierRows.length ? chantierRows : sessionData.chantiers;
        const ids = new Set(rows.map((chantier) => chantier.id));
        const storedChantierId = readStoredIntervenantChantierId();
        const nextChantierId = (queryChantierId && ids.has(queryChantierId) ? queryChantierId : "") || (storedChantierId && ids.has(storedChantierId) ? storedChantierId : "") || sessionData.default_chantier_id || sessionData.chantier_id || rows[0]?.id || "";
        setSessionInfo(sessionData);
        setChantiers(rows);
        setSelectedChantierId(nextChantierId);
        if (nextChantierId) persistIntervenantChantierId(nextChantierId);
        if (queryToken) navigate("/intervenant", { replace: true });
      } catch (error) {
        if (!alive) return;
        clearStoredIntervenantSession();
        setToken("");
        setBootError(errorMessage(error, "Portail terrain indisponible."));
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
    async function loadAllSites() {
      setDataLoading(true);
      setDataError(null);
      const results = await Promise.all(chantiers.map((chantier) => loadSiteData(token, chantier.id).then((result) => ({ chantier, result }))));
      if (!alive) return;
      const next: Record<string, SiteData> = {};
      const errors: string[] = [];
      results.forEach(({ chantier, result }) => { next[chantier.id] = result.data; if (result.error) errors.push(`${chantier.nom}: ${result.error}`); });
      setDataByChantier(next);
      setDataError(errors[0] ?? null);
      setDataLoading(false);
    }
    void loadAllSites();
    return () => { alive = false; };
  }, [bootError, bootLoading, chantiers, reloadTick, token]);

  const selectedChantier = useMemo(() => chantiers.find((chantier) => chantier.id === selectedChantierId) ?? chantiers[0] ?? null, [chantiers, selectedChantierId]);
  const selectedData = selectedChantier ? dataByChantier[selectedChantier.id] ?? EMPTY_SITE_DATA : EMPTY_SITE_DATA;
  const allTaskItems = useMemo<TaskContext[]>(() => chantiers.flatMap((chantier) => (dataByChantier[chantier.id]?.tasks ?? []).map((task) => ({ chantier, task, data: dataByChantier[chantier.id] ?? EMPTY_SITE_DATA }))), [chantiers, dataByChantier]);
  const { todayTasks, weekTasks, laterTasks } = useMemo(() => splitTasks(allTaskItems, today, weekEnd), [allTaskItems, today, weekEnd]);
  const currentTask = activeTask ? (dataByChantier[activeTask.chantier_id]?.tasks ?? []).find((task) => task.id === activeTask.id) ?? activeTask : null;
  const currentTaskData = currentTask ? dataByChantier[currentTask.chantier_id] ?? EMPTY_SITE_DATA : EMPTY_SITE_DATA;
  const currentTaskChantier = currentTask ? chantiers.find((chantier) => chantier.id === currentTask.chantier_id) ?? selectedChantier : selectedChantier;
  const todayHours = useMemo(() => Object.values(dataByChantier).flatMap((data) => data.timeEntries).filter((entry) => entry.work_date === today).reduce((sum, entry) => sum + Number(entry.duration_hours ?? 0), 0), [dataByChantier, today]);
  const selectedFieldDocuments = useMemo(() => selectedData.documents.filter(isFieldDocument), [selectedData.documents]);
  const planDocuments = useMemo(() => selectedFieldDocuments.filter(isPlanDocument), [selectedFieldDocuments]);
  const usefulDocuments = useMemo(() => selectedFieldDocuments.filter(isUsefulDocument), [selectedFieldDocuments]);
  const alerts = useMemo(() => buildAlerts(dataByChantier, selectedFieldDocuments), [dataByChantier, selectedFieldDocuments]);

  function selectChantier(chantierId: string) { setSelectedChantierId(chantierId); persistIntervenantChantierId(chantierId); setActiveTab("chantiers"); }
  function resetActionForm() { setActionMessage(null); setTimeHours(""); setTimeComment(""); setRemarkText(""); setSignalKind("blocage"); setSignalComment(""); setPhotoFile(null); }
  function openTask(task: IntervenantTask, tab: DrawerTab = "infos") { setSelectedChantierId(task.chantier_id); persistIntervenantChantierId(task.chantier_id); setActiveTask(task); setDrawerTab(tab); resetActionForm(); }
  async function logoutIntervenant() { const authSession = token === AUTH_SESSION_PORTAL_TOKEN; clearStoredIntervenantSession(); if (authSession) await supabase.auth.signOut().catch(() => undefined); navigate("/", { replace: true }); }
  function submitAccessLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextToken = extractIntervenantToken(accessLinkInput);
    if (!nextToken) { setBootError("Lien d'acces invalide."); return; }
    persistIntervenantToken(nextToken);
    navigate(`/intervenant?token=${encodeURIComponent(nextToken)}`, { replace: true });
  }
  async function runTaskAction(action: () => Promise<void>, success: string) {
    setSavingAction(true);
    setActionMessage(null);
    try { await action(); setActionMessage(success); setReloadTick((value) => value + 1); }
    catch (error) { setActionMessage(errorMessage(error, "Action impossible.")); }
    finally { setSavingAction(false); }
  }
  function submitTime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeTask) return;
    const hours = parseHours(timeHours);
    if (hours === null) { setActionMessage("Saisis une duree valide, par exemple 1,5."); return; }
    const task = activeTask;
    void runTaskAction(() => intervenantTimeCreate(token, { chantier_id: task.chantier_id, task_id: task.id, work_date: todayIsoDate(), duration_hours: hours, note: timeComment.trim() || null }), "Temps ajoute.");
  }
  function submitRemark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeTask || !remarkText.trim()) return;
    const task = activeTask;
    void runTaskAction(() => intervenantTerrainFeedbackCreate(token, { chantier_id: task.chantier_id, category: "observation_chantier", urgency: "normale", title: `Remarque - ${task.titre}`, description: remarkText.trim() }).then(() => undefined), "Remarque envoyee.");
  }
  function submitSignal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeTask) return;
    const task = activeTask;
    const comment = signalComment.trim();
    const action = signalKind === "materiel" || signalKind === "materiaux"
      ? () => intervenantMaterielCreate(token, { chantier_id: task.chantier_id, task_id: task.id, titre: signalKind === "materiaux" ? `Manque materiaux - ${task.titre}` : `Manque materiel - ${task.titre}`, commentaire: comment || null }).then(() => undefined)
      : signalKind === "information"
        ? () => intervenantInformationRequestCreate(token, { chantier_id: task.chantier_id, request_date: todayIsoDate(), subject: `Information manquante - ${task.titre}`, message: comment || "Information manquante pour avancer." }).then(() => undefined)
        : () => intervenantTerrainFeedbackCreate(token, { chantier_id: task.chantier_id, category: "blocage", urgency: "urgente", title: `Blocage - ${task.titre}`, description: comment || "Blocage signale depuis le portail terrain." }).then(() => undefined);
    void runTaskAction(action, "Signalement envoye.");
  }
  function submitPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeTask || !photoFile) return;
    const task = activeTask;
    const file = photoFile;
    void runTaskAction(async () => { const feedback = await intervenantTerrainFeedbackCreate(token, { chantier_id: task.chantier_id, category: "photo", urgency: "normale", title: `Photo - ${task.titre}`, description: "Photo ajoutee depuis le portail terrain." }); await intervenantTerrainFeedbackUploadPhoto(token, { chantier_id: task.chantier_id, feedback_id: feedback.id, file }); }, "Photo ajoutee.");
  }
  function completeTask() { if (!token || !activeTask) return; const task = activeTask; void runTaskAction(() => intervenantUpdateTaskStatus(token, task.id, "FAIT"), "Tache marquee terminee."); }

  if (bootLoading) return <FullPageMessage loading text="Chargement du portail terrain..." />;
  if (bootError || !token) return <AccessForm error={bootError ?? "Acces intervenant requis."} value={accessLinkInput} onChange={setAccessLinkInput} onSubmit={submitAccessLink} />;
  if (!chantiers.length) return <FullPageMessage text="Aucun chantier visible pour cet intervenant." />;

  const mainChantier = todayTasks[0]?.chantier ?? selectedChantier;
  const mainConstraint = todayTasks[0] ? taskConstraint(todayTasks[0].task, todayTasks[0].data.consignes) : alerts[0]?.title ?? selectedData.consignes.find((consigne) => consigne.priority !== "normale")?.title ?? "Aucune contrainte critique";

  return (
    <div className="min-h-dvh bg-slate-50 pb-[calc(5.75rem+var(--safe-bottom))] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 pt-[var(--safe-top)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 py-3">
          <div className="min-w-0"><div className="text-[11px] font-semibold uppercase text-blue-700">Portail terrain</div><h1 className="truncate text-base font-semibold">{sessionInfo?.intervenant.nom ?? "Intervenant"}</h1></div>
          <button type="button" onClick={logoutIntervenant} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500" aria-label="Se deconnecter"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-3 px-3 py-3 sm:px-4">
        {dataLoading ? <Notice icon={<Loader2 className="h-4 w-4 animate-spin" />} text="Synchronisation des donnees admin..." tone="blue" /> : null}
        {dataError ? <Notice icon={<AlertTriangle className="h-4 w-4" />} text={dataError} tone="amber" /> : null}
        {activeTab === "accueil" ? <HomeView alerts={alerts} mainChantier={mainChantier} mainConstraint={mainConstraint} onOpenTask={openTask} todayHours={todayHours} todayTasks={todayTasks} /> : null}
        {activeTab === "chantiers" ? <ChantiersView chantiers={chantiers} dataByChantier={dataByChantier} onOpenTask={openTask} onSelect={selectChantier} planDocuments={planDocuments} selectedChantier={selectedChantier} selectedData={selectedData} usefulDocuments={usefulDocuments} /> : null}
        {activeTab === "taches" ? <TasksView laterTasks={laterTasks} onOpenTask={openTask} todayTasks={todayTasks} weekTasks={weekTasks} /> : null}
        {activeTab === "temps" ? <TimeView onOpenTask={openTask} selectedChantier={selectedChantier} taskItems={allTaskItems} today={today} /> : null}
        {activeTab === "retours" ? <FeedbacksView dataByChantier={dataByChantier} /> : null}
      </main>
      {currentTask ? <TaskDrawer actionMessage={actionMessage} chantier={currentTaskChantier} close={() => setActiveTask(null)} completeTask={completeTask} consignes={currentTaskData.consignes} documents={taskDocuments(currentTask, currentTaskData.documents)} drawerTab={drawerTab} entries={currentTaskData.timeEntries.filter((entry) => entry.task_id === currentTask.id)} feedbacks={currentTaskData.feedbacks} materiels={currentTaskData.materiels.filter((row) => row.task_id === currentTask.id)} photoFile={photoFile} remarkText={remarkText} saving={savingAction} setDrawerTab={setDrawerTab} setPhotoFile={setPhotoFile} setRemarkText={setRemarkText} setSignalComment={setSignalComment} setSignalKind={setSignalKind} setTimeComment={setTimeComment} setTimeHours={setTimeHours} signalComment={signalComment} signalKind={signalKind} submitPhoto={submitPhoto} submitRemark={submitRemark} submitSignal={submitSignal} submitTime={submitTime} task={currentTask} timeComment={timeComment} timeHours={timeHours} /> : null}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

function buildAlerts(dataByChantier: Record<string, SiteData>, documents: IntervenantDocument[]): AlertItem[] {
  const siteDatas = Object.values(dataByChantier);
  const feedbackAlerts = siteDatas.flatMap((data) => data.feedbacks.filter((feedback) => feedback.status !== "traite" && ["blocage", "anomalie"].includes(feedback.category)).map((feedback) => ({ id: feedback.id, label: "Blocage", title: feedback.title, text: feedback.description, tone: feedback.urgency === "urgente" || feedback.urgency === "critique" ? "red" as Tone : "amber" as Tone })));
  const reserveAlerts = siteDatas.flatMap((data) => data.reserves.filter((reserve) => reserve.status !== "LEVEE").map((reserve) => ({ id: reserve.id, label: "Reserve", title: reserve.title, text: reserve.description ?? reserve.status, tone: reserve.priority === "URGENTE" ? "red" as Tone : "amber" as Tone })));
  const materielAlerts = siteDatas.flatMap((data) => data.materiels.filter((row) => OPEN_MATERIEL_STATUSES.has(row.statut)).map((row) => ({ id: row.id, label: normalize(row.titre).includes("materiaux") ? "Materiaux" : "Materiel", title: row.titre, text: compact(row.task_titre, row.commentaire, row.admin_commentaire) || "Demande en attente cote admin.", tone: row.statut === "validee" ? "blue" as Tone : "amber" as Tone })));
  const infoAlerts = siteDatas.flatMap((data) => data.informationRequests.filter((request) => request.status !== "traitee").map((request) => ({ id: request.id, label: "Information", title: request.subject, text: request.message, tone: "amber" as Tone })));
  const docAlerts = documents.filter(isPlanDocument).slice(0, 1).map((document) => ({ id: document.id, label: "Document", title: document.title ?? document.file_name ?? "Document important", text: compact(document.category, document.document_type) || "Document chantier", tone: "blue" as Tone }));
  return [...feedbackAlerts, ...reserveAlerts, ...materielAlerts, ...infoAlerts, ...docAlerts].slice(0, 6);
}
function HomeView({ alerts, mainChantier, mainConstraint, onOpenTask, todayHours, todayTasks }: { alerts: AlertItem[]; mainChantier: IntervenantChantier | null; mainConstraint: string; onOpenTask: (task: IntervenantTask, tab?: DrawerTab) => void; todayHours: number; todayTasks: TaskContext[] }) {
  return <><Surface><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric icon={<Building2 className="h-4 w-4" />} title="Chantier" value={mainChantier?.nom ?? "Non selectionne"} /><Metric icon={<ListChecks className="h-4 w-4" />} title="Taches" value={String(todayTasks.length)} /><Metric icon={<Clock3 className="h-4 w-4" />} title="Temps" value={formatHours(todayHours)} /><Metric icon={<AlertTriangle className="h-4 w-4" />} title="Contrainte" value={mainConstraint} /></div></Surface><Surface title="Taches du jour"><TaskList empty="Aucune tache prevue aujourd'hui." items={todayTasks} onOpenTask={onOpenTask} /></Surface><Surface title="Alertes utiles"><div className="mt-3 space-y-2">{alerts.length ? alerts.map((alert) => <NoteRow key={`${alert.label}-${alert.id}`} label={alert.label} text={alert.text} title={alert.title} tone={alert.tone} />) : <Empty>Aucune alerte bloquante.</Empty>}</div></Surface></>;
}
function ChantiersView(props: { chantiers: IntervenantChantier[]; dataByChantier: Record<string, SiteData>; onOpenTask: (task: IntervenantTask, tab?: DrawerTab) => void; onSelect: (chantierId: string) => void; planDocuments: IntervenantDocument[]; selectedChantier: IntervenantChantier | null; selectedData: SiteData; usefulDocuments: IntervenantDocument[] }) {
  const today = todayIsoDate();
  const weekEnd = addDaysIso(today, 6);
  const doneTasks = props.selectedData.tasks.filter(isTaskDone);
  const accessConstraint = props.selectedData.consignes.find((consigne) => normalize(`${consigne.title} ${consigne.description}`).includes("acces"));
  return <><Surface title="Chantiers"><div className="mt-3 space-y-2">{props.chantiers.map((chantier) => { const data = props.dataByChantier[chantier.id] ?? EMPTY_SITE_DATA; const remaining = data.tasks.filter((task) => !isTaskDone(task)).length; const active = chantier.id === props.selectedChantier?.id; return <button key={chantier.id} type="button" onClick={() => props.onSelect(chantier.id)} className={`w-full rounded-lg border px-3 py-3 text-left transition ${active ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-200"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-sm font-semibold text-slate-950">{chantier.nom}</div><div className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5 shrink-0" />{chantier.adresse ?? "Adresse non renseignee"}</div></div><Badge tone={active ? "blue" : "neutral"}>{chantier.status ?? "Actif"}</Badge></div><div className="mt-3 grid grid-cols-3 gap-2"><PlainFact label="Progression" value={`${chantierProgress(data, chantier)} %`} /><PlainFact label="Restantes" value={String(remaining)} /><PlainFact label="Docs" value={String(data.documents.filter(isFieldDocument).length)} /></div></button>; })}</div></Surface>{props.selectedChantier ? <Surface title="Detail chantier"><div className="mt-3 grid gap-3 sm:grid-cols-2"><InfoGroup title="Informations chantier"><PlainFact label="Nom" value={props.selectedChantier.nom} /><PlainFact label="Adresse" value={props.selectedChantier.adresse ?? "-"} /><PlainFact label="Statut" value={props.selectedChantier.status ?? "-"} /><PlainFact label="Responsables" value={props.selectedChantier.client ?? "Non renseigne"} /><PlainFact label="Contraintes acces" value={accessConstraint ? compact(accessConstraint.title, accessConstraint.description) : "Aucune contrainte d'acces visible"} /></InfoGroup><InfoGroup title="Consignes chantier">{props.selectedData.consignes.length ? props.selectedData.consignes.slice(0, 5).map((consigne) => <NoteRow key={consigne.id} title={consigne.title} text={consigne.description} tone={consigne.priority === "urgente" ? "red" : consigne.priority === "importante" ? "amber" : "neutral"} label="Consigne" />) : <Empty>Aucune consigne visible.</Empty>}</InfoGroup></div><Block title="Taches chantier" empty="Aucune tache visible."><SmallTaskGroup title="Aujourd'hui" tasks={props.selectedData.tasks.filter((task) => taskDate(task) === today && !isTaskDone(task))} chantier={props.selectedChantier} data={props.selectedData} onOpenTask={props.onOpenTask} /><SmallTaskGroup title="Cette semaine" tasks={props.selectedData.tasks.filter((task) => { const date = taskDate(task); return !!date && date > today && date <= weekEnd && !isTaskDone(task); })} chantier={props.selectedChantier} data={props.selectedData} onOpenTask={props.onOpenTask} /><SmallTaskGroup title="Terminees" tasks={doneTasks.slice(0, 5)} chantier={props.selectedChantier} data={props.selectedData} onOpenTask={props.onOpenTask} /></Block><DocumentBlock title="Plans chantier" documents={props.planDocuments} empty="Aucun plan, croquis ou photo technique visible." /><DocumentBlock title="Documents utiles" documents={props.usefulDocuments} empty="Aucun document technique visible." /><Block title="Retours terrain recents" empty="Aucun retour recent.">{[...props.selectedData.feedbacks.map((feedback) => ({ id: feedback.id, title: feedback.title, text: feedback.description, tone: feedback.urgency === "urgente" || feedback.urgency === "critique" ? "red" as Tone : "blue" as Tone, label: "Retour" })), ...props.selectedData.reserves.map((reserve) => ({ id: reserve.id, title: reserve.title, text: reserve.description ?? reserve.status, tone: reserve.priority === "URGENTE" ? "red" as Tone : "amber" as Tone, label: "Reserve" }))].slice(0, 5).map((row) => <NoteRow key={row.id} title={row.title} text={row.text} tone={row.tone} label={row.label} />)}</Block></Surface> : null}</>;
}
function TasksView({ laterTasks, onOpenTask, todayTasks, weekTasks }: { laterTasks: TaskContext[]; onOpenTask: (task: IntervenantTask, tab?: DrawerTab) => void; todayTasks: TaskContext[]; weekTasks: TaskContext[] }) { return <Surface title="Taches"><TaskPeriod title="Aujourd'hui" items={todayTasks} onOpenTask={onOpenTask} /><TaskPeriod title="Cette semaine" items={weekTasks} onOpenTask={onOpenTask} /><TaskPeriod title="Plus tard" items={laterTasks} onOpenTask={onOpenTask} /></Surface>; }
function TimeView({ onOpenTask, selectedChantier, taskItems, today }: { onOpenTask: (task: IntervenantTask, tab?: DrawerTab) => void; selectedChantier: IntervenantChantier | null; taskItems: TaskContext[]; today: string }) {
  const recentItems = taskItems.filter((item) => !isTaskDone(item.task) && item.data.timeEntries.some((entry) => entry.task_id === item.task.id)).sort((a, b) => sortTasks(a.task, b.task)).slice(0, 8);
  const todayItems = taskItems.filter((item) => !isTaskDone(item.task) && taskDate(item.task) === today).sort((a, b) => sortTasks(a.task, b.task));
  const currentSiteItems = taskItems.filter((item) => !isTaskDone(item.task) && item.chantier.id === selectedChantier?.id && taskDate(item.task) !== today).sort((a, b) => sortTasks(a.task, b.task)).slice(0, 12);
  return <Surface title="Temps"><TimeGroup title="Taches recentes" items={recentItems} onOpenTask={onOpenTask} /><TimeGroup title="Taches du jour" items={todayItems} onOpenTask={onOpenTask} /><TimeGroup title="Chantier actuel" items={currentSiteItems} onOpenTask={onOpenTask} /></Surface>;
}
function FeedbacksView({ dataByChantier }: { dataByChantier: Record<string, SiteData> }) {
  const feedbacks = Object.values(dataByChantier).flatMap((data) => data.feedbacks);
  const reserves = Object.values(dataByChantier).flatMap((data) => data.reserves);
  const requests = Object.values(dataByChantier).flatMap((data) => data.informationRequests);
  const materiels = Object.values(dataByChantier).flatMap((data) => data.materiels);
  return <Surface title="Retours"><div className="mt-3 space-y-2">{feedbacks.map((feedback) => <NoteRow key={feedback.id} title={feedback.title} text={feedback.description} tone={feedback.urgency === "urgente" || feedback.urgency === "critique" ? "red" : "blue"} label={feedback.category} />)}{reserves.map((reserve) => <NoteRow key={reserve.id} title={reserve.title} text={reserve.description ?? reserve.status} tone={reserve.priority === "URGENTE" ? "red" : "amber"} label="Reserve" />)}{materiels.map((row) => <NoteRow key={row.id} title={row.titre} text={compact(row.task_titre, row.commentaire, row.admin_commentaire)} tone={row.statut === "validee" ? "blue" : "amber"} label={row.statut} />)}{requests.map((request) => <NoteRow key={request.id} title={request.subject} text={request.message} tone="blue" label="Information" />)}{feedbacks.length + reserves.length + requests.length + materiels.length === 0 ? <Empty>Aucun retour terrain.</Empty> : null}</div></Surface>;
}
function TaskDrawer(props: { actionMessage: string | null; chantier: IntervenantChantier | null; close: () => void; completeTask: () => void; consignes: IntervenantConsigne[]; documents: IntervenantDocument[]; drawerTab: DrawerTab; entries: IntervenantTimeEntry[]; feedbacks: IntervenantTerrainFeedback[]; materiels: IntervenantMateriel[]; photoFile: File | null; remarkText: string; saving: boolean; setDrawerTab: (tab: DrawerTab) => void; setPhotoFile: (file: File | null) => void; setRemarkText: (value: string) => void; setSignalComment: (value: string) => void; setSignalKind: (value: SignalKind) => void; setTimeComment: (value: string) => void; setTimeHours: (value: string) => void; signalComment: string; signalKind: SignalKind; submitPhoto: (event: FormEvent<HTMLFormElement>) => void; submitRemark: (event: FormEvent<HTMLFormElement>) => void; submitSignal: (event: FormEvent<HTMLFormElement>) => void; submitTime: (event: FormEvent<HTMLFormElement>) => void; task: IntervenantTask; timeComment: string; timeHours: string }) {
  const totalTime = props.entries.reduce((sum, entry) => sum + Number(entry.duration_hours ?? 0), 0);
  const linkedPlans = props.documents.filter(isPlanDocument);
  const linkedDocs = props.documents.filter((document) => isFieldDocument(document) && !isPlanDocument(document));
  const extra = taskExtra(props.task);
  const taskConsignes = props.consignes.filter((row) => row.task_id === props.task.id || (!!props.task.zone_id && row.zone_id === props.task.zone_id) || row.applies_to_all);
  const referencePhotos = props.feedbacks.filter((feedback) => feedback.attachments.length > 0 && normalize(`${feedback.title} ${feedback.description}`).includes(normalize(props.task.titre)));
  const taskFeedbacks = props.feedbacks.filter((feedback) => normalize(`${feedback.title} ${feedback.description}`).includes(normalize(props.task.titre)));
  return <div className="fixed inset-0 z-50 bg-slate-950/35"><div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-hidden rounded-t-2xl bg-white shadow-[0_-20px_60px_rgba(15,23,42,0.24)] sm:left-auto sm:right-4 sm:top-4 sm:h-[calc(100dvh-2rem)] sm:w-[460px] sm:rounded-2xl"><div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4"><div className="min-w-0"><div className="truncate text-[11px] font-semibold uppercase text-blue-700">{props.chantier?.nom ?? "Chantier"}</div><h2 className="mt-1 text-base font-semibold text-slate-950">{props.task.titre}</h2></div><button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500" type="button" onClick={props.close} aria-label="Fermer"><X className="h-4 w-4" /></button></div><div className="grid grid-cols-2 gap-2 border-b border-slate-200 px-4 py-3"><button className={`rounded-lg px-4 py-2 text-sm font-semibold ${props.drawerTab === "infos" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"}`} type="button" onClick={() => props.setDrawerTab("infos")}>Informations</button><button className={`rounded-lg px-4 py-2 text-sm font-semibold ${props.drawerTab === "actions" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"}`} type="button" onClick={() => props.setDrawerTab("actions")}>Actions terrain</button></div><div className="h-[calc(92dvh-9rem)] overflow-y-auto px-4 py-4 sm:h-[calc(100dvh-11rem)]">{props.drawerTab === "infos" ? <div className="space-y-3"><div className="grid grid-cols-2 gap-2"><PlainFact label="Chantier" value={props.chantier?.nom ?? "-"} /><PlainFact label="Zone" value={props.task.zone_nom ?? "-"} /><PlainFact label="Lot" value={props.task.lot ?? props.task.corps_etat ?? "-"} /><PlainFact label="Statut" value={taskStatusLabel(props.task)} /><PlainFact label="Quantite" value={props.task.quantite === null ? "-" : `${props.task.quantite} ${props.task.unite ?? ""}`} /><PlainFact label="Unite" value={props.task.unite ?? "-"} /><PlainFact label="Temps prevu" value={formatHours(props.task.temps_prevu_h)} /><PlainFact label="Temps passe" value={formatHours(totalTime || props.task.temps_reel_h)} /></div><PlainFact label="Description complete" value={taskDescription(props.task)} /><PlainFact label="Contraintes" value={taskConstraint(props.task, props.consignes)} /><PlainFact label="Dependances" value={compact(extra.dependances, props.task.date_debut || props.task.date_fin ? `${formatDate(props.task.date_debut)} - ${formatDate(props.task.date_fin)}` : null) || "Non renseignees"} /><PlainFact label="Remarques admin" value={compact(extra.remarques_admin, props.task.reprise_reason) || "Aucune remarque admin visible"} /><Block title="Consignes liees" empty="Aucune consigne liee.">{taskConsignes.map((consigne) => <NoteRow key={consigne.id} title={consigne.title} text={consigne.description} tone={consigne.priority === "urgente" ? "red" : consigne.priority === "importante" ? "amber" : "neutral"} label="Consigne" />)}</Block><DocumentBlock title="Plans lies" documents={linkedPlans} empty="Aucun plan lie visible." /><DocumentBlock title="Documents lies" documents={linkedDocs} empty="Aucun document lie visible." /><Block title="Temps saisis" empty="Aucun temps saisi sur cette tache.">{props.entries.slice(0, 5).map((entry) => <NoteRow key={entry.id} title={formatHours(entry.duration_hours)} text={compact(formatDate(entry.work_date), entry.note)} tone="blue" label="Temps" />)}</Block><Block title="Materiel et materiaux" empty="Aucune demande liee.">{props.materiels.map((row) => <NoteRow key={row.id} title={row.titre} text={compact(row.commentaire, row.admin_commentaire)} tone={row.statut === "validee" ? "blue" : "amber"} label={row.statut} />)}</Block><Block title="Retours lies" empty="Aucun retour lie.">{taskFeedbacks.map((feedback) => <NoteRow key={feedback.id} title={feedback.title} text={feedback.description} tone={feedback.urgency === "urgente" || feedback.urgency === "critique" ? "red" : "blue"} label={feedback.category} />)}</Block><Block title="Photos reference" empty="Aucune photo reference visible.">{referencePhotos.map((feedback) => <NoteRow key={feedback.id} title={feedback.title} text={`${feedback.attachments.length} photo(s)`} tone="blue" label="Photo" />)}</Block></div> : <div className="space-y-3">{props.actionMessage ? <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{props.actionMessage}</div> : null}<ActionForm title="Ajouter temps" onSubmit={props.submitTime} saving={props.saving}><input className={inputClass} inputMode="decimal" value={props.timeHours} onChange={(event) => props.setTimeHours(event.target.value)} placeholder="Duree ex : 1,5" /><textarea className={inputClass} value={props.timeComment} onChange={(event) => props.setTimeComment(event.target.value)} rows={2} placeholder="Commentaire optionnel" /></ActionForm><ActionForm title="Ajouter photo" onSubmit={props.submitPhoto} saving={props.saving} disabled={!props.photoFile}><input className={inputClass} type="file" accept="image/*" capture="environment" onChange={(event) => props.setPhotoFile(event.target.files?.[0] ?? null)} /></ActionForm><ActionForm title="Ajouter remarque" onSubmit={props.submitRemark} saving={props.saving} disabled={!props.remarkText.trim()}><textarea className={inputClass} value={props.remarkText} onChange={(event) => props.setRemarkText(event.target.value)} rows={3} placeholder="Remarque terrain" /></ActionForm><ActionForm title="Signaler" onSubmit={props.submitSignal} saving={props.saving}><select className={inputClass} value={props.signalKind} onChange={(event) => props.setSignalKind(event.target.value as SignalKind)}><option value="blocage">Blocage</option><option value="materiel">Manque materiel</option><option value="materiaux">Manque materiaux</option><option value="information">Manque information</option></select><textarea className={inputClass} value={props.signalComment} onChange={(event) => props.setSignalComment(event.target.value)} rows={3} placeholder="Precision utile pour l'admin" /></ActionForm><button className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" type="button" onClick={props.completeTask} disabled={props.saving}><CheckCircle2 className="h-4 w-4" />Marquer terminee</button></div>}</div></div></div>;
}
function BottomNav({ activeTab, setActiveTab }: { activeTab: PortalTab; setActiveTab: (tab: PortalTab) => void }) { const tabs: Array<{ id: PortalTab; label: string; icon: ReactNode }> = [{ id: "accueil", label: "Accueil", icon: <Home className="h-5 w-5" /> }, { id: "chantiers", label: "Chantiers", icon: <Building2 className="h-5 w-5" /> }, { id: "taches", label: "Taches", icon: <ListChecks className="h-5 w-5" /> }, { id: "temps", label: "Temps", icon: <Clock3 className="h-5 w-5" /> }, { id: "retours", label: "Retours", icon: <MessageSquare className="h-5 w-5" /> }]; return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[var(--safe-bottom)] pt-2 backdrop-blur"><div className="mx-auto grid max-w-5xl grid-cols-5 gap-1">{tabs.map((tab) => <button key={tab.id} className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px] font-semibold ${activeTab === tab.id ? "bg-blue-700 text-white" : "text-slate-500"}`} type="button" onClick={() => setActiveTab(tab.id)}>{tab.icon}<span className="truncate">{tab.label}</span></button>)}</div></nav>; }
function TaskPeriod({ items, onOpenTask, title }: { items: TaskContext[]; onOpenTask: (task: IntervenantTask, tab?: DrawerTab) => void; title: string }) { const groups = new Map<string, { chantier: IntervenantChantier; items: TaskContext[] }>(); items.forEach((item) => { const group = groups.get(item.chantier.id) ?? { chantier: item.chantier, items: [] }; group.items.push(item); groups.set(item.chantier.id, group); }); return <div className="mt-4"><div className="text-sm font-semibold text-slate-950">{title}</div><div className="mt-2 space-y-3">{groups.size ? Array.from(groups.values()).map((group) => <div key={group.chantier.id} className="space-y-2"><div className="text-[11px] font-semibold uppercase text-blue-700">{group.chantier.nom}</div>{group.items.map((item) => <TaskCard key={item.task.id} item={item} onOpenTask={onOpenTask} />)}</div>) : <Empty>Aucune tache.</Empty>}</div></div>; }
function TaskList({ empty, items, onOpenTask }: { empty: string; items: TaskContext[]; onOpenTask: (task: IntervenantTask, tab?: DrawerTab) => void }) { return <div className="mt-3 space-y-2">{items.length ? items.map((item) => <TaskCard key={item.task.id} item={item} onOpenTask={onOpenTask} />) : <Empty>{empty}</Empty>}</div>; }
function TaskCard({ item, onOpenTask }: { item: TaskContext; onOpenTask: (task: IntervenantTask, tab?: DrawerTab) => void }) { const docs = taskDocuments(item.task, item.data.documents).length; const photos = taskPhotoCount(item.task, item.data.feedbacks); const spent = taskTimeTotal(item.task, item.data.timeEntries) || item.task.temps_reel_h; return <button className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-blue-200" type="button" onClick={() => onOpenTask(item.task)}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-sm font-semibold text-slate-950">{item.task.titre}</div><div className="mt-1 text-xs text-slate-500">{item.chantier.nom}</div></div><Badge tone={taskTone(item.task)}>{taskStatusLabel(item.task)}</Badge></div><div className="mt-3 grid gap-2 sm:grid-cols-4"><PlainFact label="Zone" value={item.task.zone_nom ?? "-"} /><PlainFact label="Lot" value={item.task.lot ?? item.task.corps_etat ?? "-"} /><PlainFact label="Prevu" value={formatHours(item.task.temps_prevu_h)} /><PlainFact label="Contrainte" value={taskConstraint(item.task, item.data.consignes)} /></div><div className="mt-3 flex flex-wrap gap-2"><Badge>{formatHours(spent)} passe</Badge><Badge>{docs} doc(s)</Badge><Badge>{photos} photo(s)</Badge><Badge>{formatDate(taskDate(item.task))}</Badge></div></button>; }
function SmallTaskGroup({ chantier, data, onOpenTask, tasks, title }: { chantier: IntervenantChantier; data: SiteData; onOpenTask: (task: IntervenantTask, tab?: DrawerTab) => void; tasks: IntervenantTask[]; title: string }) { return tasks.length ? <div className="space-y-2"><div className="text-sm font-semibold text-slate-950">{title}</div>{tasks.map((task) => <TaskCard key={task.id} item={{ chantier, task, data }} onOpenTask={onOpenTask} />)}</div> : null; }
function TimeGroup({ items, onOpenTask, title }: { items: TaskContext[]; onOpenTask: (task: IntervenantTask, tab?: DrawerTab) => void; title: string }) { return <div className="mt-4"><div className="text-sm font-semibold text-slate-950">{title}</div><div className="mt-2 space-y-2">{items.length ? items.map((item) => <TimeTaskRow key={`${title}-${item.task.id}`} item={item} onOpenTask={onOpenTask} />) : <Empty>Aucune tache dans ce groupe.</Empty>}</div></div>; }
function TimeTaskRow({ item, onOpenTask }: { item: TaskContext; onOpenTask: (task: IntervenantTask, tab?: DrawerTab) => void }) { const entries = item.data.timeEntries.filter((entry) => entry.task_id === item.task.id); const total = taskTimeTotal(item.task, item.data.timeEntries); return <button type="button" onClick={() => onOpenTask(item.task, "actions")} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-left"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-sm font-semibold text-slate-950">{item.task.titre}</div><div className="mt-1 text-xs text-slate-500">{item.chantier.nom}</div></div><Send className="h-4 w-4 text-blue-700" /></div><div className="mt-3 grid grid-cols-3 gap-2"><PlainFact label="Prevu" value={formatHours(item.task.temps_prevu_h)} /><PlainFact label="Cumule" value={formatHours(total || item.task.temps_reel_h)} /><PlainFact label="Saisies" value={String(entries.length)} /></div>{entries.length ? <div className="mt-3 space-y-1">{entries.slice(0, 3).map((entry) => <div key={entry.id} className="flex justify-between gap-3 text-xs text-slate-500"><span>{formatDate(entry.work_date)}</span><span>{formatHours(entry.duration_hours)}</span></div>)}</div> : null}</button>; }
function ActionForm({ children, disabled = false, onSubmit, saving, title }: { children: ReactNode; disabled?: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean; title: string }) { return <form className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3" onSubmit={onSubmit}><SectionHeader title={title} />{children}<button className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={saving || disabled}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : title === "Ajouter photo" ? <Camera className="h-4 w-4" /> : title === "Signaler" ? <PackageOpen className="h-4 w-4" /> : <Send className="h-4 w-4" />}{title}</button></form>; }
function DocumentBlock({ documents, empty, title }: { documents: IntervenantDocument[]; empty: string; title: string }) { return <Block title={title} empty={empty}>{documents.slice(0, 8).map((document) => <div key={document.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" /><div className="min-w-0"><div className="text-sm font-semibold text-slate-950">{document.title ?? document.file_name ?? "Document"}</div><div className="mt-1 text-xs text-slate-500">{compact(document.category, document.document_type) || "Document chantier"}</div></div></div>)}</Block>; }
function Notice({ icon, text, tone }: { icon: ReactNode; text: string; tone: Tone }) { const classes = tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-200 bg-blue-50 text-blue-700"; return <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${classes}`}>{icon}<span>{text}</span></div>; }
function Block({ children, empty, title }: { children: ReactNode; empty: string; title: string }) { const hasChildren = Array.isArray(children) ? children.some(Boolean) : Boolean(children); return <div className="mt-4 space-y-2"><div className="text-sm font-semibold text-slate-950">{title}</div>{hasChildren ? children : <Empty>{empty}</Empty>}</div>; }
function Surface({ children, title }: { children: ReactNode; title?: string }) { return <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.04)] sm:p-4">{title ? <SectionHeader title={title} /> : null}{children}</section>; }
function InfoGroup({ children, title }: { children: ReactNode; title: string }) { return <div className="space-y-2"><div className="text-sm font-semibold text-slate-950">{title}</div>{children}</div>; }
function SectionHeader({ title }: { title: string }) { return <h2 className="text-base font-semibold text-slate-950">{title}</h2>; }
function Metric({ icon, title, value }: { icon: ReactNode; title: string; value: string }) { return <div className="rounded-lg bg-slate-50 px-3 py-3"><div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-slate-500">{icon}{title}</div><div className="mt-2 line-clamp-2 text-sm font-semibold text-slate-950">{value}</div></div>; }
function PlainFact({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2"><div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div><div className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</div></div>; }
function NoteRow({ label, text, title, tone }: { label: string; text: string; title: string; tone: Tone }) { return <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-sm font-semibold text-slate-950">{title}</div>{text ? <p className="mt-1 text-sm text-slate-600">{text}</p> : null}</div><Badge tone={tone}>{label}</Badge></div></div>; }
function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) { const classes: Record<Tone, string> = { neutral: "border-slate-200 bg-white text-slate-600", blue: "border-blue-200 bg-blue-50 text-blue-700", green: "border-emerald-200 bg-emerald-50 text-emerald-700", amber: "border-amber-200 bg-amber-50 text-amber-700", red: "border-red-200 bg-red-50 text-red-700" }; return <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${classes[tone]}`}>{children}</span>; }
function Empty({ children }: { children: ReactNode }) { return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">{children}</div>; }
function FullPageMessage({ loading = false, text }: { loading?: boolean; text: string }) { return <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4"><Surface>{loading ? <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-blue-700" /> : null}<div className="text-center text-sm font-semibold text-slate-700">{text}</div></Surface></div>; }
function AccessForm({ error, onChange, onSubmit, value }: { error: string; onChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; value: string }) { return <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4"><section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.04)]"><div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-blue-700"><Building2 className="h-4 w-4" />Batipro</div><h1 className="mt-2 text-lg font-semibold text-slate-950">Portail terrain</h1><p className="mt-2 text-sm text-slate-500">{error}</p><form className="mt-4 space-y-3" onSubmit={onSubmit}><input className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Coller le lien recu" /><button className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white" type="submit">Ouvrir le portail<ChevronRight className="h-4 w-4" /></button></form></section></div>; }
