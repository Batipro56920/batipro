import { useSyncExternalStore } from "react";
import { al } from "./al";
import { fr } from "./fr";

export type Language = "fr" | "al";

type TranslationValue = string | { [key: string]: TranslationValue };
type TranslationTree = { [key: string]: TranslationValue };
type Params = Record<string, string | number>;

const STORAGE_KEY = "batipro.language";
const dictionaries: Record<Language, TranslationTree> = { fr, al: al as TranslationTree };
const localeByLanguage: Record<Language, string> = {
  fr: "fr-FR",
  al: "sq-AL",
};

const listeners = new Set<() => void>();

function isLanguage(value: string | null | undefined): value is Language {
  return value === "fr" || value === "al";
}

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isLanguage(stored) ? stored : "fr";
}

let currentLanguage: Language = readStoredLanguage();

function notify() {
  listeners.forEach((listener) => listener());
}

function resolvePath(tree: TranslationTree, key: string): string | null {
  const segments = key.split(".");
  let current: TranslationValue | undefined = tree;

  for (const segment of segments) {
    if (!current || typeof current === "string") return null;
    current = current[segment];
  }

  return typeof current === "string" ? current : null;
}

function interpolate(template: string, params?: Params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, token) => String(params[token] ?? `{${token}}`));
}

function syncDocumentLanguage(language: Language) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = localeByLanguage[language];
}

export function initializeI18n() {
  currentLanguage = readStoredLanguage();
  syncDocumentLanguage(currentLanguage);
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function getLocale(language: Language = currentLanguage) {
  return localeByLanguage[language];
}

export function setLanguage(language: Language) {
  if (language === currentLanguage) return;
  currentLanguage = language;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, language);
  }
  syncDocumentLanguage(language);
  notify();
}

export function translate(key: string, params?: Params, language: Language = currentLanguage) {
  const localized = resolvePath(dictionaries[language], key);
  const fallback = resolvePath(dictionaries.fr, key);
  const value = localized ?? fallback ?? key;
  return interpolate(value, params);
}

export function formatDate(
  value: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  language: Language = currentLanguage,
) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(getLocale(language), options).format(date);
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
  language: Language = currentLanguage,
  options?: Intl.DateTimeFormatOptions,
) {
  return formatDate(
    value,
    options ?? {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    },
    language,
  );
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  language: Language = currentLanguage,
) {
  return new Intl.NumberFormat(getLocale(language), options).format(value);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useI18n() {
  const language = useSyncExternalStore<Language>(subscribe, getLanguage, () => "fr");

  return {
    language,
    locale: getLocale(language),
    setLanguage,
    t: (key: string, params?: Params) => translate(key, params, language),
    formatDate: (value: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions) =>
      formatDate(value, options, language),
    formatDateTime: (value: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions) =>
      formatDateTime(value, language, options),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => formatNumber(value, options, language),
  };
}

initializeI18n();
