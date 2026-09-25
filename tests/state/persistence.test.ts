import { it, expect } from 'vitest'
import { load, save } from '../../src/state/persistence'
import type { KV } from '../../src/state/persistence'
function memKV(): KV {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v)
    },
  }
}
it('round-trips state and recovers from corrupt storage', () => {
  const kv = memKV()
  save({ levelIndex: 5, muted: true, lang: 'eu', musicOff: true }, kv)
  expect(load(kv)).toEqual({ levelIndex: 5, muted: true, lang: 'eu', musicOff: true })
  kv.setItem('tutu.v1', '{not json')
  expect(load(kv).levelIndex).toBe(0) // falls back, doesn't throw
})
it('returns defaults when storage is empty', () => {
  expect(load(memKV())).toEqual({ levelIndex: 0, muted: false, lang: 'en', musicOff: false })
})
it('format guard: state saved through the real save path loads back complete', () => {
  const kv = memKV()
  const state = { levelIndex: 3, muted: true, lang: 'fr', musicOff: true }
  save(state, kv)
  expect(load(kv)).toEqual(state)
})
it('load falls back to defaults when storage access is blocked, without throwing', () => {
  const blocked: KV = {
    getItem: () => {
      throw new DOMException('blocked', 'SecurityError')
    },
    setItem: () => {},
  }
  expect(() => load(blocked)).not.toThrow()
  expect(load(blocked)).toEqual({ levelIndex: 0, muted: false, lang: 'en', musicOff: false })
})
it('load falls back to defaults when the global localStorage itself is blocked', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('blocked', 'SecurityError')
    },
  })
  try {
    expect(() => load()).not.toThrow()
    expect(load()).toEqual({ levelIndex: 0, muted: false, lang: 'en', musicOff: false })
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
  }
})
it('save does not throw when setItem is blocked or the storage is full', () => {
  const full: KV = {
    getItem: () => null,
    setItem: () => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    },
  }
  expect(() =>
    save({ levelIndex: 1, muted: false, lang: 'en', musicOff: false }, full),
  ).not.toThrow()
})
