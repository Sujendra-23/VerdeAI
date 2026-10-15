import { create } from 'zustand';
import { resolveLocale, SUPPORTED_LOCALES, type SupportedLocale } from '@verdeai/shared-types';
import { messages, type MessageKey } from './messages';

const STORAGE_KEY = 'verdeai.language';
export function detectLocale(): SupportedLocale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return resolveLocale(stored);
  } catch { /* Storage may be disabled; keep the preference in memory. */ }
  for (const language of navigator.languages ?? [navigator.language]) {
    const base = language.toLowerCase().split(/[-_]/)[0];
    if (SUPPORTED_LOCALES.some((locale) => locale === base)) return resolveLocale(language);
  }
  return 'en';
}
function applyLocale(locale: SupportedLocale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = 'ltr';
}
const initialLocale = detectLocale();
applyLocale(initialLocale);
export const useLanguageStore = create<{
  locale: SupportedLocale;
  setLocale: (value: string) => void;
}>((set) => ({
  locale: initialLocale,
  setLocale: (value) => {
    const locale = resolveLocale(value);
    try { window.localStorage.setItem(STORAGE_KEY, locale); } catch { /* Keep working without storage. */ }
    applyLocale(locale);
    set({ locale });
  },
}));

export function useI18n() {
  const locale = useLanguageStore((s) => s.locale);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  return {
    locale, number,
    // API dates are calendar days, so UTC avoids shifting them on another device.
    date: (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)),
    t: (key: MessageKey, values: Record<string, string | number> = {}) =>
      messages[locale][key].replace(/\{(\w+)\}/g, (_, name: string) =>
        typeof values[name] === 'number' ? number(values[name]) : String(values[name] ?? `{${name}}`)),
  };
}
