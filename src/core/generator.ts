import type { Board, Level, Piece } from './types';
import { SIZE, EXIT_ROW } from './types';
import { cellsOf, buildGrid, decode } from './board';
import { analyze } from './solver';
import type { makeRng } from './rng';

type Rng = ReturnType<typeof makeRng>;

export function randomLayout(pieceCount: number, rng: Rng): Board {
  const red: Piece = { id: 0, r: EXIT_ROW, c: rng.int(4), len: 2, o: 'H' };
  const b: Board = [red];
  const occ = buildGrid(b);
  let id = 1;
  let tries = 0;
  while (b.length < pieceCount && tries < 300) {
    tries++;
    const o = rng.next() < 0.5 ? 'H' : 'V';
    const len = rng.next() < 0.6 ? 2 : 3;
    const r = o === 'H' ? rng.int(SIZE) : rng.int(SIZE - len + 1);
    const c = o === 'H' ? rng.int(SIZE - len + 1) : rng.int(SIZE);
    const p: Piece = { id, r, c, len, o };
    let ok = true;
    for (const [cr, cc] of cellsOf(p)) {
      const row = occ[cr];
      if (row === undefined || row[cc] !== -1) { ok = false; break; }
    }
    if (!ok) continue;
    for (const [cr, cc] of cellsOf(p)) {
      const row = occ[cr];
      if (row !== undefined) (row as number[])[cc] = id;
    }
    b.push(p);
    id++;
  }
  return b;
}

export function generateAtDepth(
  pieceCount: number,
  lo: number,
  hi: number,
  rng: Rng,
  maxLayouts = 60,
): Level | null {
  for (let i = 0; i < maxLayouts; i++) {
    const a = analyze(randomLayout(pieceCount, rng));
    if (!a) continue;
    const depths = [...a.byDepth.keys()].filter((d) => d >= lo && d <= hi);
    if (!depths.length) continue;
    const d = depths[rng.int(depths.length)];
    if (d === undefined) continue;
    const pool = a.byDepth.get(d);
    if (!pool || pool.length === 0) continue;
    const entry = pool[rng.int(pool.length)];
    if (entry === undefined) continue;
    const board = decode(a.template, entry);
    return { board, optimalMoves: d };
  }
  return null;
}
