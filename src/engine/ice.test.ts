import { describe, expect, it } from "vitest";
import { createBoard, createIdGenerator, hasValidMove } from "./board.ts";
import { placeIce } from "./ice.ts";
import { mulberry32 } from "./rng.ts";
import { boardFromStrings, boardToStrings, STABLE } from "./testHelpers.ts";

// createBoard (unlike the STABLE fixture, which deliberately has zero valid
// moves) always has at least one valid move, so it's a realistic base to
// place ice onto.
function movableBoard(seed: number) {
  return createBoard(mulberry32(seed), createIdGenerator());
}

describe("placeIce", () => {
  it("places the same cells for the same rng seed (determinism)", () => {
    const a = placeIce(movableBoard(7), mulberry32(7), 6);
    const b = placeIce(movableBoard(7), mulberry32(7), 6);
    expect(boardToStrings(a)).toEqual(boardToStrings(b));
  });

  it("only assigns ice to gems that had no special", () => {
    const rows = STABLE.slice();
    rows[0] = `R>${rows[0].slice(1)}`; // laserH at (0,0), 8 cells total
    const board = boardFromStrings(rows);
    const iced = placeIce(board, mulberry32(1), 6);
    const laserCell = iced[0];
    expect(laserCell?.special).toBe("laserH");
    expect(laserCell?.ice).toBe(0);
  });

  it("keeps at least one valid move after placement", () => {
    const iced = placeIce(movableBoard(42), mulberry32(42), 6);
    expect(hasValidMove(iced)).toBe(true);
  });

  it("assigns exactly `count` cells a single ice layer", () => {
    const iced = placeIce(movableBoard(3), mulberry32(3), 6);
    const icedCount = iced.filter((gem) => gem && gem.ice > 0).length;
    expect(icedCount).toBe(6);
    for (const gem of iced) {
      if (gem && gem.ice > 0) {
        expect(gem.ice).toBe(1);
      }
    }
  });
});
