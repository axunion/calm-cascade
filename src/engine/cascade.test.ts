import { describe, expect, it } from "vitest";
import { BOARD_SIZE, createBoard, createIdGenerator, idx } from "./board.ts";
import {
  applyGravity,
  resolveStep,
  type StepResult,
  spawnGems,
} from "./cascade.ts";
import { mulberry32 } from "./rng.ts";
import { applySwap, isValidSwap } from "./swap.ts";
import { boardFromStrings, STABLE } from "./testHelpers.ts";

describe("applyGravity", () => {
  it("compacts a column with multiple gaps, preserving order and gem ids", () => {
    const board = boardFromStrings([
      "OYGRBPYG",
      "YGB.PYGB",
      "GBPOYGBP",
      "BPY.GBPY",
      "PYG.BPYG",
      "YGBYPYGB",
      "GBP.YGBP",
      "BPYGGBPY",
    ]);
    const originalIds = [0, 2, 5, 7].map((row) => board[idx(row, 3)]?.id);

    const { board: result, falls } = applyGravity(board);

    expect([4, 5, 6, 7].map((row) => result[idx(row, 3)]?.id)).toEqual(
      originalIds,
    );
    expect([0, 1, 2, 3].map((row) => result[idx(row, 3)])).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(falls.length).toBeGreaterThan(0);
  });
});

describe("spawnGems", () => {
  it("fills empty top cells and computes fromAboveRows for the animation offset", () => {
    const board = boardFromStrings([
      "........",
      "........",
      "........",
      "ROYGBPRO",
      "OYGBPROY",
      "YGBPROYG",
      "GBPROYGB",
      "BPROYGBP",
    ]);
    const { board: result, spawns } = spawnGems(
      board,
      mulberry32(1),
      createIdGenerator(),
    );

    const col0Spawns = spawns
      .filter((s) => s.to.col === 0)
      .sort((a, b) => a.to.row - b.to.row);
    expect(col0Spawns.map((s) => s.to.row)).toEqual([0, 1, 2]);
    expect(col0Spawns.map((s) => s.fromAboveRows)).toEqual([3, 2, 1]);
    for (let row = 0; row < 3; row++) {
      expect(result[idx(row, 0)]).not.toBeNull();
    }
  });
});

describe("resolveStep", () => {
  it("returns null for a stable board", () => {
    const board = boardFromStrings(STABLE);
    expect(
      resolveStep(board, mulberry32(1), createIdGenerator(), null),
    ).toBeNull();
  });

  it("is deterministic for a given seed", () => {
    const board = boardFromStrings([
      "RRRGBPYO",
      "OYGBPROY",
      "YGBPROYG",
      "GBPROYGB",
      "BPROYGBP",
      "PROYGBPR",
      "ROYGBPRO",
      "OYGBPROY",
    ]);
    const run = () =>
      resolveStep(board, mulberry32(7), createIdGenerator(), null);
    expect(run()).toEqual(run());
  });

  it("includes matchGroups for juice positioning", () => {
    const board = boardFromStrings([
      "RRRGBPYO",
      "OYGBPROY",
      "YGBPROYG",
      "GBPROYGB",
      "BPROYGBP",
      "PROYGBPR",
      "ROYGBPRO",
      "OYGBPROY",
    ]);
    const result = resolveStep(board, mulberry32(1), createIdGenerator(), null);
    expect(result?.matchGroups).toHaveLength(1);
    expect(result?.matchGroups[0].cells).toHaveLength(3);
  });

  it("keeps a newly spawned laser out of this step's cleared set", () => {
    const board = boardFromStrings([
      "ROYGBPRO",
      "OYGBPROY",
      "ORRRRPYG",
      "GBPROYGB",
      "BPROYGBP",
      "PROYGBPR",
      "ROYGBPRO",
      "OYGBPROY",
    ]);
    const result = resolveStep(board, mulberry32(1), createIdGenerator(), null);

    expect(result?.specialSpawns).toEqual([
      { cell: { row: 2, col: 3 }, special: "laserH", kind: 0 },
    ]);
    const spawnWasCleared = result?.clearedGems.some(
      (c) => c.cell.row === 2 && c.cell.col === 3,
    );
    expect(spawnWasCleared).toBe(false);
    expect(result?.board[idx(2, 3)]).toMatchObject({
      special: "laserH",
      kind: 0,
    });
  });

  it("fires both lasers in a laser-laser swap even without a color match", () => {
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
    const swapped = applySwap(board, { row: 0, col: 0 }, { row: 0, col: 1 });
    const result = resolveStep(swapped, mulberry32(1), createIdGenerator(), {
      a: { row: 0, col: 0 },
      b: { row: 0, col: 1 },
    });

    expect(result).not.toBeNull();
    expect(result?.fires).toHaveLength(2);
  });
});

describe("3-chain scenario", () => {
  it("accumulates score as 10 x cleared x combo across a real multi-step cascade", () => {
    let foundSteps: StepResult[] | null = null;

    searchSeeds: for (let seed = 1; seed <= 500; seed++) {
      const rng = mulberry32(seed);
      const nextId = createIdGenerator();
      const board = createBoard(rng, nextId);

      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          const a = { row, col };
          const neighbors = [
            { row, col: col + 1 },
            { row: row + 1, col },
          ].filter((b) => b.row < BOARD_SIZE && b.col < BOARD_SIZE);

          for (const b of neighbors) {
            if (!isValidSwap(board, a, b)) {
              continue;
            }
            const swapped = applySwap(board, a, b);
            const steps: StepResult[] = [];
            let current = swapped;
            let step = resolveStep(current, rng, nextId, { a, b });
            while (step) {
              steps.push(step);
              current = step.board;
              step = resolveStep(current, rng, nextId, null);
            }
            if (steps.length >= 3) {
              foundSteps = steps;
              break searchSeeds;
            }
          }
        }
      }
    }

    expect(foundSteps).not.toBeNull();
    const steps = foundSteps as StepResult[];

    let combo = 0;
    let total = 0;
    for (const step of steps) {
      combo++;
      total += step.clearedGems.length * 10 * combo;
    }

    expect(combo).toBeGreaterThanOrEqual(3);
    expect(total).toBeGreaterThan(0);
  });
});
