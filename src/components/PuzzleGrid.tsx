import type { JSX } from "solid-js";
import { createEffect, onCleanup, onMount } from "solid-js";
import {
  BOARD_SIZE,
  type Cell,
  createBoard,
  createIdGenerator,
} from "../engine/board.ts";
import { mulberry32 } from "../engine/rng.ts";
import { clampDt } from "../game/animations.ts";
import { createGameLoop } from "../game/gameLoop.ts";
import { type BoardRect, createInputController } from "../game/input.ts";
import { type RenderOptions, renderBoard } from "../render/renderBoard.ts";
import { getTheme } from "../render/theme.ts";
import {
  applyStepResult,
  type PuzzleStore,
  recordShuffle,
  resetCombo,
} from "../store/puzzleStore.ts";
import styles from "../styles/Puzzle.module.css";

export interface PuzzleGridProps {
  store: PuzzleStore;
  children?: JSX.Element;
}

function PuzzleGrid(props: PuzzleGridProps) {
  const [state, setState] = props.store;
  let wrapperRef!: HTMLDivElement;
  let canvasRef!: HTMLCanvasElement;

  onMount(() => {
    const maybeCtx = canvasRef.getContext("2d");
    if (!maybeCtx) {
      throw new Error("2D canvas context not available");
    }
    const ctx: CanvasRenderingContext2D = maybeCtx;

    const rng = mulberry32(Date.now());
    const nextId = createIdGenerator();
    const loop = createGameLoop(
      createBoard(rng, nextId),
      rng,
      nextId,
      state.settings,
      {
        onStepResolved(info) {
          applyStepResult(setState, info);
        },
        onCascadeEnd() {
          resetCombo(setState);
        },
        onShuffle() {
          recordShuffle(setState);
        },
      },
    );

    const renderOptions: RenderOptions = {
      cellSize: 0,
      theme: getTheme(loop.settingsSnapshot.theme),
      selected: null,
    };

    // Bridge from the reactive store to the non-reactive rAF loop (spec/02
    // §5): the hot loop reads this plain snapshot, never the store proxy.
    createEffect(() => {
      Object.assign(loop.settingsSnapshot, state.settings);
      renderOptions.theme = getTheme(loop.settingsSnapshot.theme);
    });

    let selectedCell: Cell | null = null;
    const input = createInputController({
      onSelectionChange(cell) {
        selectedCell = cell;
      },
      onSwap(a, b) {
        loop.requestSwap(a, b);
      },
    });

    let cellSize = 0;
    let dirty = true;

    function resizeCanvasIfDirty(): void {
      if (!dirty) {
        return;
      }
      const rect = wrapperRef.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvasRef.width = Math.max(1, Math.round(rect.width * dpr));
      canvasRef.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cellSize = rect.width / BOARD_SIZE;
      dirty = false;
    }

    const resizeObserver = new ResizeObserver(() => {
      dirty = true;
    });
    resizeObserver.observe(wrapperRef);

    // Belt & suspenders (spec/04 §1.1): pinch-zoom / moving the window to a
    // different-DPR monitor doesn't always fire a resize event.
    let dprMediaQuery: MediaQueryList | null = null;
    function onDprChange(): void {
      dirty = true;
      armDprWatcher();
    }
    function armDprWatcher(): void {
      dprMediaQuery?.removeEventListener("change", onDprChange);
      dprMediaQuery = matchMedia(
        `(resolution: ${window.devicePixelRatio || 1}dppx)`,
      );
      dprMediaQuery.addEventListener("change", onDprChange);
    }
    armDprWatcher();

    function boardRect(): BoardRect {
      const rect = canvasRef.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    }

    function onPointerDown(event: PointerEvent): void {
      canvasRef.setPointerCapture(event.pointerId);
      input.handlePointerDown(event, boardRect());
    }
    function onPointerMove(event: PointerEvent): void {
      input.handlePointerMove(event);
    }
    function onPointerUp(event: PointerEvent): void {
      input.handlePointerUp(event);
    }
    function onPointerCancel(event: PointerEvent): void {
      input.handlePointerCancel(event);
    }

    canvasRef.addEventListener("pointerdown", onPointerDown);
    canvasRef.addEventListener("pointermove", onPointerMove);
    canvasRef.addEventListener("pointerup", onPointerUp);
    canvasRef.addEventListener("pointercancel", onPointerCancel);

    let rafId = 0;
    let lastTime: number | null = null;
    function frame(time: number): void {
      const rawDt = lastTime === null ? 0 : time - lastTime;
      lastTime = time;
      loop.update(clampDt(rawDt));

      resizeCanvasIfDirty();
      renderOptions.cellSize = cellSize;
      renderOptions.selected = selectedCell;
      renderBoard(ctx, loop.sprites, renderOptions);
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    onCleanup(() => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      dprMediaQuery?.removeEventListener("change", onDprChange);
      canvasRef.removeEventListener("pointerdown", onPointerDown);
      canvasRef.removeEventListener("pointermove", onPointerMove);
      canvasRef.removeEventListener("pointerup", onPointerUp);
      canvasRef.removeEventListener("pointercancel", onPointerCancel);
    });
  });

  return (
    <div class={styles.wrapper} ref={wrapperRef}>
      {/* biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: spec/03 §6 requires role="application" directly on the canvas */}
      <canvas
        class={styles.canvas}
        ref={canvasRef}
        role="application"
        aria-label="Puzzle board"
      />
      {props.children}
    </div>
  );
}

export default PuzzleGrid;
