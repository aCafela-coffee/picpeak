import type { i18n } from 'i18next';

// Separate from i18next's detector cache, which also caches server defaults.
export const SCREEN_LANGUAGE_KEY = 'picpeak.screenLanguage';
const codes = new Set(['en', 'de', 'ru', 'pt', 'nl', 'fr', 'es', 'sl', 'ko']);
let memoryPreference: string | undefined;

export function normalizeScreenLanguage(language?: string): string | undefined {
  const base = language?.toLowerCase().split('-')[0];
  return base && codes.has(base) ? base : undefined;
}

export function getScreenLanguage(): string | undefined {
  try {
    return normalizeScreenLanguage(localStorage.getItem(SCREEN_LANGUAGE_KEY) || undefined);
  } catch {
    return memoryPreference;
  }
}

export function selectScreenLanguage(instance: i18n, language: string) {
  const normalized = normalizeScreenLanguage(language);
  if (!normalized) return Promise.resolve();
  memoryPreference = normalized;
  try { localStorage.setItem(SCREEN_LANGUAGE_KEY, normalized); } catch { /* Session preference still works. */ }
  return instance.changeLanguage(normalized);
}

// Only a deliberate UI choice overrides official server-language behaviour.
export function applyServerLanguage(instance: i18n, language: string) {
  if (getScreenLanguage()) return Promise.resolve();
  return instance.changeLanguage(language);
}

// Screen-only Korean must not become an API/document locale. These callers
// previously derived a locale from the screen, so use official English there.
export function documentLanguage(language?: string): string {
  return normalizeScreenLanguage(language) === 'ko' ? 'en' : language || 'en';
}
