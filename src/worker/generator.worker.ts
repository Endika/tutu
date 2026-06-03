/// <reference lib="webworker" />

import { generateAtDepth } from '../core/generator';
import { makeRng } from '../core/rng';
import type { Level } from '../core/types';

declare const self: DedicatedWorkerGlobalScope;

const rng = makeRng(7);

self.onmessage = (e: MessageEvent<{ pieceCount: number; lo: number; hi: number }>) => {
  const { pieceCount, lo, hi } = e.data;
  const level: Level | null = generateAtDepth(pieceCount, lo, hi, rng);
  self.postMessage(level);
};
