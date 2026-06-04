import { it, expect } from 'vitest';
import { load, save } from '../../src/state/persistence';
import type { KV } from '../../src/state/persistence';
function memKV(): KV { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } }; }
it('round-trips state and recovers from corrupt storage', () => {
  const kv = memKV();
  save({ levelIndex: 5, muted: true, lang: 'eu', musicOff: true }, kv);
  expect(load(kv)).toEqual({ levelIndex: 5, muted: true, lang: 'eu', musicOff: true });
  kv.setItem('tutu.v1', '{not json');
  expect(load(kv).levelIndex).toBe(0); // falls back, doesn't throw
});
it('returns defaults when storage is empty', () => {
  expect(load(memKV())).toEqual({ levelIndex: 0, muted: false, lang: 'en', musicOff: false });
});
