import {
  type DailyRecord,
  DEFAULT_SKIN,
  type PuzzleSettings,
  type PuzzleStats,
} from "./puzzleStore.ts";

const STORAGE_KEY = "calm-cascade/v1";
const SCHEMA_VERSION = 2;
const SAVE_DEBOUNCE_MS = 500;

export interface PersistedState {
  settings: PuzzleSettings;
  stats: PuzzleStats;
  unlockedAchievements: string[];
  daily: DailyRecord | null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface PersistedPayload extends PersistedState {
  version: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasSettingsAndStats(payload: Record<string, unknown>): boolean {
  return isRecord(payload.settings) && isRecord(payload.stats);
}

// spec/04 §7.5: a v1 payload is missing skin, the four new stats, unlocked
// achievements and the daily record - fill them with defaults rather than
// rejecting the whole payload.
function migrateV1(payload: Record<string, unknown>): PersistedState {
  const v1Settings = payload.settings as Partial<PuzzleSettings>;
  const v1Stats = payload.stats as Partial<PuzzleStats>;
  return {
    settings: {
      skin: DEFAULT_SKIN,
      ...v1Settings,
    } as PuzzleSettings,
    stats: {
      bombsDetonated: 0,
      prismsFired: 0,
      iceBroken: 0,
      dailiesPlayed: 0,
      ...v1Stats,
    } as PuzzleStats,
    unlockedAchievements: [],
    daily: null,
  };
}

function normalizeV2(payload: Record<string, unknown>): PersistedState {
  return {
    settings: payload.settings as PuzzleSettings,
    stats: payload.stats as PuzzleStats,
    unlockedAchievements: Array.isArray(payload.unlockedAchievements)
      ? (payload.unlockedAchievements as string[])
      : [],
    daily: isRecord(payload.daily)
      ? (payload.daily as unknown as DailyRecord)
      : null,
  };
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
    if (!isRecord(parsed) || !hasSettingsAndStats(parsed)) {
      return null;
    }
    if (parsed.version === 1) {
      return migrateV1(parsed);
    }
    if (parsed.version === SCHEMA_VERSION) {
      return normalizeV2(parsed);
    }
    return null;
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
