import { createEffect } from "solid-js";
import JuiceOverlay from "./components/JuiceOverlay.tsx";
import PuzzleGrid from "./components/PuzzleGrid.tsx";
import PuzzleUI from "./components/PuzzleUI.tsx";
import {
  createDebouncedSave,
  loadPersistedState,
} from "./store/persistence.ts";
import { createPuzzleStore, expireJuiceEvent } from "./store/puzzleStore.ts";
import styles from "./styles/Puzzle.module.css";

function App() {
  const store = createPuzzleStore();
  const [state, setState] = store;

  // spec/02 §7: load once at store creation; settings/stats only (score and
  // combo are session-only).
  const persisted = loadPersistedState(localStorage);
  if (persisted) {
    setState("settings", persisted.settings);
    setState("stats", persisted.stats);
  }

  const scheduleSave = createDebouncedSave(localStorage);
  createEffect(() => {
    scheduleSave({
      settings: { ...state.settings },
      stats: { ...state.stats },
    });
  });

  createEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
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
