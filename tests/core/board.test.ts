import { it, expect } from 'vitest';
import type { Board } from '../../src/core/types';
import { isWin, legalMoves, applyMove, encode, decode } from '../../src/core/board';

it('detects a win only when the red car reaches cols 4-5', () => {
  const red: Board = [{ id: 0, r: 2, c: 0, len: 2, o: 'H' }];
  expect(isWin(red)).toBe(false);
  expect(isWin(applyMove(red, { idx: 0, nr: 2, nc: 4 }))).toBe(true);
});

it('horizontal moves stop before an occupying piece and at walls', () => {
  // red at cols 0-1 on row 2 (wall on left); vertical piece blocks col 4 on row 2
  // red tail is at col 1; rightward: col 2 free (nc=1), col 3 free (nc=2), col 4 blocked → exactly 2 moves
  const b: Board = [
    { id: 0, r: 2, c: 0, len: 2, o: 'H' },
    { id: 1, r: 2, c: 4, len: 2, o: 'V' }, // occupies (2,4)(3,4) — blocks col 4 on red's row
  ];
  const redMoves = legalMoves(b).filter((m) => m.idx === 0).map((m) => m.nc).sort((x, y) => x - y);
  expect(redMoves).toEqual([1, 2]); // nc is the new head col; wall stops leftward, blocker stops rightward
});

it('vertical moves respect axis and blocking', () => {
  // V piece head at (2,3), tail at (3,3). No blocker in col 3.
  // Up: head slides to rows 1 and 0 (two free cells above).
  // Down: head slides to rows 3 and 4 (tail moves to 4 and 5, still on board).
  const b: Board = [
    { id: 0, r: 2, c: 0, len: 2, o: 'H' },
    { id: 1, r: 2, c: 3, len: 2, o: 'V' }, // occupies (2,3)(3,3)
  ];
  const v = legalMoves(b).filter((m) => m.idx === 1);
  // all moves keep column 3 (axis)
  expect(v.every((m) => m.nc === 3)).toBe(true);
  // exact legal head rows: 0 and 1 (up), 3 and 4 (down)
  const nrs = v.map((m) => m.nr).sort((a, b) => a - b);
  expect(nrs).toEqual([0, 1, 3, 4]);
});

it('encode is stable and arrangement-unique; decode round-trips', () => {
  const b: Board = [{ id: 0, r: 2, c: 0, len: 2, o: 'H' }, { id: 1, r: 0, c: 3, len: 3, o: 'V' }];
  expect(encode(b)).toBe(encode([...b]));
  const moved = applyMove(b, { idx: 0, nr: 2, nc: 1 });
  expect(encode(moved)).not.toBe(encode(b));
  expect(encode(decode(b, encode(moved)))).toBe(encode(moved));
});
