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
});
