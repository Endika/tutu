export interface KV {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}
export interface SaveState {
  levelIndex: number
  muted: boolean
  lang: string
  musicOff: boolean
}
const KEY = 'tutu.v1'
const DEFAULT: SaveState = { levelIndex: 0, muted: false, lang: 'en', musicOff: false }
export function load(store?: KV): SaveState {
  try {
    const kv = store ?? localStorage
    return { ...DEFAULT, ...JSON.parse(kv.getItem(KEY) ?? '{}') }
  } catch {
    return { ...DEFAULT }
  }
}
export function save(state: SaveState, store?: KV): void {
  try {
    const kv = store ?? localStorage
    kv.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage full or blocked: keep playing with in-memory state
  }
}
