import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDebouncedSave,
  loadPersistedState,
  type PersistedState,
  type StorageLike,
  savePersistedState,
} from "./persistence.ts";

function createMemoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const samplePersisted: PersistedState = {
  settings: {
    theme: "dark",
    reducedMotion: false,
    haptics: true,
    colorBlindShapes: false,
    sound: true,
    particles: true,
  },
  stats: {
    totalScore: 120,
    bestCombo: 4,
    gemsCleared: 30,
    lasersFired: 2,
    gamesShuffled: 1,
  },
};

describe("loadPersistedState", () => {
  it("returns null when nothing is stored", () => {
    expect(loadPersistedState(createMemoryStorage())).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    const storage = createMemoryStorage();
    storage.data.set("calm-cascade/v1", "{not json");
    expect(loadPersistedState(storage)).toBeNull();
  });

  it("returns null when the schema version does not match", () => {
    const storage = createMemoryStorage();
    storage.data.set(
      "calm-cascade/v1",
      JSON.stringify({ version: 999, ...samplePersisted }),
    );
    expect(loadPersistedState(storage)).toBeNull();
  });

  it("returns null when getItem throws", () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error("private browsing");
      },
      setItem: () => {},
    };
    expect(loadPersistedState(storage)).toBeNull();
  });

  it("returns settings and stats from a valid payload", () => {
    const storage = createMemoryStorage();
    savePersistedState(storage, samplePersisted);
    expect(loadPersistedState(storage)).toEqual(samplePersisted);
  });
});

describe("savePersistedState", () => {
  it("writes the state under the schema version", () => {
    const storage = createMemoryStorage();
    savePersistedState(storage, samplePersisted);
    const raw = storage.data.get("calm-cascade/v1");
    expect(raw).toBeDefined();
    expect(JSON.parse(raw as string)).toEqual({
      version: 1,
      ...samplePersisted,
    });
  });

  it("swallows a throwing setItem", () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
    };
    expect(() => savePersistedState(storage, samplePersisted)).not.toThrow();
  });
});

describe("createDebouncedSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("only writes once for rapid successive calls within the window", () => {
    const storage = createMemoryStorage();
    const setItemSpy = vi.spyOn(storage, "setItem");
    const save = createDebouncedSave(storage);

    save(samplePersisted);
    vi.advanceTimersByTime(200);
    save({
      ...samplePersisted,
      stats: { ...samplePersisted.stats, totalScore: 200 },
    });
    vi.advanceTimersByTime(499);
    expect(setItemSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(loadPersistedState(storage)?.stats.totalScore).toBe(200);
  });
});
