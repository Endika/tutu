import { makeRng } from '../src/core/rng'
import { generateAtDepth } from '../src/core/generator'
import { encode } from '../src/core/board'
import type { Level } from '../src/core/types'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const OVERALL_CAP_MS = 240_000
const BAND_BUDGET_MS = 20_000
const QUOTA = 10

const start = Date.now()
const rng = makeRng(20260603)

const bank: Level[] = []
const seen = new Set<string>()

let consecutiveEmpty = 0
let stoppedAt: string | undefined

outer: for (let m = 2; ; m++) {
  if (Date.now() - start > OVERALL_CAP_MS) {
    stoppedAt = `overall cap ${OVERALL_CAP_MS / 1000}s hit at m=${m}`
    break
  }

  const pieceCount = Math.min(4 + Math.floor((m - 2) / 1.5), 12)
  const maxLayouts = 40 + m * 8
  const bandStart = Date.now()
  const collected: Level[] = []

  while (collected.length < QUOTA) {
    if (Date.now() - bandStart > BAND_BUDGET_MS) break
    if (Date.now() - start > OVERALL_CAP_MS) {
      stoppedAt = `overall cap ${OVERALL_CAP_MS / 1000}s hit at m=${m}`
      break outer
    }

    const lvl = generateAtDepth(pieceCount, m, m, rng, maxLayouts)
    if (!lvl) continue
    const key = encode(lvl.board)
    if (seen.has(key)) continue
    seen.add(key)
    collected.push(lvl)
  }

  const elapsed = Date.now() - bandStart
  process.stdout.write(
    `m=${m} pieces=${pieceCount} maxLayouts=${maxLayouts}: got ${collected.length}/${QUOTA} in ${elapsed}ms\n`,
  )

  bank.push(...collected)

  if (collected.length === 0) {
    consecutiveEmpty++
    if (consecutiveEmpty >= 2) {
      stoppedAt = `two consecutive zero bands (m=${m - 1} and m=${m})`
      break
    }
  } else {
    consecutiveEmpty = 0
  }
}

bank.sort((a, b) => a.optimalMoves - b.optimalMoves)

const elapsed = Date.now() - start
const moves = bank.map((l) => l.optimalMoves)
const minMoves = Math.min(...moves)
const maxMoves = Math.max(...moves)
const dist: Record<number, number> = {}
for (const m of moves) dist[m] = (dist[m] || 0) + 1

process.stdout.write(`\nStopped: ${stoppedAt}\n`)
process.stdout.write(
  `Total: ${bank.length} levels, optimalMoves ${minMoves}..${maxMoves} (${elapsed}ms)\n`,
)
process.stdout.write(`Distribution: ${JSON.stringify(dist)}\n`)

const outDir = join(import.meta.dirname, '..', 'src', 'levels')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'levels.json'), JSON.stringify(bank))
