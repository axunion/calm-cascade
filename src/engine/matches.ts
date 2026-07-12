import type { Board, Cell } from "./board.ts";

export interface MatchGroup {
  cells: Cell[];
  orientation: "h" | "v";
  kind: number;
}

// Duplicated from board.ts (not imported) to keep this module's only link to
// board.ts a type-only import, avoiding a runtime circular import (board.ts
// imports findMatches for hasValidMove).
const BOARD_SIZE = 8;
const idx = (row: number, col: number) => row * BOARD_SIZE + col;

const NO_KIND = -1;

export function findMatches(board: Board): MatchGroup[] {
  const groups: MatchGroup[] = [];

  for (let row = 0; row < BOARD_SIZE; row++) {
    scanRun(board, groups, "h", row);
  }
  for (let col = 0; col < BOARD_SIZE; col++) {
    scanRun(board, groups, "v", col);
  }

  return groups;
}

function scanRun(
  board: Board,
  groups: MatchGroup[],
  orientation: "h" | "v",
  fixed: number,
): void {
  let runStart = 0;
  let runKind = NO_KIND;

  for (let i = 0; i <= BOARD_SIZE; i++) {
    const gem = i < BOARD_SIZE ? board[cellIndex(orientation, fixed, i)] : null;
    const kind = gem ? gem.kind : NO_KIND;
    if (kind !== runKind) {
      if (runKind !== NO_KIND && i - runStart >= 3) {
        groups.push({
          orientation,
          kind: runKind,
          cells: buildCells(orientation, fixed, runStart, i - 1),
        });
      }
      runStart = i;
      runKind = kind;
    }
  }
}

function cellIndex(orientation: "h" | "v", fixed: number, i: number): number {
  return orientation === "h" ? idx(fixed, i) : idx(i, fixed);
}

function buildCells(
  orientation: "h" | "v",
  fixed: number,
  start: number,
  end: number,
): Cell[] {
  const cells: Cell[] = [];
  for (let i = start; i <= end; i++) {
    cells.push(
      orientation === "h" ? { row: fixed, col: i } : { row: i, col: fixed },
    );
  }
  return cells;
}
