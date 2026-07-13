import { createEffect } from "solid-js";
import JuiceOverlay from "./components/JuiceOverlay.tsx";
import PuzzleGrid from "./components/PuzzleGrid.tsx";
import PuzzleUI from "./components/PuzzleUI.tsx";
import { createPuzzleStore, expireJuiceEvent } from "./store/puzzleStore.ts";
import styles from "./styles/Puzzle.module.css";

function App() {
  const store = createPuzzleStore();
  const [state, setState] = store;

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
