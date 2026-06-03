import type { Board, Move, Piece } from './types';
import { SIZE } from './types';

export function cellsOf(p: Piece): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < p.len; i++) out.push(p.o === 'H' ? [p.r, p.c + i] : [p.r + i, p.c]);
  return out;
}
export function buildGrid(b: Board): number[][] {
  const g: number[][] = Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(-1));
  for (const p of b) for (const [r, c] of cellsOf(p)) (g[r] as number[])[c as number] = p.id;
  return g;
}
export function isWin(b: Board): boolean { return (b[0] as Piece).c === SIZE - 2; }
export function legalMoves(b: Board): Move[] {
  const g = buildGrid(b); const moves: Move[] = [];
  for (let idx = 0; idx < b.length; idx++) {
    const p = b[idx] as Piece;
    const row = g[p.r] as number[];
    if (p.o === 'H') {
      for (let c = p.c - 1; c >= 0 && (row[c] as number) === -1; c--) moves.push({ idx, nr: p.r, nc: c });
      const tail = p.c + p.len - 1;
      for (let c = tail + 1; c < SIZE && (row[c] as number) === -1; c++) moves.push({ idx, nr: p.r, nc: p.c + (c - tail) });
    } else {
      for (let r = p.r - 1; r >= 0 && ((g[r] as number[])[p.c] as number) === -1; r--) moves.push({ idx, nr: r, nc: p.c });
      const tail = p.r + p.len - 1;
      for (let r = tail + 1; r < SIZE && ((g[r] as number[])[p.c] as number) === -1; r++) moves.push({ idx, nr: p.r + (r - tail), nc: p.c });
    }
  }
  return moves;
}
export function applyMove(b: Board, m: Move): Board {
  const nb = b.map((p) => ({ ...p }));
  (nb[m.idx] as Piece).r = m.nr;
  (nb[m.idx] as Piece).c = m.nc;
  return nb;
}
export function encode(b: Board): string {       // unique per arrangement (fixed piece order)
  let s = ''; for (const p of b) s += String.fromCharCode(p.r * SIZE + p.c); return s;
}
export function decode(template: Board, s: string): Board {
  return template.map((p, i) => ({ ...p, r: Math.floor(s.charCodeAt(i) / SIZE), c: s.charCodeAt(i) % SIZE }));
}
