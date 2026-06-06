// Build the 100-level bank for the Flipper Zero port (flipper-tutu).
//
// Reuses the tested solver/generator: a random layout is fully analyzed (BFS of its whole
// component), which labels every reachable arrangement by its optimal distance to the exit.
// One analyze() therefore harvests levels at MANY depths at once. We pool unique levels by
// depth, then select exactly 100 on a non-decreasing, back-weighted curve, clamped to what
// is actually reachable. Output: flipper-tutu/tools/levels.json (vendored & committed there).
//
// Run: cd /home/endika/workspace/tutu && npx tsx tools/build-levels-flipper.ts

import { makeRng } from '../src/core/rng';
import { randomLayout } from '../src/core/generator';
import { analyze } from '../src/core/solver';
import { decode } from '../src/core/board';
import type { Board, Level } from '../src/core/types';
import { writeFileSync } from 'fs';
import { join } from 'path';

const TOTAL = 100;
const MIN_DEPTH = 2;
const MAX_DEPTH = 18; // keep the hardest humane for a kids game
const HARVEST_MS = 90_000;
const PER_DEPTH_CAP = 30;
const PER_LAYOUT_PER_DEPTH = 2;

const rng = makeRng(20260606);

// canonical signature of a decoded board (piece order is fixed, but be explicit)
function sig(board: Board): string {
  return board
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((p) => `${p.r},${p.c},${p.len},${p.o}`)
    .join('|');
}

// depth -> (signature -> board)
const pool = new Map<number, Map<string, Board>>();
const pieceCounts = [5, 6, 7, 8, 9, 10, 11, 12];
const start = Date.now();
let layouts = 0;

while (Date.now() - start < HARVEST_MS) {
  const pc = pieceCounts[layouts % pieceCounts.length]!;
  layouts++;
  const a = analyze(randomLayout(pc, rng));
  if (!a) continue;
  for (const [d, states] of a.byDepth) {
    if (d < MIN_DEPTH || d > MAX_DEPTH) continue;
    let bucket = pool.get(d);
    if (!bucket) {
      bucket = new Map();
      pool.set(d, bucket);
    }
    let taken = 0;
    for (let i = 0; i < states.length && taken < PER_LAYOUT_PER_DEPTH; i++) {
      if (bucket.size >= PER_DEPTH_CAP) break;
      const e = states[rng.int(states.length)]!;
      const board = decode(a.template, e);
      const s = sig(board);
      if (bucket.has(s)) continue;
      bucket.set(s, board);
      taken++;
    }
  }
}

const avail = new Map<number, number>();
for (const [d, b] of pool) if (b.size > 0) avail.set(d, b.size);
const totalAvail = [...avail.values()].reduce((s, n) => s + n, 0);

process.stdout.write(`layouts analyzed: ${layouts}, total unique pooled: ${totalAvail}\n`);
const histo = [...avail.keys()].sort((a, b) => a - b).map((d) => `${d}:${avail.get(d)}`);
process.stdout.write(`pool by depth -> ${histo.join('  ')}\n`);

if (totalAvail < TOTAL) {
  throw new Error(`only ${totalAvail} unique levels pooled (<${TOTAL}); raise HARVEST_MS/PER_DEPTH_CAP`);
}

// Water-fill selection: counts proportional to weight w(d)=d (harder => more), capped by
// availability, looped until exactly TOTAL assigned.
function selectCounts(): Map<number, number> {
  const depths = [...avail.keys()].sort((a, b) => a - b);
  const w = (d: number) => d;
  const counts = new Map<number, number>();
  depths.forEach((d) => counts.set(d, 0));
  let remaining = TOTAL;
  while (remaining > 0) {
    const open = depths.filter((d) => counts.get(d)! < avail.get(d)!);
    if (!open.length) break;
    const sumW = open.reduce((s, d) => s + w(d), 0);
    let assigned = 0;
    for (const d of open) {
      if (remaining - assigned <= 0) break;
      const want = Math.max(1, Math.round((remaining * w(d)) / sumW));
      const room = avail.get(d)! - counts.get(d)!;
      const add = Math.min(want, room, remaining - assigned);
      counts.set(d, counts.get(d)! + add);
      assigned += add;
    }
    remaining -= assigned;
    if (assigned === 0) break;
  }
  return counts;
}

const counts = selectCounts();
const bank: Level[] = [];
for (const d of [...counts.keys()].sort((a, b) => a - b)) {
  const n = counts.get(d)!;
  const boards = [...pool.get(d)!.values()].slice(0, n);
  for (const board of boards) bank.push({ board, optimalMoves: d });
}

bank.sort((a, b) => a.optimalMoves - b.optimalMoves);

if (bank.length !== TOTAL) throw new Error(`expected ${TOTAL} levels, got ${bank.length}`);
for (let i = 1; i < bank.length; i++) {
  if (bank[i]!.optimalMoves < bank[i - 1]!.optimalMoves) throw new Error('curve not non-decreasing');
}

const finalHisto: Record<number, number> = {};
for (const l of bank) finalHisto[l.optimalMoves] = (finalHisto[l.optimalMoves] || 0) + 1;
process.stdout.write(`selected curve -> ${JSON.stringify(finalHisto)}\n`);

const out = join(import.meta.dirname, '..', '..', 'flipper-tutu', 'tools', 'levels.json');
writeFileSync(out, JSON.stringify(bank));
process.stdout.write(`Wrote ${bank.length} levels to ${out}\n`);
