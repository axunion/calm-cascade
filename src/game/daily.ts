import {
  type Board,
  createBoard,
  createIdGenerator,
  type NextId,
} from "../engine/board.ts";
import { mulberry32, type Rng, seedFromString } from "../engine/rng.ts";

// spec/01 §8: the only place in the codebase that reads the real date -
// engine and store code always take an already-derived date key or seed.
export function todayKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface DailyRun {
  board: Board;
  rng: Rng;
  nextId: NextId;
}

// Deterministic from dateKey alone (spec/02 §3): same day -> same initial
// board and the same refill stream thereafter, for anyone, any time. Ice
// placement lands in phase 14 - createBoard alone already guarantees no
// initial match and at least one valid move.
export function createDailyRun(dateKey: string): DailyRun {
  const rng = mulberry32(seedFromString(`daily:${dateKey}`));
  const nextId = createIdGenerator();
  const board = createBoard(rng, nextId);
  return { board, rng, nextId };
}

// spec/01 §8: three score thresholds light a flower each, no failure state.
export const DAILY_MILESTONES: readonly number[] = [500, 2000, 5000];

export function milestonesReached(score: number): number {
  return DAILY_MILESTONES.filter((threshold) => score >= threshold).length;
}
