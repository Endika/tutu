import { it, expect } from 'vitest'
import type { Board } from '../../src/core/types'
import { solve, analyze } from '../../src/core/solver'
import { encode } from '../../src/core/board'

it('solves a one-move board with the right hint', () => {
  const b: Board = [{ id: 0, r: 2, c: 2, len: 2, o: 'H' }]
  expect(solve(b)).toEqual({ moves: 1, hint: { idx: 0, nr: 2, nc: 4 } })
})

it('returns null for an unsolvable board', () => {
  // Red at cols 0-1 on row 2; vertical pieces at col 2 rows 0-2 and 3-5 form a wall
  const b: Board = [
    { id: 0, r: 2, c: 0, len: 2, o: 'H' },
    { id: 1, r: 0, c: 2, len: 3, o: 'V' },
    { id: 2, r: 3, c: 2, len: 3, o: 'V' },
  ]
  expect(solve(b)).toBeNull()
})

it('analyze depth of the start equals solve() moves', () => {
  const b: Board = [
    { id: 0, r: 2, c: 0, len: 2, o: 'H' },
    { id: 1, r: 0, c: 3, len: 3, o: 'V' },
  ]
  const result = solve(b)
  expect(result).not.toBeNull()
  const a = analyze(b)
  expect(a).not.toBeNull()
  const startEnc = encode(b)
  const depthEntry = [...a!.byDepth.entries()].find(([, list]) => list.includes(startEnc))
  expect(depthEntry).toBeDefined()
  expect(depthEntry![0]).toBe(result!.moves)
})
