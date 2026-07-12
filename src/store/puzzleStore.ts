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
