import { describe, expect, it } from "vitest";
import { comboJuice } from "./juice.ts";

describe("comboJuice", () => {
  it("combo 1 has no juice event", () => {
    expect(comboJuice(1)).toEqual({ text: null, tier: null, trauma: 0 });
  });

  it("combo 2 and 3 are small tier with no trauma", () => {
    expect(comboJuice(2)).toEqual({
      text: "Combo 2!",
      tier: "small",
      trauma: 0,
    });
    expect(comboJuice(3)).toEqual({
      text: "Combo 3!",
      tier: "small",
      trauma: 0,
    });
  });

  it("combo 4 and 5 are medium tier with 0.25 trauma", () => {
    expect(comboJuice(4)).toEqual({
      text: "FABULOUS!!",
      tier: "medium",
      trauma: 0.25,
    });
    expect(comboJuice(5)).toEqual({
      text: "AMAZING!!",
      tier: "medium",
      trauma: 0.25,
    });
  });

  it("combo 6 and above are large tier with 0.45 trauma", () => {
    expect(comboJuice(6)).toEqual({
      text: "TRANSCENDENT!!",
      tier: "large",
      trauma: 0.45,
    });
    expect(comboJuice(10)).toEqual({
      text: "TRANSCENDENT!!",
      tier: "large",
      trauma: 0.45,
    });
  });
});
