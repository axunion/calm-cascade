import { type Board, hasValidMove } from "./board.ts";
import type { Rng } from "./rng.ts";

const MAX_PLACEMENT_ATTEMPTS = 50;

function eligibleIndices(board: Board): number[] {
  const indices: number[] = [];
  for (let i = 0; i < board.length; i++) {
    const gem = board[i];
    if (gem && gem.special === "none" && gem.ice === 0) {
      indices.push(i);
    }
  }
  return indices;
}

// Deterministic partial Fisher-Yates pick of `count` distinct indices from
// `pool`, consuming `rng` once per pick.
function pickIndices(pool: number[], rng: Rng, count: number): number[] {
  const remaining = pool.slice();
  const picked: number[] = [];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const j = Math.floor(rng() * remaining.length);
    picked.push(remaining[j]);
    remaining.splice(j, 1);
  }
  return picked;
}

// spec/01 §7: used for the daily board's frost decoration. Assigns 1 ice
// layer to `count` cells chosen from special-free gems only (ice and
// special never coexist), retrying with a fresh pick if the result would
// leave no valid move - `hasValidMove` must hold after placement.
export function placeIce(board: Board, rng: Rng, count: number): Board {
  const pool = eligibleIndices(board);
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    const indices = pickIndices(pool, rng, count);
    const next = board.slice();
    for (const i of indices) {
      const gem = next[i];
      if (gem) {
        next[i] = { ...gem, ice: 1 };
      }
    }
    if (hasValidMove(next)) {
      return next;
    }
  }
  return board;
}
