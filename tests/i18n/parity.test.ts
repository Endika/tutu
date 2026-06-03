import { it, expect } from 'vitest';
import { LOCALES, detectLang } from '../../src/i18n';
import { en } from '../../src/i18n/locales/en';
it('every locale defines every key with a non-empty string', () => {
  const keys = Object.keys(en) as (keyof typeof en)[];
  for (const [code, dict] of Object.entries(LOCALES))
    for (const k of keys) {
      expect(typeof dict[k], `${code}.${k}`).toBe('string');
      expect(dict[k].length, `${code}.${k} empty`).toBeGreaterThan(0);
    }
});
it('detects a supported browser language or falls back to en', () => {
  expect(detectLang({ language: 'es-ES' })).toBe('es');
  expect(detectLang({ language: 'eu' })).toBe('eu');
  expect(detectLang({ language: 'fr-FR' })).toBe('en'); // unsupported → en
  expect(detectLang({ language: undefined })).toBe('en');
});
