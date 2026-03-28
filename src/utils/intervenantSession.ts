const STORAGE_TOKEN_KEY = "batipro_intervenant_token";
const STORAGE_CHANTIER_KEY = "batipro_intervenant_chantier_id";

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

export function readStoredIntervenantToken(): string {
  const storage = getSafeStorage();
  if (!storage) return memoryToken;
  try {
    return String(storage.getItem(STORAGE_TOKEN_KEY) ?? "").trim();
  } catch {
    return memoryToken;
  }
}

export function persistIntervenantToken(token: string) {
  memoryToken = String(token ?? "").trim();
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_TOKEN_KEY, memoryToken);
  } catch {}
}

export function clearStoredIntervenantToken() {
  memoryToken = "";
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_TOKEN_KEY);
  } catch {}
}

export function readStoredIntervenantChantierId(): string {
  const storage = getSafeStorage();
  if (!storage) return memoryChantierId;
  try {
    return String(storage.getItem(STORAGE_CHANTIER_KEY) ?? "").trim();
  } catch {
    return memoryChantierId;
  }
}

export function persistIntervenantChantierId(chantierId: string) {
  memoryChantierId = String(chantierId ?? "").trim();
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_CHANTIER_KEY, memoryChantierId);
  } catch {}
}

export function clearStoredIntervenantChantierId() {
  memoryChantierId = "";
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_CHANTIER_KEY);
  } catch {}
}

export function clearStoredIntervenantSession() {
  clearStoredIntervenantToken();
  clearStoredIntervenantChantierId();
}

export function extractIntervenantToken(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const queryToken = url.searchParams.get("token")?.trim();
    if (queryToken) return queryToken;

    const accessMatch = url.pathname.match(/\/acces\/([^/?#]+)/i);
    if (accessMatch?.[1]) return decodeURIComponent(accessMatch[1]).trim();
  } catch {}

  const queryMatch = raw.match(/[?&]token=([^&#]+)/i);
  if (queryMatch?.[1]) return decodeURIComponent(queryMatch[1]).trim();

  const accessMatch = raw.match(/\/acces\/([^/?#]+)/i);
  if (accessMatch?.[1]) return decodeURIComponent(accessMatch[1]).trim();

  return raw;
}
