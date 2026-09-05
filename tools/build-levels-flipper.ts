// Build the 100-level bank for the Flipper Zero port (flipper-tutu).
//
// Reuses the tested solver/generator: a random layout is fully analyzed (BFS of its whole
// component), which labels every reachable arrangement by its optimal distance to the exit.
// One analyze() therefore harvests levels at MANY depths at once. We pool unique levels by
// depth, then select exactly 100 on a non-decreasing, back-weighted curve, clamped to what
// is actually reachable. Output: flipper-tutu/tools/levels.json (vendored & committed there).
//
// Run: cd /home/endika/workspace/tutu && npx tsx tools/build-levels-flipper.ts

import { makeRng } from '../src/core/rng'
import { randomLayout } from '../src/core/generator'
import { analyze } from '../src/core/solver'
import { decode } from '../src/core/board'
import type { Board, Level } from '../src/core/types'
import { writeFileSync } from 'fs'
import { join } from 'path'

const TOTAL = 100
const MIN_DEPTH = 2
const MAX_DEPTH = 24 // raised ceiling so the back of the bank is genuinely hard
const HARVEST_MS = 150_000
const PER_DEPTH_CAP = 30
const PER_LAYOUT_PER_DEPTH = 2

const rng = makeRng(20260606)

// favour congested layouts so deep (hard) positions are actually reachable
const PIECE_COUNTS = [8, 9, 10, 11, 12, 12, 11, 10]

// canonical signature of a decoded board (piece order is fixed, but be explicit)
function sig(board: Board): string {
  return board
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((p) => `${p.r},${p.c},${p.len},${p.o}`)
    .join('|')
}

// depth -> (signature -> board)
const pool = new Map<number, Map<string, Board>>()
const start = Date.now()
let layouts = 0

while (Date.now() - start < HARVEST_MS) {
  const pc = PIECE_COUNTS[layouts % PIECE_COUNTS.length]!
  layouts++
  const a = analyze(randomLayout(pc, rng))
  if (!a) continue
  for (const [d, states] of a.byDepth) {
    if (d < MIN_DEPTH || d > MAX_DEPTH) continue
    let bucket = pool.get(d)
    if (!bucket) {
      bucket = new Map()
      pool.set(d, bucket)
    }
    let taken = 0
    for (let i = 0; i < states.length && taken < PER_LAYOUT_PER_DEPTH; i++) {
      if (bucket.size >= PER_DEPTH_CAP) break
      const e = states[rng.int(states.length)]!
      const board = decode(a.template, e)
      const s = sig(board)
      if (bucket.has(s)) continue
      bucket.set(s, board)
      taken++
    }
  }
}

const avail = new Map<number, number>()
for (const [d, b] of pool) if (b.size > 0) avail.set(d, b.size)
const totalAvail = [...avail.values()].reduce((s, n) => s + n, 0)

process.stdout.write(`layouts analyzed: ${layouts}, total unique pooled: ${totalAvail}\n`)
const histo = [...avail.keys()].sort((a, b) => a - b).map((d) => `${d}:${avail.get(d)}`)
process.stdout.write(`pool by depth -> ${histo.join('  ')}\n`)

if (totalAvail < TOTAL) {
  throw new Error(
    `only ${totalAvail} unique levels pooled (<${TOTAL}); raise HARVEST_MS/PER_DEPTH_CAP`,
  )
}

// Target-curve selection. Anchor points [levelIndex (1-based), optimalMoves] define the
// desired difficulty per position; we interpolate between them and, for each level, pull
// from the pool the available depth nearest the target (never below the previous level, to
// keep the curve non-decreasing). Mid stays moderate; the tail (L75→L100) is the steep
// climb up to the ceiling — "hard part from ~75 onward", as requested.
const ANCHORS: Array<[level: number, moves: number]> = [
  [1, 2],
  [15, 6],
  [40, 10],
  [65, 13],
  [75, 15],
  [85, 18],
  [92, 21],
  [100, 24],
]

function targetMoves(i: number): number {
  for (let k = 0; k < ANCHORS.length - 1; k++) {
    const [x0, y0] = ANCHORS[k]!
    const [x1, y1] = ANCHORS[k + 1]!
    if (i <= x1) return y0 + ((y1 - y0) * (i - x0)) / (x1 - x0)
  }
  return ANCHORS[ANCHORS.length - 1]![1]
}

// per-depth remaining stock (arrays of boards)
const stock = new Map<number, Board[]>()
for (const [d, b] of pool) stock.set(d, [...b.values()])
const depthsSorted = [...stock.keys()].sort((a, b) => a - b)

function takeNearest(target: number, minAllowed: number): { d: number; board: Board } | null {
  const cands = depthsSorted.filter((d) => d >= minAllowed && stock.get(d)!.length > 0)
  if (!cands.length) return null
  let best = cands[0]!
  for (const d of cands) if (Math.abs(d - target) < Math.abs(best - target)) best = d
  return { d: best, board: stock.get(best)!.shift()! }
}

const bank: Level[] = []
let minAllowed = depthsSorted[0]!
for (let i = 1; i <= TOTAL; i++) {
  const r = takeNearest(Math.round(targetMoves(i)), minAllowed)
  if (!r) throw new Error(`ran out of stock at level ${i}`)
  bank.push({ board: r.board, optimalMoves: r.d })
  minAllowed = r.d // enforce non-decreasing
}

bank.sort((a, b) => a.optimalMoves - b.optimalMoves)

if (bank.length !== TOTAL) throw new Error(`expected ${TOTAL} levels, got ${bank.length}`)
for (let i = 1; i < bank.length; i++) {
  if (bank[i]!.optimalMoves < bank[i - 1]!.optimalMoves) throw new Error('curve not non-decreasing')
}

const finalHisto: Record<number, number> = {}
for (const l of bank) finalHisto[l.optimalMoves] = (finalHisto[l.optimalMoves] || 0) + 1
process.stdout.write(`selected curve -> ${JSON.stringify(finalHisto)}\n`)

const out = join(import.meta.dirname, '..', '..', 'flipper-tutu', 'tools', 'levels.json')
writeFileSync(out, JSON.stringify(bank))
process.stdout.write(`Wrote ${bank.length} levels to ${out}\n`)
