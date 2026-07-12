import {
  BOARD_SIZE,
  type Board,
  type Cell,
  cellFromIndex,
  cellsEqual,
  GEM_KINDS,
  type Gem,
  idx,
  isSpecialPair,
  type NextId,
} from "./board.ts";
import { type LaserFire, resolveLaserFires } from "./lasers.ts";
import { findMatches, type MatchGroup } from "./matches.ts";
import type { Rng } from "./rng.ts";
import { planSpecialSpawns, type SpecialSpawn } from "./specials.ts";

export interface Fall {
  gem: Gem;
  from: Cell;
  to: Cell;
}

export interface Spawn {
  gem: Gem;
  to: Cell;
  fromAboveRows: number;
}

export interface StepResult {
  board: Board;
  clearedGems: { cell: Cell; gem: Gem }[];
  laserFires: LaserFire[];
  specialSpawns: SpecialSpawn[];
  falls: Fall[];
  spawns: Spawn[];
  matchGroups: MatchGroup[];
}

// A swap involves two cells; unlike a plain Cell | null "which cell moved"
// hint, both are needed to detect a laser-laser swap (spec/01 §4.4), which
// must fire even though it produces no color match. The id-generation
// mechanism itself is left unspecified by spec/02 — NextId is injected here
// the same way Rng is, to keep this module free of hidden mutable state.
export interface SwapInfo {
  a: Cell;
  b: Cell;
}

function isLaserLaserSwap(board: Board, swap: SwapInfo): boolean {
  return isSpecialPair(
    board[idx(swap.a.row, swap.a.col)],
    board[idx(swap.b.row, swap.b.col)],
  );
}

function pickSwapTarget(
  matchGroups: MatchGroup[],
  swap: SwapInfo,
): Cell | null {
  const inGroup = (cell: Cell) =>
    matchGroups.some((group) => group.cells.some((c) => cellsEqual(c, cell)));
  if (inGroup(swap.a)) {
    return swap.a;
  }
  if (inGroup(swap.b)) {
    return swap.b;
  }
  return null;
}

export function applyGravity(board: Board): { board: Board; falls: Fall[] } {
  const next: Board = board.slice();
  const falls: Fall[] = [];

  for (let col = 0; col < BOARD_SIZE; col++) {
    const stack: { gem: Gem; row: number }[] = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      const gem = board[idx(row, col)];
      if (gem) {
        stack.push({ gem, row });
      }
    }

    let writeRow = BOARD_SIZE - 1;
    for (let i = stack.length - 1; i >= 0; i--) {
      const { gem, row } = stack[i];
      next[idx(writeRow, col)] = gem;
      if (writeRow !== row) {
        falls.push({ gem, from: { row, col }, to: { row: writeRow, col } });
      }
      writeRow--;
    }
    for (let row = writeRow; row >= 0; row--) {
      next[idx(row, col)] = null;
    }
  }

  return { board: next, falls };
}

export function spawnGems(
  board: Board,
  rng: Rng,
  nextId: NextId,
): { board: Board; spawns: Spawn[] } {
  const next = board.slice();
  const spawns: Spawn[] = [];

  for (let col = 0; col < BOARD_SIZE; col++) {
    let emptyCount = 0;
    while (emptyCount < BOARD_SIZE && next[idx(emptyCount, col)] === null) {
      emptyCount++;
    }
    for (let row = 0; row < emptyCount; row++) {
      const gem: Gem = {
        id: nextId(),
        kind: Math.floor(rng() * GEM_KINDS),
        special: "none",
      };
      next[idx(row, col)] = gem;
      spawns.push({ gem, to: { row, col }, fromAboveRows: emptyCount - row });
    }
  }

  return { board: next, spawns };
}

export function resolveStep(
  board: Board,
  rng: Rng,
  nextId: NextId,
  swap: SwapInfo | null,
): StepResult | null {
  const matchGroups = findMatches(board);
  const forcedLaserSwap = swap !== null && isLaserLaserSwap(board, swap);

  if (matchGroups.length === 0 && !forcedLaserSwap) {
    return null;
  }

  const swapTarget = swap ? pickSwapTarget(matchGroups, swap) : null;
  const specialSpawns = planSpecialSpawns(matchGroups, swapTarget);
  const spawnIndices = new Set(
    specialSpawns.map((spawn) => idx(spawn.cell.row, spawn.cell.col)),
  );

  // Seed cells for this step's clear: every matched cell, plus (for a
  // laser-laser swap with no color match) the two swapped cells themselves.
  const seedCells = matchGroups.flatMap((group) => group.cells);
  if (forcedLaserSwap && swap) {
    seedCells.push(swap.a, swap.b);
  }
  const initialCleared = new Set<number>();
  for (const cell of seedCells) {
    const cellIndex = idx(cell.row, cell.col);
    if (!spawnIndices.has(cellIndex)) {
      initialCleared.add(cellIndex);
    }
  }

  const { cleared, fires } = resolveLaserFires(board, initialCleared);

  const clearedGems: { cell: Cell; gem: Gem }[] = [];
  const working: Board = board.slice();
  for (const cellIndex of cleared) {
    if (spawnIndices.has(cellIndex)) {
      continue;
    }
    const gem = board[cellIndex];
    if (gem) {
      clearedGems.push({ cell: cellFromIndex(cellIndex), gem });
    }
    working[cellIndex] = null;
  }

  for (const spawn of specialSpawns) {
    const cellIndex = idx(spawn.cell.row, spawn.cell.col);
    const existingGem = board[cellIndex];
    working[cellIndex] = existingGem
      ? { ...existingGem, special: spawn.special }
      : { id: nextId(), kind: spawn.kind, special: spawn.special };
  }

  const { board: afterGravity, falls } = applyGravity(working);
  const { board: finalBoard, spawns } = spawnGems(afterGravity, rng, nextId);

  return {
    board: finalBoard,
    clearedGems,
    laserFires: fires,
    specialSpawns,
    falls,
    spawns,
    matchGroups,
  };
}
