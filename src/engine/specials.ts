import { type Cell, cellsEqual, type Special } from "./board.ts";
import type { MatchGroup } from "./matches.ts";

export interface SpecialSpawn {
  cell: Cell;
  special: Special;
  kind: number;
}

const MIN_LASER_LENGTH = 4;

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

// planSpecialSpawns turns each straight-line match of length >= 4 into a
// laser spawn (spec/01 §4.1-4.2). If a horizontal-4 and a vertical-4 target
// the same cell, only one laser spawns there and laserH wins.
export function planSpecialSpawns(
  matchGroups: MatchGroup[],
  swapTarget: Cell | null,
): SpecialSpawn[] {
  const spawns: SpecialSpawn[] = [];

  for (const group of matchGroups) {
    if (group.cells.length < MIN_LASER_LENGTH) {
      continue;
    }
    const cell = computeSpawnCell(group, swapTarget);
    const special: Special = group.orientation === "h" ? "laserH" : "laserV";
    const existing = spawns.find((spawn) => cellsEqual(spawn.cell, cell));
    if (!existing) {
      spawns.push({ cell, special, kind: group.kind });
    } else if (existing.special === "laserV" && special === "laserH") {
      existing.special = "laserH";
      existing.kind = group.kind;
    }
  }

  return spawns;
}
