import { describe, expect, it } from "vitest";
import {
  CLASSIC_SKIN,
  getAssetUrl,
  getManifest,
  getUiAccent,
  listSkins,
} from "./themeRegistry.ts";

describe("listSkins", () => {
  it("always leads with classic, followed by bundled packs in ascending id order", () => {
    const skins = listSkins();
    expect(skins[0]).toBe(CLASSIC_SKIN);
    expect(skins).toContain("pastel-bloom");
    const packIds = skins.slice(1);
    expect(packIds).toEqual([...packIds].sort());
  });
});

describe("getManifest", () => {
  it("returns null for classic (short-circuits to the built-in theme)", () => {
    expect(getManifest(CLASSIC_SKIN)).toBeNull();
  });

  it("returns null for an unknown skin id", () => {
    expect(getManifest("not-a-real-pack")).toBeNull();
  });

  it("returns the validated manifest for a bundled pack", () => {
    const manifest = getManifest("pastel-bloom");
    expect(manifest).not.toBeNull();
    expect(manifest?.displayName).toBe("Pastel Bloom");
  });
});

describe("getAssetUrl", () => {
  it("returns null for an unknown file", () => {
    expect(getAssetUrl("pastel-bloom", "does-not-exist.png")).toBeNull();
  });
});

describe("getUiAccent", () => {
  it("prefers colorsLight.uiAccent in light mode", () => {
    expect(getUiAccent("pastel-bloom", "light")).toBe("#c17fe0");
  });

  it("uses colors.uiAccent in dark mode", () => {
    expect(getUiAccent("pastel-bloom", "dark")).toBe("#e0b3f5");
  });

  it("returns undefined for classic and unknown skins", () => {
    expect(getUiAccent(CLASSIC_SKIN, "light")).toBeUndefined();
    expect(getUiAccent("not-a-real-pack", "light")).toBeUndefined();
  });
});
