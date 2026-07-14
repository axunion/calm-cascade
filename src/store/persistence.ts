import type { PuzzleSettings, PuzzleStats } from "./puzzleStore.ts";

const STORAGE_KEY = "calm-cascade/v1";
const SCHEMA_VERSION = 1;
const SAVE_DEBOUNCE_MS = 500;

export interface PersistedState {
  settings: PuzzleSettings;
  stats: PuzzleStats;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface PersistedPayload extends PersistedState {
  version: number;
}

function isPersistedPayload(value: unknown): value is PersistedPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const payload = value as Record<string, unknown>;
  return (
    payload.version === SCHEMA_VERSION &&
    typeof payload.settings === "object" &&
    payload.settings !== null &&
    typeof payload.stats === "object" &&
    payload.stats !== null
  );
}

// spec/02 §7, spec/04 §7 risk #11: all storage access must be try/catch
// wrapped - private browsing throws on read/write, and a schema mismatch or
// corrupted value must fall back to the caller's defaults rather than crash.
export function loadPersistedState(
  storage: StorageLike,
): PersistedState | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isPersistedPayload(parsed)) {
      return null;
    }
    return { settings: parsed.settings, stats: parsed.stats };
  } catch {
    return null;
  }
}

export function savePersistedState(
  storage: StorageLike,
  state: PersistedState,
): void {
  try {
    const payload: PersistedPayload = { version: SCHEMA_VERSION, ...state };
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore write failures (e.g. private browsing quota throws).
  }
}

// spec/02 §7: save on a 500ms debounce rather than on every store write.
export function createDebouncedSave(
  storage: StorageLike,
): (state: PersistedState) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (state) => {
    clearTimeout(timer);
    timer = setTimeout(
      () => savePersistedState(storage, state),
      SAVE_DEBOUNCE_MS,
    );
  };
}
