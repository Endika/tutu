/// <reference lib="webworker" />

import { generateAtDepth } from '../core/generator';
import { makeRng } from '../core/rng';
import type { Level } from '../core/types';

declare const self: DedicatedWorkerGlobalScope;

const rng = makeRng(7);

self.onmessage = (
  e: MessageEvent<{ id: number; pieceCount: number; lo: number; hi: number; maxLayouts?: number }>,
) => {
  const { id, pieceCount, lo, hi, maxLayouts } = e.data;
  const level: Level | null = generateAtDepth(pieceCount, lo, hi, rng, maxLayouts ?? 60);
  self.postMessage({ id, level });
};
