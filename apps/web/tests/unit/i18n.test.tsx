import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectLocale, useI18n, useLanguageStore } from '../../src/i18n';
import { LanguageSelector } from '../../src/components/LanguageSelector';

function DatePreview() {
  const { date } = useI18n();
  return <output>{date('2026-02-05')}</output>;
}
beforeEach(() => {
  // Node's experimental storage shadows jsdom's storage in this runtime.
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    clear: () => values.clear(),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useLanguageStore.getState().setLocale('en');
  window.localStorage.clear();
  vi.unstubAllGlobals();
});
describe('language selection', () => {
  it('changes labels and calendar formatting and remembers the selection', async () => {
    useLanguageStore.getState().setLocale('en');
    render(<><LanguageSelector /><DatePreview /></>);
    await userEvent.selectOptions(screen.getByLabelText('Language'), 'kn');
    expect(screen.getByLabelText('ಭಾಷೆ')).toHaveValue('kn');
    expect(document.documentElement.lang).toBe('kn');
    expect(window.localStorage.getItem('verdeai.language')).toBe('kn');
    expect(detectLocale()).toBe('kn');
    expect(screen.getByRole('status')).toHaveTextContent(new Intl.DateTimeFormat('kn', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date('2026-02-05T00:00:00Z')));
  });
  it('detects supported regional device languages in preference order', () => {
    window.localStorage.clear();
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE', 'kn-IN', 'fr-FR']);
    expect(detectLocale()).toBe('kn');
  });
  it('handles unsupported saved preferences and unavailable storage', () => {
    window.localStorage.setItem('verdeai.language', 'unsupported');
    expect(detectLocale()).toBe('en');
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    expect(() => useLanguageStore.getState().setLocale('hi')).not.toThrow();
    expect(useLanguageStore.getState().locale).toBe('hi');
  });
});
