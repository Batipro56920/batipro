const KEY = "batipro.chantiers.v1";

export function loadChantiers<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveChantiers<T>(data: T) {
  localStorage.setItem(KEY, JSON.stringify(data));
}