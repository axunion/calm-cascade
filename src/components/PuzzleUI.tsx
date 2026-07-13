import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { easeOutQuad, REDUCED_MOTION_MS } from "../game/animations.ts";
import type { PuzzleStore } from "../store/puzzleStore.ts";
import styles from "../styles/Puzzle.module.css";
import InfoDialog from "./InfoDialog.tsx";
import SettingsDialog from "./SettingsDialog.tsx";

export interface PuzzleUIProps {
  store: PuzzleStore;
}

const COUNT_UP_MS = 400;

// UI-local tween (spec/03 §2, §7): unrelated to the game loop's hot path, so
// a small rAF loop scoped to this component is enough - no need to route
// this through gameLoop.ts's tween system.
function createScoreDisplay(score: () => number, reducedMotion: () => boolean) {
  const [display, setDisplay] = createSignal(score());
  let from = score();
  let to = from;
  let start = 0;
  let duration = COUNT_UP_MS;
  let rafId = 0;

  function step(time: number): void {
    const t = duration <= 0 ? 1 : Math.min(1, (time - start) / duration);
    setDisplay(Math.round(from + (to - from) * easeOutQuad(t)));
    if (t < 1) {
      rafId = requestAnimationFrame(step);
    }
  }

  createEffect(() => {
    const next = score();
    if (next === to) {
      return;
    }
    from = display();
    to = next;
    start = performance.now();
    duration = reducedMotion() ? REDUCED_MOTION_MS : COUNT_UP_MS;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(step);
  });

  onCleanup(() => cancelAnimationFrame(rafId));
  return display;
}

// Glassmorphism HUD + bottom trigger buttons (spec/02 §2, spec/03 §2-4):
// sits below the canvas (never overlapping it) in the root grid's third row.
function PuzzleUI(props: PuzzleUIProps) {
  const [state, setState] = props.store;
  const scoreDisplay = createScoreDisplay(
    () => state.score,
    () => state.settings.reducedMotion,
  );

  return (
    <div class={styles.hud}>
      <div class={styles.hudGlass}>
        <div class={styles.scoreBlock}>
          <span class={styles.scoreLabel}>Score</span>
          <span class={styles.scoreValue}>{scoreDisplay()}</span>
        </div>
        <Show when={state.combo > 1}>
          <div class={styles.comboBadge}>Combo ×{state.combo}</div>
        </Show>
      </div>
      <div class={styles.buttonRow}>
        <InfoDialog stats={state.stats} />
        <SettingsDialog settings={state.settings} setStore={setState} />
      </div>
    </div>
  );
}

export default PuzzleUI;
