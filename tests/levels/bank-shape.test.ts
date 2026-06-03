import { it, expect } from 'vitest';
import bank from '../../src/levels/levels.json';
import { solve } from '../../src/core/solver';
import type { Level } from '../../src/core/types';

const levels = bank as Level[];
it('ships a non-trivial, solvable, difficulty-sorted bank', () => {
  expect(levels.length).toBeGreaterThan(120);
  for (const i of [0, Math.floor(levels.length / 2), levels.length - 1]) {
    const lvl = levels[i]!;
    expect(solve(lvl.board)!.moves).toBe(lvl.optimalMoves); // shipped data is genuinely solvable at claimed depth
  }
  expect(levels.at(-1)!.optimalMoves).toBeGreaterThan(levels[0]!.optimalMoves); // sorted, harder at the end
  for (let i = 1; i < levels.length; i++) expect(levels[i]!.optimalMoves).toBeGreaterThanOrEqual(levels[i-1]!.optimalMoves);
});
