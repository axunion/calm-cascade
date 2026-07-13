import { describe, expect, it } from "vitest";
import {
  addTrauma,
  decayTrauma,
  SHAKE_MAX_PX,
  shakeAmplitude,
} from "./shake.ts";

describe("decayTrauma", () => {
  it("decays linearly at 1.8 per second", () => {
    expect(decayTrauma(1, 500)).toBeCloseTo(1 - 0.5 * 1.8);
  });

  it("clamps to zero instead of going negative", () => {
    expect(decayTrauma(0.1, 1000)).toBe(0);
  });
});

describe("addTrauma", () => {
  it("adds and clamps to a maximum of 1", () => {
    expect(addTrauma(0.8, 0.45)).toBe(1);
  });

  it("adds normally below the ceiling", () => {
    expect(addTrauma(0.2, 0.25)).toBeCloseTo(0.45);
  });
});

describe("shakeAmplitude", () => {
  it("is zero at zero trauma", () => {
    expect(shakeAmplitude(0)).toBe(0);
  });

  it("scales with trauma squared up to SHAKE_MAX_PX", () => {
    expect(shakeAmplitude(1)).toBe(SHAKE_MAX_PX);
    expect(shakeAmplitude(0.5)).toBeCloseTo(0.25 * SHAKE_MAX_PX);
  });
});
