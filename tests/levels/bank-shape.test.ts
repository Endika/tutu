import { it, expect } from 'vitest';
import bank from '../../src/levels/levels.json';
import { solve } from '../../src/core/solver';
import type { Level } from '../../src/core/types';

const levels = bank as Level[];

it('ships a non-trivial, solvable, difficulty-sorted bank', () => {
  expect(levels.length).toBeGreaterThan(70);

  for (const i of [0, Math.floor(levels.length / 2), levels.length - 1]) {
    const lvl = levels[i]!;
    expect(solve(lvl.board)!.moves).toBe(lvl.optimalMoves);
  }

  expect(levels.at(-1)!.optimalMoves).toBeGreaterThan(levels[0]!.optimalMoves);
  for (let i = 1; i < levels.length; i++) {
    expect(levels[i]!.optimalMoves).toBeGreaterThanOrEqual(levels[i - 1]!.optimalMoves);
  }

  const counts: Record<number, number> = {};
  for (const l of levels) counts[l.optimalMoves] = (counts[l.optimalMoves] || 0) + 1;
  const max = Math.max(...(Object.values(counts) as number[]));
  expect(max).toBeLessThanOrEqual(Math.ceil(levels.length * 0.25));

  expect(levels.at(-1)!.optimalMoves).toBeGreaterThanOrEqual(10);
});
