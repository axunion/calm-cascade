import {
  type Board,
  type Cell,
  cellsEqual,
  idx,
  type Special,
} from "./board.ts";
import type { MatchGroup } from "./matches.ts";

export interface SpecialSpawn {
  cell: Cell;
  special: Exclude<Special, "none">;
  kind: number;
}

const MIN_LASER_LENGTH = 4;
const MIN_PRISM_LENGTH = 5;

// prism > bomb > laserH > laserV (spec/01 §4.2 rule 4).
const SPECIAL_PRIORITY: Record<Exclude<Special, "none">, number> = {
  prism: 3,
  bomb: 2,
  laserH: 1,
  laserV: 0,
};

// Same deterministic position rule for both laser and prism (spec/01 §4.2):
// the swap-target cell if the swap moved into this group, else a cascade
// position (center for horizontal, bottom-most for vertical).
function computeSpawnCell(group: MatchGroup, swapTarget: Cell | null): Cell {
  if (swapTarget) {
    const swapCell = group.cells.find((cell) => cellsEqual(cell, swapTarget));
    if (swapCell) {
      return swapCell;
    }
  }
  return group.orientation === "h"
    ? group.cells[Math.floor(group.cells.length / 2)]
    : group.cells[group.cells.length - 1];
}

function findSharedCell(a: MatchGroup, b: MatchGroup): Cell | null {
  for (const cellA of a.cells) {
    const shared = b.cells.find((cellB) => cellsEqual(cellA, cellB));
    if (shared) {
      return shared;
    }
  }
  return null;
}

function addSpawn(
  spawns: SpecialSpawn[],
  cell: Cell,
  special: Exclude<Special, "none">,
  kind: number,
): void {
  const existing = spawns.find((spawn) => cellsEqual(spawn.cell, cell));
  if (!existing) {
    spawns.push({ cell, special, kind });
    return;
  }
  if (SPECIAL_PRIORITY[special] > SPECIAL_PRIORITY[existing.special]) {
    existing.special = special;
    existing.kind = kind;
  }
}

// planSpecialSpawns (spec/01 §4.1-4.2):
// 1. Same-kind horizontal/vertical groups sharing a cell (L/T shape) spawn a
//    bomb at that shared cell, angle fixed regardless of swapTarget, and
//    consume both groups - they don't also spawn a laser or prism. This
//    check runs unconditionally on group length: a length>=5 leg involved in
//    an L/T is still consumed into the bomb rather than emitted as a prism.
//    spec/01 §4.1's "判定順は prism → bomb → laser" is about the priority
//    table below (same-cell collision between independently-computed
//    spawns), not about which check runs first here - resolved this way on
//    purpose (phase 11) to keep phase 10's L/T behavior unchanged rather
//    than re-reading that note as "prism preempts L/T consumption".
// 2. Remaining groups of length >= 5 spawn a prism; length 4 spawns a laser.
//    Both use the same spawn-position rule (computeSpawnCell).
// 3. A cell claimed by more than one spawn keeps only the higher-priority
//    piece (prism > bomb > laserH > laserV).
// 4. An ice-covered candidate cell never spawns a special (spec/01 §7) - the
//    group is still consumed/skipped, it just doesn't produce a piece.
export function planSpecialSpawns(
  matchGroups: MatchGroup[],
  swapTarget: Cell | null,
  board: Board,
): SpecialSpawn[] {
  const spawns: SpecialSpawn[] = [];
  const consumed = new Set<MatchGroup>();

  function hasIce(cell: Cell): boolean {
    const gem = board[idx(cell.row, cell.col)];
    return !!gem && gem.ice > 0;
  }

  const horizontals = matchGroups.filter((group) => group.orientation === "h");
  const verticals = matchGroups.filter((group) => group.orientation === "v");

  for (const h of horizontals) {
    if (consumed.has(h)) {
      continue;
    }
    for (const v of verticals) {
      if (consumed.has(v) || h.kind !== v.kind) {
        continue;
      }
      const shared = findSharedCell(h, v);
      if (shared) {
        consumed.add(h);
        consumed.add(v);
        if (!hasIce(shared)) {
          addSpawn(spawns, shared, "bomb", h.kind);
        }
        break;
      }
    }
  }

  for (const group of matchGroups) {
    if (consumed.has(group) || group.cells.length < MIN_LASER_LENGTH) {
      continue;
    }
    const cell = computeSpawnCell(group, swapTarget);
    if (hasIce(cell)) {
      continue;
    }
    const special: Exclude<Special, "none"> =
      group.cells.length >= MIN_PRISM_LENGTH
        ? "prism"
        : group.orientation === "h"
          ? "laserH"
          : "laserV";
    addSpawn(spawns, cell, special, group.kind);
  }

  return spawns;
}
