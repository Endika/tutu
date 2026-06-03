import type { Level } from '../core/types';
import { bankLevel, bankSize } from './bank';
import { levelToParams } from '../core/difficulty';
import { generateAtDepth } from '../core/generator';
import { makeRng } from '../core/rng';

export type GenFn = (pieceCount: number, lo: number, hi: number) => Level | null;

const liveRng = makeRng(7);
const defaultGen: GenFn = (pc, lo, hi) => generateAtDepth(pc, lo, hi, liveRng);

export function nextLevel(index: number, gen: GenFn = defaultGen): Level {
  const fromBank = bankLevel(index);
  if (fromBank) return fromBank;
  const p = levelToParams(index + 1);
  // tail: cap pieces+depth so generation reliably runs in <500ms even off-UI-thread
  return (
    gen(Math.min(p.pieceCount, 6), Math.min(p.targetLo, 4), Math.min(p.targetHi, 7)) ??
    bankLevel(index % bankSize)! // last-resort: recycle a bank level
  );
}

let worker: Worker | null = null;
function getWorker(): Worker {
  worker ??= new Worker(new URL('../worker/generator.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

export function nextLevelAsync(index: number): Promise<Level> {
  const fromBank = bankLevel(index);
  if (fromBank) return Promise.resolve(fromBank);
  const p = levelToParams(index + 1);
  const pieceCount = Math.min(p.pieceCount, 6), lo = Math.min(p.targetLo, 4), hi = Math.min(p.targetHi, 7);
  return new Promise<Level>((resolve) => {
    const w = getWorker();
    const onMsg = (e: MessageEvent<Level | null>) => {
      w.removeEventListener('message', onMsg);
      resolve(e.data ?? nextLevel(index));
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ pieceCount, lo, hi });
  });
}
