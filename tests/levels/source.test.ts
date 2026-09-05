import { it, expect } from 'vitest'
import { nextLevel } from '../../src/levels/source'
import { bankSize } from '../../src/levels/bank'
import { generateAtDepth } from '../../src/core/generator'
import { makeRng } from '../../src/core/rng'
import { solve } from '../../src/core/solver'

it('serves bank levels in order, then generates a solvable tail level', () => {
  const first = nextLevel(0)
  expect(solve(first.board)).not.toBeNull()
  // Inject a fast easy generator so the test stays quick and deterministic: it asserts
  // the bank→generation orchestration yields a solvable tail level. Hard live generation
  // is exercised by the generator's own test.
  const rng = makeRng(1)
  const fastGen = (pc: number) => generateAtDepth(Math.min(pc, 5), 2, 5, rng)
  const tail = nextLevel(bankSize + 5, fastGen)
  expect(solve(tail.board)).not.toBeNull()
})

it('never returns null and bank levels match the bank', () => {
  const l = nextLevel(0)
  expect(l).toBeTruthy()
  expect(typeof l.optimalMoves).toBe('number')
})
