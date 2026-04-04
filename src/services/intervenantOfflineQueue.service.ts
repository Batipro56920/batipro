import type {
  IntervenantChantier,
  IntervenantConsigne,
  IntervenantDocument,
  IntervenantInformationRequest,
  IntervenantMateriel,
  IntervenantPlanning,
  IntervenantReserve,
  IntervenantSessionInfo,
  IntervenantTask,
  IntervenantTerrainFeedback,
  IntervenantTimeEntry,
} from "./intervenantPortal.service";

const OFFLINE_CACHE_KEY = "batipro_intervenant_offline_cache_v1";
const OFFLINE_QUEUE_KEY = "batipro_intervenant_offline_queue_v1";

export type IntervenantOfflineAction =
  | {
      id: string;
      token: string;
      kind: "time_create";
      chantier_id: string;
      queued_at: string;
      payload: {
        chantier_id: string;
        task_id: string;
        work_date?: string | null;
        duration_hours: number;
        quantite_realisee?: number | null;
        progress_percent?: number | null;
        note?: string | null;
      };
    }
  | {
      id: string;
      token: string;
      kind: "materiel_create";
      chantier_id: string;
      queued_at: string;
      payload: {
        chantier_id: string;
        task_id?: string | null;
        titre: string;
        quantite?: number | null;
        unite?: string | null;
        commentaire?: string | null;
        date_souhaitee?: string | null;
      };
    }
  | {
      id: string;
      token: string;
      kind: "information_request_create";
      chantier_id: string;
      queued_at: string;
      payload: {
        chantier_id: string;
        request_date?: string | null;
        subject: string;
        message: string;
      };
    };

export type IntervenantOfflineChantierCache = {
  saved_at: string;
  tasks: IntervenantTask[];
  documents: IntervenantDocument[];
  planning: IntervenantPlanning;
  time_entries: IntervenantTimeEntry[];
  materiel: IntervenantMateriel[];
  info_requests: IntervenantInformationRequest[];
  terrain_feedbacks: IntervenantTerrainFeedback[];
  consignes: IntervenantConsigne[];
  reserves: IntervenantReserve[];
};

export type IntervenantOfflinePortalCache = {
  token: string;
  saved_at: string;
  session_info: IntervenantSessionInfo | null;
  chantiers: IntervenantChantier[];
  dashboard_tasks: Array<{ chantier: IntervenantChantier; task: IntervenantTask }>;
  chantiers_data: Record<string, IntervenantOfflineChantierCache>;
};

function readJsonObject<T>(key: string, fallback: T): T {
  if (typeof window === "undefined" || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJsonObject<T>(key: string, value: T) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage local indisponible ou plein : on garde le mode online sans casser l'UI.
  }
}

function readCacheStore(): Record<string, IntervenantOfflinePortalCache> {
  return readJsonObject<Record<string, IntervenantOfflinePortalCache>>(OFFLINE_CACHE_KEY, {});
}

function writeCacheStore(value: Record<string, IntervenantOfflinePortalCache>) {
  writeJsonObject(OFFLINE_CACHE_KEY, value);
}

function readQueueStore(): IntervenantOfflineAction[] {
  const rows = readJsonObject<IntervenantOfflineAction[]>(OFFLINE_QUEUE_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function writeQueueStore(value: IntervenantOfflineAction[]) {
  writeJsonObject(OFFLINE_QUEUE_KEY, value);
}

export function createIntervenantOfflineActionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function readIntervenantOfflinePortalCache(token: string): IntervenantOfflinePortalCache | null {
  const key = String(token ?? "").trim();
  if (!key) return null;
  return readCacheStore()[key] ?? null;
}

export function saveIntervenantOfflinePortalCache(
  token: string,
  patch: Partial<Omit<IntervenantOfflinePortalCache, "token">>,
) {
  const key = String(token ?? "").trim();
  if (!key) return;
  const currentStore = readCacheStore();
  const currentValue = currentStore[key] ?? {
    token: key,
    saved_at: new Date().toISOString(),
    session_info: null,
    chantiers: [],
    dashboard_tasks: [],
    chantiers_data: {},
  };
  currentStore[key] = {
    ...currentValue,
    ...patch,
    token: key,
    saved_at: new Date().toISOString(),
    chantiers_data: {
      ...currentValue.chantiers_data,
      ...(patch.chantiers_data ?? {}),
    },
  };
  writeCacheStore(currentStore);
}

export function queueIntervenantOfflineAction(action: IntervenantOfflineAction): number {
  const nextQueue = [...readQueueStore(), action];
  writeQueueStore(nextQueue);
  return nextQueue.filter((row) => row.token === action.token).length;
}

export function listIntervenantOfflineActions(token: string): IntervenantOfflineAction[] {
  const key = String(token ?? "").trim();
  if (!key) return [];
  return readQueueStore().filter((row) => row.token === key);
}

export function countIntervenantOfflineActions(token: string): number {
  return listIntervenantOfflineActions(token).length;
}

export function removeIntervenantOfflineAction(actionId: string) {
  const key = String(actionId ?? "").trim();
  if (!key) return;
  writeQueueStore(readQueueStore().filter((row) => row.id !== key));
}

export function clearIntervenantOfflineActions(token: string) {
  const key = String(token ?? "").trim();
  if (!key) return;
  writeQueueStore(readQueueStore().filter((row) => row.token !== key));
}
