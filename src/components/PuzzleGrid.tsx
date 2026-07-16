import type { JSX } from "solid-js";
import { createEffect, onCleanup, onMount } from "solid-js";
import {
  BOARD_SIZE,
  type Board,
  type Cell,
  createBoard,
  createIdGenerator,
  type NextId,
} from "../engine/board.ts";
import { mulberry32, type Rng } from "../engine/rng.ts";
import { clampDt } from "../game/animations.ts";
import { createAudioEngine } from "../game/audio.ts";
import { createGameLoop } from "../game/gameLoop.ts";
import { vibrateMatch } from "../game/haptics.ts";
import { type BoardRect, createInputController } from "../game/input.ts";
import { type RenderOptions, renderBoard } from "../render/renderBoard.ts";
import { getTheme } from "../render/theme.ts";
import { resolveTheme } from "../render/themeLoader.ts";
import {
  applyStepResult,
  type PuzzleStore,
  recordDailyBest,
  recordShuffle,
  resetCombo,
} from "../store/puzzleStore.ts";
import styles from "../styles/Puzzle.module.css";

export interface PuzzleGridProps {
  store: PuzzleStore;
  // Injected for the daily challenge (spec/02 §8); endless mode omits these
  // and falls back to a Date.now() seed, as before.
  board?: Board;
  rng?: Rng;
  nextId?: NextId;
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

    const rng = props.rng ?? mulberry32(Date.now());
    const nextId = props.nextId ?? createIdGenerator();
    const board = props.board ?? createBoard(rng, nextId);
    const audio = createAudioEngine();
    const loop = createGameLoop(board, rng, nextId, state.settings, {
      onStepResolved(info) {
        const unlocked = applyStepResult(props.store, info);
        if (info.gemsCleared > 0) {
          audio.playMatch(info.combo);
        }
        if (info.lasersFired > 0) {
          audio.playLaser();
        }
        if (info.prismsFired > 0) {
          audio.playPrism();
        }
        if (unlocked) {
          audio.playAchievement();
        }
        vibrateMatch(loop.settingsSnapshot.haptics, Boolean(info.juice));
      },
      onCascadeEnd() {
        resetCombo(setState);
        if (recordDailyBest(props.store)) {
          audio.playAchievement();
        }
      },
      onShuffle() {
        if (recordShuffle(props.store)) {
          audio.playAchievement();
        }
      },
    });

    const renderOptions: RenderOptions = {
      cellSize: 0,
      dpr: window.devicePixelRatio || 1,
      theme: getTheme(loop.settingsSnapshot.theme),
      colorBlindShapes: state.settings.colorBlindShapes,
      selected: null,
      beams: loop.beams,
      particles: loop.particles,
      shake: loop.shake,
    };

    // Bridge from the reactive store to the non-reactive rAF loop (spec/02
    // §5): the hot loop reads this plain snapshot, never the store proxy.
    createEffect(() => {
      Object.assign(loop.settingsSnapshot, state.settings);
      renderOptions.colorBlindShapes = state.settings.colorBlindShapes;
      audio.setEnabled(state.settings.sound);
    });

    // Dedicated effect reading only skin/theme (spec/02 §8) - other toggle
    // changes above must not trigger a theme reload. Sets the built-in theme
    // immediately, then swaps in the resolved one once ready; a generation
    // token discards a resolution that finishes after a newer one started.
    let themeGeneration = 0;
    createEffect(() => {
      const skin = state.settings.skin;
      const mode = state.settings.theme;
      const generation = ++themeGeneration;
      renderOptions.theme = getTheme(mode);
      resolveTheme(skin, mode).then((theme) => {
        if (generation === themeGeneration) {
          renderOptions.theme = theme;
        }
      });
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
      renderOptions.dpr = dpr;
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
      // Lazy AudioContext init/resume must happen inside a user gesture
      // (spec/04 §5) - the pointerdown that starts a swap gesture is it.
      audio.unlock();
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
