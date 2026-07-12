import { createEffect } from "solid-js";
import JuiceOverlay from "./components/JuiceOverlay.tsx";
import PuzzleGrid from "./components/PuzzleGrid.tsx";
import { createPuzzleStore, expireJuiceEvent } from "./store/puzzleStore.ts";

function App() {
  const store = createPuzzleStore();
  const [state, setState] = store;

  createEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
  });

  return (
    <PuzzleGrid store={store}>
      <JuiceOverlay
        events={state.juiceEvents}
        onExpire={(id) => expireJuiceEvent(setState, id)}
      />
    </PuzzleGrid>
  );
}

export default App;
