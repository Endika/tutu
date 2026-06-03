export type Orientation = 'H' | 'V';
export interface Piece { id: number; r: number; c: number; len: number; o: Orientation; }
export type Board = Piece[];               // piece 0 is always the red car (H, len 2)
export interface Move { idx: number; nr: number; nc: number; }
export interface Level { board: Board; optimalMoves: number; }
export const SIZE = 6;
export const EXIT_ROW = 2;                 // 0-indexed; red wins at cols 4-5
