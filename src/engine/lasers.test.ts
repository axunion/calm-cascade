import { describe, expect, it } from "vitest";
import { BOARD_SIZE, idx } from "./board.ts";
import { resolveLaserFires } from "./lasers.ts";
import { boardFromStrings } from "./testHelpers.ts";

const PLAIN = [
  "ROYGBPRO",
  "OYGBPROY",
  "YGBPROYG",
  "GBPROYGB",
  "BPROYGBP",
  "PROYGBPR",
  "ROYGBPRO",
  "OYGBPROY",
];

function withCell(
  rows: string[],
  row: number,
  col: number,
  token: string,
): string[] {
  const chars = rows[row].split("");
  chars[col] = token;
  return rows.map((r, i) => (i === row ? chars.join("") : r));
}

describe("resolveLaserFires", () => {
  it("laserH clears its entire row (8 cells)", () => {
    const board = boardFromStrings(withCell(PLAIN, 3, 2, "B"));
    const laserIndex = idx(3, 2);
    board[laserIndex] = { id: 999, kind: 4, special: "laserH" };
    const { cleared } = resolveLaserFires(board, new Set([laserIndex]));
    for (let col = 0; col < BOARD_SIZE; col++) {
      expect(cleared.has(idx(3, col))).toBe(true);
    }
  });

  it("laserV clears its entire column (8 cells)", () => {
    const board = boardFromStrings(PLAIN);
    const laserIndex = idx(4, 5);
    board[laserIndex] = { id: 999, kind: 0, special: "laserV" };
    const { cleared } = resolveLaserFires(board, new Set([laserIndex]));
    for (let row = 0; row < BOARD_SIZE; row++) {
      expect(cleared.has(idx(row, 5))).toBe(true);
    }
  });

  it("fires a laser that was cleared by a match", () => {
    const board = boardFromStrings(PLAIN);
    const laserIndex = idx(2, 2);
    board[laserIndex] = { id: 999, kind: 1, special: "laserV" };
    const { fires } = resolveLaserFires(board, new Set([laserIndex]));
    expect(fires).toEqual([{ cell: { row: 2, col: 2 }, orientation: "v" }]);
  });

  it("chain-fires a laser hit by another laser's beam", () => {
    const board = boardFromStrings(PLAIN);
    const first = idx(3, 2); // laserH — sweeps row 3, including col 6
    const second = idx(3, 6); // laserV — sits in row 3's sweep path
    board[first] = { id: 1, kind: 0, special: "laserH" };
    board[second] = { id: 2, kind: 1, special: "laserV" };

    const { cleared, fires } = resolveLaserFires(board, new Set([first]));

    expect(fires).toHaveLength(2);
    expect(fires.map((f) => f.orientation).sort()).toEqual(["h", "v"]);
    for (let col = 0; col < BOARD_SIZE; col++) {
      expect(cleared.has(idx(3, col))).toBe(true);
    }
    for (let row = 0; row < BOARD_SIZE; row++) {
      expect(cleared.has(idx(row, 6))).toBe(true);
    }
  });

  it("stops a chain of 3+ lasers without looping forever", () => {
    const board = boardFromStrings(PLAIN);
    // laserH at (0,3) sweeps row 0, hitting laserV at (0,6).
    // laserV at (0,6) sweeps col 6, hitting laserH at (5,6).
    const a = idx(0, 3);
    const b = idx(0, 6);
    const c = idx(5, 6);
    board[a] = { id: 1, kind: 0, special: "laserH" };
    board[b] = { id: 2, kind: 1, special: "laserV" };
    board[c] = { id: 3, kind: 2, special: "laserH" };

    const { fires } = resolveLaserFires(board, new Set([a]));

    expect(fires).toHaveLength(3);
  });

  it("adds each fired laser's cell to the cleared set exactly once", () => {
    const board = boardFromStrings(PLAIN);
    const a = idx(0, 3);
    const b = idx(0, 6);
    board[a] = { id: 1, kind: 0, special: "laserH" };
    board[b] = { id: 2, kind: 1, special: "laserV" };

    const { cleared } = resolveLaserFires(board, new Set([a]));
    const clearedArray = [...cleared];
    const occurrencesOfA = clearedArray.filter((i) => i === a).length;
    const occurrencesOfB = clearedArray.filter((i) => i === b).length;
    expect(occurrencesOfA).toBe(1);
    expect(occurrencesOfB).toBe(1);
  });

  it("cross-clears row and column for a laser-laser swap", () => {
    const board = boardFromStrings(PLAIN);
    const a = idx(4, 4);
    const b = idx(4, 5);
    board[a] = { id: 1, kind: 0, special: "laserH" };
    board[b] = { id: 2, kind: 1, special: "laserV" };

    const { cleared, fires } = resolveLaserFires(board, new Set([a, b]));

    expect(fires).toHaveLength(2);
    for (let col = 0; col < BOARD_SIZE; col++) {
      expect(cleared.has(idx(4, col))).toBe(true);
    }
    for (let row = 0; row < BOARD_SIZE; row++) {
      expect(cleared.has(idx(row, 5))).toBe(true);
    }
  });
});
