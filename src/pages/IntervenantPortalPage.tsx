
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  intervenantAddTaskComment,
  intervenantGetChantiers,
  intervenantGetDocuments,
  intervenantGetPlanning,
  intervenantGetTasks,
  intervenantMaterielCreate,
  intervenantMaterielList,
  intervenantSession,
  intervenantTimeCreate,
  intervenantTimeList,
  intervenantUpdateTaskStatus,
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
const TASK_STATUS_OPTIONS = ["A_FAIRE", "EN_COURS", "FAIT"] as const;

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

function formatHours(value: number | null): string {
  if (value === null) return "-";
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h`;
}

function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [taskStatusDrafts, setTaskStatusDrafts] = useState<Record<string, string>>({});
  const [taskCommentDrafts, setTaskCommentDrafts] = useState<Record<string, string>>({});

  const [timeTaskId, setTimeTaskId] = useState("__NONE__");
  const [timeDate, setTimeDate] = useState(todayIsoDate());
  const [timeDuration, setTimeDuration] = useState("1");
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
        setTaskStatusDrafts(Object.fromEntries(taskRows.map((task) => [task.id, task.status ?? "A_FAIRE"])));
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

  const requiresChantierSelection = chantiers.length > 1 && !selectedChantierId;
  const isInvalidToken = isInvalidTokenError(bootError ?? "");

  function reloadAll() {
    setReloadTick((tick) => tick + 1);
  }

  function onSelectChantier(chantierId: string) {
    setSelectedChantierId(chantierId);
  }

  async function onSaveTaskStatus(taskId: string) {
    if (!token || !selectedChantierId) return;

    const nextStatus = String(taskStatusDrafts[taskId] ?? "A_FAIRE").trim() || "A_FAIRE";
    setUpdatingTaskId(taskId);

    try {
      await intervenantUpdateTaskStatus(token, taskId, nextStatus);
      setTasksState((prev) => ({
        ...prev,
        data: prev.data.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task)),
      }));
    } catch (error) {
      setTasksState((prev) => ({
        ...prev,
        error: getErrorMessage(error, "Mise a jour statut impossible."),
      }));
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function onSaveTaskComment(taskId: string) {
    if (!token || !selectedChantierId) return;
    const message = String(taskCommentDrafts[taskId] ?? "").trim();
    if (!message) return;

    setUpdatingTaskId(taskId);
    try {
      await intervenantAddTaskComment(token, taskId, message, []);
      setTaskCommentDrafts((prev) => ({ ...prev, [taskId]: "" }));
    } catch (error) {
      setTasksState((prev) => ({
        ...prev,
        error: getErrorMessage(error, "Ajout commentaire impossible."),
      }));
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function onCreateTimeEntry(e: FormEvent) {
    e.preventDefault();
    if (!token || !selectedChantierId) return;

    const duration = Number(String(timeDuration).replace(",", "."));
    if (!Number.isFinite(duration) || duration <= 0) {
      setTimeState((prev) => ({ ...prev, error: "Duree invalide." }));
      return;
    }

    setTimeSaving(true);
    setTimeState((prev) => ({ ...prev, error: null }));

    try {
      await intervenantTimeCreate(token, {
        chantier_id: selectedChantierId,
        task_id: timeTaskId === "__NONE__" ? null : timeTaskId,
        work_date: timeDate || null,
        duration_hours: duration,
        note: timeNote.trim() || null,
      });

      const rows = await intervenantTimeList(token, selectedChantierId);
      setTimeState({ loading: false, error: null, data: rows });
      setTimeTaskId("__NONE__");
      setTimeDate(todayIsoDate());
      setTimeDuration("1");
      setTimeNote("");
    } catch (error) {
      setTimeState((prev) => ({
        ...prev,
        error: getErrorMessage(error, "Creation temps impossible."),
      }));
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
            <header className="rounded-2xl border bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Portail intervenant</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {sessionInfo?.intervenant?.nom || sessionInfo?.intervenant?.email || sessionInfo?.email || "Intervenant"}
                  </p>
                  <p className="text-xs text-slate-400">Session expire le {formatDateTimeFr(sessionInfo?.expires_at ?? null)}</p>
                </div>

                <div className="flex items-center gap-2">
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
              </div>
            </header>

            <section className="rounded-2xl border bg-white p-4 sm:p-5">
              <div className="mb-2 text-sm font-semibold text-slate-900">Chantiers accessibles</div>
              {chantiers.length === 0 ? (
                <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-500">Aucun chantier disponible.</div>
              ) : (
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
              )}
            </section>

            {requiresChantierSelection ? (
              <section className="rounded-2xl border bg-white p-6 text-sm text-slate-600">
                Choisir un chantier pour afficher les taches, le temps, le planning, les documents et le materiel.
              </section>
            ) : (
              <section className="rounded-2xl border bg-white p-4 sm:p-5">
                <div className="mb-3">
                  <div className="text-base font-semibold text-slate-900">{activeChantier?.nom ?? "Chantier"}</div>
                  <div className="text-xs text-slate-500">
                    {activeChantier?.adresse || "Adresse non renseignee"} - Debut: {formatDateFr(activeChantier?.planning_start_date ?? activeChantier?.date_debut ?? null)} - Fin: {formatDateFr(activeChantier?.planning_end_date ?? activeChantier?.date_fin_prevue ?? null)}
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
                        <div className="mt-2 text-xs text-slate-500">
                          Adresse: {chantier.adresse || "-"} - Debut: {formatDateFr(chantier.planning_start_date ?? chantier.date_debut)} - Fin: {formatDateFr(chantier.planning_end_date ?? chantier.date_fin_prevue)}
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
                      tasksState.data.map((task) => (
                        <article key={task.id} className="rounded-xl border p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-slate-900">{task.titre}</div>
                            <span
                              className={[
                                "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                                statusBadgeClass(task.status),
                              ].join(" ")}
                            >
                              {statusLabel(task.status)}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Lot: {resolveTaskLot(task)} - Duree: {task.duration_days} j - Ordre: {task.order_index}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Debut: {formatDateFr(task.date_debut)} - Fin: {formatDateFr(task.date_fin)} - Temps prevu: {formatHours(task.temps_prevu_h)} - Temps saisi: {formatHours(task.temps_reel_h)}
                          </div>
                          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
                            <div className="flex items-center gap-2">
                              <select
                                className="rounded-lg border px-2 py-1 text-sm"
                                value={taskStatusDrafts[task.id] ?? task.status ?? "A_FAIRE"}
                                onChange={(e) => setTaskStatusDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                              >
                                {TASK_STATUS_OPTIONS.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => onSaveTaskStatus(task.id)}
                                disabled={updatingTaskId === task.id}
                                className="rounded-lg border px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-60"
                              >
                                {updatingTaskId === task.id ? "Enregistrement..." : "Mettre a jour"}
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                className="rounded-lg border px-2 py-1 text-sm"
                                placeholder="Commentaire..."
                                value={taskCommentDrafts[task.id] ?? ""}
                                onChange={(e) => setTaskCommentDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                              />
                              <button
                                type="button"
                                onClick={() => onSaveTaskComment(task.id)}
                                disabled={updatingTaskId === task.id || !String(taskCommentDrafts[task.id] ?? "").trim()}
                                className="rounded-lg border px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-60"
                              >
                                Ajouter
                              </button>
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "temps" && (
                  <div className="space-y-3">
                    <form onSubmit={onCreateTimeEntry} className="rounded-xl border bg-slate-50 p-3">
                      <div className="mb-2 text-sm font-medium text-slate-800">Saisir du temps</div>
                      <div className="grid gap-2 md:grid-cols-4">
                        <select
                          className="rounded-lg border px-2 py-1 text-sm"
                          value={timeTaskId}
                          onChange={(e) => setTimeTaskId(e.target.value)}
                        >
                          <option value="__NONE__">Sans tache</option>
                          {tasksState.data.map((task) => (
                            <option key={task.id} value={task.id}>
                              {task.titre}
                            </option>
                          ))}
                        </select>
                        <input
                          className="rounded-lg border px-2 py-1 text-sm"
                          type="date"
                          value={timeDate}
                          onChange={(e) => setTimeDate(e.target.value)}
                        />
                        <input
                          className="rounded-lg border px-2 py-1 text-sm"
                          value={timeDuration}
                          onChange={(e) => setTimeDuration(e.target.value)}
                          placeholder="Duree (h)"
                        />
                        <input
                          className="rounded-lg border px-2 py-1 text-sm"
                          value={timeNote}
                          onChange={(e) => setTimeNote(e.target.value)}
                          placeholder="Note"
                        />
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={timeSaving}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {timeSaving ? "Enregistrement..." : "Ajouter temps"}
                        </button>
                      </div>
                    </form>

                    {timeState.loading ? (
                      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">Chargement du temps...</div>
                    ) : timeState.error ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{timeState.error}</div>
                    ) : timeState.data.length === 0 ? (
                      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-500">Aucun temps saisi.</div>
                    ) : (
                      timeState.data.map((entry) => (
                        <article key={entry.id} className="rounded-xl border p-3">
                          <div className="font-medium text-slate-900">
                            {formatHours(entry.duration_hours)} - {formatDateFr(entry.work_date)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">Tache: {entry.task_titre || "Sans tache"}</div>
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
