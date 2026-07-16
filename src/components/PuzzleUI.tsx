import { Dialog } from "@kobalte/core/dialog";
import { CalendarDays, X } from "lucide-solid";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { easeOutQuad, REDUCED_MOTION_MS } from "../game/animations.ts";
import {
  DAILY_MILESTONES,
  milestonesReached,
  todayKey,
} from "../game/daily.ts";
import {
  type PuzzleStore,
  switchToDaily,
  switchToEndless,
} from "../store/puzzleStore.ts";
import dialogStyles from "../styles/dialogs.module.css";
import styles from "../styles/Puzzle.module.css";
import InfoDialog from "./InfoDialog.tsx";
import SettingsDialog from "./SettingsDialog.tsx";

export interface PuzzleUIProps {
  store: PuzzleStore;
}

// spec/03 §3, §8: date, today's best, up to 3 flowers for the score
// milestones, and a mode-switch button. No countdown, no "not achieved" copy.
function DailyDialog(props: PuzzleUIProps) {
  const [state, setState] = props.store;
  const bestScore = () => state.daily?.bestScore ?? 0;
  const reached = () => milestonesReached(bestScore());

  return (
    <Dialog>
      <Dialog.Trigger
        class={styles.iconButton}
        aria-label="Today's Garden (daily challenge)"
      >
        <CalendarDays size={24} aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay class={dialogStyles.overlay} />
        <div class={dialogStyles.positioner}>
          <Dialog.Content class={dialogStyles.content}>
            <div class={dialogStyles.header}>
              <Dialog.Title class={dialogStyles.title}>
                Today's Garden
              </Dialog.Title>
              <Dialog.CloseButton
                class={dialogStyles.closeButton}
                aria-label="Close"
              >
                <X size={20} aria-hidden="true" />
              </Dialog.CloseButton>
            </div>
            <p class={dialogStyles.dailyDate}>{todayKey()}</p>
            <p class={dialogStyles.dailyBest}>Today's best: {bestScore()}</p>
            <div class={dialogStyles.flowerRow}>
              <For each={DAILY_MILESTONES}>
                {(_, i) => (
                  <span
                    class={dialogStyles.flower}
                    classList={{ [dialogStyles.flowerLit]: i() < reached() }}
                    aria-hidden="true"
                  >
                    🌸
                  </span>
                )}
              </For>
              <span class="sr-only">
                {reached()} of {DAILY_MILESTONES.length} milestones reached
              </span>
            </div>
            <button
              type="button"
              class={dialogStyles.dailySwitchButton}
              onClick={() => {
                if (state.mode === "daily") {
                  switchToEndless(setState);
                } else {
                  switchToDaily(props.store);
                }
              }}
            >
              {state.mode === "daily"
                ? "Back to Endless"
                : "Play Today's Garden"}
            </button>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
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
      {/* spec/03 §5: announce score at step boundaries only, so bind to the
          real store value rather than the count-up display signal. */}
      <span class="sr-only" aria-live="polite">
        Score: {state.score}
      </span>
      <div class={styles.buttonRow}>
        <InfoDialog
          stats={state.stats}
          unlockedAchievements={state.unlockedAchievements}
        />
        <DailyDialog store={props.store} />
        <SettingsDialog
          settings={state.settings}
          setStore={setState}
          unlockedAchievements={state.unlockedAchievements}
        />
      </div>
    </div>
  );
}

export default PuzzleUI;
