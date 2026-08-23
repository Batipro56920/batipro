import { createContext, useContext } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "batipro.theme";
export const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];

export type ThemeContextValue = {
  /** Choix utilisateur persiste. */
  mode: ThemeMode;
  /** Theme reellement applique une fois "system" resolu. */
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme doit etre utilise dans un ThemeProvider.");
  return context;
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODES as string[]).includes(value);
}

export function readStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

/** Couleur de la barre systeme mobile : barre superieure en clair, fond applicatif en sombre. */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#FFFFFF",
  dark: "#0B111C",
};

export function applyThemeToDocument(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLOR[resolved];
}
