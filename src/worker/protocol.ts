import type { Level } from '../core/types'

export interface GenerateRequest {
  id: number
  pieceCount: number
  lo: number
  hi: number
  maxLayouts?: number
}

export interface GenerateResponse {
  id: number
  level: Level | null
}

// Dedicated worker: only its own creator can post to it, but the message
// still crosses a structured-clone boundary with no type at runtime.
export function isGenerateRequest(x: unknown): x is GenerateRequest {
  if (typeof x !== 'object' || x === null) return false
  const r = x as Record<string, unknown>
  return (
    typeof r.id === 'number' &&
    typeof r.pieceCount === 'number' &&
    typeof r.lo === 'number' &&
    typeof r.hi === 'number' &&
    (r.maxLayouts === undefined || typeof r.maxLayouts === 'number')
  )
}
