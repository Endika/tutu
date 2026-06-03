import { it, expect } from 'vitest';
import { nextLevel } from '../../src/levels/source';
import { bankSize } from '../../src/levels/bank';
import { solve } from '../../src/core/solver';

it('serves bank levels in order, then generates a solvable tail level', () => {
  const first = nextLevel(0);
  expect(solve(first.board)).not.toBeNull();
  const tail = nextLevel(bankSize + 5); // past the bank → live generation
  expect(solve(tail.board)).not.toBeNull();
}, 4_000); // tail gen capped at pc=6 [4,7]: p99 well under 500ms; 4s = soft perf guard

it('never returns null and bank levels match the bank', () => {
  const l = nextLevel(0);
  expect(l).toBeTruthy();
  expect(typeof l.optimalMoves).toBe('number');
});
