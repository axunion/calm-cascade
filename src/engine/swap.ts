import { type Board, type Cell, idx, isSpecialPair } from "./board.ts";
import { findMatches } from "./matches.ts";

export function isAdjacent(a: Cell, b: Cell): boolean {
  const rowDelta = Math.abs(a.row - b.row);
  const colDelta = Math.abs(a.col - b.col);
  return rowDelta + colDelta === 1;
}

export function applySwap(board: Board, a: Cell, b: Cell): Board {
  const next = board.slice();
  const indexA = idx(a.row, a.col);
  const indexB = idx(b.row, b.col);
  next[indexA] = board[indexB];
  next[indexB] = board[indexA];
  return next;
}

export function isValidSwap(board: Board, a: Cell, b: Cell): boolean {
  if (!isAdjacent(a, b)) {
    return false;
  }
  const gemA = board[idx(a.row, a.col)];
  const gemB = board[idx(b.row, b.col)];
  if (!gemA || !gemB) {
    return false;
  }
  if (isSpecialPair(gemA, gemB)) {
    return true;
  }
  return findMatches(applySwap(board, a, b)).length > 0;
}
