import {
  BOARD_SIZE,
  type Board,
  type Cell,
  cellFromIndex,
  idx,
  type Special,
} from "./board.ts";

export type SpecialKind = Exclude<Special, "none">;

export interface SpecialFire {
  cell: Cell;
  special: SpecialKind;
}

export interface FireResolution {
  cleared: Set<number>;
  fires: SpecialFire[];
}

function laserSweepIndices(orientation: "h" | "v", cell: Cell): number[] {
  const indices: number[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    indices.push(orientation === "h" ? idx(cell.row, i) : idx(i, cell.col));
  }
  return indices;
}

// 3x3 centered on `cell`, clipped at the board edges (spec/01 §4: bomb).
function bombSweepIndices(cell: Cell): number[] {
  const indices: number[] = [];
  for (let row = cell.row - 1; row <= cell.row + 1; row++) {
    if (row < 0 || row >= BOARD_SIZE) {
      continue;
    }
    for (let col = cell.col - 1; col <= cell.col + 1; col++) {
      if (col < 0 || col >= BOARD_SIZE) {
        continue;
      }
      indices.push(idx(row, col));
    }
  }
  return indices;
}

// Every gem of `kind` on the board, firing cell included (spec/01 §4: prism).
function prismSweepIndices(board: Board, kind: number): number[] {
  const indices: number[] = [];
  for (let i = 0; i < board.length; i++) {
    const gem = board[i];
    if (gem && gem.kind === kind) {
      indices.push(i);
    }
  }
  return indices;
}

function sweepIndicesFor(
  board: Board,
  special: SpecialKind,
  cell: Cell,
  kind: number,
): number[] {
  if (special === "laserH") {
    return laserSweepIndices("h", cell);
  }
  if (special === "laserV") {
    return laserSweepIndices("v", cell);
  }
  if (special === "prism") {
    return prismSweepIndices(board, kind);
  }
  return bombSweepIndices(cell);
}

// BFS from the cells cleared by a match (or a special-special swap): any
// special piece among them fires, sweeping its effect area (laser =
// row/column, bomb = 3x3, prism = every same-kind gem on the board) into
// `cleared`; a special piece caught by that sweep chains into the queue.
// Each piece fires at most once, so the chain is guaranteed to terminate
// (spec/01 §4.3).
export function resolveSpecialFires(
  board: Board,
  initialCleared: Set<number>,
): FireResolution {
  const cleared = new Set(initialCleared);
  const fired = new Set<number>();
  const fires: SpecialFire[] = [];
  const queue: number[] = [...initialCleared];

  while (queue.length > 0) {
    const cellIndex = queue.shift() as number;
    if (fired.has(cellIndex)) {
      continue;
    }
    const gem = board[cellIndex];
    if (!gem || gem.special === "none") {
      continue;
    }
    fired.add(cellIndex);
    const cell = cellFromIndex(cellIndex);
    const special = gem.special;
    fires.push({ cell, special });

    for (const sweptIndex of sweepIndicesFor(board, special, cell, gem.kind)) {
      cleared.add(sweptIndex);
      const sweptGem = board[sweptIndex];
      if (sweptGem && sweptGem.special !== "none" && !fired.has(sweptIndex)) {
        queue.push(sweptIndex);
      }
    }
  }

  return { cleared, fires };
}
