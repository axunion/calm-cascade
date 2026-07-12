import { For, onCleanup, onMount } from "solid-js";
import type { JuiceEvent } from "../store/puzzleStore.ts";
import styles from "../styles/Puzzle.module.css";

export interface JuiceOverlayProps {
  events: JuiceEvent[];
  onExpire(id: number): void;
}

const TIER_CLASS: Record<JuiceEvent["tier"], string> = {
  small: styles.juiceSmall,
  medium: styles.juiceMedium,
  large: styles.juiceLarge,
};

// Reduced-motion CSS may not fire `animationend` the same way, so a timeout
// is a safety net for self-removal (spec/02 §5).
const FALLBACK_EXPIRE_MS = 1500;

// Combo text lives in the DOM, not on canvas, so it stays crisp and
// accessible (spec/02 §5). This div sits inside PuzzleGrid's wrapper and
// exactly covers the canvas via CSS.
function JuiceOverlay(props: JuiceOverlayProps) {
  return (
    <div class={styles.juiceOverlay} aria-hidden="true">
      <For each={props.events}>
        {(event) => {
          onMount(() => {
            const timer = setTimeout(
              () => props.onExpire(event.id),
              FALLBACK_EXPIRE_MS,
            );
            onCleanup(() => clearTimeout(timer));
          });
          return (
            <div
              class={`${styles.juiceText} ${TIER_CLASS[event.tier]}`}
              style={{ left: `${event.xPct}%`, top: `${event.yPct}%` }}
              onAnimationEnd={() => props.onExpire(event.id)}
            >
              {event.text}
            </div>
          );
        }}
      </For>
    </div>
  );
}

export default JuiceOverlay;
