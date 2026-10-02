import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n/config';
import { formatMoney, formatMoneyMinor } from '../money';

afterEach(async () => { await i18n.changeLanguage('en'); });

describe('official money semantics with Korean screens', () => {
  it('uses the official formatter and /100 storage conversion for every screen locale', async () => {
    for (const language of ['en', 'de', 'ko', 'ko-KR']) {
      await i18n.changeLanguage(language);
      const locale = language === 'en' ? 'en-US' : language === 'de' ? 'de-CH' : language;
      for (const currency of ['CHF', 'EUR', 'USD', 'JPY']) {
        for (const minor of [0, 12345, -12345]) {
          const expected = new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
          expect(formatMoneyMinor(minor, currency)).toBe(expected);
          expect(formatMoney(minor / 100, currency)).toBe(expected);
        }
      }
      expect(formatMoneyMinor(12345, 'EUR', { locale: 'en-US' })).toBe('€123.45');
    }
  });
});
