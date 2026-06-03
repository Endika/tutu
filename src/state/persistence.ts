export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; }
export interface SaveState { levelIndex: number; muted: boolean; lang: string; }
const KEY = 'tutu.v1';
const DEFAULT: SaveState = { levelIndex: 0, muted: false, lang: 'en' };
export function load(store: KV = localStorage): SaveState {
  try { return { ...DEFAULT, ...JSON.parse(store.getItem(KEY) ?? '{}') }; } catch { return { ...DEFAULT }; }
}
export function save(state: SaveState, store: KV = localStorage): void {
  store.setItem(KEY, JSON.stringify(state));
}
