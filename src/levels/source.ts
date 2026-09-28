import type { Level } from '../core/types'
import { bankLevel, bankSize } from './bank'
import { levelToParams } from '../core/difficulty'
import { generateAtDepth } from '../core/generator'
import { makeRng } from '../core/rng'
import type { GenerateRequest, GenerateResponse } from '../worker/protocol'

export type GenFn = (pieceCount: number, lo: number, hi: number) => Level | null

const liveRng = makeRng(7)
const defaultGen: GenFn = (pc, lo, hi) => generateAtDepth(pc, lo, hi, liveRng)

// Off-bank ("tail") difficulty. The ramp keeps climbing with the level, but pieces
// and depth are capped so a board is still found quickly off the UI thread, and the
// depth window is widened so generation rarely starves and falls back.
export const TAIL_MAX_LAYOUTS = 80
export function tailParams(index: number): { pieceCount: number; lo: number; hi: number } {
  const p = levelToParams(index + 1)
  // Aim for genuinely hard boards (~9-12 optimal moves). This takes a few seconds
  // in the worker, so the app shows a "generating" spinner; if the retry loop
  // starves we fall back to recycleHard() below (instant, also hard).
  return {
    pieceCount: Math.min(p.pieceCount, 9),
    lo: Math.min(p.targetLo, 8),
    hi: Math.min(p.targetLo + 6, 16),
  }
}

// True when the level isn't in the prebuilt bank and must be generated.
export function willGenerate(index: number): boolean {
  return bankLevel(index) === null
}

// Last resort when live generation starves: recycle from the hard end of the bank
// (sorted ascending) so the tail never drops back to trivial puzzles.
function recycleHard(index: number): Level {
  const hardStart = Math.floor(bankSize * 0.75)
  const span = Math.max(1, bankSize - hardStart)
  return bankLevel(hardStart + (index % span))!
}

export function nextLevel(index: number, gen: GenFn = defaultGen): Level {
  const fromBank = bankLevel(index)
  if (fromBank) return fromBank
  const { pieceCount, lo, hi } = tailParams(index)
  return gen(pieceCount, lo, hi) ?? recycleHard(index)
}

// The subset of Worker this module uses, so tests can drive it with an in-memory fake.
export interface LevelWorker {
  postMessage(request: GenerateRequest): void
  terminate(): void
  addEventListener(type: 'message' | 'error' | 'messageerror', listener: (e: Event) => void): void
}

interface Pending {
  index: number
  resolve: (level: Level) => void
  reject: (err: Error) => void
}

export function createAsyncSource(spawn: () => LevelWorker): (index: number) => Promise<Level> {
  let worker: LevelWorker | null = null
  let msgSeq = 0
  const pending = new Map<number, Pending>()

  // A worker that failed to load or threw never answers, and a reply that can't be
  // deserialized carries no readable id, so every pending request is failed and the
  // next one starts a fresh worker.
  function failAll(w: LevelWorker, reason: string): void {
    if (worker !== w) return
    w.terminate()
    worker = null
    const err = new Error(reason)
    for (const p of pending.values()) p.reject(err)
    pending.clear()
  }

  function getWorker(): LevelWorker {
    if (worker) return worker
    const w = spawn()
    w.addEventListener('message', (e) => {
      const { id, level } = (e as MessageEvent<GenerateResponse>).data
      const p = pending.get(id)
      if (!p) return
      pending.delete(id)
      // On starve, recycle a hard bank level rather than re-running heavy
      // generation on the main thread (which would freeze the UI).
      p.resolve(level ?? recycleHard(p.index))
    })
    w.addEventListener('error', () => failAll(w, 'level worker failed'))
    w.addEventListener('messageerror', () => failAll(w, 'level worker reply unreadable'))
    worker = w
    return w
  }

  return (index) => {
    const fromBank = bankLevel(index)
    if (fromBank) return Promise.resolve(fromBank)
    const { pieceCount, lo, hi } = tailParams(index)
    return new Promise<Level>((resolve, reject) => {
      const w = getWorker()
      const id = ++msgSeq
      pending.set(id, { index, resolve, reject })
      const request: GenerateRequest = { id, pieceCount, lo, hi, maxLayouts: TAIL_MAX_LAYOUTS }
      w.postMessage(request)
    })
  }
}

export const nextLevelAsync = createAsyncSource(
  () =>
    new Worker(new URL('../worker/generator.worker.ts', import.meta.url), {
      type: 'module',
    }),
)
