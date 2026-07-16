import { onCleanup, onMount, Show } from "solid-js";
import type { AchievementToast as AchievementToastData } from "../store/puzzleStore.ts";
import styles from "../styles/Puzzle.module.css";

export interface AchievementToastProps {
  toasts: AchievementToastData[];
  onExpire(id: string): void;
}

// Reduced-motion CSS may not fire `animationend` the same way, so a timeout
// is a safety net for self-removal (mirrors JuiceOverlay's pattern) - long
// enough to outlast either animation variant (4100ms / 3660ms).
const FALLBACK_EXPIRE_MS = 4500;

// spec/03 §8: a serial queue - one glass chip at a time (unlike JuiceOverlay,
// which shows several combo texts at once), pointer-events none so it never
// blocks input. `keyed` re-mounts (fresh timer, fresh CSS animation) whenever
// the front-of-queue toast changes to a different one.
function AchievementToast(props: AchievementToastProps) {
  return (
    <Show when={props.toasts[0]} keyed>
      {(toast) => {
        onMount(() => {
          const timer = setTimeout(
            () => props.onExpire(toast.id),
            FALLBACK_EXPIRE_MS,
          );
          onCleanup(() => clearTimeout(timer));
        });
        return (
          <div
            class={styles.achievementToast}
            aria-live="polite"
            onAnimationEnd={() => props.onExpire(toast.id)}
          >
            ✦ {toast.title}
          </div>
        );
      }}
    </Show>
  );
}

export default AchievementToast;
