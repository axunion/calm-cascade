import type { PuzzleStats } from "../store/puzzleStore.ts";

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  unlocksTheme?: string;
  isUnlocked(stats: PuzzleStats): boolean;
}

// spec/01 §9 "Garden Goals": no hidden achievements - conditions are always
// shown, even before they're met, to avoid exploration pressure. Unlocking
// is irreversible and evaluated only from stats (pure, no session state).
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: "ripple",
    title: "Ripple",
    description: "Reach a combo of 3.",
    isUnlocked: (stats) => stats.bestCombo >= 3,
  },
  {
    id: "flow-state",
    title: "Flow State",
    description: "Reach a combo of 6.",
    isUnlocked: (stats) => stats.bestCombo >= 6,
  },
  {
    id: "gem-stream",
    title: "Gem Stream",
    description: "Clear 1,000 gems.",
    isUnlocked: (stats) => stats.gemsCleared >= 1000,
  },
  {
    id: "river-of-gems",
    title: "River of Gems",
    description: "Clear 10,000 gems.",
    isUnlocked: (stats) => stats.gemsCleared >= 10000,
  },
  {
    id: "lightbender",
    title: "Lightbender",
    description: "Fire 50 lasers.",
    isUnlocked: (stats) => stats.lasersFired >= 50,
  },
  {
    id: "gentle-thunder",
    title: "Gentle Thunder",
    description: "Detonate 25 bombs.",
    isUnlocked: (stats) => stats.bombsDetonated >= 25,
  },
  {
    id: "prismatic",
    title: "Prismatic",
    description: "Fire 10 prisms.",
    unlocksTheme: "prismatic",
    isUnlocked: (stats) => stats.prismsFired >= 10,
  },
  {
    id: "calm-collector",
    title: "Calm Collector",
    description: "Reach a total score of 100,000.",
    isUnlocked: (stats) => stats.totalScore >= 100000,
  },
  {
    id: "thaw",
    title: "Thaw",
    description: "Break 100 ice layers.",
    isUnlocked: (stats) => stats.iceBroken >= 100,
  },
  {
    id: "seven-mornings",
    title: "Seven Mornings",
    description: "Play 7 daily challenges.",
    isUnlocked: (stats) => stats.dailiesPlayed >= 7,
  },
];

// Called at stats-changing step boundaries only (spec/01 §9), never per
// frame. `already` is the store's unlockedAchievements list.
export function newlyUnlocked(
  stats: PuzzleStats,
  already: readonly string[],
): AchievementDef[] {
  const alreadySet = new Set(already);
  return ACHIEVEMENTS.filter(
    (achievement) =>
      !alreadySet.has(achievement.id) && achievement.isUnlocked(stats),
  );
}
