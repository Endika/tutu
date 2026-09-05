import type { Level } from '../core/types'
import { bankLevel, bankSize } from './bank'
import { levelToParams } from '../core/difficulty'
import { generateAtDepth } from '../core/generator'
import { makeRng } from '../core/rng'

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

let worker: Worker | null = null
let msgSeq = 0
function getWorker(): Worker {
  worker ??= new Worker(new URL('../worker/generator.worker.ts', import.meta.url), {
    type: 'module',
  })
  return worker
}

export function nextLevelAsync(index: number): Promise<Level> {
  const fromBank = bankLevel(index)
  if (fromBank) return Promise.resolve(fromBank)
  const { pieceCount, lo, hi } = tailParams(index)
  const id = ++msgSeq
  return new Promise<Level>((resolve) => {
    const w = getWorker()
    const onMsg = (e: MessageEvent<{ id: number; level: Level | null }>) => {
      if (e.data.id !== id) return
      w.removeEventListener('message', onMsg)
      // On starve, recycle a hard bank level rather than re-running heavy
      // generation on the main thread (which would freeze the UI).
      resolve(e.data.level ?? recycleHard(index))
    }
    w.addEventListener('message', onMsg)
    w.postMessage({ id, pieceCount, lo, hi, maxLayouts: TAIL_MAX_LAYOUTS })
  })
}
