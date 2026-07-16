export const GEM_SLOT_COUNT = 6;

export interface ThemePackColors {
  gemColors: string[];
  boardTileA: string;
  boardTileB: string;
  selectionRing: string;
  uiAccent?: string;
}

export interface ThemeManifest {
  manifestVersion: 1;
  displayName: string;
  gems: (string | null)[];
  background: string | null;
  colors: ThemePackColors;
  colorsLight?: Partial<ThemePackColors>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNullableStringArray(value: unknown, length: number): boolean {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((item) => item === null || typeof item === "string")
  );
}

function isStringArray(value: unknown, length: number): boolean {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((item) => typeof item === "string")
  );
}

function isValidColors(value: unknown): value is ThemePackColors {
  if (!isRecord(value)) {
    return false;
  }
  if (!isStringArray(value.gemColors, GEM_SLOT_COUNT)) {
    return false;
  }
  if (
    typeof value.boardTileA !== "string" ||
    typeof value.boardTileB !== "string" ||
    typeof value.selectionRing !== "string"
  ) {
    return false;
  }
  return value.uiAccent === undefined || typeof value.uiAccent === "string";
}

function isValidPartialColors(
  value: unknown,
): value is Partial<ThemePackColors> {
  if (!isRecord(value)) {
    return false;
  }
  if (
    value.gemColors !== undefined &&
    !isStringArray(value.gemColors, GEM_SLOT_COUNT)
  ) {
    return false;
  }
  if (value.boardTileA !== undefined && typeof value.boardTileA !== "string") {
    return false;
  }
  if (value.boardTileB !== undefined && typeof value.boardTileB !== "string") {
    return false;
  }
  if (
    value.selectionRing !== undefined &&
    typeof value.selectionRing !== "string"
  ) {
    return false;
  }
  return value.uiAccent === undefined || typeof value.uiAccent === "string";
}

// spec/04 §7.2: hand-written type guard, no schema-validation dependency.
// Invalid manifests return null so the caller (themeRegistry) can warn and
// exclude the pack rather than crash the app.
export function validateManifest(value: unknown): ThemeManifest | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.manifestVersion !== 1) {
    return null;
  }
  if (!isNonEmptyString(value.displayName)) {
    return null;
  }
  if (!isNullableStringArray(value.gems, GEM_SLOT_COUNT)) {
    return null;
  }
  if (value.background !== undefined && value.background !== null) {
    if (typeof value.background !== "string") {
      return null;
    }
  }
  if (!isValidColors(value.colors)) {
    return null;
  }
  if (
    value.colorsLight !== undefined &&
    !isValidPartialColors(value.colorsLight)
  ) {
    return null;
  }

  return {
    manifestVersion: 1,
    displayName: value.displayName,
    gems: value.gems as (string | null)[],
    background: (value.background as string | undefined) ?? null,
    colors: value.colors,
    ...(value.colorsLight !== undefined
      ? { colorsLight: value.colorsLight as Partial<ThemePackColors> }
      : {}),
  };
}
