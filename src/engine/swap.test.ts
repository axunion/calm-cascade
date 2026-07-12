import { describe, expect, it } from "vitest";
import { applySwap, isValidSwap } from "./swap.ts";
import { boardFromStrings, STABLE } from "./testHelpers.ts";

describe("isValidSwap", () => {
  it("is invalid for non-adjacent cells (diagonal)", () => {
    const board = boardFromStrings(STABLE);
    expect(isValidSwap(board, { row: 0, col: 0 }, { row: 1, col: 1 })).toBe(
      false,
    );
  });

  it("is invalid for non-adjacent cells (far apart)", () => {
    const board = boardFromStrings(STABLE);
    expect(isValidSwap(board, { row: 0, col: 0 }, { row: 5, col: 5 })).toBe(
      false,
    );
  });

  it("is invalid when adjacent but no match results", () => {
    const board = boardFromStrings(STABLE);
    expect(isValidSwap(board, { row: 0, col: 0 }, { row: 0, col: 1 })).toBe(
      false,
    );
  });

  it("is valid when adjacent and a match results", () => {
    // Swapping (1,0)='O' and (1,1)='R' puts 'R' at (1,0), completing a
    // vertical run of 'R' at column 0, rows 0-2.
    const board = boardFromStrings([
      "ROYGBPRO",
      "ORGBPROY",
      "RYBPROYG",
      "GBPROYGB",
      "BPROYGBP",
      "PROYGBPR",
      "ROYGBPRO",
      "OYGBPROY",
    ]);
    expect(isValidSwap(board, { row: 1, col: 0 }, { row: 1, col: 1 })).toBe(
      true,
    );
  });

  it("is valid for a laser-laser swap with no color match", () => {
    const board = boardFromStrings([
      "R>P^YGBPOB",
      "YGBPRORY",
      "GBPRORYG",
      "BPRORYGB",
      "PRORYGBP",
      "RORYGBPR",
      "ORYGBPRO",
      "RYGBPROY",
    ]);
    expect(isValidSwap(board, { row: 0, col: 0 }, { row: 0, col: 1 })).toBe(
      true,
    );
  });

  it("is invalid when moving a lone laser to a spot that doesn't match", () => {
    const board = boardFromStrings([
      "R>OYGBPOO",
      "YGBPRORY",
      "GBPRORYG",
      "BPRORYGB",
      "PRORYGBP",
      "RORYGBPR",
      "ORYGBPRO",
      "RYGBPROY",
    ]);
    expect(isValidSwap(board, { row: 0, col: 0 }, { row: 0, col: 1 })).toBe(
      false,
    );
  });
});

describe("applySwap", () => {
  it("returns a new array and does not mutate the original board", () => {
    const board = boardFromStrings(STABLE);
    const before = board.slice();
    const result = applySwap(board, { row: 0, col: 0 }, { row: 0, col: 1 });

    expect(result).not.toBe(board);
    expect(board).toEqual(before);
    expect(result[0]).toEqual(before[1]);
    expect(result[1]).toEqual(before[0]);
  });
});
