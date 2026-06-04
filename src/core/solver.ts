import type { Board, Move } from './types';
import { legalMoves, applyMove, isWin, encode, decode } from './board';

// Optimal number of moves to solve, plus one optimal first move (for hints). null if unsolvable.
export function solve(start: Board): { moves: number; hint: Move | null } | null {
  if (isWin(start)) return { moves: 0, hint: null };
  const seen = new Set([encode(start)]);
  let frontier: { b: Board; first: Move }[] = [];
  for (const m of legalMoves(start)) {
    const nb = applyMove(start, m);
    const k = encode(nb);
    if (seen.has(k)) continue;
    seen.add(k);
    if (isWin(nb)) return { moves: 1, hint: m };
    frontier.push({ b: nb, first: m });
  }
  let depth = 1;
  while (frontier.length) {
    depth++;
    const next: { b: Board; first: Move }[] = [];
    for (const node of frontier) {
      for (const m of legalMoves(node.b)) {
        const nb = applyMove(node.b, m);
        const k = encode(nb);
        if (seen.has(k)) continue;
        seen.add(k);
        if (isWin(nb)) return { moves: depth, hint: node.first };
        next.push({ b: nb, first: node.first });
      }
    }
    frontier = next;
    if (depth > 80) break;
  }
  return null;
}

// Explore the whole (undirected) component; label every state by optimal distance to a win.
export function analyze(start: Board): { template: Board; byDepth: Map<number, string[]>; states: number } | null {
  const template = start.map((p) => ({ ...p }));
  const comp = new Set([encode(start)]);
  const wins: string[] = [];
  // Red car (piece 0) is horizontal on the exit row, so a win is fully defined
  // by its head column (4) — mirror isWin() in board.ts, which ignores the row.
  const isWinEnc = (e: string) => e.charCodeAt(0) % 6 === 4;
  if (isWinEnc(encode(start))) wins.push(encode(start));
  let frontier = [encode(start)];
  while (frontier.length) {
    const nextF: string[] = [];
    for (const e of frontier) {
      for (const m of legalMoves(decode(template, e))) {
        const ne = encode(applyMove(decode(template, e), m));
        if (comp.has(ne)) continue;
        comp.add(ne);
        if (isWinEnc(ne)) wins.push(ne);
        nextF.push(ne);
      }
    }
    frontier = nextF;
  }
  if (!wins.length) return null;
  const dist = new Map<string, number>();
  const byDepth = new Map<number, string[]>();
  for (const w of wins) dist.set(w, 0);
  byDepth.set(0, wins.slice());
  let d = 0;
  let f = wins.slice();
  while (f.length) {
    d++;
    const nf: string[] = [];
    for (const e of f) {
      for (const m of legalMoves(decode(template, e))) {
        const ne = encode(applyMove(decode(template, e), m));
        if (dist.has(ne)) continue;
        dist.set(ne, d);
        const list = byDepth.get(d) ?? (byDepth.set(d, []), byDepth.get(d)!);
        list.push(ne);
        nf.push(ne);
      }
    }
    f = nf;
  }
  return { template, byDepth, states: comp.size };
}
