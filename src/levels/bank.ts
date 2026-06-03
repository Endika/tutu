import data from './levels.json';
import type { Level } from '../core/types';

const bank = data as Level[];
export const bankSize = bank.length;
export function bankLevel(index: number): Level | null {
  return bank[index] ?? null;
}
