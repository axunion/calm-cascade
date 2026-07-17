import {
  type Board,
  createBoard,
  createIdGenerator,
  type NextId,
} from "../engine/board.ts";
import { placeIce } from "../engine/ice.ts";
import { mulberry32, type Rng, seedFromString } from "../engine/rng.ts";

const DAILY_ICE_COUNT = 6;

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
// board (frost decoration included) and the same refill stream thereafter,
// for anyone, any time. placeIce continues the same rng stream so it stays
// part of the single deterministic sequence.
export function createDailyRun(dateKey: string): DailyRun {
  const rng = mulberry32(seedFromString(`daily:${dateKey}`));
  const nextId = createIdGenerator();
  const board = placeIce(createBoard(rng, nextId), rng, DAILY_ICE_COUNT);
  return { board, rng, nextId };
}

// spec/01 §8: three score thresholds light a flower each, no failure state.
export const DAILY_MILESTONES: readonly number[] = [500, 2000, 5000];

export function milestonesReached(score: number): number {
  return DAILY_MILESTONES.filter((threshold) => score >= threshold).length;
}
