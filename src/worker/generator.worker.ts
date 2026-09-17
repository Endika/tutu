/// <reference lib="webworker" />

import { generateAtDepth } from '../core/generator'
import { makeRng } from '../core/rng'
import type { Level } from '../core/types'
import { isGenerateRequest, type GenerateResponse } from './protocol'

declare const self: DedicatedWorkerGlobalScope

const rng = makeRng(7)

self.onmessage = (e: MessageEvent<unknown>) => {
  if (!isGenerateRequest(e.data)) return
  const { id, pieceCount, lo, hi, maxLayouts } = e.data
  const level: Level | null = generateAtDepth(pieceCount, lo, hi, rng, maxLayouts ?? 60)
  const response: GenerateResponse = { id, level }
  self.postMessage(response)
}
