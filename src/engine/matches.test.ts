import { describe, expect, it } from "vitest";
import type { Board } from "./board.ts";
import { findMatches } from "./matches.ts";
import { boardFromStrings, STABLE } from "./testHelpers.ts";

describe("findMatches", () => {
  it("finds a horizontal run of 3", () => {
    const board = boardFromStrings([
      "RRR.BPYG",
      "OYGBPROY",
      "YGBPROYG",
      "GBPROYGB",
      "BPROYGBP",
      "PROYGBPR",
      "ROYGBPRO",
      "OYGBPROY",
    ]);
    const groups = findMatches(board);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual({
      orientation: "h",
      kind: 0,
      cells: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ],
    });
  });

  it("finds a horizontal run of 4", () => {
    const board = boardFromStrings([
      "RRRR.PYG",
      "OYGBPROY",
      "YGBPROYG",
      "GBPROYGB",
      "BPROYGBP",
      "PROYGBPR",
      "ROYGBPRO",
      "OYGBPROY",
    ]);
    const groups = findMatches(board);
    expect(groups).toHaveLength(1);
    expect(groups[0].cells).toHaveLength(4);
    expect(groups[0].orientation).toBe("h");
  });

  it("finds a horizontal run of 5", () => {
    const board = boardFromStrings([
      "RRRRRPYG",
      "OYGBPROY",
      "YGBPROYG",
      "GBPROYGB",
      "BPROYGBP",
      "PROYGBPR",
      "ROYGBPRO",
      "OYGBPROY",
    ]);
    const groups = findMatches(board);
    expect(groups).toHaveLength(1);
    expect(groups[0].cells).toHaveLength(5);
  });

  it("finds a vertical run of 3", () => {
    const board = boardFromStrings([
      "ROYGBPRO",
      "RYGBPROY",
      "RGBPROYG",
      "GBPROYGB",
      "BPROYGBP",
      "PROYGBPR",
      "ROYGBPRO",
      "OYGBPROY",
    ]);
    const groups = findMatches(board);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual({
      orientation: "v",
      kind: 0,
      cells: [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 },
      ],
    });
  });

  it("finds a vertical run of 4", () => {
    const board = boardFromStrings([
      "ROYGBPRO",
      "RYGBPROY",
      "RGBPROYG",
      "RBPROYGB",
      "BPROYGBP",
      "PROYGBPR",
      "ROYGBPRO",
      "OYGBPROY",
    ]);
    const groups = findMatches(board);
    expect(groups).toHaveLength(1);
    expect(groups[0].cells).toHaveLength(4);
    expect(groups[0].orientation).toBe("v");
  });

  it("finds a vertical run of 5", () => {
    const board = boardFromStrings([
      "ROYGBPRO",
      "RYGBPROY",
      "RGBPROYG",
      "RBPROYGB",
      "RPROYGBP",
      "PROYGBPR",
      "ROYGBPRO",
      "OYGBPROY",
    ]);
    const groups = findMatches(board);
    expect(groups).toHaveLength(1);
    expect(groups[0].cells).toHaveLength(5);
  });

  it("returns an L/T shape as two separate groups sharing a cell", () => {
    const board = boardFromStrings([
      "RRRGBPYO",
      "R.YGBPOY",
      "R.GBPYOG",
      "GBPROYGB",
      "BPROYGBP",
      "PROYGBPR",
      "ROYGBPRO",
      "OYGBPROY",
    ]);
    const groups = findMatches(board);
    expect(groups).toHaveLength(2);
    const orientations = groups.map((g) => g.orientation).sort();
    expect(orientations).toEqual(["h", "v"]);
    const horizontal = groups.find((g) => g.orientation === "h");
    const vertical = groups.find((g) => g.orientation === "v");
    expect(horizontal?.cells).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]);
    expect(vertical?.cells).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
    ]);
  });

  it("finds two matches in unrelated locations", () => {
    const board = boardFromStrings([
      "RRRGBPYO",
      "OYGBPROY",
      "YGBPROYG",
      "GBPPPYGB",
      "BPROYGBP",
      "PROYGBPR",
      "ROYGBPRO",
      "OYGBPROY",
    ]);
    const groups = findMatches(board);
    expect(groups).toHaveLength(2);
  });

  it("detects a match touching all four edges and corners", () => {
    const board = boardFromStrings([
      "RRRGBPYO",
      "OYGBPROY",
      "YGBPROYG",
      "GBPROYGB",
      "BPROYGBP",
      "PROYGBPR",
      "OYGBPROY",
      "YGBPRRR.",
    ]);
    const groups = findMatches(board);
    const topEdge = groups.find(
      (g) => g.orientation === "h" && g.cells.every((c) => c.row === 0),
    );
    const bottomEdge = groups.find(
      (g) => g.orientation === "h" && g.cells.every((c) => c.row === 7),
    );
    expect(topEdge).toBeDefined();
    expect(bottomEdge).toBeDefined();
  });

  it("does not detect a false match across a null gap", () => {
    const board = boardFromStrings([
      "RR.RGBPY",
      "OYGBPROY",
      "YGBPROYG",
      "GBPROYGB",
      "BPROYGBP",
      "PROYGBPR",
      "ROYGBPRO",
      "OYGBPROY",
    ]);
    expect(findMatches(board)).toHaveLength(0);
  });

  it("finds zero matches on a stable board", () => {
    const board = boardFromStrings(STABLE);
    expect(findMatches(board)).toHaveLength(0);
  });

  it("round-trips through boardToStrings", () => {
    const board = boardFromStrings(STABLE);
    expect(findMatches(board satisfies Board)).toHaveLength(0);
  });
});
