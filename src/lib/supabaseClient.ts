import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

function isTransientFetchFailure(error: unknown): boolean {
  const message = String((error as any)?.message ?? "").toLowerCase();
  return (
    message.includes("load failed") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("fetcherror")
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function supabaseFetchWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const fetchImpl = globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    throw new Error("Fetch API indisponible.");
  }

  try {
    return await fetchImpl(input, init);
  } catch (error) {
    if (!isTransientFetchFailure(error)) throw error;
    await wait(350);
    return fetchImpl(input, init);
  }
}

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

function getSafeAuthStorage(): Storage {
  if (typeof window === "undefined") {
    return createMemoryStorage();
  }
  try {
    const storage = window.localStorage;
    const probeKey = "__batipro_storage_probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return createMemoryStorage();
  }
}

const safeAuthStorage = getSafeAuthStorage();

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: safeAuthStorage,
  },
  global: {
    fetch: supabaseFetchWithRetry,
  },
});
