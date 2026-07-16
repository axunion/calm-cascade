import { BOARD_SIZE } from "../engine/board.ts";
import type { Theme } from "./theme.ts";

// spec/04 §7.4: never shrink-draw an ImageBitmap on the hot path. Re-scale
// only when (theme reference, round(cellSize * dpr)) changes - same
// single-key invalidation pattern as theme.ts's shapeCache.
let cachedTheme: Theme | null = null;
let cachedCellPx = -1;
let gemCanvases: (HTMLCanvasElement | null)[] = [];
let backgroundCanvas: HTMLCanvasElement | null = null;

function ensureCurrent(theme: Theme, cellPx: number): void {
  if (theme === cachedTheme && cellPx === cachedCellPx) {
    return;
  }
  cachedTheme = theme;
  cachedCellPx = cellPx;
  gemCanvases = new Array(theme.gems.length).fill(null);
  backgroundCanvas = null;
}

function scaleBitmap(bitmap: ImageBitmap, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(bitmap, 0, 0, size, size);
  return canvas;
}

export function getScaledGem(
  theme: Theme,
  kind: number,
  cellSize: number,
  dpr: number,
): HTMLCanvasElement | null {
  const bitmap = theme.gems[kind];
  if (!bitmap) {
    return null;
  }
  ensureCurrent(theme, Math.round(cellSize * dpr));
  let canvas = gemCanvases[kind];
  if (!canvas) {
    canvas = scaleBitmap(bitmap, Math.round(cellSize * 0.9 * dpr));
    gemCanvases[kind] = canvas;
  }
  return canvas;
}

export function getScaledBackground(
  theme: Theme,
  cellSize: number,
  dpr: number,
): HTMLCanvasElement | null {
  const bitmap = theme.background;
  if (!bitmap) {
    return null;
  }
  ensureCurrent(theme, Math.round(cellSize * dpr));
  if (!backgroundCanvas) {
    backgroundCanvas = scaleBitmap(
      bitmap,
      Math.round(cellSize * BOARD_SIZE * dpr),
    );
  }
  return backgroundCanvas;
}
