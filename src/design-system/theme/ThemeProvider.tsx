import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  applyThemeToDocument,
  readStoredThemeMode,
  THEME_STORAGE_KEY,
  ThemeContext,
  type ResolvedTheme,
  type ThemeContextValue,
  type ThemeMode,
} from "./theme-context";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToSystemTheme(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(DARK_QUERY).matches;
}

/**
 * Theme Batipro : light / dark / system, avec preference utilisateur persistee.
 * Seule preference d'interface stockee localement (aucune donnee metier).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredThemeMode);
  const systemPrefersDark = useSyncExternalStore(subscribeToSystemTheme, getSystemPrefersDark, () => false);

  const resolved: ResolvedTheme = mode === "system" ? (systemPrefersDark ? "dark" : "light") : mode;

  useEffect(() => {
    applyThemeToDocument(resolved);
  }, [resolved]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Preference non persistable (mode prive) : on garde le choix en memoire.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
