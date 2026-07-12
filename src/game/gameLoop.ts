import type { Board, Cell, NextId } from "../engine/board.ts";
import { resolveStep } from "../engine/cascade.ts";
import type { Rng } from "../engine/rng.ts";
import { applySwap, isValidSwap } from "../engine/swap.ts";
import type { PuzzleSettings } from "../store/puzzleStore.ts";

// Phase 2 skeleton (spec/05 phase 2): only the phases needed to make a swap
// feel responsive exist so far. RESOLVING/SHUFFLING and their animations
// land in phase 3 - for now a valid swap resolves every cascade step
// synchronously with no tweening.
export type Phase = "IDLE" | "SWAPPING" | "SWAP_REJECT";

export interface GameLoop {
  readonly board: Board;
  readonly phase: Phase;
  // Plain, non-reactive mirror of the store's settings (spec/02 §5): the
  // rAF loop reads this every frame instead of the Solid store proxy.
  // PuzzleGrid.tsx writes into it from a createEffect on settings changes.
  readonly settingsSnapshot: PuzzleSettings;
  requestSwap(a: Cell, b: Cell): void;
}

export function createGameLoop(
  initialBoard: Board,
  rng: Rng,
  nextId: NextId,
  initialSettings: PuzzleSettings,
): GameLoop {
  let board = initialBoard;
  let phase: Phase = "IDLE";
  const settingsSnapshot: PuzzleSettings = { ...initialSettings };

  function resolveAllSteps(
    startBoard: Board,
    swap: { a: Cell; b: Cell },
  ): Board {
    let current = startBoard;
    let step = resolveStep(current, rng, nextId, swap);
    while (step) {
      current = step.board;
      step = resolveStep(current, rng, nextId, null);
    }
    return current;
  }

  return {
    get board() {
      return board;
    },
    get phase() {
      return phase;
    },
    settingsSnapshot,
    requestSwap(a, b) {
      if (phase !== "IDLE") {
        return;
      }
      if (!isValidSwap(board, a, b)) {
        return;
      }
      phase = "SWAPPING";
      board = resolveAllSteps(applySwap(board, a, b), { a, b });
      phase = "IDLE";
    },
  };
}
