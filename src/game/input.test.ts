import { describe, expect, it } from "vitest";
import type { Cell } from "../engine/board.ts";
import {
  type BoardRect,
  createInputController,
  DOUBLE_TAP_DEBOUNCE_MS,
  type PointerLikeEvent,
} from "./input.ts";

const RECT: BoardRect = { left: 0, top: 0, width: 800, height: 800 };
const CELL = 100; // 800 / BOARD_SIZE(8)

function pointerEvent(
  clientX: number,
  clientY: number,
  timeStamp = 0,
  pointerId = 1,
): PointerLikeEvent {
  return { pointerId, clientX, clientY, timeStamp };
}

function cellCenter(row: number, col: number): { x: number; y: number } {
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

function createHarness() {
  const selections: (Cell | null)[] = [];
  const swaps: [Cell, Cell][] = [];
  const controller = createInputController({
    onSelectionChange(cell) {
      selections.push(cell);
    },
    onSwap(a, b) {
      swaps.push([a, b]);
    },
  });
  return { controller, selections, swaps };
}

describe("createInputController", () => {
  it("treats a small move (<=10px) followed by pointerup as a tap", () => {
    const { controller, selections } = createHarness();
    const start = cellCenter(2, 2);
    controller.handlePointerDown(pointerEvent(start.x, start.y, 0), RECT);
    controller.handlePointerMove(pointerEvent(start.x + 9, start.y, 10));
    controller.handlePointerUp(pointerEvent(start.x + 9, start.y, 20));

    expect(selections).toEqual([{ row: 2, col: 2 }]);
  });

  it("treats an 11px move as a swipe on the dominant axis", () => {
    const { controller, swaps } = createHarness();
    const start = cellCenter(2, 2);
    controller.handlePointerDown(pointerEvent(start.x, start.y, 0), RECT);
    controller.handlePointerMove(pointerEvent(start.x + 11, start.y, 10));

    expect(swaps).toEqual([
      [
        { row: 2, col: 2 },
        { row: 2, col: 3 },
      ],
    ]);
  });

  it("resolves the dominant axis to vertical when |dy| > |dx|", () => {
    const { controller, swaps } = createHarness();
    const start = cellCenter(2, 2);
    controller.handlePointerDown(pointerEvent(start.x, start.y, 0), RECT);
    controller.handlePointerMove(pointerEvent(start.x, start.y + 11, 10));

    expect(swaps).toEqual([
      [
        { row: 2, col: 2 },
        { row: 3, col: 2 },
      ],
    ]);
  });

  it("tap-tap: selecting then tapping an adjacent cell emits a swap and deselects", () => {
    const { controller, swaps, selections } = createHarness();
    const a = cellCenter(2, 2);
    const b = cellCenter(2, 3);

    controller.handlePointerDown(pointerEvent(a.x, a.y, 0), RECT);
    controller.handlePointerUp(pointerEvent(a.x, a.y, 10));

    controller.handlePointerDown(pointerEvent(b.x, b.y, 1000), RECT);
    controller.handlePointerUp(pointerEvent(b.x, b.y, 1010));

    expect(swaps).toEqual([
      [
        { row: 2, col: 2 },
        { row: 2, col: 3 },
      ],
    ]);
    expect(selections.at(-1)).toBeNull();
  });

  it("tapping the same selected cell again deselects it", () => {
    const { controller, selections } = createHarness();
    const a = cellCenter(2, 2);

    controller.handlePointerDown(pointerEvent(a.x, a.y, 0), RECT);
    controller.handlePointerUp(pointerEvent(a.x, a.y, 10));

    controller.handlePointerDown(pointerEvent(a.x, a.y, 1000), RECT);
    controller.handlePointerUp(pointerEvent(a.x, a.y, 1010));

    expect(selections).toEqual([{ row: 2, col: 2 }, null]);
  });

  it("ignores a re-tap on the same cell within the debounce window", () => {
    const { controller, selections } = createHarness();
    const a = cellCenter(2, 2);

    controller.handlePointerDown(pointerEvent(a.x, a.y, 0), RECT);
    controller.handlePointerUp(pointerEvent(a.x, a.y, 10));

    const secondTapUpTime = 10 + DOUBLE_TAP_DEBOUNCE_MS - 1;
    controller.handlePointerDown(
      pointerEvent(a.x, a.y, secondTapUpTime - 5),
      RECT,
    );
    controller.handlePointerUp(pointerEvent(a.x, a.y, secondTapUpTime));

    expect(selections).toEqual([{ row: 2, col: 2 }]);
  });

  it("moves the selection when tapping a non-adjacent cell", () => {
    const { controller, selections, swaps } = createHarness();
    const a = cellCenter(0, 0);
    const c = cellCenter(5, 5);

    controller.handlePointerDown(pointerEvent(a.x, a.y, 0), RECT);
    controller.handlePointerUp(pointerEvent(a.x, a.y, 10));

    controller.handlePointerDown(pointerEvent(c.x, c.y, 1000), RECT);
    controller.handlePointerUp(pointerEvent(c.x, c.y, 1010));

    expect(selections).toEqual([
      { row: 0, col: 0 },
      { row: 5, col: 5 },
    ]);
    expect(swaps).toEqual([]);
  });

  it("resets to NONE on pointercancel", () => {
    const { controller, selections } = createHarness();
    const a = cellCenter(2, 2);

    controller.handlePointerDown(pointerEvent(a.x, a.y, 0), RECT);
    controller.handlePointerCancel(pointerEvent(a.x, a.y, 10));
    // A pointerup after cancel must not be treated as a tap.
    controller.handlePointerUp(pointerEvent(a.x, a.y, 20));

    expect(selections).toEqual([]);
  });

  it("ignores events from a second pointer while the first is active", () => {
    const { controller, selections, swaps } = createHarness();
    const a = cellCenter(2, 2);
    const b = cellCenter(5, 5);

    controller.handlePointerDown(pointerEvent(a.x, a.y, 0, 1), RECT);
    controller.handlePointerDown(pointerEvent(b.x, b.y, 5, 2), RECT);
    controller.handlePointerMove(pointerEvent(b.x + 20, b.y, 10, 2));
    controller.handlePointerUp(pointerEvent(b.x + 20, b.y, 15, 2));
    controller.handlePointerUp(pointerEvent(a.x, a.y, 20, 1));

    expect(swaps).toEqual([]);
    expect(selections).toEqual([{ row: 2, col: 2 }]);
  });
});
