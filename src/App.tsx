import { createEffect } from "solid-js";
import JuiceOverlay from "./components/JuiceOverlay.tsx";
import PuzzleGrid from "./components/PuzzleGrid.tsx";
import PuzzleUI from "./components/PuzzleUI.tsx";
import { getUiAccent } from "./render/themeRegistry.ts";
import {
  createDebouncedSave,
  loadPersistedState,
} from "./store/persistence.ts";
import { createPuzzleStore, expireJuiceEvent } from "./store/puzzleStore.ts";
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
      <PuzzleGrid store={store}>
        <JuiceOverlay
          events={state.juiceEvents}
          onExpire={(id) => expireJuiceEvent(setState, id)}
        />
      </PuzzleGrid>
      <PuzzleUI store={store} />
    </>
  );
}

export default App;
