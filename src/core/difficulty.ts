export interface Params {
  targetLo: number
  targetHi: number
  pieceCount: number
}
export function levelToParams(n: number): Params {
  // n is 1-based
  const targetLo = Math.min(2 + Math.floor((n - 1) * 0.7), 30)
  const targetHi = targetLo + 3
  const pieceCount = Math.min(4 + Math.floor((n - 1) / 3), 13)
  return { targetLo, targetHi, pieceCount }
}
