import {
  BOARD_SIZE,
  type Board,
  type Cell,
  cellFromIndex,
  idx,
} from "./board.ts";

export interface LaserFire {
  cell: Cell;
  orientation: "h" | "v";
}

export interface LaserResolution {
  cleared: Set<number>;
  fires: LaserFire[];
}

function sweepIndices(orientation: "h" | "v", cell: Cell): number[] {
  const indices: number[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    indices.push(orientation === "h" ? idx(cell.row, i) : idx(i, cell.col));
  }
  return indices;
}

// BFS from the cells cleared by a match (or a laser-laser swap): any laser
// among them fires, sweeping its row/column into `cleared`; a laser caught by
// that sweep chains into the queue. Each laser fires at most once, so the
// chain is guaranteed to terminate (spec/01 §4.3).
export function resolveLaserFires(
  board: Board,
  initialCleared: Set<number>,
): LaserResolution {
  const cleared = new Set(initialCleared);
  const fired = new Set<number>();
  const fires: LaserFire[] = [];
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
    const orientation = gem.special === "laserH" ? "h" : "v";
    fires.push({ cell, orientation });

    for (const sweptIndex of sweepIndices(orientation, cell)) {
      cleared.add(sweptIndex);
      const sweptGem = board[sweptIndex];
      if (sweptGem && sweptGem.special !== "none" && !fired.has(sweptIndex)) {
        queue.push(sweptIndex);
      }
    }
  }

  return { cleared, fires };
}
