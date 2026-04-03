import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  intervenantConsigneList,
  intervenantConsigneMarkRead,
  intervenantDailyChecklistGet,
  intervenantDailyChecklistUpsert,
  intervenantGetChantiers,
  intervenantGetDocuments,
  intervenantInformationRequestCreate,
  intervenantInformationRequestList,
  intervenantGetPlanning,
  intervenantGetTasks,
  intervenantMaterielCreate,
  intervenantMaterielList,
  intervenantReserveList,
  intervenantReserveMarkLifted,
  intervenantTerrainFeedbackCreate,
  intervenantTerrainFeedbackList,
  intervenantTerrainFeedbackUploadPhoto,
  intervenantSession,
  intervenantTimeCreate,
  intervenantTimeDelete,
  intervenantTimeList,
  type IntervenantChantier,
  type IntervenantConsigne,
  type IntervenantDailyChecklist,
  type IntervenantDocument,
  type IntervenantInformationRequest,
  type IntervenantMateriel,
  type IntervenantPlanning,
  type IntervenantReserve,
  type IntervenantTask,
  type IntervenantTerrainFeedback,
  type IntervenantTimeEntry,
} from "../services/intervenantPortal.service";
import TodayChecklistCard, {
  type DailyChecklistItemKey,
  type DailyChecklistValues,
} from "../components/TodayChecklistCard";
import TerrainFeedbackPanel from "../components/intervenantPortal/TerrainFeedbackPanel";
import {
  PortalBadge,
  PortalCard,
  PortalEmptyState,
  PortalField,
  PortalPillButton,
  PortalPrimaryButton,
  PortalSectionHeading,
  PortalSecondaryButton,
  portalInputClass,
} from "../components/intervenantPortal/PortalUi";
import { useI18n } from "../i18n";
import {
  clearStoredIntervenantChantierId,
  clearStoredIntervenantSession,
  extractIntervenantToken,
  persistIntervenantChantierId,
  persistIntervenantToken,
  readStoredIntervenantChantierId,
  readStoredIntervenantToken,
} from "../utils/intervenantSession";

type PortalTab = "accueil" | "consignes" | "reserves" | "temps" | "taches" | "planning" | "documents" | "materiel" | "messages" | "retours";
type LoadState<T> = { loading: boolean; error: string | null; data: T };
type DashboardTaskItem = { chantier: IntervenantChantier; task: IntervenantTask };
type MobileGlobalTab = "home" | "sites" | "site";
type MobileQuickAction = "time" | "materiel" | null;

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
const EMPTY_INFO_REQUESTS_STATE: LoadState<IntervenantInformationRequest[]> = { loading: false, error: null, data: [] };
const EMPTY_TERRAIN_FEEDBACKS_STATE: LoadState<IntervenantTerrainFeedback[]> = { loading: false, error: null, data: [] };
const EMPTY_CONSIGNES_STATE: LoadState<IntervenantConsigne[]> = { loading: false, error: null, data: [] };
const EMPTY_RESERVES_STATE: LoadState<IntervenantReserve[]> = { loading: false, error: null, data: [] };
const EMPTY_DASHBOARD_TASKS_STATE: LoadState<DashboardTaskItem[]> = { loading: false, error: null, data: [] };

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

function formatDateLabel(value: string | null, locale: string): string {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(locale);
}

function formatDateTimeLabel(value: string | null, locale: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(locale);
}

function formatQuantity(value: number | null, unit: string | null, locale: string, empty = "0"): string {
  if (value === null) return empty;
  const formatted = value.toLocaleString(locale, { maximumFractionDigits: 2 });
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

function checklistValuesFromRow(row: IntervenantDailyChecklist | null | undefined): DailyChecklistValues {
  return {
    photos_taken: row?.photos_taken ?? null,
    tasks_reported: row?.tasks_reported ?? null,
    time_logged: row?.time_logged ?? null,
    has_equipment: row?.has_equipment ?? null,
    has_materials: row?.has_materials ?? null,
    has_information: row?.has_information ?? null,
  };
}

function checklistStarted(row: IntervenantDailyChecklist | null | undefined): boolean {
  if (!row) return false;
  return Boolean(
    row.id ||
      row.created_at ||
      row.updated_at ||
      row.validated_at ||
      Object.values(checklistValuesFromRow(row)).some((value) => value !== null),
  );
}

function checklistStatus(row: IntervenantDailyChecklist | null | undefined): "pending" | "in_progress" | "validated" {
  if (row?.validated_at) return "validated";
  if (checklistStarted(row)) return "in_progress";
  return "pending";
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

function isInvalidQuantityError(message: string): boolean {
  return String(message ?? "").toLowerCase().includes("invalid_quantite_realisee");
}

function taskQuantityProgress(task: IntervenantTask): number | null {
  if (task.quantite === null || task.quantite <= 0) return null;
  const done = Number(task.quantite_realisee ?? 0);
  return Math.max(0, Math.min(100, (done / task.quantite) * 100));
}

function buildLegacyQuantityDelta(task: IntervenantTask | null, targetProgressPercent: number): number | null {
  if (!task || task.quantite === null || task.quantite <= 0) return null;
  const currentQuantity = Math.max(0, Number(task.quantite_realisee ?? 0));
  const targetQuantity = (task.quantite * clampPercent(targetProgressPercent)) / 100;
  const delta = Math.round((targetQuantity - currentQuantity) * 10000) / 10000;
  return delta > 0 ? delta : null;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function roundPercent(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.round(clampPercent(value));
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

function statusLabel(
  status: string | null,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const normalized = String(status ?? "").toUpperCase();
  if (["FAIT", "TERMINE", "DONE", "COMPLETED"].includes(normalized)) return t("intervenantPortal.taskStatus.done");
  if (["EN_COURS", "IN_PROGRESS"].includes(normalized)) return t("intervenantPortal.taskStatus.inProgress");
  return t("intervenantPortal.taskStatus.todo");
}

function resolveTaskLot(
  task: IntervenantTask,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  return String(task.lot ?? task.corps_etat ?? "").trim() || t("intervenantPortal.lotFallback");
}

function materielStatusLabel(
  status: IntervenantMateriel["statut"],
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  return t(`common.materielStatus.${status}`);
}

function feedbackClass(type: "success" | "error"): string {
  return type === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";
}

function tabToneClass(status: string | null): "neutral" | "amber" | "green" {
  const normalized = String(status ?? "").toUpperCase();
  if (["FAIT", "TERMINE", "DONE", "COMPLETED"].includes(normalized)) return "green";
  if (["EN_COURS", "IN_PROGRESS"].includes(normalized)) return "amber";
  return "neutral";
}

function chantierDateSummary(
  chantier: IntervenantChantier | null,
  locale: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!chantier) return "";
  const start = chantier.date_debut ?? chantier.planning_start_date;
  const end = chantier.date_fin_prevue ?? chantier.planning_end_date;
  if (start && end) return `${formatDateLabel(start, locale)} -> ${formatDateLabel(end, locale)}`;
  if (start) return t("intervenantPortal.siteDates.since", { date: formatDateLabel(start, locale) });
  if (end) return t("intervenantPortal.siteDates.until", { date: formatDateLabel(end, locale) });
  return t("intervenantPortal.siteDates.unknown");
}

function chantierSearchText(chantier: IntervenantChantier): string {
  return [chantier.nom, chantier.client, chantier.adresse].filter(Boolean).join(" ").toLowerCase();
}

function isConsigneActiveForDate(consigne: IntervenantConsigne, isoDate: string): boolean {
  if (!consigne.date_debut) return false;
  if (isoDate < consigne.date_debut) return false;
  if (consigne.date_fin && isoDate > consigne.date_fin) return false;
  return true;
}

function consignePriorityWeight(priority: IntervenantConsigne["priority"]): number {
  if (priority === "urgente") return 0;
  if (priority === "importante") return 1;
  return 2;
}

function compareConsignes(a: IntervenantConsigne, b: IntervenantConsigne): number {
  if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
  const priorityDelta = consignePriorityWeight(a.priority) - consignePriorityWeight(b.priority);
  if (priorityDelta !== 0) return priorityDelta;
  return String(b.date_debut).localeCompare(String(a.date_debut));
}

function consignePriorityMeta(
  priority: IntervenantConsigne["priority"],
): { label: string; tone: "neutral" | "amber" | "red" } {
  if (priority === "urgente") return { label: "Urgente", tone: "red" };
  if (priority === "importante") return { label: "Importante", tone: "amber" };
  return { label: "Normale", tone: "neutral" };
}

function reserveStatusMeta(
  status: IntervenantReserve["status"],
  t: (key: string, params?: Record<string, string | number>) => string,
): { label: string; tone: "blue" | "green" | "amber" } {
  if (status === "LEVEE") return { label: t("intervenantPortal.reserves.statusLevee"), tone: "green" };
  if (status === "EN_COURS") return { label: t("intervenantPortal.reserves.statusInProgress"), tone: "blue" };
  return { label: t("intervenantPortal.reserves.statusOpen"), tone: "amber" };
}

function reservePriorityMeta(
  priority: IntervenantReserve["priority"],
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (priority === "URGENTE") return t("intervenantPortal.reserves.priorityUrgent");
  if (priority === "BASSE") return t("intervenantPortal.reserves.priorityLow");
  return t("intervenantPortal.reserves.priorityNormal");
}

export default function IntervenantPortalPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, locale, setLanguage, t } = useI18n();
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
  const [accessLinkInput, setAccessLinkInput] = useState("");

  const [tasksState, setTasksState] = useState<LoadState<IntervenantTask[]>>(EMPTY_TASKS_STATE);
  const [documentsState, setDocumentsState] = useState<LoadState<IntervenantDocument[]>>(EMPTY_DOCUMENTS_STATE);
  const [planningState, setPlanningState] = useState<LoadState<IntervenantPlanning>>(EMPTY_PLANNING_STATE);
  const [timeState, setTimeState] = useState<LoadState<IntervenantTimeEntry[]>>(EMPTY_TIME_STATE);
  const [materielState, setMaterielState] = useState<LoadState<IntervenantMateriel[]>>(EMPTY_MATERIEL_STATE);
  const [dashboardTasksState, setDashboardTasksState] = useState<LoadState<DashboardTaskItem[]>>(EMPTY_DASHBOARD_TASKS_STATE);

  const [reloadTick, setReloadTick] = useState(0);
  const [portalOptionsOpen, setPortalOptionsOpen] = useState(false);
  const [mobileGlobalTab, setMobileGlobalTab] = useState<MobileGlobalTab>("home");
  const [mobileQuickAction, setMobileQuickAction] = useState<MobileQuickAction>(null);
  const [sidebarChantierQuery, setSidebarChantierQuery] = useState("");
  const [timeTaskId, setTimeTaskId] = useState<string | null>(null);
  const [timeTaskSearch, setTimeTaskSearch] = useState("");
  const [timeTaskListOpen, setTimeTaskListOpen] = useState(false);
  const [timeFeedback, setTimeFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [timeDate, setTimeDate] = useState(todayIsoDate());
  const [timeHours, setTimeHours] = useState("");
  const [timeProgressPercent, setTimeProgressPercent] = useState("0");
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
  const [dailyChecklist, setDailyChecklist] = useState<IntervenantDailyChecklist | null>(null);
  const [dailyChecklistLoading, setDailyChecklistLoading] = useState(false);
  const [dailyChecklistSaving, setDailyChecklistSaving] = useState(false);
  const [dailyChecklistError, setDailyChecklistError] = useState<string | null>(null);
  const [dailyChecklistFeedback, setDailyChecklistFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [infoRequestState, setInfoRequestState] = useState<LoadState<IntervenantInformationRequest[]>>(EMPTY_INFO_REQUESTS_STATE);
  const [infoRequestSubject, setInfoRequestSubject] = useState("");
  const [infoRequestMessage, setInfoRequestMessage] = useState("");
  const [infoRequestSaving, setInfoRequestSaving] = useState(false);
  const [infoRequestFeedback, setInfoRequestFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [terrainFeedbackState, setTerrainFeedbackState] = useState<LoadState<IntervenantTerrainFeedback[]>>(EMPTY_TERRAIN_FEEDBACKS_STATE);
  const [consignesState, setConsignesState] = useState<LoadState<IntervenantConsigne[]>>(EMPTY_CONSIGNES_STATE);
  const [reservesState, setReservesState] = useState<LoadState<IntervenantReserve[]>>(EMPTY_RESERVES_STATE);
  const [terrainFeedbackChantierId, setTerrainFeedbackChantierId] = useState("");
  const [terrainFeedbackCategory, setTerrainFeedbackCategory] = useState("observation_chantier");
  const [terrainFeedbackUrgency, setTerrainFeedbackUrgency] = useState("normale");
  const [terrainFeedbackTitle, setTerrainFeedbackTitle] = useState("");
  const [terrainFeedbackDescription, setTerrainFeedbackDescription] = useState("");
  const [terrainFeedbackFiles, setTerrainFeedbackFiles] = useState<File[]>([]);
  const [terrainFeedbackSaving, setTerrainFeedbackSaving] = useState(false);
  const [terrainFeedbackFeedback, setTerrainFeedbackFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [consigneMarkingId, setConsigneMarkingId] = useState<string | null>(null);
  const [reserveLiftingId, setReserveLiftingId] = useState<string | null>(null);
  const [reserveFeedback, setReserveFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  useEffect(() => {
    let alive = true;
    async function bootstrap() {
      setBootLoading(true);
      setBootError(null);
      const candidateToken = extractIntervenantToken(queryToken || readStoredIntervenantToken());
      if (!candidateToken) {
        if (!alive) return;
        setToken("");
        setSessionInfo(null);
        setChantiers([]);
        setSelectedChantierId("");
        setBootError(t("intervenantPortal.missingToken"));
        setBootLoading(false);
        return;
      }
      try {
        setToken(candidateToken);
        persistIntervenantToken(candidateToken);
        const [sessionData, chantierRows] = await Promise.all([
          intervenantSession(candidateToken),
          intervenantGetChantiers(candidateToken),
        ]);
        if (!alive) return;
        const chantierIds = new Set(chantierRows.map((row) => row.id));
        const storedChantierId = readStoredIntervenantChantierId();
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
        if (nextChantierId) persistIntervenantChantierId(nextChantierId);
        else clearStoredIntervenantChantierId();
        if (queryToken) {
          navigate("/intervenant", { replace: true });
        }
        setBootLoading(false);
      } catch (error) {
        if (!alive) return;
        const message = getErrorMessage(error, t("intervenantPortal.errors.portalLoad"));
        if (isInvalidTokenError(message)) {
          clearStoredIntervenantSession();
          setToken("");
        }
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
  }, [navigate, queryChantierId, queryToken, t]);

  useEffect(() => {
    if (!token || bootLoading || bootError) return;
    let alive = true;
    async function loadDailyChecklist() {
      setDailyChecklistLoading(true);
      setDailyChecklistError(null);
      try {
        const row = await intervenantDailyChecklistGet(token, todayIsoDate());
        if (!alive) return;
        setDailyChecklist(row);
      } catch (error) {
        if (!alive) return;
        setDailyChecklist(null);
        setDailyChecklistError(getErrorMessage(error, t("intervenantPortal.errors.checklistLoad")));
      } finally {
        if (alive) setDailyChecklistLoading(false);
      }
    }
    void loadDailyChecklist();
    return () => {
      alive = false;
    };
  }, [bootError, bootLoading, t, token]);

  useEffect(() => {
    if (bootLoading || bootError) return;
    if (chantiers.length === 0) {
      if (selectedChantierId) setSelectedChantierId("");
      clearStoredIntervenantChantierId();
      setMobileGlobalTab("home");
      return;
    }
    const ids = new Set(chantiers.map((chantier) => chantier.id));
    if (selectedChantierId && ids.has(selectedChantierId)) {
      persistIntervenantChantierId(selectedChantierId);
      return;
    }
    const stored = readStoredIntervenantChantierId();
    const nextChantierId = stored && ids.has(stored) ? stored : chantiers[0].id;
    if (nextChantierId && nextChantierId !== selectedChantierId) setSelectedChantierId(nextChantierId);
  }, [bootError, bootLoading, chantiers, selectedChantierId]);

  useEffect(() => {
    if (chantiers.length === 0) {
      setQuickMaterielChantierId("");
      setTerrainFeedbackChantierId("");
      return;
    }
    setQuickMaterielChantierId((current) => {
      const validCurrent = current && chantiers.some((chantier) => chantier.id === current);
      if (validCurrent) return current;
      return selectedChantierId || chantiers[0].id;
    });
    setTerrainFeedbackChantierId((current) => {
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
    setTimeHours("");
    setTimeProgressPercent("0");
    setTimeNote("");
    setTimeDate(todayIsoDate());
    setMaterielTaskId("");
    setMaterielFeedback(null);
    setInfoRequestFeedback(null);
    setTerrainFeedbackFeedback(null);
    setTerrainFeedbackFiles([]);
    setTerrainFeedbackChantierId(selectedChantierId);
    setReserveFeedback(null);
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
      setInfoRequestState({ loading: true, error: null, data: [] });
      setTerrainFeedbackState({ loading: true, error: null, data: [] });
      setConsignesState({ loading: true, error: null, data: [] });
      setReservesState({ loading: true, error: null, data: [] });
      const [tasksResult, documentsResult, planningResult, timeResult, materielResult, infoRequestsResult, terrainFeedbackResult, consignesResult, reservesResult] = await Promise.allSettled([
        intervenantGetTasks(token, selectedChantierId),
        intervenantGetDocuments(token, selectedChantierId),
        intervenantGetPlanning(token, selectedChantierId),
        intervenantTimeList(token, selectedChantierId),
        intervenantMaterielList(token, selectedChantierId),
        intervenantInformationRequestList(token, selectedChantierId),
        intervenantTerrainFeedbackList(token, selectedChantierId),
        intervenantConsigneList(token, selectedChantierId),
        intervenantReserveList(token, selectedChantierId),
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
      setTasksState(tasksResult.status === "fulfilled" ? { loading: false, error: null, data: tasksResult.value } : { loading: false, error: getErrorMessage(tasksResult.reason, t("intervenantPortal.errors.tasksLoad")), data: [] });
      setDocumentsState(documentsResult.status === "fulfilled" ? { loading: false, error: null, data: documentsResult.value } : { loading: false, error: getErrorMessage(documentsResult.reason, t("intervenantPortal.errors.documentsLoad")), data: [] });
      setPlanningState(planningResult.status === "fulfilled" ? { loading: false, error: null, data: planningResult.value } : { loading: false, error: getErrorMessage(planningResult.reason, t("intervenantPortal.errors.planningLoad")), data: { chantier_id: selectedChantierId, lots: [] } });
      setTimeState(timeResult.status === "fulfilled" ? { loading: false, error: null, data: timeResult.value } : { loading: false, error: getErrorMessage(timeResult.reason, t("intervenantPortal.errors.timeLoad")), data: [] });
      setMaterielState(materielResult.status === "fulfilled" ? { loading: false, error: null, data: materielResult.value } : { loading: false, error: getErrorMessage(materielResult.reason, t("intervenantPortal.errors.materialLoad")), data: [] });
      setInfoRequestState(infoRequestsResult.status === "fulfilled" ? { loading: false, error: null, data: infoRequestsResult.value } : { loading: false, error: getErrorMessage(infoRequestsResult.reason, t("intervenantPortal.errors.infoLoad")), data: [] });
      setTerrainFeedbackState(terrainFeedbackResult.status === "fulfilled" ? { loading: false, error: null, data: terrainFeedbackResult.value } : { loading: false, error: getErrorMessage(terrainFeedbackResult.reason, t("intervenantPortal.errors.terrainFeedbackLoad")), data: [] });
      setConsignesState(consignesResult.status === "fulfilled" ? { loading: false, error: null, data: consignesResult.value } : { loading: false, error: getErrorMessage(consignesResult.reason, t("intervenantPortal.errors.consignesLoad")), data: [] });
      setReservesState(reservesResult.status === "fulfilled" ? { loading: false, error: null, data: reservesResult.value } : { loading: false, error: getErrorMessage(reservesResult.reason, t("intervenantPortal.errors.reservesLoad")), data: [] });
    }
    void loadChantierData();
    return () => {
      alive = false;
    };
  }, [bootError, bootLoading, navigate, reloadTick, selectedChantierId, t, token]);

  useEffect(() => {
    if (!token || bootLoading || bootError) return;
    if (chantiers.length === 0) {
      setDashboardTasksState(EMPTY_DASHBOARD_TASKS_STATE);
      return;
    }
    let alive = true;
    async function loadDashboardData() {
      setDashboardTasksState({ loading: true, error: null, data: [] });
      const taskLoads = await Promise.allSettled(chantiers.map(async (chantier) => ({ chantier, rows: await intervenantGetTasks(token, chantier.id) })));
      if (!alive) return;
      const dashboardTasks: DashboardTaskItem[] = [];
      let dashboardTasksError: string | null = null;
      taskLoads.forEach((result) => {
        if (result.status === "fulfilled") result.value.rows.forEach((task) => dashboardTasks.push({ chantier: result.value.chantier, task }));
        else if (!dashboardTasksError) dashboardTasksError = getErrorMessage(result.reason, t("intervenantPortal.errors.homeLoad"));
      });
      setDashboardTasksState({ loading: false, error: dashboardTasksError, data: dashboardTasks });
    }
    void loadDashboardData();
    return () => {
      alive = false;
    };
  }, [bootError, bootLoading, chantiers, reloadTick, t, token]);

  function logoutIntervenant() {
    clearStoredIntervenantSession();
    setToken("");
    setSessionInfo(null);
    setChantiers([]);
    setSelectedChantierId("");
    navigate("/", { replace: true });
  }

  function openIntervenantLink(rawValue: string) {
    const nextToken = extractIntervenantToken(rawValue);
    if (!nextToken) {
      setBootError(t("intervenantPortal.invalidAccessLink"));
      return;
    }
    setAccessLinkInput("");
    setBootError(null);
    navigate(`/intervenant?token=${encodeURIComponent(nextToken)}`, { replace: true });
  }

  function submitIntervenantLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openIntervenantLink(accessLinkInput);
  }

  function chooseChantier(nextChantierId: string) {
    if (!nextChantierId || nextChantierId === selectedChantierId) return;
    if (!chantiers.some((chantier) => chantier.id === nextChantierId)) return;
    setSelectedChantierId(nextChantierId);
    persistIntervenantChantierId(nextChantierId);
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

  function tabLabel(tab: PortalTab) {
    return t(`intervenantPortal.tabs.${tab}`);
  }

  function formatPortalDate(value: string | null) {
    return formatDateLabel(value, locale);
  }

  function formatPortalDateTime(value: string | null) {
    return formatDateTimeLabel(value, locale);
  }

  function formatPortalHours(value: number | null, empty = "-") {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return empty;
    return `${Math.round(Number(value) * 100) / 100} h`;
  }

  function formatPortalQuantity(value: number | null, unit: string | null, empty = "0") {
    return formatQuantity(value, unit, locale, empty);
  }

  const activeChantier = useMemo(() => chantiers.find((chantier) => chantier.id === selectedChantierId) ?? null, [chantiers, selectedChantierId]);
  const filteredChantiers = useMemo(() => {
    const query = sidebarChantierQuery.trim().toLowerCase();
    if (!query) return chantiers;
    return chantiers.filter((chantier) => chantierSearchText(chantier).includes(query));
  }, [chantiers, sidebarChantierQuery]);
  const latestTaskProgressById = useMemo(() => {
    const next = new Map<string, number>();
    timeState.data.forEach((entry) => {
      if (!entry.task_id || entry.progress_percent === null || next.has(entry.task_id)) return;
      next.set(entry.task_id, clampPercent(entry.progress_percent));
    });
    return next;
  }, [timeState.data]);
  function taskCurrentProgress(task: IntervenantTask): number | null {
    return latestTaskProgressById.get(task.id) ?? taskQuantityProgress(task);
  }
  const prioritizedTasks = useMemo(() => {
    return [...tasksState.data].sort((a, b) => {
      const aProgress = taskCurrentProgress(a);
      const bProgress = taskCurrentProgress(b);
      const bucketDelta =
        (aProgress !== null
          ? aProgress > 0 && aProgress < 100
            ? 0
            : aProgress <= 0
              ? 1
              : 2
          : taskPortalPriority(a)) -
        (bProgress !== null
          ? bProgress > 0 && bProgress < 100
            ? 0
            : bProgress <= 0
              ? 1
              : 2
          : taskPortalPriority(b));
      if (bucketDelta !== 0) return bucketDelta;
      const planningDelta = taskPlanningDateValue(a) - taskPlanningDateValue(b);
      if (planningDelta !== 0) return planningDelta;
      const orderDelta = Number(a.order_index ?? 0) - Number(b.order_index ?? 0);
      if (orderDelta !== 0) return orderDelta;
      return a.titre.localeCompare(b.titre, "fr");
    });
  }, [tasksState.data, latestTaskProgressById]);
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
  const selectedTimeTaskProgress = useMemo(
    () => (selectedTimeTask ? roundPercent(taskCurrentProgress(selectedTimeTask)) : null),
    [selectedTimeTask, latestTaskProgressById],
  );
  const todayChecklistDate = useMemo(() => todayIsoDate(), []);
  const tomorrowChecklistDate = useMemo(() => addDaysIso(todayChecklistDate, 1), [todayChecklistDate]);
  const dailyChecklistValues = useMemo(() => checklistValuesFromRow(dailyChecklist), [dailyChecklist]);
  const dailyChecklistCurrentStatus = useMemo(() => checklistStatus(dailyChecklist), [dailyChecklist]);
  const latestInfoRequests = useMemo(() => infoRequestState.data.slice(0, 3), [infoRequestState.data]);
  const openInfoRequestCount = useMemo(
    () => infoRequestState.data.filter((request) => request.status !== "traitee").length,
    [infoRequestState.data],
  );
  const activeConsignes = useMemo(
    () =>
      consignesState.data
        .filter((row) => isConsigneActiveForDate(row, todayChecklistDate))
        .sort(compareConsignes),
    [consignesState.data, todayChecklistDate],
  );
  const sortedConsignes = useMemo(
    () => [...consignesState.data].sort(compareConsignes),
    [consignesState.data],
  );
  const unreadConsignesCount = useMemo(
    () => activeConsignes.filter((row) => !row.is_read).length,
    [activeConsignes],
  );
  const sortedReserves = useMemo(
    () =>
      [...reservesState.data].sort((a, b) => {
        if (a.status !== b.status) return a.status === "LEVEE" ? 1 : -1;
        return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
      }),
    [reservesState.data],
  );
  const openReservesCount = useMemo(
    () => reservesState.data.filter((row) => row.status !== "LEVEE").length,
    [reservesState.data],
  );
  const todayDashboardTasks = useMemo(
    () => dashboardTasksSorted.filter((item) => taskAnchorDate(item.task) === todayChecklistDate).slice(0, 4),
    [dashboardTasksSorted, todayChecklistDate],
  );
  const tomorrowDashboardTasks = useMemo(
    () => dashboardTasksSorted.filter((item) => taskAnchorDate(item.task) === tomorrowChecklistDate).slice(0, 4),
    [dashboardTasksSorted, tomorrowChecklistDate],
  );
  const todoDashboardTasks = useMemo(
    () =>
      dashboardTasksSorted
        .filter((item) => taskPortalPriority(item.task) < 2)
        .slice(0, 5),
    [dashboardTasksSorted],
  );
  const contentTitle = activeTab === "accueil" ? t("intervenantPortal.portalTitle") : activeChantier?.nom ?? t("intervenantPortal.selectedSiteFallback");
  const contentSubtitle = activeTab === "accueil"
    ? `${chantiers.length} ${t("intervenantPortal.tabs.chantiers").toLowerCase()}`
    : chantierDateSummary(activeChantier, locale, t);
  const dailyChecklistDateLabel = formatPortalDate(todayChecklistDate);
  const dailyChecklistValidatedLabel = dailyChecklist?.validated_at ? formatPortalDateTime(dailyChecklist.validated_at) : null;
  const entryTabs = ["temps", "materiel", "retours", "messages"] as PortalTab[];
  const consultTabs = ["consignes", "reserves", "planning", "taches", "documents"] as PortalTab[];

  useEffect(() => {
    if (!selectedTimeTask) {
      setTimeProgressPercent("0");
      return;
    }
    const nextPercent = roundPercent(taskCurrentProgress(selectedTimeTask)) ?? 0;
    setTimeProgressPercent(String(nextPercent));
  }, [selectedTimeTask, latestTaskProgressById]);

  const weekPlanningCard = (
    <PortalCard tone="default">
      <PortalSectionHeading
        eyebrow={t("intervenantPortal.currentWeek")}
        title={t("intervenantPortal.currentWeek")}
        subtitle={t("intervenantPortal.globalPlanningAllSites")}
      />
      {dashboardTasksState.loading ? (
        <div className="mt-4 text-sm text-slate-600">{t("intervenantPortal.loadingGlobalPlanning")}</div>
      ) : dashboardTasksState.error ? (
        <div className="mt-4 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{dashboardTasksState.error}</div>
      ) : dashboardWeekGroups.some((group) => group.items.length > 0) ? (
        <div className="mt-4 space-y-3">
          {dashboardWeekGroups.map((group) =>
            group.items.length === 0 ? null : (
              <div key={group.isoDate} className="rounded-[1rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-sm font-semibold text-slate-900">{formatPortalDate(group.isoDate)}</div>
                <div className="mt-3 space-y-2">
                  {group.items.map((item) => (
                    <div key={`${item.chantier.id}-${item.task.id}`} className="rounded-[1rem] border border-slate-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">{item.chantier.nom}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900" style={TITLE_CLAMP_STYLE}>{item.task.titre}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {resolveTaskLot(item.task, t)} • {statusLabel(item.task.status, t)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      ) : upcomingDashboardTasks.length > 0 ? (
        <div className="mt-4 space-y-2">
          {upcomingDashboardTasks.slice(0, 6).map((item) => (
            <div key={`${item.chantier.id}-${item.task.id}`} className="rounded-[1rem] border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">{item.chantier.nom}</div>
              <div className="mt-1 text-sm font-semibold text-slate-900" style={TITLE_CLAMP_STYLE}>{item.task.titre}</div>
              <div className="mt-1 text-xs text-slate-500">
                {taskAnchorDate(item.task) ? formatPortalDate(taskAnchorDate(item.task)) : t("intervenantPortal.dateNotProvided")}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <PortalEmptyState>{t("intervenantPortal.noTaskPlannedWeek")}</PortalEmptyState>
        </div>
      )}
    </PortalCard>
  );

  function selectTimeTask(task: IntervenantTask) {
    setTimeTaskId(task.id);
    setTimeTaskSearch("");
    setTimeTaskListOpen(false);
    setTimeFeedback(null);
  }

  function preferredChecklistChantierId() {
    return selectedChantierId || activeChantier?.id || chantiers[0]?.id || "";
  }

  async function saveDailyChecklist(
    patch: Partial<DailyChecklistValues> & { validate?: boolean },
    feedbackMessage: string,
    fallbackError: string,
  ) {
    if (!token) return;
    const nextChantierId = preferredChecklistChantierId() || dailyChecklist?.chantier_id || null;
    setDailyChecklistSaving(true);
    setDailyChecklistFeedback(null);
    setDailyChecklistError(null);
    try {
      const nextRow = await intervenantDailyChecklistUpsert(token, {
        chantier_id: nextChantierId,
        checklist_date: todayChecklistDate,
        photos_taken: patch.photos_taken ?? dailyChecklistValues.photos_taken,
        tasks_reported: patch.tasks_reported ?? dailyChecklistValues.tasks_reported,
        time_logged: patch.time_logged ?? dailyChecklistValues.time_logged,
        has_equipment: patch.has_equipment ?? dailyChecklistValues.has_equipment,
        has_materials: patch.has_materials ?? dailyChecklistValues.has_materials,
        has_information: patch.has_information ?? dailyChecklistValues.has_information,
        validate: patch.validate ?? false,
      });
      setDailyChecklist(nextRow);
      setDailyChecklistFeedback({ type: "success", message: feedbackMessage });
    } catch (error) {
      const message = getErrorMessage(error, fallbackError);
      setDailyChecklistError(message);
      setDailyChecklistFeedback({ type: "error", message });
    } finally {
      setDailyChecklistSaving(false);
    }
  }

  function onToggleDailyChecklistItem(key: DailyChecklistItemKey) {
    if (dailyChecklistCurrentStatus === "validated") return;
    const currentValue = dailyChecklistValues[key];
    const nextValue = currentValue === true ? false : true;
    void saveDailyChecklist({ [key]: nextValue }, t("intervenantPortal.feedback.checklistSaved"), t("intervenantPortal.errors.checklistSave"));
  }

  function onValidateDailyChecklist() {
    if (dailyChecklistCurrentStatus === "validated") return;
    void saveDailyChecklist({ validate: true }, t("intervenantPortal.feedback.checklistValidated"), t("intervenantPortal.errors.checklistValidate"));
  }

  function openChecklistMaterialRequest(kind: "materiel" | "materiaux") {
    const chantierId = preferredChecklistChantierId();
    if (chantierId) chooseChantier(chantierId);
    setMobileGlobalTab("site");
    setActiveTab("materiel");
    setMaterielFeedback(null);
    setMaterielTaskId("");
    setMaterielDate(todayIsoDate());
    setMaterielTitre(
      kind === "materiaux"
        ? t("intervenantPortal.dailyChecklist.prefill.materialsTitle")
        : t("intervenantPortal.dailyChecklist.prefill.materialTitle"),
    );
    setMaterielCommentaire("");
  }

  function openChecklistInformationRequest() {
    const chantierId = preferredChecklistChantierId();
    if (chantierId) chooseChantier(chantierId);
    setMobileGlobalTab("site");
    setActiveTab("messages");
    setInfoRequestFeedback(null);
    setInfoRequestSubject(t("intervenantPortal.dailyChecklist.prefill.informationSubject"));
    setInfoRequestMessage(t("intervenantPortal.dailyChecklist.prefill.informationMessage"));
  }

  async function onCreateTimeEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedChantierId) return;
    if (!timeTaskId) {
      setTimeFeedback({ type: "error", message: t("intervenantPortal.errors.chooseTask") });
      return;
    }
    const hours = Number(String(timeHours).replace(",", "."));
    if (!Number.isFinite(hours) || hours <= 0) {
      setTimeFeedback({ type: "error", message: t("intervenantPortal.errors.validHours") });
      return;
    }
    const progressValue = Number(String(timeProgressPercent).replace(",", "."));
    if (!Number.isFinite(progressValue) || progressValue < 0 || progressValue > 100) {
      setTimeFeedback({ type: "error", message: t("intervenantPortal.errors.validProgress") });
      return;
    }
    const currentProgress = selectedTimeTask ? roundPercent(taskCurrentProgress(selectedTimeTask)) ?? 0 : 0;
    if (
      progressValue < currentProgress &&
      typeof window !== "undefined" &&
      !window.confirm(t("intervenantPortal.time.lowerProgressConfirm", { current: currentProgress, next: Math.round(progressValue) }))
    ) {
      return;
    }
    setTimeSaving(true);
    setTimeFeedback(null);
    try {
      const payload = {
        chantier_id: selectedChantierId,
        task_id: timeTaskId,
        work_date: timeDate || todayIsoDate(),
        duration_hours: hours,
        progress_percent: clampPercent(progressValue),
        note: timeNote.trim() || null,
      };
      const legacyQuantityDelta = buildLegacyQuantityDelta(selectedTimeTask, progressValue);
      try {
        await intervenantTimeCreate(token, payload);
      } catch (error) {
        const message = getErrorMessage(error, t("intervenantPortal.errors.saveTime"));
        if (!isInvalidQuantityError(message)) throw error;
        if (legacyQuantityDelta !== null) {
          await intervenantTimeCreate(token, {
            ...payload,
            quantite_realisee: legacyQuantityDelta,
          });
        } else {
          throw new Error(
            selectedTimeTask?.quantite && selectedTimeTask.quantite > 0
              ? t("intervenantPortal.errors.validQuantity")
              : t("intervenantPortal.errors.taskQuantityRequiredForProgress"),
          );
        }
      }
      setTimeFeedback({ type: "success", message: t("intervenantPortal.feedback.timeSaved") });
      setTimeHours("");
      setTimeProgressPercent("0");
      setTimeNote("");
      setTimeDate(todayIsoDate());
      setTimeTaskId(null);
      setTimeTaskSearch("");
      setTimeTaskListOpen(false);
      if (mobileQuickAction === "time") {
        setMobileQuickAction(null);
      }
      setReloadTick((value) => value + 1);
    } catch (error) {
      const message = getErrorMessage(error, t("intervenantPortal.errors.saveTime"));
      setTimeFeedback({ type: "error", message: isTaskIdRequiredError(message) ? t("intervenantPortal.errors.chooseTask") : message });
    } finally {
      setTimeSaving(false);
    }
  }

  async function onDeleteTimeEntry(entry: IntervenantTimeEntry) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(t("intervenantPortal.time.deleteConfirm"))) return;
    setTimeDeletingId(entry.id);
    setTimeFeedback(null);
    try {
      await intervenantTimeDelete(token, entry.id);
      setTimeFeedback({ type: "success", message: t("intervenantPortal.feedback.timeDeleted") });
      setReloadTick((value) => value + 1);
    } catch (error) {
      setTimeFeedback({ type: "error", message: getErrorMessage(error, t("intervenantPortal.errors.deleteTime")) });
    } finally {
      setTimeDeletingId(null);
    }
  }
  async function onCreateMateriel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedChantierId) return;
    if (!materielTitre.trim()) {
      setMaterielFeedback({ type: "error", message: t("intervenantPortal.errors.descriptionRequired") });
      return;
    }
    const quantityValue = materielQuantite.trim() ? Number(String(materielQuantite).replace(",", ".")) : null;
    if (quantityValue !== null && (!Number.isFinite(quantityValue) || quantityValue <= 0)) {
      setMaterielFeedback({ type: "error", message: t("intervenantPortal.errors.validQuantity") });
      return;
    }
    setMaterielSaving(true);
    setMaterielFeedback(null);
    try {
      await intervenantMaterielCreate(token, { chantier_id: selectedChantierId, task_id: materielTaskId || null, titre: materielTitre.trim(), quantite: quantityValue, unite: materielUnite.trim() || null, commentaire: materielCommentaire.trim() || null, date_souhaitee: materielDate || null });
      setMaterielFeedback({ type: "success", message: t("intervenantPortal.feedback.materialSent") });
      setMaterielTitre("");
      setMaterielTaskId("");
      setMaterielQuantite("1");
      setMaterielUnite("");
      setMaterielDate("");
      setMaterielCommentaire("");
      setReloadTick((value) => value + 1);
    } catch (error) {
      setMaterielFeedback({ type: "error", message: getErrorMessage(error, t("intervenantPortal.errors.sendMaterial")) });
    } finally {
      setMaterielSaving(false);
    }
  }

  async function onCreateQuickMateriel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !quickMaterielChantierId) {
      setQuickMaterielFeedback({ type: "error", message: t("intervenantPortal.errors.chooseSite") });
      return;
    }
    if (!quickMaterielTitre.trim()) {
      setQuickMaterielFeedback({ type: "error", message: t("intervenantPortal.errors.descriptionRequired") });
      return;
    }
    const quantityValue = quickMaterielQuantite.trim() ? Number(String(quickMaterielQuantite).replace(",", ".")) : null;
    if (quantityValue !== null && (!Number.isFinite(quantityValue) || quantityValue <= 0)) {
      setQuickMaterielFeedback({ type: "error", message: t("intervenantPortal.errors.validQuantity") });
      return;
    }
    setQuickMaterielSaving(true);
    setQuickMaterielFeedback(null);
    try {
      await intervenantMaterielCreate(token, { chantier_id: quickMaterielChantierId, titre: quickMaterielTitre.trim(), quantite: quantityValue });
      setQuickMaterielFeedback({ type: "success", message: t("intervenantPortal.feedback.materialSent") });
      setQuickMaterielTitre("");
      setQuickMaterielQuantite("1");
      if (mobileQuickAction === "materiel") {
        setMobileQuickAction(null);
      }
      setReloadTick((value) => value + 1);
    } catch (error) {
      setQuickMaterielFeedback({ type: "error", message: getErrorMessage(error, t("intervenantPortal.errors.sendMaterial")) });
    } finally {
      setQuickMaterielSaving(false);
    }
  }

  async function onCreateInfoRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedChantierId) {
      setInfoRequestFeedback({ type: "error", message: t("intervenantPortal.errors.chooseSite") });
      return;
    }
    if (!infoRequestSubject.trim()) {
      setInfoRequestFeedback({ type: "error", message: t("intervenantPortal.errors.infoSubjectRequired") });
      return;
    }
    if (!infoRequestMessage.trim()) {
      setInfoRequestFeedback({ type: "error", message: t("intervenantPortal.errors.infoMessageRequired") });
      return;
    }

    setInfoRequestSaving(true);
    setInfoRequestFeedback(null);
    try {
      await intervenantInformationRequestCreate(token, {
        chantier_id: selectedChantierId,
        request_date: todayIsoDate(),
        subject: infoRequestSubject.trim(),
        message: infoRequestMessage.trim(),
      });
      setInfoRequestFeedback({ type: "success", message: t("intervenantPortal.feedback.infoSent") });
      setInfoRequestSubject("");
      setInfoRequestMessage("");
      setReloadTick((value) => value + 1);
    } catch (error) {
      setInfoRequestFeedback({ type: "error", message: getErrorMessage(error, t("intervenantPortal.errors.sendInfo")) });
    } finally {
      setInfoRequestSaving(false);
    }
  }

  async function onCreateTerrainFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !terrainFeedbackChantierId) {
      setTerrainFeedbackFeedback({ type: "error", message: t("intervenantPortal.errors.chooseSite") });
      return;
    }
    if (!terrainFeedbackTitle.trim()) {
      setTerrainFeedbackFeedback({ type: "error", message: t("intervenantPortal.errors.terrainFeedbackTitleRequired") });
      return;
    }
    if (!terrainFeedbackDescription.trim()) {
      setTerrainFeedbackFeedback({
        type: "error",
        message: t("intervenantPortal.errors.terrainFeedbackDescriptionRequired"),
      });
      return;
    }

    setTerrainFeedbackSaving(true);
    setTerrainFeedbackFeedback(null);
    try {
      const created = await intervenantTerrainFeedbackCreate(token, {
        chantier_id: terrainFeedbackChantierId,
        category: terrainFeedbackCategory,
        urgency: terrainFeedbackUrgency,
        title: terrainFeedbackTitle.trim(),
        description: terrainFeedbackDescription.trim(),
      });

      if (terrainFeedbackFiles.length > 0) {
        try {
          const attachments = await Promise.all(
            terrainFeedbackFiles.map((file) =>
              intervenantTerrainFeedbackUploadPhoto(token, {
                chantier_id: terrainFeedbackChantierId,
                feedback_id: created.id,
                file,
              }),
            ),
          );
          created.attachments = attachments;
        } catch (error) {
          throw new Error(getErrorMessage(error, t("intervenantPortal.errors.terrainFeedbackPhotos")));
        }
      }

      setTerrainFeedbackFeedback({ type: "success", message: t("intervenantPortal.feedback.terrainFeedbackSent") });
      setTerrainFeedbackCategory("observation_chantier");
      setTerrainFeedbackUrgency("normale");
      setTerrainFeedbackTitle("");
      setTerrainFeedbackDescription("");
      setTerrainFeedbackFiles([]);
      if (terrainFeedbackChantierId !== selectedChantierId) {
        chooseChantier(terrainFeedbackChantierId);
      }
      setReloadTick((value) => value + 1);
    } catch (error) {
      setTerrainFeedbackFeedback({
        type: "error",
        message: getErrorMessage(error, t("intervenantPortal.errors.terrainFeedbackCreate")),
      });
    } finally {
      setTerrainFeedbackSaving(false);
    }
  }

  async function onMarkConsigneRead(consigne: IntervenantConsigne) {
    if (!token || consigne.is_read) return;
    setConsigneMarkingId(consigne.id);
    try {
      const result = await intervenantConsigneMarkRead(token, consigne.id);
      setConsignesState((current) => ({
        ...current,
        data: current.data.map((row) =>
          row.id === consigne.id
            ? { ...row, is_read: true, read_at: result.read_at ?? new Date().toISOString() }
            : row,
        ),
      }));
    } catch (error) {
      setConsignesState((current) => ({
        ...current,
        error: getErrorMessage(error, t("intervenantPortal.errors.consigneRead")),
      }));
    } finally {
      setConsigneMarkingId(null);
    }
  }

  async function onMarkReserveLifted(reserve: IntervenantReserve) {
    if (!token || reserve.status === "LEVEE") return;
    setReserveLiftingId(reserve.id);
    setReserveFeedback(null);
    try {
      const updated = await intervenantReserveMarkLifted(token, reserve.id);
      setReservesState((current) => ({
        ...current,
        data: current.data.map((row) => (row.id === reserve.id ? { ...row, ...updated } : row)),
      }));
      setReserveFeedback({ type: "success", message: t("intervenantPortal.feedback.reserveLifted") });
      setReloadTick((value) => value + 1);
    } catch (error) {
      const message = getErrorMessage(error, t("intervenantPortal.errors.reserveLift"));
      setReserveFeedback({ type: "error", message });
      setReservesState((current) => ({ ...current, error: message }));
    } finally {
      setReserveLiftingId(null);
    }
  }

  const checklistCard = (
    <div className="space-y-3">
      <TodayChecklistCard
        status={dailyChecklistCurrentStatus}
        checklistDateLabel={dailyChecklistDateLabel}
        validatedAtLabel={dailyChecklistValidatedLabel}
        values={dailyChecklistValues}
        saving={dailyChecklistSaving || dailyChecklistLoading}
        feedback={dailyChecklistFeedback}
        onToggle={onToggleDailyChecklistItem}
        onValidate={onValidateDailyChecklist}
        onRequestMaterial={() => openChecklistMaterialRequest("materiel")}
        onRequestMaterials={() => openChecklistMaterialRequest("materiaux")}
        onRequestInformation={openChecklistInformationRequest}
      />
      {dailyChecklistError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {dailyChecklistError}
        </div>
      ) : null}
    </div>
  );

  const latestInfoRequestsCard = (
    <PortalCard tone="default">
      <PortalSectionHeading
        eyebrow={t("intervenantPortal.latestMessages")}
        title={t("intervenantPortal.latestMessages")}
        subtitle={t("intervenantPortal.latestMessagesPreview")}
        aside={<PortalBadge tone={openInfoRequestCount > 0 ? "blue" : "neutral"}>{t("intervenantPortal.unreadCount", { count: openInfoRequestCount })}</PortalBadge>}
      />
      {infoRequestState.loading ? (
        <div className="mt-4 rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {t("intervenantPortal.messages.loading")}
        </div>
      ) : infoRequestState.error ? (
        <div className="mt-4 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {infoRequestState.error}
        </div>
      ) : latestInfoRequests.length === 0 ? (
        <div className="mt-4"><PortalEmptyState>{t("intervenantPortal.messages.empty")}</PortalEmptyState></div>
      ) : (
        <div className="mt-4 space-y-3">
          {latestInfoRequests.map((request) => (
            <div key={request.id} className="rounded-[1rem] border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{request.subject}</div>
                  <div className="mt-1 text-xs text-slate-500">{t("intervenantPortal.messages.requestDate", { value: formatPortalDate(request.request_date) })}</div>
                </div>
                <PortalBadge tone={request.status === "traitee" ? "green" : "blue"}>
                  {request.status === "traitee" ? t("intervenantPortal.messages.statusDone") : t("intervenantPortal.messages.statusSent")}
                </PortalBadge>
              </div>
              <div className="mt-2 text-sm text-slate-600">{request.message}</div>
            </div>
          ))}
        </div>
      )}
    </PortalCard>
  );

  const consignesCard = (
    <PortalCard tone="accent" className="border-blue-300 shadow-[0_18px_42px_rgba(30,64,175,0.12)]">
      <PortalSectionHeading
        eyebrow={t("intervenantPortal.consignes.today")}
        title={t("intervenantPortal.consignes.today")}
        subtitle={t("intervenantPortal.consignes.subtitle")}
        aside={<PortalBadge tone={unreadConsignesCount > 0 ? "amber" : "neutral"}>{t("intervenantPortal.unreadCount", { count: unreadConsignesCount })}</PortalBadge>}
      />
      {consignesState.loading ? (
        <div className="mt-4"><PortalEmptyState>{t("intervenantPortal.consignes.loading")}</PortalEmptyState></div>
      ) : consignesState.error ? (
        <div className="mt-4 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {consignesState.error}
        </div>
      ) : activeConsignes.length === 0 ? (
        <div className="mt-4"><PortalEmptyState>{t("intervenantPortal.consignes.emptyToday")}</PortalEmptyState></div>
      ) : (
        <div className="mt-4 space-y-3">
          {activeConsignes.map((consigne) => {
            const priorityMeta = consignePriorityMeta(consigne.priority);
            return (
              <article
                key={consigne.id}
                className={[
                  "rounded-[1rem] border p-4",
                  consigne.is_read ? "border-slate-200 bg-white/90" : "border-blue-200 bg-blue-50/80 shadow-[0_10px_24px_rgba(59,130,246,0.10)]",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                        {consigne.is_read ? t("intervenantPortal.consignes.read") : t("intervenantPortal.consignes.priorityUnread")}
                      </span>
                      <PortalBadge tone={priorityMeta.tone}>{priorityMeta.label}</PortalBadge>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900" style={TITLE_CLAMP_STYLE}>
                      {consigne.title}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {consigne.task_titre ? `${consigne.task_titre} - ` : ""}
                      {consigne.zone_nom ? `${consigne.zone_nom} - ` : ""}
                      {consigne.date_fin
                        ? t("intervenantPortal.consignes.period", { start: formatPortalDate(consigne.date_debut), end: formatPortalDate(consigne.date_fin) })
                        : t("intervenantPortal.consignes.startsOn", { value: formatPortalDate(consigne.date_debut) })}
                    </div>
                  </div>
                  <PortalBadge tone={consigne.is_read ? "green" : "amber"}>
                    {consigne.is_read ? t("intervenantPortal.consignes.read") : t("intervenantPortal.consignes.unread")}
                  </PortalBadge>
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm text-slate-900">{consigne.description}</div>
                {!consigne.is_read ? (
                  <div className="mt-4 flex justify-end">
                    <PortalSecondaryButton
                      type="button"
                      disabled={consigneMarkingId === consigne.id}
                      onClick={() => void onMarkConsigneRead(consigne)}
                      className="w-full sm:w-auto"
                    >
                      {consigneMarkingId === consigne.id
                        ? t("intervenantPortal.consignes.marking")
                        : t("intervenantPortal.consignes.markRead")}
                    </PortalSecondaryButton>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </PortalCard>
  );

  const terrainSummaryCard = (
    <PortalCard tone="default">
      <PortalSectionHeading
        eyebrow="Exécuter"
        title="Aujourd'hui / Demain"
        subtitle="Vue terrain directe : tâches à faire, planning immédiat, consignes importantes."
        aside={<PortalBadge tone={unreadConsignesCount > 0 ? "amber" : "green"}>{unreadConsignesCount} consigne{unreadConsignesCount > 1 ? "s" : ""} non lue{unreadConsignesCount > 1 ? "s" : ""}</PortalBadge>}
      />

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {[
          { title: "Aujourd'hui", items: todayDashboardTasks, empty: "Aucune tâche planifiée aujourd'hui." },
          { title: "Demain", items: tomorrowDashboardTasks, empty: "Aucune tâche planifiée demain." },
          { title: "À faire", items: todoDashboardTasks, empty: "Aucune tâche en attente." },
        ].map((group) => (
          <section key={group.title} className="rounded-[1rem] border border-slate-200 bg-slate-50/80 p-4">
            <div className="text-sm font-semibold text-slate-900">{group.title}</div>
            <div className="mt-3 space-y-2">
              {dashboardTasksState.loading ? (
                <div className="rounded-[1rem] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
                  Chargement...
                </div>
              ) : group.items.length === 0 ? (
                <div className="rounded-[1rem] border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
                  {group.empty}
                </div>
              ) : (
                group.items.map((item) => {
                  const anchorDate = taskAnchorDate(item.task);
                  return (
                    <button
                      key={`${group.title}-${item.chantier.id}-${item.task.id}`}
                      type="button"
                      onClick={() => {
                        chooseChantier(item.chantier.id);
                        setActiveTab("taches");
                        setMobileGlobalTab("site");
                      }}
                      className="w-full rounded-[1rem] border border-slate-200 bg-white px-3 py-3 text-left hover:border-blue-200 hover:bg-blue-50/40"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                        {item.chantier.nom}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900" style={TITLE_CLAMP_STYLE}>
                        {item.task.titre}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {resolveTaskLot(item.task, t)} · {statusLabel(item.task.status, t)}
                        {anchorDate ? ` · ${formatPortalDate(anchorDate)}` : ""}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        ))}
      </div>
    </PortalCard>
  );

  const messagesPanel = (
    <div className="space-y-4">
      <PortalCard tone="default">
        <PortalSectionHeading
          eyebrow={t("intervenantPortal.messages.newRequest")}
          title={t("intervenantPortal.messages.title")}
          subtitle={t("intervenantPortal.messages.subtitle")}
          aside={<PortalBadge tone={openInfoRequestCount > 0 ? "blue" : "neutral"}>{t("intervenantPortal.unreadCount", { count: openInfoRequestCount })}</PortalBadge>}
        />
        <form onSubmit={onCreateInfoRequest} className="mt-4 space-y-4 rounded-[1rem] border border-slate-200 bg-slate-50/80 p-4">
          <PortalField label={t("intervenantPortal.messages.subject")}>
            <input
              className={portalInputClass()}
              value={infoRequestSubject}
              onChange={(event) => {
                setInfoRequestSubject(event.target.value);
                setInfoRequestFeedback(null);
              }}
              placeholder={t("intervenantPortal.messages.subjectPlaceholder")}
            />
          </PortalField>
          <PortalField label={t("intervenantPortal.messages.message")}>
            <textarea
              className={[portalInputClass(), "min-h-32 resize-y"].join(" ")}
              value={infoRequestMessage}
              onChange={(event) => {
                setInfoRequestMessage(event.target.value);
                setInfoRequestFeedback(null);
              }}
              placeholder={t("intervenantPortal.messages.messagePlaceholder")}
            />
          </PortalField>
          {infoRequestFeedback ? (
            <div className={["rounded-[1rem] border px-4 py-3 text-sm", feedbackClass(infoRequestFeedback.type)].join(" ")}>
              {infoRequestFeedback.message}
            </div>
          ) : null}
          <div className="flex justify-end">
            <PortalPrimaryButton type="submit" disabled={infoRequestSaving} className="w-full sm:w-auto">
              {infoRequestSaving ? t("intervenantPortal.messages.sending") : t("intervenantPortal.messages.send")}
            </PortalPrimaryButton>
          </div>
        </form>
      </PortalCard>

      <PortalCard tone="default">
        {infoRequestState.loading ? (
          <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {t("intervenantPortal.messages.loading")}
          </div>
        ) : infoRequestState.error ? (
          <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {infoRequestState.error}
          </div>
        ) : infoRequestState.data.length === 0 ? (
          <PortalEmptyState>{t("intervenantPortal.messages.empty")}</PortalEmptyState>
        ) : (
          <div className="space-y-3">
            {infoRequestState.data.map((request) => (
              <article key={request.id} className="rounded-[1rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{request.subject}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t("intervenantPortal.messages.requestDate", { value: formatPortalDate(request.request_date) })}
                    </div>
                  </div>
                  <PortalBadge tone={request.status === "traitee" ? "green" : "blue"}>
                    {request.status === "traitee"
                      ? t("intervenantPortal.messages.statusDone")
                      : t("intervenantPortal.messages.statusSent")}
                  </PortalBadge>
                </div>
                <div className="mt-2 text-sm text-slate-600">{request.message}</div>
              </article>
            ))}
          </div>
        )}
      </PortalCard>
    </div>
  );

  const terrainFeedbackPanel = (
    <TerrainFeedbackPanel
      t={t}
      chantiers={chantiers}
      activeChantierId={selectedChantierId}
      form={{
        chantier_id: terrainFeedbackChantierId || selectedChantierId || chantiers[0]?.id || "",
        category: terrainFeedbackCategory,
        urgency: terrainFeedbackUrgency,
        title: terrainFeedbackTitle,
        description: terrainFeedbackDescription,
      }}
      onChange={(patch) => {
        if (patch.chantier_id !== undefined) setTerrainFeedbackChantierId(patch.chantier_id);
        if (patch.category !== undefined) setTerrainFeedbackCategory(patch.category);
        if (patch.urgency !== undefined) setTerrainFeedbackUrgency(patch.urgency);
        if (patch.title !== undefined) setTerrainFeedbackTitle(patch.title);
        if (patch.description !== undefined) setTerrainFeedbackDescription(patch.description);
        setTerrainFeedbackFeedback(null);
      }}
      onSubmit={onCreateTerrainFeedback}
      saving={terrainFeedbackSaving}
      feedback={terrainFeedbackFeedback}
      files={terrainFeedbackFiles}
      onFilesChange={(files) => {
        setTerrainFeedbackFiles(files);
        setTerrainFeedbackFeedback(null);
      }}
      listLoading={terrainFeedbackState.loading}
      listError={terrainFeedbackState.error}
      rows={terrainFeedbackState.data}
      formatDate={formatPortalDate}
      formatDateTime={formatPortalDateTime}
    />
  );

  const consignesPanel = (
    <PortalCard tone="default">
      <PortalSectionHeading
        eyebrow={t("intervenantPortal.consignes.title")}
        title={t("intervenantPortal.consignes.title")}
        subtitle={t("intervenantPortal.consignes.subtitle")}
        aside={<PortalBadge tone={unreadConsignesCount > 0 ? "amber" : "neutral"}>{t("intervenantPortal.unreadCount", { count: unreadConsignesCount })}</PortalBadge>}
      />
      {consignesState.loading ? (
        <div className="mt-4"><PortalEmptyState>{t("intervenantPortal.consignes.loading")}</PortalEmptyState></div>
      ) : consignesState.error ? (
        <div className="mt-4 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {consignesState.error}
        </div>
      ) : consignesState.data.length === 0 ? (
        <div className="mt-4"><PortalEmptyState>{t("intervenantPortal.consignes.empty")}</PortalEmptyState></div>
      ) : (
        <div className="mt-4 space-y-3">
          {sortedConsignes.map((consigne) => {
            const priorityMeta = consignePriorityMeta(consigne.priority);
            return (
              <article key={consigne.id} className="rounded-[1rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-900" style={TITLE_CLAMP_STYLE}>
                        {consigne.title}
                      </div>
                      <PortalBadge tone={priorityMeta.tone}>{priorityMeta.label}</PortalBadge>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {consigne.chantier_nom || activeChantier?.nom || "-"} -{" "}
                      {consigne.zone_nom ? `${consigne.zone_nom} - ` : ""}
                      {consigne.date_fin
                        ? t("intervenantPortal.consignes.period", { start: formatPortalDate(consigne.date_debut), end: formatPortalDate(consigne.date_fin) })
                        : t("intervenantPortal.consignes.startsOn", { value: formatPortalDate(consigne.date_debut) })}
                    </div>
                  </div>
                  <PortalBadge tone={consigne.is_read ? "green" : "blue"}>
                    {consigne.is_read ? t("intervenantPortal.consignes.read") : t("intervenantPortal.consignes.unread")}
                  </PortalBadge>
                </div>
                {consigne.task_titre ? (
                  <div className="mt-2 text-xs text-slate-500">
                    {t("intervenantPortal.consignes.relatedTask", { value: consigne.task_titre })}
                  </div>
                ) : null}
                <div className="mt-3 whitespace-pre-wrap text-sm text-slate-900">{consigne.description}</div>
                {!consigne.is_read ? (
                  <div className="mt-4 flex justify-end">
                    <PortalSecondaryButton
                      type="button"
                      disabled={consigneMarkingId === consigne.id}
                      onClick={() => void onMarkConsigneRead(consigne)}
                      className="w-full sm:w-auto"
                    >
                      {consigneMarkingId === consigne.id
                        ? t("intervenantPortal.consignes.marking")
                        : t("intervenantPortal.consignes.markRead")}
                    </PortalSecondaryButton>
                  </div>
                ) : consigne.read_at ? (
                  <div className="mt-3 text-xs text-slate-500">
                    {t("intervenantPortal.consignes.readAt", { value: formatPortalDateTime(consigne.read_at) })}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </PortalCard>
  );

  const reservesPanel = (
    <PortalCard tone="default">
      <PortalSectionHeading
        eyebrow={t("intervenantPortal.reserves.title")}
        title={t("intervenantPortal.reserves.title")}
        subtitle={t("intervenantPortal.reserves.subtitle")}
        aside={
          <PortalBadge tone={openReservesCount > 0 ? "amber" : "neutral"}>
            {t("intervenantPortal.reserves.openCount", { count: openReservesCount })}
          </PortalBadge>
        }
      />
      {reserveFeedback ? (
        <div className={["mt-4 rounded-[1rem] border px-4 py-3 text-sm", feedbackClass(reserveFeedback.type)].join(" ")}>
          {reserveFeedback.message}
        </div>
      ) : null}
      {reservesState.loading ? (
        <div className="mt-4"><PortalEmptyState>{t("intervenantPortal.reserves.loading")}</PortalEmptyState></div>
      ) : reservesState.error ? (
        <div className="mt-4 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {reservesState.error}
        </div>
      ) : sortedReserves.length === 0 ? (
        <div className="mt-4"><PortalEmptyState>{t("intervenantPortal.reserves.empty")}</PortalEmptyState></div>
      ) : (
        <div className="mt-4 space-y-3">
          {sortedReserves.map((reserve) => {
            const status = reserveStatusMeta(reserve.status, t);
            return (
              <article key={reserve.id} className="rounded-[1rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900" style={TITLE_CLAMP_STYLE}>{reserve.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {reserve.task_titre ? `${reserve.task_titre} - ` : ""}
                      {reservePriorityMeta(reserve.priority, t)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t("intervenantPortal.reserves.createdAt", { value: formatPortalDateTime(reserve.created_at) })}
                    </div>
                  </div>
                  <PortalBadge tone={status.tone}>{status.label}</PortalBadge>
                </div>
                {reserve.description ? (
                  <div className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{reserve.description}</div>
                ) : null}
                {reserve.status === "LEVEE" ? (
                  <div className="mt-3 text-xs text-emerald-700">
                    {t("intervenantPortal.reserves.liftedAt", { value: formatPortalDateTime(reserve.levee_at) })}
                  </div>
                ) : (
                  <div className="mt-4 flex justify-end">
                    <PortalPrimaryButton
                      type="button"
                      disabled={reserveLiftingId === reserve.id}
                      onClick={() => void onMarkReserveLifted(reserve)}
                      className="w-full sm:w-auto"
                    >
                      {reserveLiftingId === reserve.id
                        ? t("intervenantPortal.reserves.lifting")
                        : t("intervenantPortal.reserves.markLifted")}
                    </PortalPrimaryButton>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </PortalCard>
  );

  const tasksPanel = (
    <div className="space-y-3">
      {tasksState.loading ? (
        <PortalEmptyState>{t("intervenantPortal.tasks.loading")}</PortalEmptyState>
      ) : tasksState.error ? (
        <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{tasksState.error}</div>
      ) : prioritizedTasks.length === 0 ? (
        <PortalEmptyState>{t("intervenantPortal.tasks.empty")}</PortalEmptyState>
      ) : (
        prioritizedTasks.map((task) => {
          const progress = taskCurrentProgress(task);
          return (
            <PortalCard key={task.id} tone="default" className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-slate-950" style={TITLE_CLAMP_STYLE}>{task.titre}</div>
                  <div className="mt-2 text-sm text-slate-500">{t("intervenantPortal.tasks.lot", { value: resolveTaskLot(task, t) })}</div>
                </div>
                <PortalBadge tone={tabToneClass(task.status)}>{statusLabel(task.status, t)}</PortalBadge>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>{t("intervenantPortal.tasks.progress", { value: Math.round(progress ?? 0) })}</span>
                  <span>
                    {progress === null
                      ? t("intervenantPortal.time.noProgressRecorded")
                      : task.quantite
                        ? `${formatPortalQuantity(task.quantite_realisee, task.unite)} / ${formatPortalQuantity(task.quantite, task.unite, "-")}`
                        : t("intervenantPortal.time.selectedProgressValue", { value: Math.round(progress) })}
                  </span>
                </div>
                <div className="mt-2 h-2.5 rounded-full bg-slate-100">
                  <div className="h-2.5 rounded-full bg-blue-700 transition-all" style={{ width: `${Math.max(progress ? 6 : 0, Math.min(100, progress ?? 0))}%` }} />
                </div>
              </div>
            </PortalCard>
          );
        })
      )}
    </div>
  );

  const timePanel = (
    <div className="space-y-4">
      <PortalCard tone="default">
        <PortalSectionHeading
          eyebrow={t("intervenantPortal.time.addEntry")}
          title={t("intervenantPortal.time.addEntry")}
          subtitle={selectedTimeTask ? selectedTimeTask.titre : t("intervenantPortal.time.searchTaskPlaceholder")}
        />
        <form onSubmit={onCreateTimeEntry} className="mt-4 space-y-4">
          <PortalField label={t("intervenantPortal.time.task")}>
            <div className="rounded-[1rem] border border-slate-200 bg-slate-50/80 p-3">
              <input
                className={portalInputClass()}
                value={timeTaskSearch}
                onChange={(e) => { setTimeTaskSearch(e.target.value); setTimeTaskListOpen(true); setTimeFeedback(null); }}
                onFocus={() => setTimeTaskListOpen(true)}
                placeholder={t("intervenantPortal.time.searchTaskPlaceholder")}
              />
              {selectedTimeTask ? (
                <div className="mt-3 rounded-[1rem] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{t("intervenantPortal.time.selectedTask")}</div>
                  <div className="mt-1 font-semibold text-slate-900" style={TITLE_CLAMP_STYLE}>{selectedTimeTask.titre}</div>
                  <div className="mt-2 text-xs text-slate-600">
                    {selectedTimeTaskProgress === null
                      ? t("intervenantPortal.time.noProgressRecorded")
                      : t("intervenantPortal.time.currentProgress", { value: selectedTimeTaskProgress })}
                  </div>
                </div>
              ) : null}
              {timeTaskListOpen ? (
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-[1rem] border border-slate-200 bg-white p-2">
                  {filteredTimeTasks.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-slate-500">{t("intervenantPortal.time.noMatchingTask")}</div>
                  ) : (
                    filteredTimeTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => selectTimeTask(task)}
                        className={[
                          "block w-full rounded-[0.9rem] border px-4 py-3 text-left transition",
                          task.id === timeTaskId ? "border-blue-700 bg-blue-700 text-white" : "border-slate-200 bg-slate-50/70 text-slate-900 hover:border-blue-200 hover:bg-blue-50",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold" style={TITLE_CLAMP_STYLE}>{task.titre}</div>
                        <div className={task.id === timeTaskId ? "mt-1 text-xs text-blue-100" : "mt-1 text-xs text-slate-500"}>
                          {resolveTaskLot(task, t)} • {statusLabel(task.status, t)}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </PortalField>

          <div className="grid gap-4 md:grid-cols-2">
            <PortalField label={t("intervenantPortal.time.date")}>
              <input className={portalInputClass()} type="date" value={timeDate} onChange={(e) => { setTimeDate(e.target.value); setTimeFeedback(null); }} />
            </PortalField>
            <PortalField label={t("intervenantPortal.time.durationHours")} hint={t("intervenantPortal.time.durationHelp")}>
              <input
                className={portalInputClass()}
                inputMode="decimal"
                value={timeHours}
                onChange={(e) => { setTimeHours(e.target.value); setTimeFeedback(null); }}
                placeholder={t("intervenantPortal.time.hoursPlaceholder")}
              />
            </PortalField>
          </div>

          <PortalField
            label={t("intervenantPortal.time.progressLabel")}
            hint={
              selectedTimeTaskProgress === null
                ? t("intervenantPortal.time.noProgressRecorded")
                : t("intervenantPortal.time.currentProgress", { value: selectedTimeTaskProgress })
            }
          >
            <div className="rounded-[1rem] border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
                <span>{t("intervenantPortal.time.newProgress")}</span>
                <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-blue-700 shadow-sm">
                  {t("intervenantPortal.time.selectedProgressValue", { value: Math.round(Number(timeProgressPercent || 0)) })}
                </span>
              </div>
              <input
                className="mt-4 h-2 w-full cursor-pointer accent-blue-700"
                type="range"
                min="0"
                max="100"
                step="1"
                value={timeProgressPercent}
                onChange={(e) => {
                  setTimeProgressPercent(e.target.value);
                  setTimeFeedback(null);
                }}
              />
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          </PortalField>

          <PortalField label={t("intervenantPortal.time.observations")}>
            <textarea
              className={[portalInputClass(), "min-h-28 resize-y"].join(" ")}
              value={timeNote}
              onChange={(e) => { setTimeNote(e.target.value); setTimeFeedback(null); }}
              placeholder={t("intervenantPortal.time.observationsPlaceholder")}
            />
          </PortalField>

          {timeFeedback ? <div className={["rounded-[1rem] border px-4 py-3 text-sm", feedbackClass(timeFeedback.type)].join(" ")}>{timeFeedback.message}</div> : null}
          <PortalPrimaryButton type="submit" disabled={timeSaving} className="w-full sm:w-auto">
            {timeSaving ? t("intervenantPortal.time.saving") : t("intervenantPortal.time.save")}
          </PortalPrimaryButton>
        </form>
      </PortalCard>

      <PortalCard tone="default">
        <PortalSectionHeading eyebrow={t("intervenantPortal.time.latestEntries")} title={t("intervenantPortal.time.latestEntries")} />
        {timeState.loading ? (
          <div className="mt-4"><PortalEmptyState>{t("intervenantPortal.time.loading")}</PortalEmptyState></div>
        ) : timeState.error ? (
          <div className="mt-4 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {isTaskIdRequiredError(timeState.error) ? t("intervenantPortal.errors.chooseTask") : timeState.error}
          </div>
        ) : timeState.data.length === 0 ? (
          <div className="mt-4"><PortalEmptyState>{t("intervenantPortal.time.empty")}</PortalEmptyState></div>
        ) : (
          <div className="mt-4 space-y-3">
            {timeState.data.map((entry) => (
              <article key={entry.id} className="rounded-[1rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{formatPortalDate(entry.work_date)}</div>
                    <div className="mt-1 text-sm text-slate-500">{entry.task_titre || t("intervenantPortal.time.taskFallback")}</div>
                    <div className="mt-2 text-xs text-slate-500">{t("intervenantPortal.time.hours", { value: formatPortalHours(entry.duration_hours) })}</div>
                    {entry.progress_percent !== null ? (
                      <div className="mt-1 text-xs text-slate-500">{t("intervenantPortal.time.progressEntry", { value: Math.round(entry.progress_percent) })}</div>
                    ) : null}
                    {entry.quantite_realisee !== null ? (
                      <div className="mt-1 text-xs text-slate-500">{t("intervenantPortal.time.quantity", { value: formatPortalQuantity(entry.quantite_realisee, entry.task_unite) })}</div>
                    ) : null}
                    {entry.note ? <div className="mt-1 text-xs text-slate-500">{t("intervenantPortal.time.note", { value: entry.note })}</div> : null}
                  </div>
                  <PortalSecondaryButton type="button" disabled={timeDeletingId === entry.id} onClick={() => void onDeleteTimeEntry(entry)} className="px-3 py-2 text-xs text-red-700 hover:bg-red-50">
                    {timeDeletingId === entry.id ? t("intervenantPortal.time.deleting") : t("intervenantPortal.time.delete")}
                  </PortalSecondaryButton>
                </div>
              </article>
            ))}
          </div>
        )}
      </PortalCard>
    </div>
  );

  const planningPanel = (
    <div className="space-y-3">
      {planningState.loading ? (
        <PortalEmptyState>{t("intervenantPortal.planning.loading")}</PortalEmptyState>
      ) : planningState.error ? (
        <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{planningState.error}</div>
      ) : planningState.data.lots.length === 0 ? (
        <PortalEmptyState>{t("intervenantPortal.planning.empty")}</PortalEmptyState>
      ) : (
        planningState.data.lots.map((lot) => (
          <PortalCard key={lot.lot} tone="default">
            <div className="flex items-center justify-between gap-3">
              <div className="text-base font-semibold text-slate-950">{lot.lot}</div>
              <PortalBadge tone="blue">{lot.progress_pct.toFixed(1)}%</PortalBadge>
            </div>
            <div className="mt-4 h-2.5 rounded-full bg-slate-100"><div className="h-2.5 rounded-full bg-blue-700" style={{ width: `${Math.max(0, Math.min(100, lot.progress_pct))}%` }} /></div>
            <div className="mt-3 text-sm text-slate-500">{t("intervenantPortal.planning.schedule", { start: formatPortalDate(lot.start_date), end: formatPortalDate(lot.end_date) })}</div>
            <div className="mt-1 text-sm text-slate-500">{t("intervenantPortal.planning.summary", { done: lot.done_tasks, total: lot.total_tasks, days: lot.total_duration_days })}</div>
          </PortalCard>
        ))
      )}
    </div>
  );

  const documentsPanel = (
    <div className="space-y-3">
      {documentsState.loading ? (
        <PortalEmptyState>{t("intervenantPortal.documents.loading")}</PortalEmptyState>
      ) : documentsState.error ? (
        <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{documentsState.error}</div>
      ) : documentsState.data.length === 0 ? (
        <PortalEmptyState>{t("intervenantPortal.documents.empty")}</PortalEmptyState>
      ) : (
        documentsState.data.map((doc) => (
          <PortalCard key={doc.id} tone="default">
            <div className="text-base font-semibold text-slate-950">{doc.title || doc.file_name || t("intervenantPortal.documents.fallback")}</div>
            <div className="mt-2 text-sm text-slate-500">{doc.category || "-"} • {doc.document_type || "-"} • {formatPortalDateTime(doc.created_at)}</div>
          </PortalCard>
        ))
      )}
    </div>
  );

  const materielPanel = (
    <div className="space-y-4">
      <PortalCard tone="default">
        <PortalSectionHeading eyebrow={t("intervenantPortal.material.newRequest")} title={t("intervenantPortal.material.newRequest")} />
        <form onSubmit={onCreateMateriel} className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <PortalField label={t("intervenantPortal.material.relatedTaskPlaceholder")}>
              <select className={portalInputClass()} value={materielTaskId} onChange={(e) => { setMaterielTaskId(e.target.value); setMaterielFeedback(null); }}>
                <option value="">{t("intervenantPortal.material.relatedTaskPlaceholder")}</option>
                {prioritizedTasks.map((task) => <option key={task.id} value={task.id}>{task.titre}</option>)}
              </select>
            </PortalField>
            <PortalField label={t("intervenantPortal.material.description")}>
              <input className={portalInputClass()} placeholder={t("intervenantPortal.material.description")} value={materielTitre} onChange={(e) => { setMaterielTitre(e.target.value); setMaterielFeedback(null); }} />
            </PortalField>
            <PortalField label={t("intervenantPortal.material.quantity")}>
              <input className={portalInputClass()} placeholder={t("intervenantPortal.material.quantity")} value={materielQuantite} onChange={(e) => { setMaterielQuantite(e.target.value); setMaterielFeedback(null); }} />
            </PortalField>
            <PortalField label={t("intervenantPortal.material.unit")}>
              <input className={portalInputClass()} placeholder={t("intervenantPortal.material.unit")} value={materielUnite} onChange={(e) => { setMaterielUnite(e.target.value); setMaterielFeedback(null); }} />
            </PortalField>
            <PortalField label={t("intervenantPortal.material.requestedDate")}>
              <input className={portalInputClass()} type="date" value={materielDate} onChange={(e) => { setMaterielDate(e.target.value); setMaterielFeedback(null); }} />
            </PortalField>
            <PortalField label={t("intervenantPortal.material.comment")} className="md:col-span-2">
              <textarea className={[portalInputClass(), "min-h-28 resize-y"].join(" ")} placeholder={t("intervenantPortal.material.comment")} value={materielCommentaire} onChange={(e) => { setMaterielCommentaire(e.target.value); setMaterielFeedback(null); }} />
            </PortalField>
          </div>
          {materielFeedback ? <div className={["rounded-[1rem] border px-4 py-3 text-sm", feedbackClass(materielFeedback.type)].join(" ")}>{materielFeedback.message}</div> : null}
          <PortalPrimaryButton type="submit" disabled={materielSaving} className="w-full sm:w-auto">
            {materielSaving ? t("intervenantPortal.material.sending") : t("intervenantPortal.material.send")}
          </PortalPrimaryButton>
        </form>
      </PortalCard>

      <PortalCard tone="default">
        <PortalSectionHeading eyebrow={t("intervenantPortal.openMaterialRequests")} title={t("intervenantPortal.openMaterialRequests")} />
        {materielState.loading ? (
          <div className="mt-4"><PortalEmptyState>{t("intervenantPortal.material.loading")}</PortalEmptyState></div>
        ) : materielState.error ? (
          <div className="mt-4 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{materielState.error}</div>
        ) : materielState.data.length === 0 ? (
          <div className="mt-4"><PortalEmptyState>{t("intervenantPortal.material.empty")}</PortalEmptyState></div>
        ) : (
          <div className="mt-4 space-y-3">
            {materielState.data.map((row) => (
              <article key={row.id} className="rounded-[1rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold text-slate-950">{row.titre}</div>
                    {(row.task_titre || row.task_id) ? <div className="mt-2 text-sm text-slate-500">{t("intervenantPortal.material.task", { value: row.task_titre ?? prioritizedTasks.find((task) => task.id === row.task_id)?.titre ?? "-" })}</div> : null}
                    <div className="mt-1 text-sm text-slate-500">{t("intervenantPortal.material.quantityValue", { value: formatPortalQuantity(row.quantite, row.unite, "-") })}</div>
                    <div className="mt-1 text-sm text-slate-500">{t("intervenantPortal.material.requested", { value: formatPortalDate(row.date_souhaitee) })}</div>
                    {row.commentaire ? <div className="mt-1 text-sm text-slate-500">{t("intervenantPortal.material.commentValue", { value: row.commentaire })}</div> : null}
                    {row.admin_commentaire ? <div className="mt-1 text-sm text-slate-500">{t("intervenantPortal.material.adminComment", { value: row.admin_commentaire })}</div> : null}
                  </div>
                  <PortalBadge tone={row.statut === "livree" ? "green" : row.statut === "refusee" ? "red" : row.statut === "validee" ? "blue" : "amber"}>
                    {materielStatusLabel(row.statut, t)}
                  </PortalBadge>
                </div>
              </article>
            ))}
          </div>
        )}
      </PortalCard>
    </div>
  );

  const homePanel = (
    <div className="space-y-5">
      {terrainSummaryCard}
      {consignesCard}
      {checklistCard}
      {weekPlanningCard}
      {latestInfoRequestsCard}
    </div>
  );

  const activePanel =
    activeTab === "accueil"
      ? homePanel
      : activeTab === "consignes"
        ? consignesPanel
        : activeTab === "reserves"
          ? reservesPanel
      : activeTab === "taches"
        ? tasksPanel
        : activeTab === "temps"
          ? timePanel
          : activeTab === "planning"
            ? planningPanel
            : activeTab === "documents"
              ? documentsPanel
              : activeTab === "materiel"
                ? materielPanel
                : activeTab === "retours"
                  ? terrainFeedbackPanel
                  : messagesPanel;

  if (bootLoading) {
    return <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-700">{t("intervenantPortal.bootLoading")}</div>;
  }

  if (bootError) {
    const missingToken = bootError === t("intervenantPortal.missingToken");
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-700">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">{t("intervenantPortal.unavailableTitle")}</div>
          <div className="mt-2 text-sm text-slate-600">{bootError}</div>
          {missingToken ? (
            <form onSubmit={submitIntervenantLink} className="mt-5 space-y-3">
              <div className="text-sm text-slate-600">{t("intervenantPortal.accessLinkHelp")}</div>
              <textarea
                className="min-h-28 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                value={accessLinkInput}
                onChange={(event) => {
                  setAccessLinkInput(event.target.value);
                  if (bootError === t("intervenantPortal.invalidAccessLink")) {
                    setBootError(t("intervenantPortal.missingToken"));
                  }
                }}
                placeholder={t("intervenantPortal.accessLinkPlaceholder")}
              />
              <button type="submit" className="w-full rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
                {t("intervenantPortal.openAccessLink")}
              </button>
            </form>
          ) : null}
          {isInvalidTokenError(bootError) ? (
            <button
              type="button"
              onClick={() => {
                clearStoredIntervenantSession();
                setToken("");
                setSessionInfo(null);
                setChantiers([]);
                setSelectedChantierId("");
                setBootError(t("intervenantPortal.missingToken"));
              }}
              className="mt-4 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {t("intervenantPortal.enterAnotherLink")}
            </button>
          ) : null}
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
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("intervenantPortal.sectionIntervenant")}</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{sessionInfo?.intervenant.nom || t("intervenantPortal.portalTitle")}</div>
              <div className="mt-1 text-xs text-slate-500">{sessionInfo?.expires_at ? t("intervenantPortal.sessionUntil", { date: formatPortalDateTime(sessionInfo.expires_at) }) : t("intervenantPortal.sessionActive")}</div>
              <div className="mt-4 inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label={t("layout.languageSwitcherLabel")}>
                {(["fr", "al"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLanguage(value)}
                    className={[
                      "rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                      language === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900",
                    ].join(" ")}
                    aria-pressed={language === value}
                  >
                    {t(`common.languages.${value}`)}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setReloadTick((value) => value + 1)} className="flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">{t("common.actions.refresh")}</button>
                <button type="button" onClick={logoutIntervenant} className="flex-1 rounded-full border border-red-200 px-3 py-2 text-sm font-medium text-red-700">{t("layout.signOut")}</button>
              </div>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("intervenantPortal.sectionSites")}</div>
              <input className="mt-3 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={sidebarChantierQuery} onChange={(e) => setSidebarChantierQuery(e.target.value)} placeholder={t("intervenantPortal.searchSitePlaceholder")} />
              <div className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto pr-1">
                {filteredChantiers.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-3 text-sm text-slate-500">{t("intervenantPortal.noSiteFound")}</div> : filteredChantiers.map((chantier) => {
                  const selected = chantier.id === selectedChantierId;
                  return <button key={chantier.id} type="button" onClick={() => chooseChantier(chantier.id)} className={["w-full rounded-2xl border px-3 py-3 text-left", selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-900"].join(" ")}><div className="text-sm font-semibold">{chantier.nom}</div><div className={selected ? "mt-1 text-xs text-slate-200" : "mt-1 text-xs text-slate-500"}>{chantier.client || t("intervenantPortal.noClient")}</div></button>;
                })}
              </div>
            </section>
            <nav className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {t("intervenantPortal.tabs.accueil")}
                  </div>
                  <PortalPillButton
                    type="button"
                    active={activeTab === "accueil"}
                    onClick={() => setActiveTab("accueil")}
                    className="w-full justify-start text-left"
                  >
                    {tabLabel("accueil")}
                  </PortalPillButton>
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {t("intervenantPortal.groups.entry")}
                  </div>
                  {entryTabs.map((tab) => (
                    <PortalPillButton
                      key={tab}
                      type="button"
                      active={activeTab === tab}
                      onClick={() => setActiveTab(tab)}
                      className="w-full justify-start text-left"
                    >
                      {tabLabel(tab)}
                    </PortalPillButton>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {t("intervenantPortal.groups.consult")}
                  </div>
                  {consultTabs.map((tab) => (
                    <PortalPillButton
                      key={tab}
                      type="button"
                      active={activeTab === tab}
                      onClick={() => setActiveTab(tab)}
                      className="w-full justify-start text-left"
                    >
                      {tabLabel(tab)}
                    </PortalPillButton>
                  ))}
                </div>
              </div>
            </nav>
          </div>
        </aside>

        <main className="min-w-0 space-y-3 md:space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:hidden">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-base font-semibold text-slate-900">{sessionInfo?.intervenant.nom || t("intervenantPortal.portalTitle")}</div><div className="mt-1 text-xs text-slate-500">{sessionInfo?.expires_at ? t("intervenantPortal.sessionUntil", { date: formatPortalDateTime(sessionInfo.expires_at) }) : t("intervenantPortal.sessionActive")}</div></div><div className="flex shrink-0 gap-2"><button type="button" onClick={openMobileHome} className={["rounded-full px-3 py-1.5 text-xs font-medium", mobileGlobalTab === "home" ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-700"].join(" ")}>{t("intervenantPortal.tabs.accueil")}</button><button type="button" onClick={() => setPortalOptionsOpen((value) => !value)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700">{t("intervenantPortal.tabs.options")}</button></div></div>
            {portalOptionsOpen ? <div className="mt-3 space-y-2"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setReloadTick((value) => value + 1)} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">{t("common.actions.refresh")}</button><button type="button" onClick={logoutIntervenant} className="rounded-full border border-red-200 px-3 py-2 text-sm font-medium text-red-700">{t("layout.signOut")}</button></div><div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label={t("layout.languageSwitcherLabel")}>{(["fr", "al"] as const).map((value) => <button key={value} type="button" onClick={() => setLanguage(value)} className={["rounded-lg px-2.5 py-1.5 text-xs font-medium transition", language === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"].join(" ")} aria-pressed={language === value}>{t(`common.languages.${value}`)}</button>)}</div></div> : null}
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm md:hidden"><div className="grid grid-cols-2 gap-2"><PortalPillButton type="button" active={mobileGlobalTab === "home"} onClick={openMobileHome}>{t("intervenantPortal.tabs.accueil")}</PortalPillButton><PortalPillButton type="button" active={mobileGlobalTab !== "home"} onClick={openMobileSites}>{t("intervenantPortal.tabs.chantiers")}</PortalPillButton></div></section>
          {mobileGlobalTab === "sites" ? <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:hidden"><div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("intervenantPortal.sitesAccessible")}</div><input className="mt-3 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={sidebarChantierQuery} onChange={(e) => setSidebarChantierQuery(e.target.value)} placeholder={t("intervenantPortal.searchSitePlaceholder")} /><div className="mt-3 space-y-2">{filteredChantiers.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-3 text-sm text-slate-500">{t("intervenantPortal.noSiteFound")}</div> : filteredChantiers.map((chantier) => <button key={chantier.id} type="button" onClick={() => openMobileSite(chantier.id)} className="block w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left"><div className="text-sm font-semibold text-slate-900">{chantier.nom}</div><div className="mt-1 text-xs text-slate-500">{chantier.client || t("intervenantPortal.noClient")}</div></button>)}</div></section> : null}
          {mobileGlobalTab === "site" && selectedChantierId ? (
            <section className="space-y-3 md:hidden">
              <button type="button" onClick={openMobileSites} className="block w-full rounded-3xl border border-blue-200 bg-blue-50 px-4 py-3 text-left shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">{t("intervenantPortal.siteLabel")}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{t("intervenantPortal.siteLabel")} : {activeChantier?.nom ?? t("intervenantPortal.chooseSite")} ▾</div>
              </button>
              <nav className="space-y-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {t("intervenantPortal.groups.entry")}
                  </div>
                  <div className="no-scrollbar flex gap-2 overflow-x-auto">
                    {entryTabs.map((tab) => (
                      <PortalPillButton key={tab} type="button" active={activeTab === tab} onClick={() => setActiveTab(tab)} className="shrink-0">
                        {tabLabel(tab)}
                      </PortalPillButton>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {t("intervenantPortal.groups.consult")}
                  </div>
                  <div className="no-scrollbar flex gap-2 overflow-x-auto">
                    {consultTabs.map((tab) => (
                      <PortalPillButton key={tab} type="button" active={activeTab === tab} onClick={() => setActiveTab(tab)} className="shrink-0">
                        {tabLabel(tab)}
                      </PortalPillButton>
                    ))}
                  </div>
                </div>
              </nav>
            </section>
          ) : null}
          <section className={["rounded-3xl border border-slate-200 bg-white p-4 shadow-sm", mobileGlobalTab === "sites" || (mobileGlobalTab === "home" && activeTab === "accueil") ? "hidden md:block" : ""].join(" ")}><div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div className="min-w-0"><div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{activeTab === "accueil" ? t("intervenantPortal.dashboardTitle") : t("intervenantPortal.selectedSite")}</div><div className="mt-1 text-lg font-semibold text-slate-900">{contentTitle}</div><div className="mt-1 text-sm text-slate-500">{contentSubtitle}</div>{activeTab !== "accueil" && activeChantier ? <div className="mt-2 text-xs text-slate-500">{activeChantier.client || t("intervenantPortal.noClient")}{activeChantier.adresse ? ` - ${activeChantier.adresse}` : ""}</div> : null}</div>{activeTab !== "accueil" && activeChantier ? <div className="text-sm text-slate-500">{t("intervenantPortal.progress", { value: activeChantier.avancement ?? 0 })}</div> : null}</div></section>
          {chantiers.length === 0 ? <section className={["rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm", mobileGlobalTab === "sites" ? "hidden md:block" : ""].join(" ")}><div className="text-lg font-semibold text-slate-900">{t("intervenantPortal.noAccessibleSiteTitle")}</div><div className="mt-2 text-sm text-slate-500">{t("intervenantPortal.noAccessibleSiteMessage")}</div></section> : <section className={["rounded-3xl border border-slate-200 bg-white p-4 shadow-sm", mobileGlobalTab === "sites" ? "hidden md:block" : ""].join(" ")}>{activePanel}</section>}
          {mobileQuickAction ? (
            <div className="fixed inset-0 z-50 bg-slate-100 md:hidden">
              <div className="flex min-h-screen flex-col px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
                <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">
                    {mobileQuickAction === "time" ? t("intervenantPortal.mobile.quickTimeTitle") : t("intervenantPortal.mobile.quickMaterialTitle")}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileQuickAction(null)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    {t("intervenantPortal.mobile.close")}
                  </button>
                </div>
                <div className="mt-3 flex-1 overflow-y-auto">
                  {mobileQuickAction === "time" ? (
                    <form onSubmit={onCreateTimeEntry} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-600">{t("intervenantPortal.siteLabel")}</label>
                          <select
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                            value={selectedChantierId}
                            onChange={(e) => chooseChantier(e.target.value)}
                          >
                            {chantiers.map((chantier) => (
                              <option key={chantier.id} value={chantier.id}>
                                {chantier.nom}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-slate-600">{t("intervenantPortal.time.task")}</label>
                          <div className="rounded-2xl border border-slate-200 bg-white p-2">
                            <input
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              value={timeTaskSearch}
                              onChange={(e) => {
                                setTimeTaskSearch(e.target.value);
                                setTimeTaskListOpen(true);
                                setTimeFeedback(null);
                              }}
                              onFocus={() => setTimeTaskListOpen(true)}
                              placeholder={t("intervenantPortal.time.searchTaskPlaceholder")}
                            />
                            {selectedTimeTask ? (
                              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                <div className="font-medium text-slate-800">{t("intervenantPortal.time.selectedTask")}</div>
                                <div className="mt-1" style={TITLE_CLAMP_STYLE}>
                                  {selectedTimeTask.titre}
                                </div>
                                <div className="mt-2">
                                  {selectedTimeTaskProgress === null
                                    ? t("intervenantPortal.time.noProgressRecorded")
                                    : t("intervenantPortal.time.currentProgress", { value: selectedTimeTaskProgress })}
                                </div>
                              </div>
                            ) : null}
                            {timeTaskListOpen ? (
                              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                                {filteredTimeTasks.slice(0, 10).length === 0 ? (
                                  <div className="px-2 py-3 text-sm text-slate-500">{t("intervenantPortal.time.noMatchingTask")}</div>
                                ) : (
                                  filteredTimeTasks.slice(0, 10).map((task) => (
                                    <button
                                      key={task.id}
                                      type="button"
                                      onClick={() => selectTimeTask(task)}
                                      className={[
                                        "block w-full rounded-xl border px-3 py-2 text-left",
                                        task.id === timeTaskId
                                          ? "border-blue-600 bg-blue-600 text-white"
                                          : "border-slate-200 bg-white text-slate-900",
                                      ].join(" ")}
                                    >
                                      <div className="text-sm font-medium" style={TITLE_CLAMP_STYLE}>
                                        {task.titre}
                                      </div>
                                      <div
                                        className={
                                          task.id === timeTaskId ? "mt-1 text-xs text-slate-200" : "mt-1 text-xs text-slate-500"
                                        }
                                      >
                                        {resolveTaskLot(task, t)} - {statusLabel(task.status, t)}
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-600">{t("intervenantPortal.time.date")}</label>
                          <input
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                            type="date"
                            value={timeDate}
                            onChange={(e) => {
                              setTimeDate(e.target.value);
                              setTimeFeedback(null);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-600">{t("intervenantPortal.time.durationHours")}</label>
                          <div className="text-xs text-slate-500">{t("intervenantPortal.time.durationHelp")}</div>
                          <input
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                            inputMode="decimal"
                            value={timeHours}
                            onChange={(e) => {
                              setTimeHours(e.target.value);
                              setTimeFeedback(null);
                            }}
                            placeholder={t("intervenantPortal.time.hoursPlaceholder")}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-600">{t("intervenantPortal.time.progressLabel")}</label>
                          <div className="text-xs text-slate-500">
                            {selectedTimeTaskProgress === null
                              ? t("intervenantPortal.time.noProgressRecorded")
                              : t("intervenantPortal.time.currentProgress", { value: selectedTimeTaskProgress })}
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                            <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-700">
                              <span>{t("intervenantPortal.time.newProgress")}</span>
                              <span>{t("intervenantPortal.time.selectedProgressValue", { value: Math.round(Number(timeProgressPercent || 0)) })}</span>
                            </div>
                            <input
                              className="mt-3 h-2 w-full cursor-pointer accent-blue-700"
                              type="range"
                              min="0"
                              max="100"
                              step="1"
                              value={timeProgressPercent}
                              onChange={(e) => {
                                setTimeProgressPercent(e.target.value);
                                setTimeFeedback(null);
                              }}
                            />
                            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                              <span>0%</span>
                              <span>100%</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-600">{t("intervenantPortal.time.observations")}</label>
                          <textarea
                            className="min-h-24 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                            value={timeNote}
                            onChange={(e) => {
                              setTimeNote(e.target.value);
                              setTimeFeedback(null);
                            }}
                            placeholder={t("intervenantPortal.time.observationsPlaceholder")}
                          />
                        </div>
                      </div>
                      {timeFeedback ? (
                        <div
                          className={[
                            "mt-3 rounded-2xl border px-3 py-2 text-sm",
                            timeFeedback.type === "success"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-red-200 bg-red-50 text-red-700",
                          ].join(" ")}
                        >
                          {timeFeedback.message}
                        </div>
                      ) : null}
                      <button
                        type="submit"
                        disabled={timeSaving}
                        className="mt-4 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {timeSaving ? t("intervenantPortal.time.saving") : t("intervenantPortal.time.save")}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={onCreateQuickMateriel} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-600">{t("intervenantPortal.siteLabel")}</label>
                          <select
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                            value={quickMaterielChantierId}
                            onChange={(e) => {
                              setQuickMaterielChantierId(e.target.value);
                              setQuickMaterielFeedback(null);
                            }}
                          >
                            {chantiers.map((chantier) => (
                              <option key={chantier.id} value={chantier.id}>
                                {chantier.nom}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-600">{t("intervenantPortal.material.description")}</label>
                          <input
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                            value={quickMaterielTitre}
                            onChange={(e) => {
                              setQuickMaterielTitre(e.target.value);
                              setQuickMaterielFeedback(null);
                            }}
                            placeholder={t("intervenantPortal.material.description")}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-600">{t("intervenantPortal.material.quantity")}</label>
                          <input
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                            inputMode="decimal"
                            value={quickMaterielQuantite}
                            onChange={(e) => {
                              setQuickMaterielQuantite(e.target.value);
                              setQuickMaterielFeedback(null);
                            }}
                            placeholder={t("intervenantPortal.material.quantity")}
                          />
                        </div>
                      </div>
                      {quickMaterielFeedback ? (
                        <div
                          className={[
                            "mt-3 rounded-2xl border px-3 py-2 text-sm",
                            quickMaterielFeedback.type === "success"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-red-200 bg-red-50 text-red-700",
                          ].join(" ")}
                        >
                          {quickMaterielFeedback.message}
                        </div>
                      ) : null}
                      <button
                        type="submit"
                        disabled={quickMaterielSaving}
                        className="mt-4 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {quickMaterielSaving ? t("intervenantPortal.material.sending") : t("intervenantPortal.material.send")}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          ) : null}
          {LEGACY_FALLBACK_ENABLED && import.meta.env.DEV ? <p className="text-xs text-slate-400">{t("intervenantPortal.legacyFallbackNotice")}</p> : null}
        </main>
      </div>
    </div>
  );
}
