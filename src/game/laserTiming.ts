import { BOARD_SIZE, type Cell, cellsEqual, idx } from "../engine/board.ts";
import type { SwapInfo } from "../engine/cascade.ts";
import type { MatchGroup } from "../engine/matches.ts";

export const BEAM_STAGGER_MS = 18;

// gameLoop.ts filters StepResult.fires down to the laser-only subset and
// converts each SpecialFire (`{ cell, special }`) into this shape before
// calling into this module - this module's own API (this type included)
// stays laser-specific and unchanged by engine/fires.ts's generalization.
export interface LaserFire {
  cell: Cell;
  orientation: "h" | "v";
}

// Distance in cells from `from` to `to` along `orientation`'s sweep line, or
// null if `to` isn't on that line at all.
function axisDistance(
  from: Cell,
  to: Cell,
  orientation: "h" | "v",
): number | null {
  if (orientation === "h") {
    return from.row === to.row ? Math.abs(to.col - from.col) : null;
  }
  return from.col === to.col ? Math.abs(to.row - from.row) : null;
}

function isRootFire(
  fire: LaserFire,
  matchGroups: MatchGroup[],
  swap: SwapInfo | null,
): boolean {
  const inMatch = matchGroups.some((group) =>
    group.cells.some((cell) => cellsEqual(cell, fire.cell)),
  );
  if (inMatch) {
    return true;
  }
  return (
    !!swap && (cellsEqual(swap.a, fire.cell) || cellsEqual(swap.b, fire.cell))
  );
}

// Each fire's beam begins the instant the sweep that triggered it arrives
// (spec/04 §2.5); a "root" fire - matched directly, or part of a
// laser-laser swap - begins with the step itself (delay 0), never chained
// even if its cell happens to sit on another root's row/col.
// `fires` is already in BFS trigger order (engine/fires.ts), so a chained
// fire's trigger is always an earlier entry in this array. If more than one
// earlier fire's line could have swept it, the first (by BFS order) is used;
// this is a presentation-only approximation when that's ambiguous - it never
// affects clear/score outcomes, only which frame a beam visually starts on.
export function computeFireDelays(
  fires: LaserFire[],
  matchGroups: MatchGroup[],
  swap: SwapInfo | null,
): number[] {
  const delays: number[] = [];
  for (let i = 0; i < fires.length; i++) {
    const fire = fires[i];
    if (isRootFire(fire, matchGroups, swap)) {
      delays.push(0);
      continue;
    }
    let delay = 0;
    for (let j = 0; j < i; j++) {
      const earlier = fires[j];
      const distance = axisDistance(
        earlier.cell,
        fire.cell,
        earlier.orientation,
      );
      if (distance === null) {
        continue;
      }
      delay = delays[j] + distance * BEAM_STAGGER_MS;
      break;
    }
    delays.push(delay);
  }
  return delays;
}

// Per-cell clear delay for every gem swept by a beam (spec/04 §2.5 stagger:
// distance from the firing cell x 18ms). A cell hit by more than one beam
// clears at the earliest arrival.
export function computeClearDelays(
  fires: LaserFire[],
  fireDelays: number[],
): Map<number, number> {
  const delays = new Map<number, number>();
  fires.forEach((fire, i) => {
    for (let step = 0; step < BOARD_SIZE; step++) {
      const cell: Cell =
        fire.orientation === "h"
          ? { row: fire.cell.row, col: step }
          : { row: step, col: fire.cell.col };
      // Always on the fire's own line by construction, so this never nulls out.
      const distance = axisDistance(fire.cell, cell, fire.orientation) ?? 0;
      const delay = fireDelays[i] + distance * BEAM_STAGGER_MS;
      const cellIndex = idx(cell.row, cell.col);
      const existing = delays.get(cellIndex);
      if (existing === undefined || delay < existing) {
        delays.set(cellIndex, delay);
      }
    }
  });
  return delays;
}
