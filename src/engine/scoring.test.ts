import { describe, expect, it } from "vitest";
import { stepScore } from "./scoring.ts";

describe("stepScore", () => {
  it("computes cleared count times 10 times combo", () => {
    expect(stepScore(3, 1)).toBe(30);
    expect(stepScore(5, 3)).toBe(150);
  });

  it("returns 0 when nothing is cleared", () => {
    expect(stepScore(0, 1)).toBe(0);
  });

  it("sums to 260 across the spec/01 §3 three-chain example", () => {
    const total = stepScore(3, 1) + stepScore(4, 2) + stepScore(5, 3);
    expect(total).toBe(260);
  });
});
