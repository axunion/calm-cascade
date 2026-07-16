import { GEM_KINDS } from "../engine/board.ts";

export type ThemeMode = "dark" | "light";

export interface Theme {
  boardTileA: string;
  boardTileB: string;
  selectionRing: string;
  gemColors: string[];
  gems: readonly (ImageBitmap | null)[];
  background: ImageBitmap | null;
}

// Shared across both built-in themes so the hot render loop never has to
// optional-chain into `theme.gems` - classic is always vector-only.
const NO_GEM_BITMAPS: readonly (ImageBitmap | null)[] = Object.freeze(
  new Array(GEM_KINDS).fill(null),
);

const LIGHT_THEME: Theme = {
  boardTileA: "#efeaf5",
  boardTileB: "#e6dff0",
  selectionRing: "#aa3bff",
  gemColors: ["#f28b9d", "#f5b46a", "#f2d675", "#9ed6a0", "#8fc7ea", "#c6a6e0"],
  gems: NO_GEM_BITMAPS,
  background: null,
};

const DARK_THEME: Theme = {
  boardTileA: "#1f2028",
  boardTileB: "#262834",
  selectionRing: "#c084fc",
  gemColors: ["#e07a90", "#e0a25f", "#e0c869", "#7fbf8a", "#7ab3d9", "#b494d6"],
  gems: NO_GEM_BITMAPS,
  background: null,
};

export function getTheme(mode: ThemeMode): Theme {
  return mode === "dark" ? DARK_THEME : LIGHT_THEME;
}

// One Path2D shape per gem kind (spec/03 §6: color + shape are both always
// drawn, so color-blind players can tell gems apart without relying on hue).
// Centered at the origin; callers translate to the gem's screen position.
type ShapeBuilder = (cellSize: number) => Path2D;

const SHAPE_BUILDERS: ShapeBuilder[] = [
  circlePath,
  trianglePath,
  squarePath,
  diamondPath,
  starPath,
  dropPath,
];

// Cached per (kind, cellSize): cellSize only changes on resize, so this
// keeps the rAF render loop allocation-free (spec/04 §4).
const shapeCache = new Map<number, Path2D>();
let shapeCacheCellSize = -1;

export function gemShapePath(kind: number, cellSize: number): Path2D {
  if (cellSize !== shapeCacheCellSize) {
    shapeCache.clear();
    shapeCacheCellSize = cellSize;
  }
  let path = shapeCache.get(kind);
  if (!path) {
    const builder = SHAPE_BUILDERS[kind % GEM_KINDS];
    path = builder(cellSize);
    shapeCache.set(kind, path);
  }
  return path;
}

function circlePath(cellSize: number): Path2D {
  const path = new Path2D();
  path.arc(0, 0, cellSize * 0.36, 0, Math.PI * 2);
  return path;
}

function trianglePath(cellSize: number): Path2D {
  const r = cellSize * 0.4;
  const path = new Path2D();
  path.moveTo(0, -r);
  path.lineTo(r * 0.87, r * 0.5);
  path.lineTo(-r * 0.87, r * 0.5);
  path.closePath();
  return path;
}

function squarePath(cellSize: number): Path2D {
  const r = cellSize * 0.32;
  const path = new Path2D();
  path.rect(-r, -r, r * 2, r * 2);
  return path;
}

function diamondPath(cellSize: number): Path2D {
  const r = cellSize * 0.38;
  const path = new Path2D();
  path.moveTo(0, -r);
  path.lineTo(r, 0);
  path.lineTo(0, r);
  path.lineTo(-r, 0);
  path.closePath();
  return path;
}

function starPath(cellSize: number): Path2D {
  const outer = cellSize * 0.4;
  const inner = outer * 0.45;
  const path = new Path2D();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  }
  path.closePath();
  return path;
}

function dropPath(cellSize: number): Path2D {
  const r = cellSize * 0.34;
  const path = new Path2D();
  path.moveTo(0, -r * 1.3);
  path.quadraticCurveTo(r * 1.1, r * 0.3, 0, r);
  path.quadraticCurveTo(-r * 1.1, r * 0.3, 0, -r * 1.3);
  path.closePath();
  return path;
}

// Double-headed arrow drawn on top of a laser gem's shape (spec/01 §4.3,
// spec/03 color-blind support): the sweep axis is legible independent of
// color, the same way gem shapes stand in for kind.
export type LaserOrientation = "h" | "v";

// Only two orientations ever exist, so a pair of slots is enough - no need
// for gemShapePath's Map (which keys on the much larger set of gem kinds).
let cachedH: Path2D | null = null;
let cachedV: Path2D | null = null;
let laserArrowCacheCellSize = -1;

export function laserArrowPath(
  orientation: LaserOrientation,
  cellSize: number,
): Path2D {
  if (cellSize !== laserArrowCacheCellSize) {
    cachedH = null;
    cachedV = null;
    laserArrowCacheCellSize = cellSize;
  }
  if (orientation === "h") {
    cachedH ??= axisArrowPath(cellSize, true);
    return cachedH;
  }
  cachedV ??= axisArrowPath(cellSize, false);
  return cachedV;
}

function axisArrowPath(cellSize: number, horizontal: boolean): Path2D {
  const half = cellSize * 0.34;
  const head = cellSize * 0.1;
  const path = new Path2D();
  const point = (along: number, across: number) =>
    horizontal ? ([along, across] as const) : ([across, along] as const);

  path.moveTo(...point(-half, 0));
  path.lineTo(...point(half, 0));
  path.moveTo(...point(half - head, -head));
  path.lineTo(...point(half, 0));
  path.lineTo(...point(half - head, head));
  path.moveTo(...point(-half + head, -head));
  path.lineTo(...point(-half, 0));
  path.lineTo(...point(-half + head, head));
  return path;
}

// Drawn on top of a bomb gem's shape (spec/01 §4.3, spec/03 color-blind
// support): a small bud with four petal strokes, evoking the "bloom" the
// bomb's clear plays as (never an explosion glyph, per the Calm pillar) -
// color-independent, the same way gem shapes stand in for kind.
let cachedBombIcon: Path2D | null = null;
let bombIconCacheCellSize = -1;

export function bombIconPath(cellSize: number): Path2D {
  if (cellSize !== bombIconCacheCellSize) {
    cachedBombIcon = null;
    bombIconCacheCellSize = cellSize;
  }
  cachedBombIcon ??= buildBombIconPath(cellSize);
  return cachedBombIcon;
}

function buildBombIconPath(cellSize: number): Path2D {
  const r = cellSize * 0.14;
  const petal = cellSize * 0.1;
  const path = new Path2D();
  path.arc(0, 0, r, 0, Math.PI * 2);
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI / 2) * i + Math.PI / 4;
    const innerX = Math.cos(angle) * r;
    const innerY = Math.sin(angle) * r;
    const outerX = Math.cos(angle) * (r + petal);
    const outerY = Math.sin(angle) * (r + petal);
    path.moveTo(innerX, innerY);
    path.lineTo(outerX, outerY);
  }
  return path;
}
