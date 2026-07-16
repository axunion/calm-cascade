import { describe, expect, it } from "vitest";
import { validateManifest } from "./themePack.ts";

function validManifest(): Record<string, unknown> {
  return {
    manifestVersion: 1,
    displayName: "Pastel Bloom",
    gems: ["a.png", null, "c.png", null, "e.png", null],
    background: undefined,
    colors: {
      gemColors: ["#111", "#222", "#333", "#444", "#555", "#666"],
      boardTileA: "#efeaf5",
      boardTileB: "#e6dff0",
      selectionRing: "#aa3bff",
    },
  };
}

describe("validateManifest", () => {
  it("accepts a valid manifest and normalizes background: undefined to null", () => {
    const manifest = validateManifest(validManifest());
    expect(manifest).not.toBeNull();
    expect(manifest?.background).toBeNull();
    expect(manifest?.displayName).toBe("Pastel Bloom");
    expect(manifest?.gems).toEqual([
      "a.png",
      null,
      "c.png",
      null,
      "e.png",
      null,
    ]);
  });

  it("rejects a manifestVersion mismatch", () => {
    expect(
      validateManifest({ ...validManifest(), manifestVersion: 2 }),
    ).toBeNull();
  });

  it("rejects an empty displayName", () => {
    expect(
      validateManifest({ ...validManifest(), displayName: "" }),
    ).toBeNull();
  });

  it("rejects gems with a length other than 6", () => {
    expect(
      validateManifest({ ...validManifest(), gems: ["a.png", null] }),
    ).toBeNull();
  });

  it("rejects colors.gemColors with a length other than 6", () => {
    const manifest = validManifest();
    expect(
      validateManifest({
        ...manifest,
        colors: { ...(manifest.colors as object), gemColors: ["#111", "#222"] },
      }),
    ).toBeNull();
  });

  it("only type-checks the keys present in colorsLight (partial override)", () => {
    const manifest = validateManifest({
      ...validManifest(),
      colorsLight: { uiAccent: "#ff00ff" },
    });
    expect(manifest).not.toBeNull();
    expect(manifest?.colorsLight).toEqual({ uiAccent: "#ff00ff" });
  });

  it("rejects colorsLight with an invalid present key", () => {
    expect(
      validateManifest({
        ...validManifest(),
        colorsLight: { boardTileA: 123 },
      }),
    ).toBeNull();
  });

  it("rejects a non-object value", () => {
    expect(validateManifest(null)).toBeNull();
    expect(validateManifest("not an object")).toBeNull();
  });
});
