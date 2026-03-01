import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  intervenantGetChantiers,
  intervenantGetDocuments,
  intervenantGetPlanning,
  intervenantGetTasks,
  intervenantMaterielCreate,
  intervenantMaterielList,
  intervenantSession,
  intervenantTimeCreate,
  intervenantTimeDelete,
  intervenantTimeList,
  type IntervenantChantier,
  type IntervenantDocument,
  type IntervenantMateriel,
  type IntervenantPlanning,
  type IntervenantTask,
  type IntervenantTimeEntry,
} from "../services/intervenantPortal.service";

type PortalTab = "accueil" | "temps" | "taches" | "planning" | "documents" | "materiel" | "messages";
type LoadState<T> = { loading: boolean; error: string | null; data: T };
type DashboardTaskItem = { chantier: IntervenantChantier; task: IntervenantTask };
type DashboardMaterielItem = { chantier: IntervenantChantier; row: IntervenantMateriel };
type MobileGlobalTab = "home" | "sites" | "site";

const STORAGE_TOKEN_KEY = "batipro_intervenant_token";
const STORAGE_CHANTIER_KEY = "batipro_intervenant_chantier_id";
const LEGACY_FALLBACK_ENABLED =
  String(import.meta.env.VITE_ENABLE_INTERVENANT_LEGACY_FALLBACK ?? "0").trim() === "1";
const TITLE_CLAMP_STYLE = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical" as const,
  WebkitLineClamp: 2,
  overflow: "hidden",
};
const EMPTY_TASKS_STATE: LoadState<IntervenantTask[]> = { loading: false, error: null, data: [] };
const EMPTY_DOCUMENTS_STATE: LoadState<IntervenantDocument[]> = { loading: false, error: null, data: [] };
const EMPTY_PLANNING_STATE: LoadState<IntervenantPlanning> = {
  loading: false,
  error: null,
  data: { chantier_id: null, lots: [] },
};
const EMPTY_TIME_STATE: LoadState<IntervenantTimeEntry[]> = { loading: false, error: null, data: [] };
const EMPTY_MATERIEL_STATE: LoadState<IntervenantMateriel[]> = { loading: false, error: null, data: [] };
const EMPTY_DASHBOARD_TASKS_STATE: LoadState<DashboardTaskItem[]> = { loading: false, error: null, data: [] };
const EMPTY_DASHBOARD_MATERIEL_STATE: LoadState<DashboardMaterielItem[]> = { loading: false, error: null, data: [] };

let memoryToken = "";
let memoryChantierId = "";

function getSafeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    const probeKey = "__batipro_intervenant_storage_probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}

function readStoredToken(): string {
  const storage = getSafeStorage();
  if (!storage) return memoryToken;
  try {
    return String(storage.getItem(STORAGE_TOKEN_KEY) ?? "").trim();
  } catch {
    return memoryToken;
  }
}

function persistToken(token: string) {
  memoryToken = String(token ?? "").trim();
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_TOKEN_KEY, memoryToken);
  } catch {}
}

function clearStoredToken() {
  memoryToken = "";
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_TOKEN_KEY);
  } catch {}
}

function readStoredChantierId(): string {
  const storage = getSafeStorage();
  if (!storage) return memoryChantierId;
  try {
    return String(storage.getItem(STORAGE_CHANTIER_KEY) ?? "").trim();
  } catch {
    return memoryChantierId;
  }
}

function persistChantierId(chantierId: string) {
  memoryChantierId = String(chantierId ?? "").trim();
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_CHANTIER_KEY, memoryChantierId);
  } catch {}
}

function clearStoredChantierId() {
  memoryChantierId = "";
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_CHANTIER_KEY);
  } catch {}
}

function getErrorMessage(error: unknown, fallback: string): string {
  const message = String((error as { message?: string } | null)?.message ?? fallback).trim();
  return message || fallback;
}

function isInvalidTokenError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("invalid") || normalized.includes("expire") || normalized.includes("token manquant");
}

function shouldFallbackToLegacy(error: unknown): boolean {
  const message = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    message.includes("function") ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("permission denied for function")
  );
}

function formatDateFr(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("fr-FR");
}

function formatDateTimeFr(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("fr-FR");
}

function formatQuantity(value: number | null, unit: string | null, empty = "0"): string {
  if (value === null) return empty;
  const formatted = value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  return unit ? `${formatted} ${unit}` : formatted;
}

function todayIsoDateFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayIsoDate(): string {
  return todayIsoDateFromDate(new Date());
}

function startOfWeekIso(date = new Date()): string {
  const probe = new Date(date);
  const day = probe.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  probe.setHours(0, 0, 0, 0);
  probe.setDate(probe.getDate() + diff);
  return todayIsoDateFromDate(probe);
}

function addDaysIso(isoDate: string, days: number): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return todayIsoDateFromDate(parsed);
}

function taskStatusPriority(status: string | null): number {
  const normalized = String(status ?? "").toUpperCase();
  if (["EN_COURS", "IN_PROGRESS"].includes(normalized)) return 0;
  if (["A_FAIRE", "TODO", "PENDING"].includes(normalized)) return 1;
  if (["FAIT", "TERMINE", "DONE", "COMPLETED"].includes(normalized)) return 2;
  return 3;
}

function taskPlanningDateValue(task: IntervenantTask): number {
  const candidate = task.date_debut ?? task.date ?? task.date_fin;
  if (!candidate) return Number.MAX_SAFE_INTEGER;
  const timestamp = Date.parse(candidate);
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}
function isTaskIdRequiredError(message: string): boolean {
  return String(message ?? "").toLowerCase().includes("task_id_required");
}

function taskQuantityProgress(task: IntervenantTask): number | null {
  if (task.quantite === null || task.quantite <= 0) return null;
  const done = Number(task.quantite_realisee ?? 0);
  return Math.max(0, Math.min(100, (done / task.quantite) * 100));
}

function taskPortalPriority(task: IntervenantTask): number {
  const progress = taskQuantityProgress(task);
  if (progress !== null) {
    if (progress > 0 && progress < 100) return 0;
    if (progress <= 0) return 1;
    return 2;
  }
  return taskStatusPriority(task.status);
}

function taskAnchorDate(task: IntervenantTask): string | null {
  return task.date_debut ?? task.date ?? task.date_fin;
}

function statusLabel(status: string | null): string {
  const normalized = String(status ?? "").toUpperCase();
  if (["FAIT", "TERMINE", "DONE", "COMPLETED"].includes(normalized)) return "Termine";
  if (["EN_COURS", "IN_PROGRESS"].includes(normalized)) return "En cours";
  return "A faire";
}

function statusBadgeClass(status: string | null): string {
  const normalized = String(status ?? "").toUpperCase();
  if (["FAIT", "TERMINE", "DONE", "COMPLETED"].includes(normalized)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["EN_COURS", "IN_PROGRESS"].includes(normalized)) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function resolveTaskLot(task: IntervenantTask): string {
  return String(task.lot ?? task.corps_etat ?? "").trim() || "A classer";
}

function materielStatusLabel(status: IntervenantMateriel["statut"]): string {
  if (status === "validee") return "Validee";
  if (status === "refusee") return "Refusee";
  if (status === "livree") return "Livree";
  return "En attente";
}

function materielStatusClass(status: IntervenantMateriel["statut"]): string {
  if (status === "validee") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "refusee") return "bg-red-50 text-red-700 border-red-200";
  if (status === "livree") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function isOpenMaterielStatus(status: IntervenantMateriel["statut"]): boolean {
  return status === "en_attente" || status === "validee";
}

function chantierDateSummary(chantier: IntervenantChantier | null): string {
  if (!chantier) return "";
  const start = chantier.date_debut ?? chantier.planning_start_date;
  const end = chantier.date_fin_prevue ?? chantier.planning_end_date;
  if (start && end) return `${formatDateFr(start)} -> ${formatDateFr(end)}`;
  if (start) return `Depuis ${formatDateFr(start)}`;
  if (end) return `Jusqu'au ${formatDateFr(end)}`;
  return "Dates non renseignees";
}

function chantierSearchText(chantier: IntervenantChantier): string {
  return [chantier.nom, chantier.client, chantier.adresse].filter(Boolean).join(" ").toLowerCase();
}

export default function IntervenantPortalPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryToken = useMemo(() => new URLSearchParams(location.search).get("token")?.trim() ?? "", [location.search]);
  const queryChantierId = useMemo(
    () => new URLSearchParams(location.search).get("chantier_id")?.trim() ?? "",
    [location.search],
  );

  const [token, setToken] = useState("");
  const [sessionInfo, setSessionInfo] = useState<Awaited<ReturnType<typeof intervenantSession>> | null>(null);
  const [chantiers, setChantiers] = useState<IntervenantChantier[]>([]);
  const [selectedChantierId, setSelectedChantierId] = useState("");
  const [activeTab, setActiveTab] = useState<PortalTab>("accueil");
  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  const [tasksState, setTasksState] = useState<LoadState<IntervenantTask[]>>(EMPTY_TASKS_STATE);
  const [documentsState, setDocumentsState] = useState<LoadState<IntervenantDocument[]>>(EMPTY_DOCUMENTS_STATE);
  const [planningState, setPlanningState] = useState<LoadState<IntervenantPlanning>>(EMPTY_PLANNING_STATE);
  const [timeState, setTimeState] = useState<LoadState<IntervenantTimeEntry[]>>(EMPTY_TIME_STATE);
  const [materielState, setMaterielState] = useState<LoadState<IntervenantMateriel[]>>(EMPTY_MATERIEL_STATE);
  const [dashboardTasksState, setDashboardTasksState] = useState<LoadState<DashboardTaskItem[]>>(EMPTY_DASHBOARD_TASKS_STATE);
  const [dashboardMaterielState, setDashboardMaterielState] = useState<LoadState<DashboardMaterielItem[]>>(EMPTY_DASHBOARD_MATERIEL_STATE);

  const [reloadTick, setReloadTick] = useState(0);
  const [portalOptionsOpen, setPortalOptionsOpen] = useState(false);
  const [mobileGlobalTab, setMobileGlobalTab] = useState<MobileGlobalTab>("home");
  const [sidebarChantierQuery, setSidebarChantierQuery] = useState("");
  const [timeTaskId, setTimeTaskId] = useState<string | null>(null);
  const [timeTaskSearch, setTimeTaskSearch] = useState("");
  const [timeTaskListOpen, setTimeTaskListOpen] = useState(false);
  const [timeFeedback, setTimeFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [timeDate, setTimeDate] = useState(todayIsoDate());
  const [timeQuantity, setTimeQuantity] = useState("");
  const [timeNote, setTimeNote] = useState("");
  const [timeSaving, setTimeSaving] = useState(false);
  const [timeDeletingId, setTimeDeletingId] = useState<string | null>(null);
  const [materielTitre, setMaterielTitre] = useState("");
  const [materielTaskId, setMaterielTaskId] = useState("");
  const [materielQuantite, setMaterielQuantite] = useState("1");
  const [materielUnite, setMaterielUnite] = useState("");
  const [materielDate, setMaterielDate] = useState("");
  const [materielCommentaire, setMaterielCommentaire] = useState("");
  const [materielSaving, setMaterielSaving] = useState(false);
  const [materielFeedback, setMaterielFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [quickMaterielChantierId, setQuickMaterielChantierId] = useState("");
  const [quickMaterielTitre, setQuickMaterielTitre] = useState("");
  const [quickMaterielQuantite, setQuickMaterielQuantite] = useState("1");
  const [quickMaterielSaving, setQuickMaterielSaving] = useState(false);
  const [quickMaterielFeedback, setQuickMaterielFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  useEffect(() => {
    let alive = true;
    async function bootstrap() {
      setBootLoading(true);
      setBootError(null);
      const candidateToken = queryToken || readStoredToken();
      if (!candidateToken) {
        if (!alive) return;
        setToken("");
        setSessionInfo(null);
        setChantiers([]);
        setSelectedChantierId("");
        setBootError("Token manquant.");
        setBootLoading(false);
        return;
      }
      try {
        setToken(candidateToken);
        persistToken(candidateToken);
        const [sessionData, chantierRows] = await Promise.all([
          intervenantSession(candidateToken),
          intervenantGetChantiers(candidateToken),
        ]);
        if (!alive) return;
        const chantierIds = new Set(chantierRows.map((row) => row.id));
        const storedChantierId = readStoredChantierId();
        const fromQuery = queryChantierId && chantierIds.has(queryChantierId) ? queryChantierId : "";
        const fromStorage = storedChantierId && chantierIds.has(storedChantierId) ? storedChantierId : "";
        const nextChantierId = fromQuery || fromStorage || chantierRows[0]?.id || "";
        setSessionInfo(sessionData);
        setChantiers(chantierRows);
        setSelectedChantierId(nextChantierId);
        const isMobileViewport = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
        if (isMobileViewport && chantierRows.length === 1 && nextChantierId) {
          setMobileGlobalTab("site");
          setActiveTab("temps");
        } else {
          setMobileGlobalTab("home");
          setActiveTab("accueil");
        }
        if (nextChantierId) persistChantierId(nextChantierId);
        else clearStoredChantierId();
        setBootLoading(false);
      } catch (error) {
        if (!alive) return;
        const message = getErrorMessage(error, "Acces intervenant indisponible.");
        if (LEGACY_FALLBACK_ENABLED && shouldFallbackToLegacy(error)) {
          navigate(`/acces/${encodeURIComponent(candidateToken)}`, { replace: true });
          return;
        }
        setSessionInfo(null);
        setChantiers([]);
        setSelectedChantierId("");
        setMobileGlobalTab("home");
        setBootError(message);
        setBootLoading(false);
      }
    }
    void bootstrap();
    return () => {
      alive = false;
    };
  }, [navigate, queryChantierId, queryToken]);

  useEffect(() => {
    if (bootLoading || bootError) return;
    if (chantiers.length === 0) {
      if (selectedChantierId) setSelectedChantierId("");
      clearStoredChantierId();
      setMobileGlobalTab("home");
      return;
    }
    const ids = new Set(chantiers.map((chantier) => chantier.id));
    if (selectedChantierId && ids.has(selectedChantierId)) {
      persistChantierId(selectedChantierId);
      return;
    }
    const stored = readStoredChantierId();
    const nextChantierId = stored && ids.has(stored) ? stored : chantiers[0].id;
    if (nextChantierId && nextChantierId !== selectedChantierId) setSelectedChantierId(nextChantierId);
  }, [bootError, bootLoading, chantiers, selectedChantierId]);

  useEffect(() => {
    if (chantiers.length === 0) {
      setQuickMaterielChantierId("");
      return;
    }
    setQuickMaterielChantierId((current) => {
      const validCurrent = current && chantiers.some((chantier) => chantier.id === current);
      if (validCurrent) return current;
      return selectedChantierId || chantiers[0].id;
    });
  }, [chantiers, selectedChantierId]);

  useEffect(() => {
    setTimeTaskId(null);
    setTimeTaskSearch("");
    setTimeTaskListOpen(false);
    setTimeFeedback(null);
    setTimeQuantity("");
    setTimeNote("");
    setTimeDate(todayIsoDate());
    setMaterielTaskId("");
    setMaterielFeedback(null);
  }, [selectedChantierId]);

  useEffect(() => {
    if (!token || !selectedChantierId || bootLoading || bootError) return;
    let alive = true;
    async function loadChantierData() {
      setTasksState({ loading: true, error: null, data: [] });
      setDocumentsState({ loading: true, error: null, data: [] });
      setPlanningState({ loading: true, error: null, data: { chantier_id: selectedChantierId, lots: [] } });
      setTimeState({ loading: true, error: null, data: [] });
      setMaterielState({ loading: true, error: null, data: [] });
      const [tasksResult, documentsResult, planningResult, timeResult, materielResult] = await Promise.allSettled([
        intervenantGetTasks(token, selectedChantierId),
        intervenantGetDocuments(token, selectedChantierId),
        intervenantGetPlanning(token, selectedChantierId),
        intervenantTimeList(token, selectedChantierId),
        intervenantMaterielList(token, selectedChantierId),
      ]);
      if (!alive) return;
      if (LEGACY_FALLBACK_ENABLED) {
        const fallbackError =
          (tasksResult.status === "rejected" && shouldFallbackToLegacy(tasksResult.reason) && tasksResult.reason) ||
          (documentsResult.status === "rejected" && shouldFallbackToLegacy(documentsResult.reason) && documentsResult.reason) ||
          (planningResult.status === "rejected" && shouldFallbackToLegacy(planningResult.reason) && planningResult.reason);
        if (fallbackError) {
          navigate(`/acces/${encodeURIComponent(token)}`, { replace: true });
          return;
        }
      }
      setTasksState(tasksResult.status === "fulfilled" ? { loading: false, error: null, data: tasksResult.value } : { loading: false, error: getErrorMessage(tasksResult.reason, "Erreur chargement taches."), data: [] });
      setDocumentsState(documentsResult.status === "fulfilled" ? { loading: false, error: null, data: documentsResult.value } : { loading: false, error: getErrorMessage(documentsResult.reason, "Erreur chargement documents."), data: [] });
      setPlanningState(planningResult.status === "fulfilled" ? { loading: false, error: null, data: planningResult.value } : { loading: false, error: getErrorMessage(planningResult.reason, "Erreur chargement planning."), data: { chantier_id: selectedChantierId, lots: [] } });
      setTimeState(timeResult.status === "fulfilled" ? { loading: false, error: null, data: timeResult.value } : { loading: false, error: getErrorMessage(timeResult.reason, "Erreur chargement temps."), data: [] });
      setMaterielState(materielResult.status === "fulfilled" ? { loading: false, error: null, data: materielResult.value } : { loading: false, error: getErrorMessage(materielResult.reason, "Erreur chargement materiel."), data: [] });
    }
    void loadChantierData();
    return () => {
      alive = false;
    };
  }, [bootError, bootLoading, navigate, reloadTick, selectedChantierId, token]);

  useEffect(() => {
    if (!token || bootLoading || bootError) return;
    if (chantiers.length === 0) {
      setDashboardTasksState(EMPTY_DASHBOARD_TASKS_STATE);
      setDashboardMaterielState(EMPTY_DASHBOARD_MATERIEL_STATE);
      return;
    }
    let alive = true;
    async function loadDashboardData() {
      setDashboardTasksState({ loading: true, error: null, data: [] });
      setDashboardMaterielState({ loading: true, error: null, data: [] });
      const taskLoads = await Promise.allSettled(chantiers.map(async (chantier) => ({ chantier, rows: await intervenantGetTasks(token, chantier.id) })));
      const materielLoads = await Promise.allSettled(chantiers.map(async (chantier) => ({ chantier, rows: await intervenantMaterielList(token, chantier.id) })));
      if (!alive) return;
      const dashboardTasks: DashboardTaskItem[] = [];
      let dashboardTasksError: string | null = null;
      taskLoads.forEach((result) => {
        if (result.status === "fulfilled") result.value.rows.forEach((task) => dashboardTasks.push({ chantier: result.value.chantier, task }));
        else if (!dashboardTasksError) dashboardTasksError = getErrorMessage(result.reason, "Erreur chargement accueil.");
      });
      const dashboardMateriel: DashboardMaterielItem[] = [];
      let dashboardMaterielError: string | null = null;
      materielLoads.forEach((result) => {
        if (result.status === "fulfilled") result.value.rows.forEach((row) => dashboardMateriel.push({ chantier: result.value.chantier, row }));
        else if (!dashboardMaterielError) dashboardMaterielError = getErrorMessage(result.reason, "Erreur chargement demandes materiel.");
      });
      setDashboardTasksState({ loading: false, error: dashboardTasksError, data: dashboardTasks });
      setDashboardMaterielState({ loading: false, error: dashboardMaterielError, data: dashboardMateriel });
    }
    void loadDashboardData();
    return () => {
      alive = false;
    };
  }, [bootError, bootLoading, chantiers, reloadTick, token]);
  function logoutIntervenant() {
    clearStoredToken();
    clearStoredChantierId();
    setToken("");
    setSessionInfo(null);
    setChantiers([]);
    setSelectedChantierId("");
    navigate("/", { replace: true });
  }

  function chooseChantier(nextChantierId: string) {
    if (!nextChantierId || nextChantierId === selectedChantierId) return;
    if (!chantiers.some((chantier) => chantier.id === nextChantierId)) return;
    setSelectedChantierId(nextChantierId);
    persistChantierId(nextChantierId);
  }

  function openMobileHome() {
    setMobileGlobalTab("home");
    setActiveTab("accueil");
  }

  function openMobileSites() {
    setMobileGlobalTab("sites");
  }

  function openMobileSite(chantierId: string) {
    chooseChantier(chantierId);
    setMobileGlobalTab("site");
    if (activeTab === "accueil") {
      setActiveTab("temps");
    }
  }

  const activeChantier = useMemo(() => chantiers.find((chantier) => chantier.id === selectedChantierId) ?? null, [chantiers, selectedChantierId]);
  const filteredChantiers = useMemo(() => {
    const query = sidebarChantierQuery.trim().toLowerCase();
    if (!query) return chantiers;
    return chantiers.filter((chantier) => chantierSearchText(chantier).includes(query));
  }, [chantiers, sidebarChantierQuery]);
  const prioritizedTasks = useMemo(() => {
    return [...tasksState.data].sort((a, b) => {
      const bucketDelta = taskPortalPriority(a) - taskPortalPriority(b);
      if (bucketDelta !== 0) return bucketDelta;
      const planningDelta = taskPlanningDateValue(a) - taskPlanningDateValue(b);
      if (planningDelta !== 0) return planningDelta;
      const orderDelta = Number(a.order_index ?? 0) - Number(b.order_index ?? 0);
      if (orderDelta !== 0) return orderDelta;
      return a.titre.localeCompare(b.titre, "fr");
    });
  }, [tasksState.data]);
  const selectedTimeTask = useMemo(() => prioritizedTasks.find((task) => task.id === timeTaskId) ?? null, [prioritizedTasks, timeTaskId]);
  const filteredTimeTasks = useMemo(() => {
    const query = timeTaskSearch.trim().toLowerCase();
    if (!query) return prioritizedTasks;
    return prioritizedTasks.filter((task) => task.titre.toLowerCase().includes(query));
  }, [prioritizedTasks, timeTaskSearch]);
  const dashboardTasksSorted = useMemo(() => {
    return [...dashboardTasksState.data].sort((a, b) => {
      const aTime = taskPlanningDateValue(a.task);
      const bTime = taskPlanningDateValue(b.task);
      if (aTime !== bTime) return aTime - bTime;
      const bucketDelta = taskPortalPriority(a.task) - taskPortalPriority(b.task);
      if (bucketDelta !== 0) return bucketDelta;
      return a.task.titre.localeCompare(b.task.titre, "fr");
    });
  }, [dashboardTasksState.data]);
  const dashboardWeekStart = useMemo(() => startOfWeekIso(new Date()), []);
  const dashboardWeekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDaysIso(dashboardWeekStart, index)), [dashboardWeekStart]);
  const dashboardWeekGroups = useMemo(() => dashboardWeekDays.map((isoDate) => ({ isoDate, items: dashboardTasksSorted.filter((item) => taskAnchorDate(item.task) === isoDate) })), [dashboardTasksSorted, dashboardWeekDays]);
  const upcomingDashboardTasks = useMemo(() => dashboardTasksSorted.filter((item) => {
    const anchor = taskAnchorDate(item.task);
    return !!anchor && Date.parse(anchor) >= Date.parse(`${dashboardWeekStart}T00:00:00`);
  }), [dashboardTasksSorted, dashboardWeekStart]);
  const openDashboardMateriel = useMemo(() => [...dashboardMaterielState.data].filter((item) => isOpenMaterielStatus(item.row.statut)).sort((a, b) => {
    const aTs = a.row.created_at ? Date.parse(a.row.created_at) : 0;
    const bTs = b.row.created_at ? Date.parse(b.row.created_at) : 0;
    return bTs - aTs;
  }), [dashboardMaterielState.data]);
  const latestTimeEntry = useMemo(() => timeState.data[0] ?? null, [timeState.data]);
  const contentTitle = activeTab === "accueil" ? "Accueil intervenant" : activeChantier?.nom ?? "Selection chantier";
  const contentSubtitle = activeTab === "accueil" ? `${chantiers.length} chantier${chantiers.length > 1 ? "s" : ""} accessible${chantiers.length > 1 ? "s" : ""}` : chantierDateSummary(activeChantier);

  function selectTimeTask(task: IntervenantTask) {
    setTimeTaskId(task.id);
    setTimeTaskSearch("");
    setTimeTaskListOpen(false);
    setTimeFeedback(null);
  }

  function jumpToTimeEntry() {
    setActiveTab("temps");
    setTimeDate(todayIsoDate());
    const suggestedTask = (latestTimeEntry?.task_id && prioritizedTasks.find((task) => task.id === latestTimeEntry.task_id)) || prioritizedTasks[0] || null;
    if (suggestedTask) setTimeTaskId(suggestedTask.id);
  }

  async function onCreateTimeEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedChantierId) return;
    if (!timeTaskId) {
      setTimeFeedback({ type: "error", message: "Choisir une tache." });
      return;
    }
    const quantity = Number(String(timeQuantity).replace(",", "."));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setTimeFeedback({ type: "error", message: "Saisir une quantite valide." });
      return;
    }
    setTimeSaving(true);
    setTimeFeedback(null);
    try {
      await intervenantTimeCreate(token, { chantier_id: selectedChantierId, task_id: timeTaskId, work_date: timeDate || todayIsoDate(), quantite_realisee: quantity, note: timeNote.trim() || null });
      setTimeFeedback({ type: "success", message: "Saisie enregistree." });
      setTimeQuantity("");
      setTimeNote("");
      setTimeDate(todayIsoDate());
      setTimeTaskId(null);
      setTimeTaskSearch("");
      setTimeTaskListOpen(false);
      setReloadTick((value) => value + 1);
    } catch (error) {
      const message = getErrorMessage(error, "Impossible d'enregistrer la saisie.");
      setTimeFeedback({ type: "error", message: isTaskIdRequiredError(message) ? "Choisir une tache." : message });
    } finally {
      setTimeSaving(false);
    }
  }

  async function onDeleteTimeEntry(entry: IntervenantTimeEntry) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm("Supprimer cette saisie ?")) return;
    setTimeDeletingId(entry.id);
    setTimeFeedback(null);
    try {
      await intervenantTimeDelete(token, entry.id);
      setTimeFeedback({ type: "success", message: "Saisie supprimee." });
      setReloadTick((value) => value + 1);
    } catch (error) {
      setTimeFeedback({ type: "error", message: getErrorMessage(error, "Impossible de supprimer la saisie.") });
    } finally {
      setTimeDeletingId(null);
    }
  }
  async function onCreateMateriel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedChantierId) return;
    if (!materielTitre.trim()) {
      setMaterielFeedback({ type: "error", message: "Renseigner une description." });
      return;
    }
    const quantityValue = materielQuantite.trim() ? Number(String(materielQuantite).replace(",", ".")) : null;
    if (quantityValue !== null && (!Number.isFinite(quantityValue) || quantityValue <= 0)) {
      setMaterielFeedback({ type: "error", message: "Saisir une quantite valide." });
      return;
    }
    setMaterielSaving(true);
    setMaterielFeedback(null);
    try {
      await intervenantMaterielCreate(token, { chantier_id: selectedChantierId, task_id: materielTaskId || null, titre: materielTitre.trim(), quantite: quantityValue, unite: materielUnite.trim() || null, commentaire: materielCommentaire.trim() || null, date_souhaitee: materielDate || null });
      setMaterielFeedback({ type: "success", message: "Demande envoyee." });
      setMaterielTitre("");
      setMaterielTaskId("");
      setMaterielQuantite("1");
      setMaterielUnite("");
      setMaterielDate("");
      setMaterielCommentaire("");
      setReloadTick((value) => value + 1);
    } catch (error) {
      setMaterielFeedback({ type: "error", message: getErrorMessage(error, "Impossible d'envoyer la demande.") });
    } finally {
      setMaterielSaving(false);
    }
  }

  async function onCreateQuickMateriel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !quickMaterielChantierId) {
      setQuickMaterielFeedback({ type: "error", message: "Choisir un chantier." });
      return;
    }
    if (!quickMaterielTitre.trim()) {
      setQuickMaterielFeedback({ type: "error", message: "Renseigner une description." });
      return;
    }
    const quantityValue = quickMaterielQuantite.trim() ? Number(String(quickMaterielQuantite).replace(",", ".")) : null;
    if (quantityValue !== null && (!Number.isFinite(quantityValue) || quantityValue <= 0)) {
      setQuickMaterielFeedback({ type: "error", message: "Saisir une quantite valide." });
      return;
    }
    setQuickMaterielSaving(true);
    setQuickMaterielFeedback(null);
    try {
      await intervenantMaterielCreate(token, { chantier_id: quickMaterielChantierId, titre: quickMaterielTitre.trim(), quantite: quantityValue });
      setQuickMaterielFeedback({ type: "success", message: "Demande envoyee." });
      setQuickMaterielTitre("");
      setQuickMaterielQuantite("1");
      setReloadTick((value) => value + 1);
    } catch (error) {
      setQuickMaterielFeedback({ type: "error", message: getErrorMessage(error, "Impossible d'envoyer la demande.") });
    } finally {
      setQuickMaterielSaving(false);
    }
  }

  if (bootLoading) {
    return <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-700">Chargement du portail intervenant...</div>;
  }

  if (bootError) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-700">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Acces intervenant indisponible</div>
          <div className="mt-2 text-sm text-slate-600">{bootError}</div>
          {isInvalidTokenError(bootError) ? <button type="button" onClick={() => navigate("/", { replace: true })} className="mt-4 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Retour accueil</button> : null}
        </div>
      </div>
    );
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-slate-100 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-slate-900 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-7xl md:grid md:grid-cols-[18rem_minmax(0,1fr)] md:gap-5">
        <aside className="hidden md:block">
          <div className="sticky top-4 space-y-4">
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Intervenant</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{sessionInfo?.intervenant.nom || "Portail intervenant"}</div>
              <div className="mt-1 text-xs text-slate-500">Session {sessionInfo?.expires_at ? `jusqu'au ${formatDateTimeFr(sessionInfo.expires_at)}` : "active"}</div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setReloadTick((value) => value + 1)} className="flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">Rafraichir</button>
                <button type="button" onClick={logoutIntervenant} className="flex-1 rounded-full border border-red-200 px-3 py-2 text-sm font-medium text-red-700">Deconnexion</button>
              </div>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Chantiers</div>
              <input className="mt-3 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={sidebarChantierQuery} onChange={(e) => setSidebarChantierQuery(e.target.value)} placeholder="Rechercher un chantier" />
              <div className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto pr-1">
                {filteredChantiers.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-3 text-sm text-slate-500">Aucun chantier trouve.</div> : filteredChantiers.map((chantier) => {
                  const selected = chantier.id === selectedChantierId;
                  return <button key={chantier.id} type="button" onClick={() => chooseChantier(chantier.id)} className={["w-full rounded-2xl border px-3 py-3 text-left", selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-900"].join(" ")}><div className="text-sm font-semibold">{chantier.nom}</div><div className={selected ? "mt-1 text-xs text-slate-200" : "mt-1 text-xs text-slate-500"}>{chantier.client || "Client non renseigne"}</div></button>;
                })}
              </div>
            </section>
            <nav className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
              {(["accueil","temps","taches","planning","documents","materiel","messages"] as PortalTab[]).map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={["block w-full rounded-2xl px-3 py-2 text-left text-sm font-medium", activeTab === tab ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"].join(" ")}>{tab === "accueil" ? "Accueil" : tab === "taches" ? "Taches" : tab.charAt(0).toUpperCase() + tab.slice(1)}</button>)}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 space-y-3 md:space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:hidden">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-base font-semibold text-slate-900">{sessionInfo?.intervenant.nom || "Portail intervenant"}</div><div className="mt-1 text-xs text-slate-500">Session {sessionInfo?.expires_at ? `jusqu'au ${formatDateTimeFr(sessionInfo.expires_at)}` : "active"}</div></div><div className="flex shrink-0 gap-2"><button type="button" onClick={openMobileHome} className={["rounded-full px-3 py-1.5 text-xs font-medium", mobileGlobalTab === "home" ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-700"].join(" ")}>Accueil</button><button type="button" onClick={() => setPortalOptionsOpen((value) => !value)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700">Options</button></div></div>
            {portalOptionsOpen ? <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setReloadTick((value) => value + 1)} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">Rafraichir</button><button type="button" onClick={logoutIntervenant} className="rounded-full border border-red-200 px-3 py-2 text-sm font-medium text-red-700">Deconnexion</button></div> : null}
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm md:hidden"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={openMobileHome} className={["rounded-2xl px-3 py-2 text-sm font-medium", mobileGlobalTab === "home" ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-700"].join(" ")}>Accueil</button><button type="button" onClick={openMobileSites} className={["rounded-2xl px-3 py-2 text-sm font-medium", mobileGlobalTab !== "home" ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-700"].join(" ")}>Chantiers</button></div></section>
          {mobileGlobalTab === "sites" ? <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:hidden"><div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Chantiers accessibles</div><input className="mt-3 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={sidebarChantierQuery} onChange={(e) => setSidebarChantierQuery(e.target.value)} placeholder="Rechercher un chantier" /><div className="mt-3 space-y-2">{filteredChantiers.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-3 text-sm text-slate-500">Aucun chantier trouve.</div> : filteredChantiers.map((chantier) => <button key={chantier.id} type="button" onClick={() => openMobileSite(chantier.id)} className="block w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left"><div className="text-sm font-semibold text-slate-900">{chantier.nom}</div><div className="mt-1 text-xs text-slate-500">{chantier.client || "Client non renseigne"}</div></button>)}</div></section> : null}
          {mobileGlobalTab === "site" && selectedChantierId ? <section className="space-y-3 md:hidden"><button type="button" onClick={openMobileSites} className="block w-full rounded-3xl border border-blue-200 bg-blue-50 px-4 py-3 text-left shadow-sm"><div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Chantier</div><div className="mt-1 text-sm font-semibold text-slate-900">Chantier : {activeChantier?.nom ?? "Choisir un chantier"} ▾</div></button><nav className="no-scrollbar flex gap-2 overflow-x-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">{(["temps","taches","planning","documents","materiel","messages"] as PortalTab[]).map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={["shrink-0 rounded-full px-3 py-2 text-sm font-medium", activeTab === tab ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-700"].join(" ")}>{tab === "taches" ? "Taches" : tab.charAt(0).toUpperCase() + tab.slice(1)}</button>)}</nav></section> : null}
          <section className={["rounded-3xl border border-slate-200 bg-white p-4 shadow-sm", mobileGlobalTab === "sites" ? "hidden md:block" : ""].join(" ")}><div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div className="min-w-0"><div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{activeTab === "accueil" ? "Dashboard" : "Chantier selectionne"}</div><div className="mt-1 text-lg font-semibold text-slate-900">{contentTitle}</div><div className="mt-1 text-sm text-slate-500">{contentSubtitle}</div>{activeTab !== "accueil" && activeChantier ? <div className="mt-2 text-xs text-slate-500">{activeChantier.client || "Client non renseigne"}{activeChantier.adresse ? ` - ${activeChantier.adresse}` : ""}</div> : null}</div>{activeTab !== "accueil" && activeChantier ? <div className="text-sm text-slate-500">Avancement: {activeChantier.avancement ?? 0}%</div> : null}</div></section>
          {chantiers.length === 0 ? <section className={["rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm", mobileGlobalTab === "sites" ? "hidden md:block" : ""].join(" ")}><div className="text-lg font-semibold text-slate-900">Aucun chantier accessible</div><div className="mt-2 text-sm text-slate-500">Votre lien est valide, mais aucun chantier n'est rattache a cette session.</div></section> : <section className={["rounded-3xl border border-slate-200 bg-white p-4 shadow-sm", mobileGlobalTab === "sites" ? "hidden md:block" : ""].join(" ")}>
            {activeTab === "accueil" ? <div className="space-y-4"><div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]"><div className="space-y-4"><section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-semibold text-slate-900">Semaine en cours</div><div className="mt-1 text-xs text-slate-500">Planning global tous chantiers</div>{dashboardTasksState.loading ? <div className="mt-3 text-sm text-slate-600">Chargement du planning global...</div> : dashboardTasksState.error ? <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{dashboardTasksState.error}</div> : dashboardWeekGroups.some((group) => group.items.length > 0) ? <div className="mt-3 space-y-3">{dashboardWeekGroups.map((group) => group.items.length === 0 ? null : <div key={group.isoDate} className="rounded-2xl border border-slate-200 bg-white p-3"><div className="text-sm font-semibold text-slate-900">{formatDateFr(group.isoDate)}</div><div className="mt-2 space-y-2">{group.items.map((item) => <div key={`${item.chantier.id}-${item.task.id}`} className="rounded-2xl border border-slate-200 p-3"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.chantier.nom}</div><div className="mt-1 text-sm font-medium text-slate-900" style={TITLE_CLAMP_STYLE}>{item.task.titre}</div><div className="mt-1 text-xs text-slate-500">{resolveTaskLot(item.task)} - {statusLabel(item.task.status)}</div></div>)}</div></div>)}</div> : upcomingDashboardTasks.length > 0 ? <div className="mt-3 space-y-2"><div className="text-sm font-medium text-slate-700">Prochaines taches</div>{upcomingDashboardTasks.slice(0, 6).map((item) => <div key={`${item.chantier.id}-${item.task.id}`} className="rounded-2xl border border-slate-200 bg-white p-3"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.chantier.nom}</div><div className="mt-1 text-sm font-medium text-slate-900" style={TITLE_CLAMP_STYLE}>{item.task.titre}</div><div className="mt-1 text-xs text-slate-500">{taskAnchorDate(item.task) ? formatDateFr(taskAnchorDate(item.task)) : "Date non renseignee"}</div></div>)}</div> : <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-500">Aucune tache planifiee sur la semaine.</div>}</section><section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-semibold text-slate-900">Demandes materiel en cours</div><div className="mt-1 text-xs text-slate-500">Vue multi-chantiers</div>{dashboardMaterielState.loading ? <div className="mt-3 text-sm text-slate-600">Chargement des demandes...</div> : dashboardMaterielState.error ? <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{dashboardMaterielState.error}</div> : openDashboardMateriel.length === 0 ? <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-500">Aucune demande en cours.</div> : <div className="mt-3 space-y-2">{openDashboardMateriel.slice(0, 6).map((item) => <div key={item.row.id} className="rounded-2xl border border-slate-200 bg-white p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.chantier.nom}</div><div className="mt-1 text-sm font-medium text-slate-900">{item.row.titre}</div></div><span className={["inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", materielStatusClass(item.row.statut)].join(" ")}>{materielStatusLabel(item.row.statut)}</span></div><div className="mt-1 text-xs text-slate-500">{formatQuantity(item.row.quantite, item.row.unite, "-")}</div></div>)}</div>}</section></div><div className="space-y-4"><section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-semibold text-slate-900">Actions rapides</div><div className="mt-3 space-y-3"><button type="button" onClick={jumpToTimeEntry} className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700">Ajouter du temps</button><form onSubmit={onCreateQuickMateriel} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3"><div className="text-sm font-medium text-slate-900">Demande materiel rapide</div><select className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={quickMaterielChantierId} onChange={(e) => { setQuickMaterielChantierId(e.target.value); setQuickMaterielFeedback(null); }}>{chantiers.map((chantier) => <option key={chantier.id} value={chantier.id}>{chantier.nom}</option>)}</select><input className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={quickMaterielTitre} onChange={(e) => { setQuickMaterielTitre(e.target.value); setQuickMaterielFeedback(null); }} placeholder="Description" /><input className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={quickMaterielQuantite} onChange={(e) => { setQuickMaterielQuantite(e.target.value); setQuickMaterielFeedback(null); }} placeholder="Quantite" />{quickMaterielFeedback ? <div className={["rounded-2xl border px-3 py-2 text-sm", quickMaterielFeedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"].join(" ")}>{quickMaterielFeedback.message}</div> : null}<button type="submit" disabled={quickMaterielSaving} className="w-full rounded-2xl border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 disabled:opacity-60">{quickMaterielSaving ? "Envoi..." : "Envoyer"}</button></form></div></section><section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-semibold text-slate-900">Messagerie</div><div className="mt-1 text-xs text-slate-500">Apercu des derniers echanges</div></div><span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700">0 non lu</span></div><div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-500">La messagerie detaillee n'est pas encore exposee par le backend. L'onglet est prepare pour la suite.</div></section></div></div></div> : null}
            {activeTab === "taches" ? <div className="space-y-3">{tasksState.loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Chargement des taches...</div> : tasksState.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{tasksState.error}</div> : prioritizedTasks.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Aucune tache assignee.</div> : prioritizedTasks.map((task) => { const progress = taskQuantityProgress(task); return <article key={task.id} className="rounded-2xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-slate-900" style={TITLE_CLAMP_STYLE}>{task.titre}</div><div className="mt-1 text-xs text-slate-500">Lot: {resolveTaskLot(task)}</div><div className="mt-1 text-xs text-slate-500">Qte totale: {formatQuantity(task.quantite, task.unite, "-")}</div><div className="mt-1 text-xs text-slate-500">Qte realisee: {formatQuantity(task.quantite_realisee, task.unite)}</div><div className="mt-1 text-xs text-slate-500">Avancement: {Math.round(progress ?? 0)}%</div></div><span className={["inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", statusBadgeClass(task.status)].join(" ")}>{statusLabel(task.status)}</span></div></article>; })}</div> : null}
            {activeTab === "temps" ? <div className="space-y-3"><form onSubmit={onCreateTimeEntry} className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="text-sm font-semibold text-slate-900">Ajouter une saisie</div><div className="mt-3 grid gap-3 md:grid-cols-2"><div className="space-y-2 md:col-span-2"><label className="text-xs font-medium text-slate-600">Tache</label><div className="rounded-2xl border border-slate-200 bg-white p-2"><input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={timeTaskSearch} onChange={(e) => { setTimeTaskSearch(e.target.value); setTimeTaskListOpen(true); setTimeFeedback(null); }} onFocus={() => setTimeTaskListOpen(true)} placeholder="Rechercher une tache..." />{selectedTimeTask ? <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"><div className="font-medium text-slate-800">Tache choisie</div><div className="mt-1" style={TITLE_CLAMP_STYLE}>{selectedTimeTask.titre}</div></div> : null}{timeTaskListOpen ? <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">{filteredTimeTasks.length === 0 ? <div className="px-2 py-3 text-sm text-slate-500">Aucune tache correspondante.</div> : filteredTimeTasks.map((task) => <button key={task.id} type="button" onClick={() => selectTimeTask(task)} className={["block w-full rounded-xl border px-3 py-2 text-left", task.id === timeTaskId ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-900"].join(" ")}><div className="text-sm font-medium" style={TITLE_CLAMP_STYLE}>{task.titre}</div><div className={task.id === timeTaskId ? "mt-1 text-xs text-slate-200" : "mt-1 text-xs text-slate-500"}>{resolveTaskLot(task)} - {statusLabel(task.status)}</div></button>)}</div> : null}<div className="mt-2 text-[11px] text-slate-500">{prioritizedTasks.length} taches disponibles</div></div></div><div className="space-y-1"><label className="text-xs font-medium text-slate-600">Date</label><input className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" type="date" value={timeDate} onChange={(e) => { setTimeDate(e.target.value); setTimeFeedback(null); }} /></div><div className="space-y-1"><label className="text-xs font-medium text-slate-600">Quantite realisee</label>{selectedTimeTask ? <div className="text-xs text-slate-500">Qte totale: {formatQuantity(selectedTimeTask.quantite, selectedTimeTask.unite, "-")}</div> : null}<input className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" inputMode="decimal" value={timeQuantity} onChange={(e) => { setTimeQuantity(e.target.value); setTimeFeedback(null); }} placeholder={selectedTimeTask?.unite ? `Quantite (${selectedTimeTask.unite})` : "Quantite"} /><div className="text-[11px] text-slate-500">L'avancement est calcule a partir de cette quantite.</div></div><div className="space-y-1 md:col-span-2"><label className="text-xs font-medium text-slate-600">Observations</label><textarea className="min-h-24 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={timeNote} onChange={(e) => { setTimeNote(e.target.value); setTimeFeedback(null); }} placeholder="Observations (optionnel)" /></div></div>{timeFeedback ? <div className={["mt-3 rounded-2xl border px-3 py-2 text-sm", timeFeedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"].join(" ")}>{timeFeedback.message}</div> : null}<div className="mt-3 flex justify-end"><button type="submit" disabled={timeSaving} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{timeSaving ? "Enregistrement..." : "Enregistrer"}</button></div></form>
            <section className="space-y-2"><div className="text-sm font-semibold text-slate-900">Dernieres saisies</div>{timeState.loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Chargement du temps...</div> : timeState.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{isTaskIdRequiredError(timeState.error) ? "Choisir une tache." : timeState.error}</div> : timeState.data.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Aucune saisie pour ce chantier.</div> : timeState.data.map((entry) => <article key={entry.id} className="rounded-2xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-slate-900">{formatDateFr(entry.work_date)}</div><div className="mt-1 text-xs text-slate-500">{entry.task_titre || "Tache"}</div><div className="mt-1 text-xs text-slate-500">Quantite: {formatQuantity(entry.quantite_realisee, entry.task_unite)}</div>{entry.note ? <div className="mt-1 text-xs text-slate-500">Note: {entry.note}</div> : null}</div><button type="button" disabled={timeDeletingId === entry.id} onClick={() => void onDeleteTimeEntry(entry)} className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-60">{timeDeletingId === entry.id ? "Suppression..." : "Supprimer"}</button></div></article>)}</section></div> : null}
            {activeTab === "planning" ? <div className="space-y-2">{planningState.loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Chargement du planning...</div> : planningState.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{planningState.error}</div> : planningState.data.lots.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Aucun lot planifie.</div> : planningState.data.lots.map((lot) => <article key={lot.lot} className="rounded-2xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold text-slate-900">{lot.lot}</div><div className="text-xs text-slate-500">{lot.progress_pct.toFixed(1)}%</div></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, lot.progress_pct))}%` }} /></div><div className="mt-2 text-xs text-slate-500">Debut: {formatDateFr(lot.start_date)} - Fin: {formatDateFr(lot.end_date)}</div><div className="mt-1 text-xs text-slate-500">Taches: {lot.done_tasks}/{lot.total_tasks} - Duree estimee: {lot.total_duration_days} j</div></article>)}</div> : null}
            {activeTab === "documents" ? <div className="space-y-2">{documentsState.loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Chargement des documents...</div> : documentsState.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{documentsState.error}</div> : documentsState.data.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Aucun document disponible.</div> : documentsState.data.map((doc) => <article key={doc.id} className="rounded-2xl border border-slate-200 p-3"><div className="text-sm font-semibold text-slate-900">{doc.title || doc.file_name || "Document"}</div><div className="mt-1 text-xs text-slate-500">{doc.category || "-"} - {doc.document_type || "-"} - {formatDateTimeFr(doc.created_at)}</div></article>)}</div> : null}
            {activeTab === "materiel" ? <div className="space-y-3"><form onSubmit={onCreateMateriel} className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="text-sm font-semibold text-slate-900">Nouvelle demande materiel</div><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5"><select className="rounded-2xl border border-slate-200 px-3 py-2 text-sm xl:col-span-2" value={materielTaskId} onChange={(e) => { setMaterielTaskId(e.target.value); setMaterielFeedback(null); }}><option value="">Tache concernee (optionnel)</option>{prioritizedTasks.map((task) => <option key={task.id} value={task.id}>{task.titre}</option>)}</select><input className="rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder="Description" value={materielTitre} onChange={(e) => { setMaterielTitre(e.target.value); setMaterielFeedback(null); }} /><input className="rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder="Quantite" value={materielQuantite} onChange={(e) => { setMaterielQuantite(e.target.value); setMaterielFeedback(null); }} /><input className="rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder="Unite" value={materielUnite} onChange={(e) => { setMaterielUnite(e.target.value); setMaterielFeedback(null); }} /><input className="rounded-2xl border border-slate-200 px-3 py-2 text-sm xl:col-span-2" type="date" value={materielDate} onChange={(e) => { setMaterielDate(e.target.value); setMaterielFeedback(null); }} /><input className="rounded-2xl border border-slate-200 px-3 py-2 text-sm xl:col-span-3" placeholder="Commentaire" value={materielCommentaire} onChange={(e) => { setMaterielCommentaire(e.target.value); setMaterielFeedback(null); }} /></div>{materielFeedback ? <div className={["mt-3 rounded-2xl border px-3 py-2 text-sm", materielFeedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"].join(" ")}>{materielFeedback.message}</div> : null}<div className="mt-3 flex justify-end"><button type="submit" disabled={materielSaving} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{materielSaving ? "Envoi..." : "Envoyer"}</button></div></form>{materielState.loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Chargement des demandes...</div> : materielState.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{materielState.error}</div> : materielState.data.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Aucune demande materiel.</div> : materielState.data.map((row) => <article key={row.id} className="rounded-2xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-slate-900">{row.titre}</div>{(row.task_titre || row.task_id) ? <div className="mt-1 text-xs text-slate-500">Tache: {row.task_titre ?? prioritizedTasks.find((task) => task.id === row.task_id)?.titre ?? "-"}</div> : null}<div className="mt-1 text-xs text-slate-500">Quantite: {row.quantite ?? "-"} {row.unite || ""}</div><div className="mt-1 text-xs text-slate-500">Souhaitee: {formatDateFr(row.date_souhaitee)}</div>{row.commentaire ? <div className="mt-1 text-xs text-slate-500">Commentaire: {row.commentaire}</div> : null}{row.admin_commentaire ? <div className="mt-1 text-xs text-slate-500">Admin: {row.admin_commentaire}</div> : null}</div><span className={["inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", materielStatusClass(row.statut)].join(" ")}>{materielStatusLabel(row.statut)}</span></div></article>)}</div> : null}
            {activeTab === "messages" ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">La messagerie n'est pas encore branchee sur une source de donnees. Le layout est en place pour stabiliser la navigation desktop et mobile.</div> : null}
          </section>}
          {LEGACY_FALLBACK_ENABLED && import.meta.env.DEV ? <p className="text-xs text-slate-400">Compat fallback active: /acces/:token sera utilise uniquement si les RPC ne sont pas disponibles.</p> : null}
        </main>
      </div>
    </div>
  );
}
