import { getTheme, type Theme, type ThemeMode } from "./theme.ts";
import type { ThemePackColors } from "./themePack.ts";
import { getAssetUrl, getManifest } from "./themeRegistry.ts";

export type BitmapLoader = (url: string) => Promise<ImageBitmap | null>;

// spec/04 §7.3: every failure resolves to null - no throw, no user-facing
// error, just a console.warn. The caller falls back per-asset (vector gem /
// checkerboard background) rather than the whole pack failing.
export async function loadBitmap(url: string): Promise<ImageBitmap | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`themeLoader: "${url}" responded with ${response.status}`);
      return null;
    }
    const blob = await response.blob();
    return await createImageBitmap(blob);
  } catch (error) {
    console.warn(`themeLoader: failed to load "${url}"`, error);
    return null;
  }
}

function mergeColors(
  manifestColors: ThemePackColors,
  colorsLight: Partial<ThemePackColors> | undefined,
  mode: ThemeMode,
): ThemePackColors {
  return mode === "light" && colorsLight
    ? { ...manifestColors, ...colorsLight }
    : manifestColors;
}

function resolveAssetBitmap(
  skinId: string,
  fileName: string | null,
  loader: BitmapLoader,
): Promise<ImageBitmap | null> {
  const url = fileName ? getAssetUrl(skinId, fileName) : null;
  return url ? loader(url) : Promise.resolve(null);
}

const themeCache = new Map<string, Theme>();

// spec/02 §8: resolution is async, keyed on (skinId, mode) and cached so
// dark/light toggling or revisiting a skin never redecodes images.
export async function resolveTheme(
  skinId: string,
  mode: ThemeMode,
  loader: BitmapLoader = loadBitmap,
): Promise<Theme> {
  const cacheKey = `${skinId}/${mode}`;
  const cached = themeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const manifest = getManifest(skinId);
  if (!manifest) {
    return getTheme(mode);
  }

  const colors = mergeColors(manifest.colors, manifest.colorsLight, mode);

  const [gems, background] = await Promise.all([
    Promise.all(
      manifest.gems.map((fileName) =>
        resolveAssetBitmap(skinId, fileName, loader),
      ),
    ),
    resolveAssetBitmap(skinId, manifest.background, loader),
  ]);

  const theme: Theme = {
    boardTileA: colors.boardTileA,
    boardTileB: colors.boardTileB,
    selectionRing: colors.selectionRing,
    gemColors: colors.gemColors,
    gems,
    background,
  };

  themeCache.set(cacheKey, theme);
  return theme;
}
