import { describe, expect, it } from "vitest";
import type { Board } from "./board.ts";
import {
  BOARD_SIZE,
  createBoard,
  createIdGenerator,
  hasValidMove,
  reshuffle,
} from "./board.ts";
import { findMatches } from "./matches.ts";
import { mulberry32 } from "./rng.ts";
import { boardFromStrings } from "./testHelpers.ts";

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

describe("createBoard", () => {
  it.each(
    SEEDS,
  )("has no initial match and at least one valid move (seed %i)", (seed) => {
    const board = createBoard(mulberry32(seed), createIdGenerator());
    expect(findMatches(board)).toHaveLength(0);
    expect(hasValidMove(board)).toBe(true);
  });

  it("fills every cell", () => {
    const board = createBoard(mulberry32(1), createIdGenerator());
    expect(board).toHaveLength(BOARD_SIZE * BOARD_SIZE);
    expect(board.every((gem) => gem !== null)).toBe(true);
  });
});

describe("hasValidMove", () => {
  it("returns true when an adjacent swap would complete a vertical match", () => {
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
    expect(hasValidMove(board)).toBe(true);
  });

  it("returns false for a board with zero valid moves", () => {
    // Real 8x8 deadlock fixture found by randomized search (no match, and no
    // single adjacent swap creates one) — hand-constructing one reliably is
    // impractical, so this is a verified concrete example.
    const board = boardFromStrings([
      "YBGGBYBO",
      "OYOGROYR",
      "RPBYYPOG",
      "BROOGRBY",
      "PGROPPGO",
      "RBPYGOBB",
      "YGYBRROY",
      "PORORBYG",
    ]);
    expect(findMatches(board)).toHaveLength(0);
    expect(hasValidMove(board)).toBe(false);
  });

  it("treats an adjacent laser-laser pair as a valid move even without a color match", () => {
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
    expect(hasValidMove(board)).toBe(true);
  });

  it("does not count an ice-involved swap as a valid move, even the board's only one", () => {
    // Same board as "returns true when an adjacent swap would complete a
    // vertical match", but (1,0) now carries 1 ice layer - spec/01 §7: an
    // ice-covered gem can't move, so this board's only valid move no longer
    // counts.
    const board = boardFromStrings([
      "ROYGBPRO",
      "O1RGBPROY",
      "RYBPROYG",
      "GBPROYGB",
      "BPROYGBP",
      "PROYGBPR",
      "ROYGBPRO",
      "OYGBPROY",
    ]);
    expect(hasValidMove(board)).toBe(false);
  });
});

describe("reshuffle", () => {
  it.each(
    SEEDS,
  )("preserves gem composition and reaches a stable, playable board (seed %i)", (seed) => {
    const rng = mulberry32(seed);
    const nextId = createIdGenerator();
    const original = createBoard(rng, nextId);
    const before = composition(original);

    const result = reshuffle(original, rng, nextId);

    expect(composition(result)).toEqual(before);
    expect(findMatches(result)).toHaveLength(0);
    expect(hasValidMove(result)).toBe(true);
  });
});

function composition(board: Board) {
  const counts = new Map<string, number>();
  for (const gem of board) {
    if (!gem) continue;
    const key = `${gem.kind}:${gem.special}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort();
}
