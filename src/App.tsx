import { createEffect, Show } from "solid-js";
import AchievementToast from "./components/AchievementToast.tsx";
import JuiceOverlay from "./components/JuiceOverlay.tsx";
import PuzzleGrid from "./components/PuzzleGrid.tsx";
import PuzzleUI from "./components/PuzzleUI.tsx";
import { createDailyRun, todayKey } from "./game/daily.ts";
import { getUiAccent } from "./render/themeRegistry.ts";
import {
  createDebouncedSave,
  loadPersistedState,
} from "./store/persistence.ts";
import {
  createPuzzleStore,
  expireAchievementToast,
  expireJuiceEvent,
} from "./store/puzzleStore.ts";
import styles from "./styles/Puzzle.module.css";

function App() {
  const store = createPuzzleStore();
  const [state, setState] = store;

  // spec/02 §7: load once at store creation; settings/stats/unlocks/daily
  // only (score and combo are session-only).
  const persisted = loadPersistedState(localStorage);
  if (persisted) {
    setState("settings", persisted.settings);
    setState("stats", persisted.stats);
    setState("unlockedAchievements", persisted.unlockedAchievements);
    setState("daily", persisted.daily);
  }

  const scheduleSave = createDebouncedSave(localStorage);
  createEffect(() => {
    scheduleSave({
      settings: { ...state.settings },
      stats: { ...state.stats },
      unlockedAchievements: [...state.unlockedAchievements],
      daily: state.daily,
    });
  });

  createEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
  });

  // spec/03 §6: reduced motion is the OS preference OR the settings toggle.
  // The engine's own tweens/particles/shake already read settings.reducedMotion
  // directly, but CSS-driven animations (dialogs, juice text, achievement
  // toast) only have `prefers-reduced-motion` to go on - this attribute lets
  // their stylesheets react to the in-app toggle too.
  createEffect(() => {
    document.documentElement.dataset.reducedMotion = String(
      state.settings.reducedMotion,
    );
  });

  // spec/03 §5: uiAccent overrides --accent inline; classic/undefined falls
  // back to the CSS default for the current dark/light mode.
  createEffect(() => {
    const accent = getUiAccent(state.settings.skin, state.settings.theme);
    if (accent) {
      document.documentElement.style.setProperty("--accent", accent);
    } else {
      document.documentElement.style.removeProperty("--accent");
    }
  });

  return (
    <>
      <div class={styles.topSpacer} aria-hidden="true">
        Calm Cascade
      </div>
      {/* spec/02 §8: keyed on mode so switching endless <-> daily fully
          remounts PuzzleGrid - no in-flight game state survives the switch. */}
      <Show when={state.mode} keyed>
        {(mode) => {
          const dailyRun = mode === "daily" ? createDailyRun(todayKey()) : null;
          return (
            <PuzzleGrid
              store={store}
              board={dailyRun?.board}
              rng={dailyRun?.rng}
              nextId={dailyRun?.nextId}
            >
              <JuiceOverlay
                events={state.juiceEvents}
                onExpire={(id) => expireJuiceEvent(setState, id)}
              />
              <AchievementToast
                toasts={state.achievementToasts}
                onExpire={(id) => expireAchievementToast(setState, id)}
              />
            </PuzzleGrid>
          );
        }}
      </Show>
      <PuzzleUI store={store} />
    </>
  );
}

export default App;
