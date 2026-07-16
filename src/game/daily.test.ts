import { describe, expect, it } from "vitest";
import { BOARD_SIZE, type Cell, hasValidMove, idx } from "../engine/board.ts";
import { resolveStep } from "../engine/cascade.ts";
import { findMatches } from "../engine/matches.ts";
import { applySwap } from "../engine/swap.ts";
import { boardToStrings } from "../engine/testHelpers.ts";
import {
  createDailyRun,
  DAILY_MILESTONES,
  milestonesReached,
  todayKey,
} from "./daily.ts";

function findValidSwap(run: ReturnType<typeof createDailyRun>): {
  a: Cell;
  b: Cell;
} {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const a: Cell = { row, col };
      const right: Cell = { row, col: col + 1 };
      const down: Cell = { row: row + 1, col };
      for (const b of [right, down]) {
        if (b.row >= BOARD_SIZE || b.col >= BOARD_SIZE) {
          continue;
        }
        const swapped = run.board.slice();
        swapped[idx(a.row, a.col)] = run.board[idx(b.row, b.col)];
        swapped[idx(b.row, b.col)] = run.board[idx(a.row, a.col)];
        if (findMatches(swapped).length > 0) {
          return { a, b };
        }
      }
    }
  }
  throw new Error("no valid swap found - createBoard's invariant is broken");
}

describe("todayKey", () => {
  it("formats a given date as YYYY-MM-DD", () => {
    expect(todayKey(new Date(2026, 6, 15))).toBe("2026-07-15");
  });

  it("zero-pads single-digit months and days", () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("createDailyRun", () => {
  it("produces the exact same board for the same date key (determinism)", () => {
    const a = createDailyRun("2026-07-15");
    const b = createDailyRun("2026-07-15");
    expect(boardToStrings(a.board)).toEqual(boardToStrings(b.board));
  });

  it("produces the exact same refill stream after the same swap (determinism)", () => {
    const a = createDailyRun("2026-07-15");
    const b = createDailyRun("2026-07-15");
    const swap = findValidSwap(a);
    const swappedA = applySwap(a.board, swap.a, swap.b);
    const swappedB = applySwap(b.board, swap.a, swap.b);

    const resultA = resolveStep(swappedA, a.rng, a.nextId, swap);
    const resultB = resolveStep(swappedB, b.rng, b.nextId, swap);

    expect(resultA).not.toBeNull();
    expect(boardToStrings(resultA?.board ?? [])).toEqual(
      boardToStrings(resultB?.board ?? []),
    );
  });

  it("produces a board with no initial match and at least one valid move", () => {
    const { board } = createDailyRun("2026-07-15");
    expect(findMatches(board)).toHaveLength(0);
    expect(hasValidMove(board)).toBe(true);
  });
});

describe("milestonesReached", () => {
  it("has the spec/01 §8 thresholds", () => {
    expect(DAILY_MILESTONES).toEqual([500, 2000, 5000]);
  });

  it("lights exactly one flower at the 500 boundary", () => {
    expect(milestonesReached(500)).toBe(1);
    expect(milestonesReached(499)).toBe(0);
  });

  it("lights two flowers for a score between the 2nd and 3rd threshold", () => {
    expect(milestonesReached(2500)).toBe(2);
  });

  it("lights all three flowers at or above the top threshold", () => {
    expect(milestonesReached(5000)).toBe(3);
    expect(milestonesReached(10000)).toBe(3);
  });
});
