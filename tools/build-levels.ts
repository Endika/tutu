import { makeRng } from '../src/core/rng';
import { generateAtDepth } from '../src/core/generator';
import { encode } from '../src/core/board';
import type { Level } from '../src/core/types';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const WALL_BUDGET_MS = 85_000; // stop loop at 85s to allow final write
const start = Date.now();

const rng = makeRng(20260603);

// Difficulty schedule: gentle ramp, feasibility-bounded.
// Easy phases are fast; hard phases have lower maxLayouts to stay in budget.
interface Slot { pieces: number; lo: number; hi: number; maxLayouts: number; attempts: number }

function buildSchedule(): Slot[] {
  const slots: Slot[] = [];

  // Phase 1: very easy — 4 pieces, depth 2-4 (90 slots)
  for (let i = 0; i < 90; i++) {
    slots.push({ pieces: 4, lo: 2, hi: 4, maxLayouts: 8, attempts: 1 });
  }

  // Phase 2: easy — 5 pieces, depth 3-6 (80 slots)
  for (let i = 0; i < 80; i++) {
    const lo = 3 + Math.floor(i / 40);
    slots.push({ pieces: 5, lo, hi: lo + 3, maxLayouts: 10, attempts: 1 });
  }

  // Phase 3: easy-medium — 6 pieces, depth 5-8 (60 slots)
  for (let i = 0; i < 60; i++) {
    const lo = 5 + Math.floor(i / 30);
    slots.push({ pieces: 6, lo, hi: lo + 3, maxLayouts: 10, attempts: 1 });
  }

  // Phase 4: medium — 7 pieces, depth 7-10 (25 slots)
  for (let i = 0; i < 25; i++) {
    const lo = 7 + Math.floor(i / 12);
    slots.push({ pieces: 7, lo, hi: lo + 3, maxLayouts: 12, attempts: 1 });
  }

  // Phase 5: medium-hard — 8 pieces, depth 9-11 (12 slots)
  for (let i = 0; i < 12; i++) {
    const lo = 9 + Math.floor(i / 6);
    slots.push({ pieces: 8, lo, hi: lo + 2, maxLayouts: 12, attempts: 1 });
  }

  return slots;
}

const schedule = buildSchedule();
const bank: Level[] = [];
const seen = new Set<string>();
let skipped = 0;

for (const slot of schedule) {
  if (Date.now() - start > WALL_BUDGET_MS) break;

  let found = false;
  for (let attempt = 0; attempt < slot.attempts; attempt++) {
    if (Date.now() - start > WALL_BUDGET_MS) break;
    const lvl = generateAtDepth(slot.pieces, slot.lo, slot.hi, rng, slot.maxLayouts);
    if (!lvl) continue;
    const key = encode(lvl.board);
    if (seen.has(key)) continue;
    seen.add(key);
    bank.push(lvl);
    found = true;
    break;
  }
  if (!found) skipped++;
}

bank.sort((a, b) => a.optimalMoves - b.optimalMoves);

const elapsed = Date.now() - start;
const moves = bank.map((l) => l.optimalMoves);
const minMoves = Math.min(...moves);
const maxMoves = Math.max(...moves);

process.stdout.write(`wrote ${bank.length} levels, optimalMoves ${minMoves}..${maxMoves}, skipped ${skipped} (${elapsed}ms)\n`);

const outDir = join(import.meta.dirname, '..', 'src', 'levels');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'levels.json'), JSON.stringify(bank));
