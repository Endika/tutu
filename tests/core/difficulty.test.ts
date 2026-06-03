import { it, expect } from 'vitest';
import { levelToParams } from '../../src/core/difficulty';
it('ramps monotonically and caps', () => {
  const a = levelToParams(1), b = levelToParams(10), c = levelToParams(200);
  expect(a.targetLo).toBeLessThan(b.targetLo);
  expect(b.pieceCount).toBeLessThanOrEqual(c.pieceCount);
  expect(c.pieceCount).toBeLessThanOrEqual(13);
  expect(c.targetLo).toBeLessThanOrEqual(30);
  expect(a.targetHi).toBe(a.targetLo + 3);
});
it('level 1 starts easy', () => {
  const a = levelToParams(1);
  expect(a.targetLo).toBe(2);
  expect(a.pieceCount).toBe(4);
});
