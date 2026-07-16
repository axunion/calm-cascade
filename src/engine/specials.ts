import { type Cell, cellsEqual, type Special } from "./board.ts";
import type { MatchGroup } from "./matches.ts";

export interface SpecialSpawn {
  cell: Cell;
  special: Exclude<Special, "none">;
  kind: number;
}

const MIN_LASER_LENGTH = 4;

// prism > bomb > laserH > laserV (spec/01 §4.2 rule 4). "prism" isn't a
// Special yet (phase 11) - this rank table is the skeleton it slots into.
const SPECIAL_PRIORITY: Record<Exclude<Special, "none">, number> = {
  bomb: 2,
  laserH: 1,
  laserV: 0,
};

function computeLaserSpawnCell(
  group: MatchGroup,
  swapTarget: Cell | null,
): Cell {
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
//    consume both groups - they don't also spawn a laser.
// 2. Remaining groups of length >= 4 spawn a laser at the swap-target cell
//    (if the swap moved into this group) or a deterministic cascade
//    position (center for horizontal, bottom-most for vertical).
// 3. A cell claimed by more than one spawn keeps only the higher-priority
//    piece (prism > bomb > laserH > laserV).
export function planSpecialSpawns(
  matchGroups: MatchGroup[],
  swapTarget: Cell | null,
): SpecialSpawn[] {
  const spawns: SpecialSpawn[] = [];
  const consumed = new Set<MatchGroup>();

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
        addSpawn(spawns, shared, "bomb", h.kind);
        break;
      }
    }
  }

  for (const group of matchGroups) {
    if (consumed.has(group) || group.cells.length < MIN_LASER_LENGTH) {
      continue;
    }
    const cell = computeLaserSpawnCell(group, swapTarget);
    const special = group.orientation === "h" ? "laserH" : "laserV";
    addSpawn(spawns, cell, special, group.kind);
  }

  return spawns;
}
