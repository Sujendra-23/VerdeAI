import { SUPPORTED_LOCALES, type SupportedLocale } from '@verdeai/shared-types';
import { useI18n, useLanguageStore } from '../i18n';
const names: Record<SupportedLocale, string> = {
  en: 'English', kn: 'ಕನ್ನಡ', hi: 'हिन्दी', fr: 'Français', es: 'Español',
};
export function LanguageSelector() {
  const { locale, t } = useI18n();
  const setLocale = useLanguageStore((s) => s.setLocale);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor="language-select" className="text-sm text-slate-300">{t('language')}</label>
      <select id="language-select" value={locale} onChange={(e) => setLocale(e.target.value)}
        className="min-h-11 rounded-md border border-slate-700 bg-slate-900 px-2 py-2 text-base focus:border-verde-500 md:text-sm">
        {SUPPORTED_LOCALES.map((value) => <option key={value} value={value} lang={value}>{names[value]}</option>)}
      </select>
    </div>
  );
}
