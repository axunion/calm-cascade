import { findMatches } from "./matches.ts";
import type { Rng } from "./rng.ts";

export const BOARD_SIZE = 8;
export const GEM_KINDS = 6;

export type Special = "none" | "laserH" | "laserV" | "bomb" | "prism";

export interface Gem {
  id: number;
  kind: number;
  special: Special;
  // 0 = none, 1+ = ice layers. Field added ahead of the ice mechanic itself
  // (phase 14) so every Gem literal across the codebase settles on a shape
  // now rather than needing a second mechanical pass later.
  ice: number;
}

export type Board = (Gem | null)[];

export type NextId = () => number;

export interface Cell {
  row: number;
  col: number;
}

export const idx = (row: number, col: number): number => row * BOARD_SIZE + col;

export const cellFromIndex = (index: number): Cell => ({
  row: Math.floor(index / BOARD_SIZE),
  col: index % BOARD_SIZE,
});

export const cellsEqual = (a: Cell, b: Cell): boolean =>
  a.row === b.row && a.col === b.col;

// A laser-laser pair is always a valid swap and always fires (spec/01 §4.4),
// bypassing the usual color-match requirement — shared by board.ts, swap.ts,
// and cascade.ts so the rule lives in exactly one place.
export const isSpecialPair = (gemA: Gem | null, gemB: Gem | null): boolean =>
  !!gemA && !!gemB && gemA.special !== "none" && gemB.special !== "none";

export function createIdGenerator(start = 0): NextId {
  let current = start;
  return () => current++;
}

function pickKind(rng: Rng, forbidden: Set<number>): number {
  let kind: number;
  do {
    kind = Math.floor(rng() * GEM_KINDS);
  } while (forbidden.has(kind));
  return kind;
}

// Kinds that would complete a run-of-3 if placed at (row, col), given what's
// already been placed to its left and above.
function forbiddenKinds(board: Board, row: number, col: number): Set<number> {
  const forbidden = new Set<number>();
  const left1 = col >= 1 ? board[idx(row, col - 1)] : null;
  const left2 = col >= 2 ? board[idx(row, col - 2)] : null;
  if (left1 && left2 && left1.kind === left2.kind) {
    forbidden.add(left1.kind);
  }
  const up1 = row >= 1 ? board[idx(row - 1, col)] : null;
  const up2 = row >= 2 ? board[idx(row - 2, col)] : null;
  if (up1 && up2 && up1.kind === up2.kind) {
    forbidden.add(up1.kind);
  }
  return forbidden;
}

function buildRandomBoard(rng: Rng, nextId: NextId): Board {
  const board: Board = new Array(BOARD_SIZE * BOARD_SIZE).fill(null);
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      board[idx(row, col)] = {
        id: nextId(),
        kind: pickKind(rng, forbiddenKinds(board, row, col)),
        special: "none",
        ice: 0,
      };
    }
  }
  return board;
}

function wouldSwapMatch(board: Board, a: Cell, b: Cell): boolean {
  const gemA = board[idx(a.row, a.col)];
  const gemB = board[idx(b.row, b.col)];
  if (!gemA || !gemB) {
    return false;
  }
  if (isSpecialPair(gemA, gemB)) {
    return true;
  }
  const swapped = board.slice();
  swapped[idx(a.row, a.col)] = gemB;
  swapped[idx(b.row, b.col)] = gemA;
  return findMatches(swapped).length > 0;
}

export function hasValidMove(board: Board): boolean {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (
        col + 1 < BOARD_SIZE &&
        wouldSwapMatch(board, { row, col }, { row, col: col + 1 })
      ) {
        return true;
      }
      if (
        row + 1 < BOARD_SIZE &&
        wouldSwapMatch(board, { row, col }, { row: row + 1, col })
      ) {
        return true;
      }
    }
  }
  return false;
}

const MAX_GENERATION_ATTEMPTS = 50;

export function createBoard(rng: Rng, nextId: NextId): Board {
  let board = buildRandomBoard(rng, nextId);
  for (
    let attempt = 0;
    attempt < MAX_GENERATION_ATTEMPTS && !hasValidMove(board);
    attempt++
  ) {
    board = buildRandomBoard(rng, nextId);
  }
  return board;
}

function shuffleInPlace<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}

// Places gems one cell at a time (like buildRandomBoard), picking any
// remaining gem whose kind doesn't complete a run-of-3, instead of shuffling
// the whole board and rejecting it — this converges in ~1 attempt instead of
// the ~10 a blind full-board shuffle-and-reject needs.
function tryConstrainedShuffle(gems: Gem[], rng: Rng): Board | null {
  const remaining = shuffleInPlace(gems.slice(), rng);
  const board: Board = new Array(BOARD_SIZE * BOARD_SIZE).fill(null);
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const forbidden = forbiddenKinds(board, row, col);
      const foundIndex = remaining.findIndex((gem) => !forbidden.has(gem.kind));
      if (foundIndex === -1) {
        return null;
      }
      board[idx(row, col)] = remaining[foundIndex];
      remaining.splice(foundIndex, 1);
    }
  }
  return board;
}

export function reshuffle(board: Board, rng: Rng, nextId: NextId): Board {
  const gems = board.filter((gem): gem is Gem => gem !== null);
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const shuffled = tryConstrainedShuffle(gems, rng);
    if (
      shuffled &&
      findMatches(shuffled).length === 0 &&
      hasValidMove(shuffled)
    ) {
      return shuffled;
    }
  }
  return createBoard(rng, nextId);
}
