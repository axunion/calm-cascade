import { describe, expect, it } from "vitest";
import type { PuzzleStats } from "../store/puzzleStore.ts";
import { ACHIEVEMENTS, newlyUnlocked } from "./achievements.ts";

const ZERO_STATS: PuzzleStats = {
  totalScore: 0,
  bestCombo: 0,
  gemsCleared: 0,
  lasersFired: 0,
  gamesShuffled: 0,
  bombsDetonated: 0,
  prismsFired: 0,
  iceBroken: 0,
  dailiesPlayed: 0,
};

function stats(overrides: Partial<PuzzleStats>): PuzzleStats {
  return { ...ZERO_STATS, ...overrides };
}

describe("newlyUnlocked", () => {
  it("returns only ripple for a combo-3 stats line", () => {
    const unlocked = newlyUnlocked(stats({ bestCombo: 3 }), []);
    expect(unlocked.map((a) => a.id)).toEqual(["ripple"]);
  });

  it("returns nothing already present in the unlocked list", () => {
    const unlocked = newlyUnlocked(stats({ bestCombo: 3 }), ["ripple"]);
    expect(unlocked).toHaveLength(0);
  });

  it("stays locked at 999 gems cleared and unlocks at 1,000", () => {
    expect(newlyUnlocked(stats({ gemsCleared: 999 }), [])).toHaveLength(0);
    const unlocked = newlyUnlocked(stats({ gemsCleared: 1000 }), []);
    expect(unlocked.map((a) => a.id)).toEqual(["gem-stream"]);
  });

  it("returns both achievements when a single step crosses two thresholds", () => {
    const unlocked = newlyUnlocked(
      stats({ bestCombo: 3, gemsCleared: 1000 }),
      [],
    );
    expect(unlocked.map((a) => a.id).sort()).toEqual(
      ["gem-stream", "ripple"].sort(),
    );
  });

  it("never fires for zero-value stats", () => {
    expect(newlyUnlocked(ZERO_STATS, [])).toHaveLength(0);
  });

  it("has isUnlocked false for every achievement at zero stats", () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.isUnlocked(ZERO_STATS)).toBe(false);
    }
  });
});
