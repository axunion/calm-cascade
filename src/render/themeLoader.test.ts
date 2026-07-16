import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTheme } from "./theme.ts";
import type { ThemeManifest } from "./themePack.ts";

vi.mock("./themeRegistry.ts", () => ({
  getManifest: vi.fn(),
  getAssetUrl: vi.fn(),
}));

import type { BitmapLoader } from "./themeLoader.ts";
import { resolveTheme } from "./themeLoader.ts";
import { getAssetUrl, getManifest } from "./themeRegistry.ts";

function manifest(overrides: Partial<ThemeManifest> = {}): ThemeManifest {
  return {
    manifestVersion: 1,
    displayName: "Test Pack",
    gems: ["g0.png", "g1.png", "g2.png", "g3.png", "g4.png", "g5.png"],
    background: "bg.png",
    colors: {
      gemColors: ["#111", "#222", "#333", "#444", "#555", "#666"],
      boardTileA: "#aaa",
      boardTileB: "#bbb",
      selectionRing: "#ccc",
      uiAccent: "#ddd",
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getManifest).mockReset();
  vi.mocked(getAssetUrl).mockReset();
});

describe("resolveTheme", () => {
  it("fills theme.gems and background with bitmaps when every image loads", async () => {
    vi.mocked(getManifest).mockReturnValue(manifest());
    vi.mocked(getAssetUrl).mockImplementation(
      (skinId, fileName) => `/themes/${skinId}/${fileName}`,
    );
    const bitmap = {} as ImageBitmap;
    const loader: BitmapLoader = vi.fn(async () => bitmap);

    const theme = await resolveTheme("full-success", "dark", loader);

    expect(theme.gems).toEqual([
      bitmap,
      bitmap,
      bitmap,
      bitmap,
      bitmap,
      bitmap,
    ]);
    expect(theme.background).toBe(bitmap);
  });

  it("falls back to null only for the one asset that fails to load", async () => {
    vi.mocked(getManifest).mockReturnValue(manifest());
    vi.mocked(getAssetUrl).mockImplementation(
      (skinId, fileName) => `/themes/${skinId}/${fileName}`,
    );
    const bitmap = {} as ImageBitmap;
    const loader: BitmapLoader = vi.fn(async (url: string) =>
      url.endsWith("g2.png") ? null : bitmap,
    );

    const theme = await resolveTheme("partial-failure", "dark", loader);

    expect(theme.gems).toEqual([bitmap, bitmap, null, bitmap, bitmap, bitmap]);
    expect(theme.background).toBe(bitmap);
  });

  it("returns getTheme(mode)'s exact reference for an unknown skin", async () => {
    vi.mocked(getManifest).mockReturnValue(null);
    const loader: BitmapLoader = vi.fn(async () => ({}) as ImageBitmap);

    const theme = await resolveTheme("no-such-pack", "light", loader);

    expect(theme).toBe(getTheme("light"));
    expect(loader).not.toHaveBeenCalled();
  });

  it("merges colorsLight into the resolved colors in light mode", async () => {
    vi.mocked(getManifest).mockReturnValue(
      manifest({ colorsLight: { boardTileA: "#fff", uiAccent: "#eee" } }),
    );
    vi.mocked(getAssetUrl).mockReturnValue(null);
    const loader: BitmapLoader = vi.fn(async () => null);

    const theme = await resolveTheme("light-merge", "light", loader);

    expect(theme.boardTileA).toBe("#fff");
    expect(theme.boardTileB).toBe("#bbb");
  });

  it("does not call the loader again on a second call for the same (skin, mode)", async () => {
    vi.mocked(getManifest).mockReturnValue(manifest());
    vi.mocked(getAssetUrl).mockImplementation(
      (skinId, fileName) => `/themes/${skinId}/${fileName}`,
    );
    const bitmap = {} as ImageBitmap;
    const loader: BitmapLoader = vi.fn(async () => bitmap);

    await resolveTheme("cache-key", "dark", loader);
    await resolveTheme("cache-key", "dark", loader);

    expect(loader).toHaveBeenCalledTimes(7);
  });
});
