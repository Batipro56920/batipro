
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
  intervenantTimeList,
  type IntervenantChantier,
  type IntervenantDocument,
  type IntervenantMateriel,
  type IntervenantPlanning,
  type IntervenantTask,
  type IntervenantTimeEntry,
} from "../services/intervenantPortal.service";

type PortalTab = "chantiers" | "taches" | "temps" | "documents" | "planning" | "materiel";

type LoadState<T> = {
  loading: boolean;
  error: string | null;
  data: T;
};

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
  } catch {
    // Ignore iOS private mode storage failures.
  }
}

function clearStoredToken() {
  memoryToken = "";
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_TOKEN_KEY);
  } catch {
    // Ignore iOS private mode storage failures.
  }
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
  } catch {
    // Ignore iOS private mode storage failures.
  }
}

function clearStoredChantierId() {
  memoryChantierId = "";
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_CHANTIER_KEY);
  } catch {
    // Ignore iOS private mode storage failures.
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  const message = String((error as { message?: string } | null)?.message ?? fallback).trim();
  return message || fallback;
}

function isInvalidTokenError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid_or_expired_token") ||
    normalized.includes("invalid") ||
    normalized.includes("expire") ||
    normalized.includes("token manquant")
  );
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

function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function taskStatusPriority(status: string | null): number {
  const normalized = String(status ?? "").toUpperCase();
  if (["A_FAIRE", "TODO", "PENDING"].includes(normalized)) return 0;
  if (["EN_COURS", "IN_PROGRESS"].includes(normalized)) return 1;
  if (["FAIT", "TERMINE", "DONE", "COMPLETED"].includes(normalized)) return 2;
  return 3;
}

function isTaskIdRequiredError(message: string): boolean {
  return String(message ?? "").toLowerCase().includes("task_id_required");
}

function taskQuantityProgress(task: IntervenantTask): number | null {
  if (task.quantite === null || task.quantite <= 0) return null;
  const done = Number(task.quantite_realisee ?? 0);
  return Math.max(0, Math.min(100, (done / task.quantite) * 100));
}

function statusLabel(status: string | null): string {
  const normalized = String(status ?? "").toUpperCase();
  if (["FAIT", "TERMINE", "DONE", "COMPLETED"].includes(normalized)) return "Fait";
  if (["EN_COURS", "IN_PROGRESS"].includes(normalized)) return "En cours";
  return "A faire";
}

function statusBadgeClass(status: string | null): string {
  const normalized = String(status ?? "").toUpperCase();
  if (["FAIT", "TERMINE", "DONE", "COMPLETED"].includes(normalized)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (["EN_COURS", "IN_PROGRESS"].includes(normalized)) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
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

const EMPTY_TASKS_STATE: LoadState<IntervenantTask[]> = {
  loading: false,
  error: null,
  data: [],
};

const EMPTY_DOCUMENTS_STATE: LoadState<IntervenantDocument[]> = {
  loading: false,
  error: null,
  data: [],
};

const EMPTY_PLANNING_STATE: LoadState<IntervenantPlanning> = {
  loading: false,
  error: null,
  data: { chantier_id: null, lots: [] },
};

const EMPTY_TIME_STATE: LoadState<IntervenantTimeEntry[]> = {
  loading: false,
  error: null,
  data: [],
};

const EMPTY_MATERIEL_STATE: LoadState<IntervenantMateriel[]> = {
  loading: false,
  error: null,
  data: [],
};

export default function IntervenantPortalPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const queryToken = useMemo(
    () => new URLSearchParams(location.search).get("token")?.trim() ?? "",
    [location.search],
  );
  const queryChantierId = useMemo(
    () => new URLSearchParams(location.search).get("chantier_id")?.trim() ?? "",
    [location.search],
  );

  const [token, setToken] = useState("");
  const [sessionInfo, setSessionInfo] = useState<Awaited<ReturnType<typeof intervenantSession>> | null>(null);
  const [chantiers, setChantiers] = useState<IntervenantChantier[]>([]);
  const [selectedChantierId, setSelectedChantierId] = useState("");
  const [activeTab, setActiveTab] = useState<PortalTab>("taches");

  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  const [tasksState, setTasksState] = useState<LoadState<IntervenantTask[]>>(EMPTY_TASKS_STATE);
  const [documentsState, setDocumentsState] = useState<LoadState<IntervenantDocument[]>>(EMPTY_DOCUMENTS_STATE);
  const [planningState, setPlanningState] = useState<LoadState<IntervenantPlanning>>(EMPTY_PLANNING_STATE);
  const [timeState, setTimeState] = useState<LoadState<IntervenantTimeEntry[]>>(EMPTY_TIME_STATE);
  const [materielState, setMaterielState] = useState<LoadState<IntervenantMateriel[]>>(EMPTY_MATERIEL_STATE);

  const [reloadTick, setReloadTick] = useState(0);
  const [portalOptionsOpen, setPortalOptionsOpen] = useState(false);
  const [timeTaskId, setTimeTaskId] = useState<string | null>(null);
  const [timeTaskQuery, setTimeTaskQuery] = useState("");
  const [timeTaskListOpen, setTimeTaskListOpen] = useState(false);
  const [timeFeedback, setTimeFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [timeDate, setTimeDate] = useState(todayIsoDate());
  const [timeQuantity, setTimeQuantity] = useState("");
  const [timeNote, setTimeNote] = useState("");
  const [timeSaving, setTimeSaving] = useState(false);

  const [materielTitre, setMaterielTitre] = useState("");
  const [materielQuantite, setMaterielQuantite] = useState("1");
  const [materielUnite, setMaterielUnite] = useState("");
  const [materielDate, setMaterielDate] = useState("");
  const [materielCommentaire, setMaterielCommentaire] = useState("");
  const [materielSaving, setMaterielSaving] = useState(false);

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

        if (import.meta.env.DEV) {
          console.log("[Intervenant] bootstrap token present");
        }

        const [sessionData, chantierRows] = await Promise.all([
          intervenantSession(candidateToken),
          intervenantGetChantiers(candidateToken),
        ]);

        if (!alive) return;

        const chantierIds = new Set(chantierRows.map((row) => row.id));
        const storedChantierId = readStoredChantierId();
        const fromQuery = queryChantierId && chantierIds.has(queryChantierId) ? queryChantierId : "";
        const fromStorage = storedChantierId && chantierIds.has(storedChantierId) ? storedChantierId : "";
        let nextChantierId = fromQuery || fromStorage;
        if (!nextChantierId && chantierRows.length === 1) {
          nextChantierId = chantierRows[0]?.id ?? "";
        }

        setSessionInfo(sessionData);
        setChantiers(chantierRows);
        setSelectedChantierId(nextChantierId);

        if (nextChantierId) {
          persistChantierId(nextChantierId);
        } else {
          clearStoredChantierId();
          setActiveTab("chantiers");
        }

        setBootLoading(false);
      } catch (error) {
        if (!alive) return;

        const message = getErrorMessage(error, "Acces intervenant indisponible.");

        if (LEGACY_FALLBACK_ENABLED && shouldFallbackToLegacy(error)) {
          if (import.meta.env.DEV) {
            console.log("[Intervenant] fallback to /acces triggered:", message);
          }
          navigate(`/acces/${encodeURIComponent(candidateToken)}`, { replace: true });
          return;
        }

        setSessionInfo(null);
        setChantiers([]);
        setSelectedChantierId("");
        setBootError(message);
        setBootLoading(false);
      }
    }

    void bootstrap();
    return () => {
      alive = false;
    };
  }, [queryToken, queryChantierId, navigate]);

  useEffect(() => {
    if (!selectedChantierId) return;
    persistChantierId(selectedChantierId);
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
          (documentsResult.status === "rejected" &&
            shouldFallbackToLegacy(documentsResult.reason) &&
            documentsResult.reason) ||
          (planningResult.status === "rejected" &&
            shouldFallbackToLegacy(planningResult.reason) &&
            planningResult.reason);

        if (fallbackError) {
          if (import.meta.env.DEV) {
            console.log(
              "[Intervenant] fallback to /acces triggered during data load:",
              getErrorMessage(fallbackError, "RPC missing"),
            );
          }
          navigate(`/acces/${encodeURIComponent(token)}`, { replace: true });
          return;
        }
      }

      if (tasksResult.status === "fulfilled") {
        const taskRows = tasksResult.value;
        setTasksState({ loading: false, error: null, data: taskRows });
      } else {
        setTasksState({
          loading: false,
          error: getErrorMessage(tasksResult.reason, "Erreur chargement taches."),
          data: [],
        });
      }

      if (documentsResult.status === "fulfilled") {
        setDocumentsState({ loading: false, error: null, data: documentsResult.value });
      } else {
        setDocumentsState({
          loading: false,
          error: getErrorMessage(documentsResult.reason, "Erreur chargement documents."),
          data: [],
        });
      }

      if (planningResult.status === "fulfilled") {
        setPlanningState({ loading: false, error: null, data: planningResult.value });
      } else {
        setPlanningState({
          loading: false,
          error: getErrorMessage(planningResult.reason, "Erreur chargement planning."),
          data: { chantier_id: selectedChantierId, lots: [] },
        });
      }

      if (timeResult.status === "fulfilled") {
        setTimeState({ loading: false, error: null, data: timeResult.value });
      } else {
        setTimeState({
          loading: false,
          error: getErrorMessage(timeResult.reason, "Erreur chargement temps."),
          data: [],
        });
      }

      if (materielResult.status === "fulfilled") {
        setMaterielState({ loading: false, error: null, data: materielResult.value });
      } else {
        setMaterielState({
          loading: false,
          error: getErrorMessage(materielResult.reason, "Erreur chargement materiel."),
          data: [],
        });
      }
    }

    void loadChantierData();
    return () => {
      alive = false;
    };
  }, [token, selectedChantierId, bootLoading, bootError, reloadTick, navigate]);

  function logoutIntervenant() {
    clearStoredToken();
    clearStoredChantierId();
    setToken("");
    setSessionInfo(null);
    setChantiers([]);
    setSelectedChantierId("");
    navigate("/", { replace: true });
  }

  const activeChantier = useMemo(
    () => chantiers.find((chantier) => chantier.id === selectedChantierId) ?? null,
    [chantiers, selectedChantierId],
  );
  const prioritizedTasks = useMemo(() => {
    const currentIntervenantId = sessionInfo?.intervenant_id ?? null;
    return [...tasksState.data].sort((a, b) => {
      const aAssigned = currentIntervenantId && a.intervenant_id === currentIntervenantId ? 0 : 1;
      const bAssigned = currentIntervenantId && b.intervenant_id === currentIntervenantId ? 0 : 1;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;

      const statusDelta = taskStatusPriority(a.status) - taskStatusPriority(b.status);
      if (statusDelta !== 0) return statusDelta;

      const lotDelta = resolveTaskLot(a).localeCompare(resolveTaskLot(b), "fr");
      if (lotDelta !== 0) return lotDelta;

      return a.titre.localeCompare(b.titre, "fr");
    });
  }, [sessionInfo?.intervenant_id, tasksState.data]);
  const filteredTimeTasks = useMemo(() => {
    const query = timeTaskQuery.trim().toLowerCase();
    const rows = query
      ? prioritizedTasks.filter((task) => task.titre.toLowerCase().includes(query))
      : prioritizedTasks;
    return rows.slice(0, 10);
  }, [prioritizedTasks, timeTaskQuery]);
  const selectedTimeTask =
    timeTaskId ? prioritizedTasks.find((task) => task.id === timeTaskId) ?? null : null;

  const requiresChantierSelection = chantiers.length > 1 && !selectedChantierId;
  const isInvalidToken = isInvalidTokenError(bootError ?? "");
  const showChantiersShortcut = chantiers.length > 1 && activeTab !== "chantiers";

  useEffect(() => {
    if (!prioritizedTasks.length) {
      setTimeTaskId(null);
      setTimeTaskQuery("");
      return;
    }

    const currentTask = timeTaskId ? prioritizedTasks.find((task) => task.id === timeTaskId) ?? null : null;
    if (currentTask) {
      return;
    }

    const preferredTask = prioritizedTasks[0];
    setTimeTaskId(preferredTask.id);
    setTimeTaskQuery(preferredTask.titre);
  }, [prioritizedTasks, timeTaskId]);

  function reloadAll() {
    setReloadTick((tick) => tick + 1);
  }

  function onSelectChantier(chantierId: string) {
    setSelectedChantierId(chantierId);
  }

  function selectTimeTask(task: IntervenantTask) {
    setTimeTaskId(task.id);
    setTimeTaskQuery(task.titre);
    setTimeTaskListOpen(false);
    setTimeFeedback(null);
  }

  async function onCreateTimeEntry(e: FormEvent) {
    e.preventDefault();
    if (!token || !selectedChantierId) return;

    const quantity = Number(String(timeQuantity).replace(",", "."));
    if (!timeTaskId) {
      setTimeState((prev) => ({ ...prev, error: "Choisir une tache." }));
      setTimeFeedback(null);
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setTimeState((prev) => ({ ...prev, error: "Quantite realisee invalide." }));
      setTimeFeedback(null);
      return;
    }

    setTimeSaving(true);
    setTimeFeedback(null);
    setTimeState((prev) => ({ ...prev, error: null }));

    try {
      await intervenantTimeCreate(token, {
        chantier_id: selectedChantierId,
        task_id: timeTaskId,
        work_date: timeDate || null,
        quantite_realisee: quantity,
        note: timeNote.trim() || null,
      });

      const [rows, taskRows] = await Promise.all([
        intervenantTimeList(token, selectedChantierId),
        intervenantGetTasks(token, selectedChantierId),
      ]);
      setTimeState({ loading: false, error: null, data: rows });
      setTasksState({ loading: false, error: null, data: taskRows });
      setTimeFeedback({ type: "success", message: "Saisie enregistree." });
      if (taskRows.length > 0) {
        const currentTask = taskRows.find((task) => task.id === timeTaskId) ?? taskRows[0];
        setTimeTaskId(currentTask.id);
        setTimeTaskQuery(currentTask.titre);
      } else {
        setTimeTaskId(null);
        setTimeTaskQuery("");
      }
      setTimeTaskListOpen(false);
      setTimeDate(todayIsoDate());
      setTimeQuantity("");
      setTimeNote("");
    } catch (error) {
      const message = getErrorMessage(error, "Creation temps impossible.");
      if (isTaskIdRequiredError(message)) {
        if (prioritizedTasks.length > 0) {
          const preferredTask = prioritizedTasks[0];
          setTimeTaskId(preferredTask.id);
          setTimeTaskQuery(preferredTask.titre);
        }
        setTimeState((prev) => ({ ...prev, error: "Choisir une tache." }));
        setTimeFeedback(null);
        return;
      }

      setTimeState((prev) => ({
        ...prev,
        error: message,
      }));
      setTimeFeedback(null);
    } finally {
      setTimeSaving(false);
    }
  }

  async function onCreateMateriel(e: FormEvent) {
    e.preventDefault();
    if (!token || !selectedChantierId) return;

    const titre = materielTitre.trim();
    const quantite = Number(String(materielQuantite).replace(",", "."));

    if (!titre) {
      setMaterielState((prev) => ({ ...prev, error: "Titre obligatoire." }));
      return;
    }
    if (!Number.isFinite(quantite) || quantite <= 0) {
      setMaterielState((prev) => ({ ...prev, error: "Quantite invalide." }));
      return;
    }

    setMaterielSaving(true);
    setMaterielState((prev) => ({ ...prev, error: null }));

    try {
      await intervenantMaterielCreate(token, {
        chantier_id: selectedChantierId,
        titre,
        quantite,
        unite: materielUnite.trim() || null,
        commentaire: materielCommentaire.trim() || null,
        date_souhaitee: materielDate || null,
      });

      const rows = await intervenantMaterielList(token, selectedChantierId);
      setMaterielState({ loading: false, error: null, data: rows });
      setMaterielTitre("");
      setMaterielQuantite("1");
      setMaterielUnite("");
      setMaterielDate("");
      setMaterielCommentaire("");
    } catch (error) {
      setMaterielState((prev) => ({
        ...prev,
        error: getErrorMessage(error, "Creation demande materiel impossible."),
      }));
    } finally {
      setMaterielSaving(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
        {bootLoading ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">Chargement de l acces intervenant...</div>
        ) : bootError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-xl font-semibold text-red-800">
              {isInvalidToken ? "Lien invalide ou expire" : "Acces intervenant indisponible"}
            </h1>
            <p className="mt-2 text-sm text-red-700">
              {isInvalidToken
                ? "Demande un nouveau lien a ton administrateur Batipro."
                : "Impossible de charger le portail intervenant pour le moment."}
            </p>
            <p className="mt-2 text-xs text-red-600">Detail: {bootError}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <header className="rounded-2xl border bg-white px-4 py-3 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {sessionInfo?.intervenant?.nom || sessionInfo?.intervenant?.email || sessionInfo?.email || "Intervenant"}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Session expire le {formatDateTimeFr(sessionInfo?.expires_at ?? null)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setPortalOptionsOpen((open) => !open)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Options
                  <span className="text-[10px]">{portalOptionsOpen ? "▴" : "▾"}</span>
                </button>
              </div>

              {portalOptionsOpen ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={reloadAll}
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    Rafraichir
                  </button>
                  <button
                    type="button"
                    onClick={logoutIntervenant}
                    className="rounded-xl border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Deconnexion
                  </button>
                </div>
              ) : null}
            </header>

            {showChantiersShortcut ? (
              <section className="rounded-2xl border bg-white p-4 sm:p-5">
                <div className="mb-2 text-sm font-semibold text-slate-900">Chantiers accessibles</div>
                <div className="overflow-x-auto whitespace-nowrap pb-1">
                  <div className="inline-flex gap-2">
                    {chantiers.map((chantier) => {
                      const active = chantier.id === selectedChantierId;
                      return (
                        <button
                          key={chantier.id}
                          type="button"
                          onClick={() => onSelectChantier(chantier.id)}
                          className={[
                            "rounded-xl border px-3 py-2 text-left text-sm transition",
                            active
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                          ].join(" ")}
                        >
                          <div className="font-medium">{chantier.nom}</div>
                          <div className={active ? "text-blue-100" : "text-slate-400"}>{chantier.client || "-"}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            ) : null}

            {requiresChantierSelection ? (
              <section className="rounded-2xl border bg-white p-6 text-sm text-slate-600">
                Choisir un chantier pour afficher les taches, le temps, le planning, les documents et le materiel.
              </section>
            ) : (
              <section className="rounded-2xl border bg-white p-4 sm:p-5">
                <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Chantier selectionne
                  </div>
                  <div className="mt-1 text-base font-semibold text-slate-900">{activeChantier?.nom ?? "Chantier"}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {activeChantier?.adresse || "Adresse non renseignee"}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    Debut: {formatDateFr(activeChantier?.planning_start_date ?? activeChantier?.date_debut ?? null)}
                    {" - "}
                    Fin: {formatDateFr(activeChantier?.planning_end_date ?? activeChantier?.date_fin_prevue ?? null)}
                  </div>
                </div>

                <div className="overflow-x-auto whitespace-nowrap pb-2">
                  <div className="inline-flex gap-2">
                    {([
                      { key: "chantiers", label: "Chantiers" },
                      { key: "taches", label: "Taches" },
                      { key: "temps", label: "Temps" },
                      { key: "documents", label: "Documents" },
                      { key: "planning", label: "Planning" },
                      { key: "materiel", label: "Materiel" },
                    ] as Array<{ key: PortalTab; label: string }>).map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={[
                          "rounded-xl border px-3 py-2 text-sm",
                          activeTab === tab.key
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {activeTab === "chantiers" && (
                  <div className="space-y-2">
                    {chantiers.map((chantier) => (
                      <article key={chantier.id} className="rounded-xl border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-900">{chantier.nom}</div>
                            <div className="text-xs text-slate-500">{chantier.client || "Client non renseigne"}</div>
                          </div>
                          {selectedChantierId === chantier.id ? (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">Selectionne</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSelectChantier(chantier.id)}
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                            >
                              Ouvrir
                            </button>
                          )}
                        </div>
                        <div className="mt-2 text-xs leading-5 text-slate-500">
                          {chantier.adresse || "Adresse non renseignee"}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          Debut: {formatDateFr(chantier.planning_start_date ?? chantier.date_debut)}
                          {" - "}
                          Fin: {formatDateFr(chantier.planning_end_date ?? chantier.date_fin_prevue)}
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {activeTab === "taches" && (
                  <div className="space-y-2">
                    {tasksState.loading ? (
                      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">Chargement des taches...</div>
                    ) : tasksState.error ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{tasksState.error}</div>
                    ) : tasksState.data.length === 0 ? (
                      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-500">Aucune tache assignee.</div>
                    ) : (
                      prioritizedTasks.map((task) => (
                        <article key={task.id} className="rounded-xl border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-slate-900" style={TITLE_CLAMP_STYLE}>
                                {task.titre}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">Lot: {resolveTaskLot(task)}</div>
                              <div className="mt-1 text-xs leading-5 text-slate-500">
                                Qte totale: {formatQuantity(task.quantite, task.unite, "-")}
                                {" - "}
                                Qte realisee: {formatQuantity(task.quantite_realisee, task.unite)}
                              </div>
                              {taskQuantityProgress(task) !== null ? (
                                <div className="mt-1 text-xs text-slate-400">
                                  Avancement estime: {Math.round(taskQuantityProgress(task) ?? 0)}%
                                </div>
                              ) : null}
                            </div>
                            <span
                              className={[
                                "inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                                statusBadgeClass(task.status),
                              ].join(" ")}
                            >
                              {statusLabel(task.status)}
                            </span>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "temps" && (
                  <div className="space-y-3">
                    <form onSubmit={onCreateTimeEntry} className="rounded-xl border bg-slate-50 p-3">
                      <div className="mb-2 text-sm font-medium text-slate-800">Ajouter une saisie</div>
                      <div className="grid gap-2">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-slate-600">Tache</label>
                          <input
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                            value={timeTaskQuery}
                            placeholder="Rechercher une tache..."
                            onFocus={() => setTimeTaskListOpen(true)}
                            onChange={(e) => {
                              const value = e.target.value;
                              setTimeTaskQuery(value);
                              setTimeTaskListOpen(true);
                              setTimeFeedback(null);
                              const matchesSelected = selectedTimeTask && value.trim() === selectedTimeTask.titre;
                              if (!matchesSelected) {
                                setTimeTaskId(null);
                              }
                            }}
                          />

                          {timeTaskListOpen && filteredTimeTasks.length > 0 ? (
                            <div className="rounded-xl border bg-white p-1">
                              {filteredTimeTasks.map((task) => (
                                <button
                                  key={task.id}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selectTimeTask(task)}
                                  className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                                >
                                  <div className="text-sm font-medium text-slate-800" style={TITLE_CLAMP_STYLE}>
                                    {task.titre}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {resolveTaskLot(task)} - {statusLabel(task.status)}
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : timeTaskListOpen ? (
                            <div className="rounded-xl border bg-white px-3 py-2 text-xs text-slate-500">
                              Aucune tache correspondante.
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-600">Date</label>
                          <input
                            className="rounded-lg border px-2 py-1 text-sm"
                            type="date"
                            value={timeDate}
                            onChange={(e) => {
                              setTimeDate(e.target.value);
                              setTimeFeedback(null);
                            }}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-600">Quantite realisee</label>
                          {selectedTimeTask ? (
                            <div className="text-xs text-slate-500">
                              Qte totale: {formatQuantity(selectedTimeTask.quantite, selectedTimeTask.unite, "-")}
                            </div>
                          ) : null}
                          <input
                            className="rounded-lg border px-2 py-1 text-sm"
                            inputMode="decimal"
                            value={timeQuantity}
                            onChange={(e) => {
                              setTimeQuantity(e.target.value);
                              setTimeFeedback(null);
                            }}
                            placeholder={selectedTimeTask?.unite ? `Quantite (${selectedTimeTask.unite})` : "Quantite"}
                          />
                          <div className="text-[11px] text-slate-500">
                            L'avancement est calcule a partir de cette quantite.
                          </div>
                          {selectedTimeTask && taskQuantityProgress(selectedTimeTask) !== null ? (
                            <div className="text-[11px] text-slate-400">
                              Avancement actuel: {Math.round(taskQuantityProgress(selectedTimeTask) ?? 0)}%
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-600">Observations</label>
                          <textarea
                            className="min-h-20 rounded-lg border px-2 py-2 text-sm"
                            value={timeNote}
                            onChange={(e) => {
                              setTimeNote(e.target.value);
                              setTimeFeedback(null);
                            }}
                            placeholder="Observations (optionnel)"
                          />
                        </div>
                      </div>
                      {timeFeedback ? (
                        <div
                          className={[
                            "mt-3 rounded-lg border px-3 py-2 text-sm",
                            timeFeedback.type === "success"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-red-200 bg-red-50 text-red-700",
                          ].join(" ")}
                        >
                          {timeFeedback.message}
                        </div>
                      ) : null}
                      <div className="mt-3 flex justify-end">
                        <button
                          type="submit"
                          disabled={timeSaving}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {timeSaving ? "Enregistrement..." : "Enregistrer"}
                        </button>
                      </div>
                    </form>

                    {timeState.loading ? (
                      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">Chargement du temps...</div>
                    ) : timeState.error ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {isTaskIdRequiredError(timeState.error) ? "Choisir une tache." : timeState.error}
                      </div>
                    ) : timeState.data.length === 0 ? (
                      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-500">Aucun temps saisi.</div>
                    ) : (
                      timeState.data.map((entry) => (
                        <article key={entry.id} className="rounded-xl border p-3">
                          <div className="font-medium text-slate-900">
                            {formatDateFr(entry.work_date)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{entry.task_titre || "Tache"}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Quantite: {formatQuantity(entry.quantite_realisee, entry.task_unite)}
                          </div>
                          {entry.note ? <div className="mt-1 text-xs text-slate-500">Note: {entry.note}</div> : null}
                        </article>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "documents" && (
                  <div className="space-y-2">
                    {documentsState.loading ? (
                      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">Chargement des documents...</div>
                    ) : documentsState.error ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{documentsState.error}</div>
                    ) : documentsState.data.length === 0 ? (
                      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-500">Aucun document disponible.</div>
                    ) : (
                      documentsState.data.map((doc) => (
                        <article key={doc.id} className="rounded-xl border p-3">
                          <div className="font-medium text-slate-900">{doc.title || doc.file_name || "Document"}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {doc.category || "-"} - {doc.document_type || "-"} - {formatDateTimeFr(doc.created_at)}
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "planning" && (
                  <div className="space-y-2">
                    {planningState.loading ? (
                      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">Chargement du planning...</div>
                    ) : planningState.error ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{planningState.error}</div>
                    ) : planningState.data.lots.length === 0 ? (
                      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-500">Aucun lot planifie.</div>
                    ) : (
                      planningState.data.lots.map((lot) => (
                        <article key={lot.lot} className="rounded-xl border p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-slate-900">{lot.lot}</div>
                            <div className="text-xs text-slate-500">{lot.progress_pct.toFixed(1)}%</div>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-blue-600"
                              style={{ width: `${Math.max(0, Math.min(100, lot.progress_pct))}%` }}
                            />
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            Debut: {formatDateFr(lot.start_date)} - Fin: {formatDateFr(lot.end_date)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Taches: {lot.done_tasks}/{lot.total_tasks} - Duree estimee: {lot.total_duration_days} j
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "materiel" && (
                  <div className="space-y-3">
                    <form onSubmit={onCreateMateriel} className="rounded-xl border bg-slate-50 p-3">
                      <div className="mb-2 text-sm font-medium text-slate-800">Nouvelle demande materiel</div>
                      <div className="grid gap-2 md:grid-cols-5">
                        <input
                          className="rounded-lg border px-2 py-1 text-sm md:col-span-2"
                          placeholder="Titre"
                          value={materielTitre}
                          onChange={(e) => setMaterielTitre(e.target.value)}
                        />
                        <input
                          className="rounded-lg border px-2 py-1 text-sm"
                          placeholder="Quantite"
                          value={materielQuantite}
                          onChange={(e) => setMaterielQuantite(e.target.value)}
                        />
                        <input
                          className="rounded-lg border px-2 py-1 text-sm"
                          placeholder="Unite"
                          value={materielUnite}
                          onChange={(e) => setMaterielUnite(e.target.value)}
                        />
                        <input
                          className="rounded-lg border px-2 py-1 text-sm"
                          type="date"
                          value={materielDate}
                          onChange={(e) => setMaterielDate(e.target.value)}
                        />
                      </div>
                      <input
                        className="mt-2 w-full rounded-lg border px-2 py-1 text-sm"
                        placeholder="Commentaire"
                        value={materielCommentaire}
                        onChange={(e) => setMaterielCommentaire(e.target.value)}
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={materielSaving}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {materielSaving ? "Enregistrement..." : "Envoyer"}
                        </button>
                      </div>
                    </form>

                    {materielState.loading ? (
                      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">Chargement des demandes...</div>
                    ) : materielState.error ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{materielState.error}</div>
                    ) : materielState.data.length === 0 ? (
                      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-500">Aucune demande materiel.</div>
                    ) : (
                      materielState.data.map((row) => (
                        <article key={row.id} className="rounded-xl border p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-slate-900">{row.titre}</div>
                            <span
                              className={[
                                "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                                materielStatusClass(row.statut),
                              ].join(" ")}
                            >
                              {materielStatusLabel(row.statut)}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Quantite: {row.quantite ?? "-"} {row.unite || ""} - Souhaitee: {formatDateFr(row.date_souhaitee)}
                          </div>
                          {row.commentaire ? <div className="mt-1 text-xs text-slate-500">Commentaire: {row.commentaire}</div> : null}
                          {row.admin_commentaire ? <div className="mt-1 text-xs text-slate-500">Admin: {row.admin_commentaire}</div> : null}
                        </article>
                      ))
                    )}
                  </div>
                )}
              </section>
            )}

            {LEGACY_FALLBACK_ENABLED && import.meta.env.DEV && (
              <p className="text-xs text-slate-400">
                Compat fallback active: /acces/:token sera utilise uniquement si les RPC ne sont pas disponibles.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
