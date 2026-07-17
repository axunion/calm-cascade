import { batch } from "solid-js";
import { createStore, type SetStoreFunction } from "solid-js/store";
import { newlyUnlocked } from "../game/achievements.ts";
import { todayKey } from "../game/daily.ts";
import type { ThemeMode } from "../render/theme.ts";

export type GameMode = "endless" | "daily";

export interface PuzzleStats {
  totalScore: number;
  bestCombo: number;
  gemsCleared: number;
  lasersFired: number;
  gamesShuffled: number;
  bombsDetonated: number;
  prismsFired: number;
  iceBroken: number;
  dailiesPlayed: number;
}

export const DEFAULT_SKIN = "classic";

export interface PuzzleSettings {
  theme: ThemeMode;
  skin: string;
  reducedMotion: boolean;
  haptics: boolean;
  colorBlindShapes: boolean;
  sound: boolean;
  particles: boolean;
}

export interface DailyRecord {
  date: string;
  bestScore: number;
}

export interface JuiceEvent {
  id: number;
  text: string;
  tier: "small" | "medium" | "large";
  xPct: number;
  yPct: number;
}

export interface AchievementToast {
  id: string;
  title: string;
}

export interface PuzzleState {
  score: number;
  combo: number;
  mode: GameMode;
  stats: PuzzleStats;
  settings: PuzzleSettings;
  juiceEvents: JuiceEvent[];
  unlockedAchievements: string[];
  achievementToasts: AchievementToast[];
  daily: DailyRecord | null;
}

function prefersDarkTheme(): boolean {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-color-scheme: dark)").matches
  );
}

// spec/03 §6: reduced motion is OS setting OR the settings toggle. The OS
// preference only seeds the initial toggle value (same pattern as the dark
// theme default above) - from then on it's the user's explicit setting.
function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function createDefaultState(): PuzzleState {
  return {
    score: 0,
    combo: 0,
    mode: "endless",
    stats: {
      totalScore: 0,
      bestCombo: 0,
      gemsCleared: 0,
      lasersFired: 0,
      gamesShuffled: 0,
      bombsDetonated: 0,
      prismsFired: 0,
      iceBroken: 0,
      dailiesPlayed: 0,
    },
    settings: {
      theme: prefersDarkTheme() ? "dark" : "light",
      skin: DEFAULT_SKIN,
      reducedMotion: prefersReducedMotion(),
      haptics: true,
      colorBlindShapes: false,
      sound: true,
      particles: true,
    },
    juiceEvents: [],
    unlockedAchievements: [],
    achievementToasts: [],
    daily: null,
  };
}

export type PuzzleStore = [PuzzleState, SetStoreFunction<PuzzleState>];

export function createPuzzleStore(): PuzzleStore {
  return createStore<PuzzleState>(createDefaultState());
}

const JUICE_QUEUE_LIMIT = 8;

export interface StepResultInput {
  scoreDelta: number;
  combo: number;
  gemsCleared: number;
  lasersFired: number;
  bombsDetonated: number;
  prismsFired: number;
  iceBroken: number;
  juice: JuiceEvent | null;
}

// Evaluated at the end of every stats-changing batch (spec/01 §9): never per
// frame. Unlock is irreversible - newly-met achievements are appended to
// both the persisted id list and the session-only toast queue. Returns
// whether anything unlocked, so callers can play the unlock sound.
function evaluateAchievements(
  state: PuzzleState,
  setStore: SetStoreFunction<PuzzleState>,
): boolean {
  const unlocked = newlyUnlocked(state.stats, state.unlockedAchievements);
  if (unlocked.length === 0) {
    return false;
  }
  setStore("unlockedAchievements", (ids) => [
    ...ids,
    ...unlocked.map((achievement) => achievement.id),
  ]);
  setStore("achievementToasts", (toasts) => [
    ...toasts,
    ...unlocked.map((achievement) => ({
      id: achievement.id,
      title: achievement.title,
    })),
  ]);
  return true;
}

// Called at cascade step boundaries only (spec/02 §5): one batch per step,
// never per frame. Returns whether an achievement unlocked this step.
export function applyStepResult(
  store: PuzzleStore,
  step: StepResultInput,
): boolean {
  const [state, setStore] = store;
  return batch(() => {
    setStore("score", (score) => score + step.scoreDelta);
    setStore("combo", step.combo);
    setStore("stats", "totalScore", (total) => total + step.scoreDelta);
    setStore("stats", "gemsCleared", (count) => count + step.gemsCleared);
    setStore("stats", "bestCombo", (best) => Math.max(best, step.combo));
    if (step.lasersFired > 0) {
      setStore("stats", "lasersFired", (count) => count + step.lasersFired);
    }
    if (step.bombsDetonated > 0) {
      setStore(
        "stats",
        "bombsDetonated",
        (count) => count + step.bombsDetonated,
      );
    }
    if (step.prismsFired > 0) {
      setStore("stats", "prismsFired", (count) => count + step.prismsFired);
    }
    if (step.iceBroken > 0) {
      setStore("stats", "iceBroken", (count) => count + step.iceBroken);
    }
    if (step.juice) {
      const juice = step.juice;
      setStore("juiceEvents", (events) => {
        const trimmed =
          events.length >= JUICE_QUEUE_LIMIT ? events.slice(1) : events;
        return [...trimmed, juice];
      });
    }
    return evaluateAchievements(state, setStore);
  });
}

export function resetCombo(setStore: SetStoreFunction<PuzzleState>): void {
  setStore("combo", 0);
}

export function recordShuffle(store: PuzzleStore): boolean {
  const [state, setStore] = store;
  return batch(() => {
    setStore("stats", "gamesShuffled", (count) => count + 1);
    return evaluateAchievements(state, setStore);
  });
}

// spec/01 §8: switching modes always starts a fresh session score. The first
// switch to daily on a given date resets that day's record and counts as
// that day's first play; switching back later the same day is a no-op on
// dailiesPlayed/daily.bestScore. Returns whether an achievement unlocked.
export function switchToDaily(store: PuzzleStore): boolean {
  const [state, setStore] = store;
  const dateKey = todayKey();
  return batch(() => {
    setStore("mode", "daily");
    setStore("score", 0);
    setStore("combo", 0);
    if (state.daily?.date === dateKey) {
      return false;
    }
    setStore("daily", { date: dateKey, bestScore: 0 });
    setStore("stats", "dailiesPlayed", (count) => count + 1);
    return evaluateAchievements(state, setStore);
  });
}

export function switchToEndless(setStore: SetStoreFunction<PuzzleState>): void {
  batch(() => {
    setStore("mode", "endless");
    setStore("score", 0);
    setStore("combo", 0);
  });
}

// spec/01 §8: only the day's best score is kept, saved when a cascade ends
// with a new best. A no-op outside daily mode, so a stale `daily` record
// from a previous day never gets overwritten by endless-mode scores.
export function recordDailyBest(store: PuzzleStore): boolean {
  const [state, setStore] = store;
  if (state.mode !== "daily" || !state.daily) {
    return false;
  }
  if (state.score <= state.daily.bestScore) {
    return false;
  }
  return batch(() => {
    setStore("daily", "bestScore", state.score);
    return evaluateAchievements(state, setStore);
  });
}

export function expireJuiceEvent(
  setStore: SetStoreFunction<PuzzleState>,
  id: number,
): void {
  setStore("juiceEvents", (events) =>
    events.filter((event) => event.id !== id),
  );
}

export function expireAchievementToast(
  setStore: SetStoreFunction<PuzzleState>,
  id: string,
): void {
  setStore("achievementToasts", (toasts) =>
    toasts.filter((toast) => toast.id !== id),
  );
}
