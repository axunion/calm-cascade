import { describe, expect, it } from "vitest";
import { idx } from "../engine/board.ts";
import type { MatchGroup } from "../engine/matches.ts";
import {
  computeClearDelays,
  computeFireDelays,
  type LaserFire,
} from "./laserTiming.ts";

function matchGroup(cells: { row: number; col: number }[]): MatchGroup {
  return { cells, orientation: "h", kind: 0 };
}

describe("computeFireDelays", () => {
  it("gives a matched laser zero delay", () => {
    const fire: LaserFire = { cell: { row: 2, col: 2 }, orientation: "v" };
    const delays = computeFireDelays(
      [fire],
      [matchGroup([{ row: 2, col: 2 }])],
      null,
    );
    expect(delays).toEqual([0]);
  });

  it("gives both lasers zero delay in a laser-laser swap even though they share a row", () => {
    const a: LaserFire = { cell: { row: 4, col: 4 }, orientation: "h" };
    const b: LaserFire = { cell: { row: 4, col: 5 }, orientation: "v" };
    const delays = computeFireDelays([a, b], [], {
      a: { row: 4, col: 4 },
      b: { row: 4, col: 5 },
    });
    expect(delays).toEqual([0, 0]);
  });

  it("delays a chain-fired laser by its distance from the triggering fire", () => {
    const first: LaserFire = { cell: { row: 3, col: 2 }, orientation: "h" };
    const second: LaserFire = { cell: { row: 3, col: 6 }, orientation: "v" };
    const delays = computeFireDelays(
      [first, second],
      [matchGroup([{ row: 3, col: 2 }])],
      null,
    );
    expect(delays).toEqual([0, 4 * 18]);
  });

  it("accumulates delay across a chain of three", () => {
    const a: LaserFire = { cell: { row: 0, col: 3 }, orientation: "h" };
    const b: LaserFire = { cell: { row: 0, col: 6 }, orientation: "v" };
    const c: LaserFire = { cell: { row: 5, col: 6 }, orientation: "h" };
    const delays = computeFireDelays(
      [a, b, c],
      [matchGroup([{ row: 0, col: 3 }])],
      null,
    );
    expect(delays).toEqual([0, 3 * 18, 3 * 18 + 5 * 18]);
  });
});

describe("computeClearDelays", () => {
  it("gives every swept cell in the row/col a distance-based delay", () => {
    const fire: LaserFire = { cell: { row: 3, col: 2 }, orientation: "h" };
    const delays = computeClearDelays([fire], [0]);
    expect(delays.get(idx(3, 0))).toBe(2 * 18);
    expect(delays.get(idx(3, 2))).toBe(0);
    expect(delays.get(idx(3, 7))).toBe(5 * 18);
  });

  it("takes the earliest arrival when two beams cross the same cell", () => {
    const h: LaserFire = { cell: { row: 4, col: 4 }, orientation: "h" };
    const v: LaserFire = { cell: { row: 1, col: 5 }, orientation: "v" };
    const delays = computeClearDelays([h, v], [0, 0]);
    // (4, 5) is swept by h at distance 1 and by v at distance 3.
    expect(delays.get(idx(4, 5))).toBe(1 * 18);
  });
});
