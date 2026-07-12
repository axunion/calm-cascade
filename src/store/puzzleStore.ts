import { batch } from "solid-js";
import { createStore, type SetStoreFunction } from "solid-js/store";
import type { ThemeMode } from "../render/theme.ts";

export interface PuzzleStats {
  totalScore: number;
  bestCombo: number;
  gemsCleared: number;
  lasersFired: number;
  gamesShuffled: number;
}

export interface PuzzleSettings {
  theme: ThemeMode;
  reducedMotion: boolean;
  haptics: boolean;
  colorBlindShapes: boolean;
  sound: boolean;
  particles: boolean;
}

export interface JuiceEvent {
  id: number;
  text: string;
  tier: "small" | "medium" | "large";
  xPct: number;
  yPct: number;
}

export interface PuzzleState {
  score: number;
  combo: number;
  stats: PuzzleStats;
  settings: PuzzleSettings;
  juiceEvents: JuiceEvent[];
}

function prefersDarkTheme(): boolean {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function createDefaultState(): PuzzleState {
  return {
    score: 0,
    combo: 0,
    stats: {
      totalScore: 0,
      bestCombo: 0,
      gemsCleared: 0,
      lasersFired: 0,
      gamesShuffled: 0,
    },
    settings: {
      theme: prefersDarkTheme() ? "dark" : "light",
      reducedMotion: false,
      haptics: true,
      colorBlindShapes: false,
      sound: true,
      particles: true,
    },
    juiceEvents: [],
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
  juice: JuiceEvent | null;
}

// Called at cascade step boundaries only (spec/02 §5): one batch per step,
// never per frame.
export function applyStepResult(
  setStore: SetStoreFunction<PuzzleState>,
  step: StepResultInput,
): void {
  batch(() => {
    setStore("score", (score) => score + step.scoreDelta);
    setStore("combo", step.combo);
    setStore("stats", "totalScore", (total) => total + step.scoreDelta);
    setStore("stats", "gemsCleared", (count) => count + step.gemsCleared);
    setStore("stats", "bestCombo", (best) => Math.max(best, step.combo));
    if (step.lasersFired > 0) {
      setStore("stats", "lasersFired", (count) => count + step.lasersFired);
    }
    if (step.juice) {
      const juice = step.juice;
      setStore("juiceEvents", (events) => {
        const trimmed =
          events.length >= JUICE_QUEUE_LIMIT ? events.slice(1) : events;
        return [...trimmed, juice];
      });
    }
  });
}

export function resetCombo(setStore: SetStoreFunction<PuzzleState>): void {
  setStore("combo", 0);
}

export function recordShuffle(setStore: SetStoreFunction<PuzzleState>): void {
  setStore("stats", "gamesShuffled", (count) => count + 1);
}

export function expireJuiceEvent(
  setStore: SetStoreFunction<PuzzleState>,
  id: number,
): void {
  setStore("juiceEvents", (events) =>
    events.filter((event) => event.id !== id),
  );
}
