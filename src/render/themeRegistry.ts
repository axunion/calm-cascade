import type { ThemeMode } from "./theme.ts";
import { type ThemeManifest, validateManifest } from "./themePack.ts";

export const CLASSIC_SKIN = "classic";

const MANIFEST_PATH_RE = /^\/themes\/([^/]+)\/manifest\.json$/;
const ASSET_PATH_RE = /^\/themes\/([^/]+)\/(.+)$/;

// spec/04 §7.1: root-absolute glob patterns resolve identically under dev,
// build, and vitest (node) - a themes/<name>/ directory is discovered just
// by existing, with no index file to maintain.
const manifestModules = import.meta.glob("/themes/*/manifest.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

const assetModules = import.meta.glob("/themes/*/*.{png,webp,jpg,jpeg}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function collectManifests(): Map<string, ThemeManifest> {
  const manifests = new Map<string, ThemeManifest>();
  for (const [path, raw] of Object.entries(manifestModules)) {
    const match = MANIFEST_PATH_RE.exec(path);
    if (!match) {
      continue;
    }
    const skinId = match[1];
    const manifest = validateManifest(raw);
    if (!manifest) {
      console.warn(`themeRegistry: invalid manifest for skin "${skinId}"`);
      continue;
    }
    manifests.set(skinId, manifest);
  }
  return manifests;
}

function collectAssetUrls(): Map<string, string> {
  const assets = new Map<string, string>();
  for (const [path, url] of Object.entries(assetModules)) {
    const match = ASSET_PATH_RE.exec(path);
    if (!match) {
      continue;
    }
    const [, skinId, fileName] = match;
    assets.set(`${skinId}/${fileName}`, url);
  }
  return assets;
}

const manifests = collectManifests();
const assetUrls = collectAssetUrls();

// classic is the built-in vector theme (render/theme.ts) - it has no
// themes/ directory or manifest, so it always leads the list.
export function listSkins(): string[] {
  return [CLASSIC_SKIN, ...[...manifests.keys()].sort()];
}

export function getManifest(skinId: string): ThemeManifest | null {
  return manifests.get(skinId) ?? null;
}

export function getAssetUrl(skinId: string, fileName: string): string | null {
  return assetUrls.get(`${skinId}/${fileName}`) ?? null;
}

export function getUiAccent(
  skinId: string,
  mode: ThemeMode,
): string | undefined {
  const manifest = manifests.get(skinId);
  if (!manifest) {
    return undefined;
  }
  if (mode === "light" && manifest.colorsLight?.uiAccent) {
    return manifest.colorsLight.uiAccent;
  }
  return manifest.colors.uiAccent;
}
