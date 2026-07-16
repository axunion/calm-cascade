import { describe, expect, it } from "vitest";
import type { Cell } from "./board.ts";
import type { MatchGroup } from "./matches.ts";
import { planSpecialSpawns } from "./specials.ts";

function horizontalRun(
  row: number,
  startCol: number,
  length: number,
  kind = 0,
): MatchGroup {
  return {
    orientation: "h",
    kind,
    cells: Array.from({ length }, (_, i) => ({ row, col: startCol + i })),
  };
}

function verticalRun(
  col: number,
  startRow: number,
  length: number,
  kind = 0,
): MatchGroup {
  return {
    orientation: "v",
    kind,
    cells: Array.from({ length }, (_, i) => ({ row: startRow + i, col })),
  };
}

describe("planSpecialSpawns", () => {
  it("spawns at the swap target when it is part of a horizontal 4", () => {
    const group = horizontalRun(2, 1, 4);
    const swapTarget: Cell = { row: 2, col: 3 };
    const spawns = planSpecialSpawns([group], swapTarget);
    expect(spawns).toEqual([
      { cell: { row: 2, col: 3 }, special: "laserH", kind: 0 },
    ]);
  });

  it("spawns at the center cell for a cascade-origin horizontal 4", () => {
    const group = horizontalRun(2, 1, 4);
    const spawns = planSpecialSpawns([group], null);
    expect(spawns).toEqual([
      { cell: { row: 2, col: 3 }, special: "laserH", kind: 0 },
    ]);
  });

  it("spawns at the bottom-most cell for a cascade-origin vertical 4", () => {
    const group = verticalRun(3, 1, 4);
    const spawns = planSpecialSpawns([group], null);
    expect(spawns).toEqual([
      { cell: { row: 4, col: 3 }, special: "laserV", kind: 0 },
    ]);
  });

  it("spawns exactly one laser for a 5-length line", () => {
    const group = horizontalRun(0, 0, 5);
    const spawns = planSpecialSpawns([group], null);
    expect(spawns).toHaveLength(1);
    expect(spawns[0].special).toBe("laserH");
  });

  it("spawns only one laser, laserH, when a horizontal-4 and vertical-4 target the same cell", () => {
    // Horizontal run row 5, cols 1-4 → center cell {row:5, col:3}.
    // Vertical run col 3, rows 2-5 → bottom-most cell {row:5, col:3}.
    // Both candidate spawn cells collide at {row:5, col:3}.
    const h = horizontalRun(5, 1, 4, 1);
    const v = verticalRun(3, 2, 4, 2);
    const spawns = planSpecialSpawns([h, v], null);
    expect(spawns).toHaveLength(1);
    expect(spawns[0]).toEqual({
      cell: { row: 5, col: 3 },
      special: "laserH",
      kind: 1,
    });
  });

  it("ignores groups shorter than 4", () => {
    const group = horizontalRun(0, 0, 3);
    expect(planSpecialSpawns([group], null)).toHaveLength(0);
  });

  it("spawns a bomb at the shared cell for an L-shaped same-kind intersection", () => {
    const h = horizontalRun(2, 1, 3, 0); // (2,1) (2,2) (2,3)
    const v = verticalRun(3, 2, 3, 0); // (2,3) (3,3) (4,3)
    const spawns = planSpecialSpawns([h, v], null);
    expect(spawns).toEqual([
      { cell: { row: 2, col: 3 }, special: "bomb", kind: 0 },
    ]);
  });

  it("spawns the bomb at the shared corner regardless of swapTarget", () => {
    const h = horizontalRun(2, 1, 3, 0);
    const v = verticalRun(3, 2, 3, 0);
    const swapTarget: Cell = { row: 2, col: 1 };
    const spawns = planSpecialSpawns([h, v], swapTarget);
    expect(spawns).toEqual([
      { cell: { row: 2, col: 3 }, special: "bomb", kind: 0 },
    ]);
  });

  it("spawns a bomb for a 4+3 same-kind intersection", () => {
    const h = horizontalRun(5, 1, 4, 2); // (5,1)..(5,4)
    const v = verticalRun(4, 3, 3, 2); // (3,4) (4,4) (5,4)
    const spawns = planSpecialSpawns([h, v], null);
    expect(spawns).toEqual([
      { cell: { row: 5, col: 4 }, special: "bomb", kind: 2 },
    ]);
  });

  it("does not also spawn a laser from groups consumed by a bomb", () => {
    const h = horizontalRun(5, 1, 4, 2);
    const v = verticalRun(4, 3, 3, 2);
    expect(planSpecialSpawns([h, v], null)).toHaveLength(1);
  });

  it("does not spawn a bomb for an intersection between different kinds", () => {
    const h = horizontalRun(2, 1, 3, 0);
    const v = verticalRun(3, 2, 3, 1);
    expect(planSpecialSpawns([h, v], null)).toHaveLength(0);
  });

  it("keeps the bomb when its cell collides with an independently-computed laser spawn", () => {
    const hBomb = horizontalRun(2, 1, 3, 0); // (2,1) (2,2) (2,3)
    const vBomb = verticalRun(3, 2, 3, 0); // (2,3) (3,3) (4,3) -> bomb at (2,3)
    const vLaser = verticalRun(3, 0, 4, 1); // (0,3)..(3,3), different kind
    const swapTarget: Cell = { row: 2, col: 3 };
    const spawns = planSpecialSpawns([hBomb, vBomb, vLaser], swapTarget);
    expect(spawns).toEqual([
      { cell: { row: 2, col: 3 }, special: "bomb", kind: 0 },
    ]);
  });
});
