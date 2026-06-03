import { en } from './locales/en';
import { es } from './locales/es';
import { eu } from './locales/eu';
import { gl } from './locales/gl';
import { va } from './locales/va';
import { ca } from './locales/ca';
import type { Dict } from './locales/en';

export type { Dict };
export const LOCALES: Record<string, Dict> = { en, es, eu, gl, va, ca };
export function detectLang(nav: { language?: string } = navigator): string {
  const code = (nav.language || 'en').slice(0, 2).toLowerCase();
  return code in LOCALES ? code : 'en';
}
let current: Dict = en;
export function setLang(code: string): void { current = LOCALES[code] ?? en; }
export function t(key: keyof Dict): string { return current[key]; }
