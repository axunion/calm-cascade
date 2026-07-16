import { describe, expect, it } from "vitest";
import { BOARD_SIZE, idx } from "./board.ts";
import { resolveSpecialFires } from "./fires.ts";
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

describe("resolveSpecialFires", () => {
  it("laserH clears its entire row (8 cells)", () => {
    const board = boardFromStrings(withCell(PLAIN, 3, 2, "B"));
    const laserIndex = idx(3, 2);
    board[laserIndex] = { id: 999, kind: 4, special: "laserH", ice: 0 };
    const { cleared } = resolveSpecialFires(board, new Set([laserIndex]));
    for (let col = 0; col < BOARD_SIZE; col++) {
      expect(cleared.has(idx(3, col))).toBe(true);
    }
  });

  it("laserV clears its entire column (8 cells)", () => {
    const board = boardFromStrings(PLAIN);
    const laserIndex = idx(4, 5);
    board[laserIndex] = { id: 999, kind: 0, special: "laserV", ice: 0 };
    const { cleared } = resolveSpecialFires(board, new Set([laserIndex]));
    for (let row = 0; row < BOARD_SIZE; row++) {
      expect(cleared.has(idx(row, 5))).toBe(true);
    }
  });

  it("fires a laser that was cleared by a match", () => {
    const board = boardFromStrings(PLAIN);
    const laserIndex = idx(2, 2);
    board[laserIndex] = { id: 999, kind: 1, special: "laserV", ice: 0 };
    const { fires } = resolveSpecialFires(board, new Set([laserIndex]));
    expect(fires).toEqual([{ cell: { row: 2, col: 2 }, special: "laserV" }]);
  });

  it("chain-fires a laser hit by another laser's beam", () => {
    const board = boardFromStrings(PLAIN);
    const first = idx(3, 2); // laserH — sweeps row 3, including col 6
    const second = idx(3, 6); // laserV — sits in row 3's sweep path
    board[first] = { id: 1, kind: 0, special: "laserH", ice: 0 };
    board[second] = { id: 2, kind: 1, special: "laserV", ice: 0 };

    const { cleared, fires } = resolveSpecialFires(board, new Set([first]));

    expect(fires).toHaveLength(2);
    expect(fires.map((f) => f.special).sort()).toEqual(["laserH", "laserV"]);
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
    board[a] = { id: 1, kind: 0, special: "laserH", ice: 0 };
    board[b] = { id: 2, kind: 1, special: "laserV", ice: 0 };
    board[c] = { id: 3, kind: 2, special: "laserH", ice: 0 };

    const { fires } = resolveSpecialFires(board, new Set([a]));

    expect(fires).toHaveLength(3);
  });

  it("adds each fired laser's cell to the cleared set exactly once", () => {
    const board = boardFromStrings(PLAIN);
    const a = idx(0, 3);
    const b = idx(0, 6);
    board[a] = { id: 1, kind: 0, special: "laserH", ice: 0 };
    board[b] = { id: 2, kind: 1, special: "laserV", ice: 0 };

    const { cleared } = resolveSpecialFires(board, new Set([a]));
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
    board[a] = { id: 1, kind: 0, special: "laserH", ice: 0 };
    board[b] = { id: 2, kind: 1, special: "laserV", ice: 0 };

    const { cleared, fires } = resolveSpecialFires(board, new Set([a, b]));

    expect(fires).toHaveLength(2);
    for (let col = 0; col < BOARD_SIZE; col++) {
      expect(cleared.has(idx(4, col))).toBe(true);
    }
    for (let row = 0; row < BOARD_SIZE; row++) {
      expect(cleared.has(idx(row, 5))).toBe(true);
    }
  });

  it("bomb clears its centered 3x3", () => {
    const board = boardFromStrings(PLAIN);
    const bombIndex = idx(4, 4);
    board[bombIndex] = { id: 999, kind: 2, special: "bomb", ice: 0 };
    const { cleared } = resolveSpecialFires(board, new Set([bombIndex]));
    for (let row = 3; row <= 5; row++) {
      for (let col = 3; col <= 5; col++) {
        expect(cleared.has(idx(row, col))).toBe(true);
      }
    }
    expect(cleared.has(idx(2, 4))).toBe(false);
    expect(cleared.has(idx(4, 2))).toBe(false);
  });

  it("clips the bomb's 3x3 to a 2x2 at a board corner", () => {
    const board = boardFromStrings(PLAIN);
    const bombIndex = idx(0, 0);
    board[bombIndex] = { id: 999, kind: 3, special: "bomb", ice: 0 };
    const { cleared } = resolveSpecialFires(board, new Set([bombIndex]));
    expect(cleared.has(idx(0, 0))).toBe(true);
    expect(cleared.has(idx(0, 1))).toBe(true);
    expect(cleared.has(idx(1, 0))).toBe(true);
    expect(cleared.has(idx(1, 1))).toBe(true);
    expect(cleared.size).toBe(4);
  });

  it("chain-fires a bomb caught by a laser's sweep", () => {
    const board = boardFromStrings(PLAIN);
    const laserIndex = idx(3, 2); // laserH — sweeps row 3, including col 5
    const bombIndex = idx(3, 5);
    board[laserIndex] = { id: 1, kind: 0, special: "laserH", ice: 0 };
    board[bombIndex] = { id: 2, kind: 1, special: "bomb", ice: 0 };

    const { cleared, fires } = resolveSpecialFires(
      board,
      new Set([laserIndex]),
    );

    expect(fires.map((f) => f.special).sort()).toEqual(["bomb", "laserH"]);
    // The bomb's 3x3 around (3,5), clipped to rows 2-4 and cols 4-6.
    for (let row = 2; row <= 4; row++) {
      for (let col = 4; col <= 6; col++) {
        expect(cleared.has(idx(row, col))).toBe(true);
      }
    }
  });

  it("fires both pieces from their swapped positions for a bomb-laser swap", () => {
    const board = boardFromStrings(PLAIN);
    const a = idx(4, 4);
    const b = idx(4, 5);
    board[a] = { id: 1, kind: 0, special: "bomb", ice: 0 };
    board[b] = { id: 2, kind: 1, special: "laserV", ice: 0 };

    const { cleared, fires } = resolveSpecialFires(board, new Set([a, b]));

    expect(fires.map((f) => f.special).sort()).toEqual(["bomb", "laserV"]);
    for (let row = 0; row < BOARD_SIZE; row++) {
      expect(cleared.has(idx(row, 5))).toBe(true);
    }
    for (let row = 3; row <= 5; row++) {
      for (let col = 3; col <= 5; col++) {
        expect(cleared.has(idx(row, col))).toBe(true);
      }
    }
  });
});
