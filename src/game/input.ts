import { BOARD_SIZE, type Cell, cellsEqual } from "../engine/board.ts";
import { isAdjacent } from "../engine/swap.ts";

export const SWIPE_THRESHOLD_PX = 10;
export const DOUBLE_TAP_DEBOUNCE_MS = 250;

// Structurally compatible with native PointerEvent, so real events can be
// passed straight through while tests inject plain objects (spec/06 §3).
export interface PointerLikeEvent {
  pointerId: number;
  clientX: number;
  clientY: number;
  timeStamp: number;
}

export interface BoardRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface InputCallbacks {
  onSelectionChange(cell: Cell | null): void;
  onSwap(a: Cell, b: Cell): void;
}

export interface InputController {
  handlePointerDown(event: PointerLikeEvent, rect: BoardRect): void;
  handlePointerMove(event: PointerLikeEvent): void;
  handlePointerUp(event: PointerLikeEvent): void;
  handlePointerCancel(event: PointerLikeEvent): void;
}

type PressState =
  | { kind: "none" }
  | {
      kind: "pressed";
      pointerId: number;
      startX: number;
      startY: number;
      startCell: Cell;
    };

function cellFromPoint(event: PointerLikeEvent, rect: BoardRect): Cell | null {
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  if (
    localX < 0 ||
    localY < 0 ||
    localX >= rect.width ||
    localY >= rect.height
  ) {
    return null;
  }
  const col = Math.floor((localX / rect.width) * BOARD_SIZE);
  const row = Math.floor((localY / rect.height) * BOARD_SIZE);
  if (col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE) {
    return null;
  }
  return { row, col };
}

function dominantNeighbor(cell: Cell, dx: number, dy: number): Cell | null {
  if (Math.abs(dx) > Math.abs(dy)) {
    const col = cell.col + (dx > 0 ? 1 : -1);
    return col >= 0 && col < BOARD_SIZE ? { row: cell.row, col } : null;
  }
  const row = cell.row + (dy > 0 ? 1 : -1);
  return row >= 0 && row < BOARD_SIZE ? { row, col: cell.col } : null;
}

// Pointer state machine (spec/04 §3.2). Knows nothing about the game phase —
// it only ever emits selection changes and swap requests; the caller decides
// whether a swap is accepted.
export function createInputController(
  callbacks: InputCallbacks,
): InputController {
  let state: PressState = { kind: "none" };
  let selected: Cell | null = null;
  let lastTap: { cell: Cell; time: number } | null = null;

  function setSelected(cell: Cell | null): void {
    selected = cell;
    callbacks.onSelectionChange(cell);
  }

  function handleTap(cell: Cell, time: number): void {
    if (
      lastTap &&
      cellsEqual(lastTap.cell, cell) &&
      time - lastTap.time < DOUBLE_TAP_DEBOUNCE_MS
    ) {
      return;
    }
    lastTap = { cell, time };

    if (!selected) {
      setSelected(cell);
      return;
    }
    if (cellsEqual(selected, cell)) {
      setSelected(null);
      return;
    }
    if (isAdjacent(selected, cell)) {
      callbacks.onSwap(selected, cell);
      setSelected(null);
      return;
    }
    setSelected(cell);
  }

  return {
    handlePointerDown(event, rect) {
      if (state.kind !== "none") {
        return;
      }
      const cell = cellFromPoint(event, rect);
      if (!cell) {
        return;
      }
      state = {
        kind: "pressed",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startCell: cell,
      };
    },

    handlePointerMove(event) {
      if (state.kind !== "pressed" || state.pointerId !== event.pointerId) {
        return;
      }
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      if (Math.hypot(dx, dy) <= SWIPE_THRESHOLD_PX) {
        return;
      }
      const target = dominantNeighbor(state.startCell, dx, dy);
      if (target) {
        callbacks.onSwap(state.startCell, target);
        setSelected(null);
      }
      state = { kind: "none" };
    },

    handlePointerUp(event) {
      if (state.kind === "pressed" && state.pointerId === event.pointerId) {
        handleTap(state.startCell, event.timeStamp);
      }
      if (state.kind !== "none" && state.pointerId === event.pointerId) {
        state = { kind: "none" };
      }
    },

    handlePointerCancel(event) {
      if (state.kind !== "none" && state.pointerId === event.pointerId) {
        state = { kind: "none" };
      }
    },
  };
}
