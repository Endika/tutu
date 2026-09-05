import { it, expect } from 'vitest'
import { makeRng } from '../../src/core/rng'
import { generateAtDepth } from '../../src/core/generator'
import { solve } from '../../src/core/solver'

it('generates an easy level whose real optimal matches its claimed depth', () => {
  const lvl = generateAtDepth(4, 2, 5, makeRng(42))
  expect(lvl).not.toBeNull()
  expect(lvl!.optimalMoves).toBeGreaterThanOrEqual(2)
  expect(lvl!.optimalMoves).toBeLessThanOrEqual(5)
  expect(solve(lvl!.board)!.moves).toBe(lvl!.optimalMoves)
})

it('is deterministic for a fixed seed', () => {
  const a = generateAtDepth(5, 2, 6, makeRng(7))
  const b = generateAtDepth(5, 2, 6, makeRng(7))
  expect(a).toEqual(b)
})
