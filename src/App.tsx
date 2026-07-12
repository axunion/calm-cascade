import { createEffect } from "solid-js";
import PuzzleGrid from "./components/PuzzleGrid.tsx";
import { createPuzzleStore } from "./store/puzzleStore.ts";

function App() {
  const [store] = createPuzzleStore();

  createEffect(() => {
    document.documentElement.dataset.theme = store.settings.theme;
  });

  return <PuzzleGrid settings={store.settings} />;
}

export default App;
