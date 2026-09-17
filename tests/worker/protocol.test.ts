import { it, expect } from 'vitest'
import { isGenerateRequest } from '../../src/worker/protocol'

it('accepts a well-formed request, with and without maxLayouts', () => {
  expect(isGenerateRequest({ id: 1, pieceCount: 9, lo: 8, hi: 14 })).toBe(true)
  expect(isGenerateRequest({ id: 1, pieceCount: 9, lo: 8, hi: 14, maxLayouts: 80 })).toBe(true)
})

it('rejects a request missing a field', () => {
  expect(isGenerateRequest({ pieceCount: 9, lo: 8, hi: 14 })).toBe(false)
})

it('rejects a request with a field of the wrong type', () => {
  expect(isGenerateRequest({ id: 1, pieceCount: '9', lo: 8, hi: 14 })).toBe(false)
  expect(isGenerateRequest({ id: 1, pieceCount: 9, lo: 8, hi: 14, maxLayouts: '80' })).toBe(false)
})

it('rejects null and undefined', () => {
  expect(isGenerateRequest(null)).toBe(false)
  expect(isGenerateRequest(undefined)).toBe(false)
})
