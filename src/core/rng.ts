export function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  const next = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  return { next, int: (n: number) => Math.floor(next() * n) };
}
