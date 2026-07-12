import { BOARD_SIZE, type Cell } from "../engine/board.ts";
import type { Sprite } from "../game/animations.ts";
import { type BeamEffect, drawBeams } from "./effects.ts";
import { gemShapePath, laserArrowPath, type Theme } from "./theme.ts";

export interface RenderOptions {
  cellSize: number;
  theme: Theme;
  selected: Cell | null;
  beams: readonly BeamEffect[];
}

// Draw order per spec/04 §1.3 (shake/particles land in a later phase):
// clear -> board background -> gem sprites -> laser beams -> selection ring.
export function renderBoard(
  ctx: CanvasRenderingContext2D,
  sprites: ReadonlyMap<number, Sprite>,
  options: RenderOptions,
): void {
  const { cellSize, theme, selected, beams } = options;
  const boardPx = cellSize * BOARD_SIZE;

  ctx.clearRect(0, 0, boardPx, boardPx);
  drawBackground(ctx, theme, cellSize);
  drawGems(ctx, sprites, theme, cellSize);
  drawBeams(ctx, beams, theme, cellSize);
  if (selected) {
    drawSelectionRing(ctx, selected, theme, cellSize);
  }
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  cellSize: number,
): void {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      ctx.fillStyle =
        (row + col) % 2 === 0 ? theme.boardTileA : theme.boardTileB;
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
    }
  }
}

function drawGems(
  ctx: CanvasRenderingContext2D,
  sprites: ReadonlyMap<number, Sprite>,
  theme: Theme,
  cellSize: number,
): void {
  // Map#forEach avoids allocating a JS-visible iterator object every frame
  // (unlike `for...of sprites.values()`), keeping this hot-path call free of
  // per-frame allocations (spec/04 §4).
  sprites.forEach((sprite) => {
    if (sprite.alpha <= 0) {
      return;
    }
    const x = (sprite.x + 0.5) * cellSize;
    const y = (sprite.y + 0.5) * cellSize;
    ctx.save();
    ctx.globalAlpha = sprite.alpha;
    ctx.translate(x, y);
    if (sprite.scale !== 1) {
      ctx.scale(sprite.scale, sprite.scale);
    }
    ctx.fillStyle = theme.gemColors[sprite.kind];
    ctx.fill(gemShapePath(sprite.kind, cellSize));
    if (sprite.special !== "none") {
      drawLaserArrow(ctx, sprite.special === "laserH" ? "h" : "v", cellSize);
    }
    ctx.restore();
  });
}

// Stroked in a fixed near-white so the sweep axis reads over any gem color
// (spec/03 color-blind support pairs shape with a color-independent cue).
function drawLaserArrow(
  ctx: CanvasRenderingContext2D,
  orientation: "h" | "v",
  cellSize: number,
): void {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = Math.max(1.5, cellSize * 0.05);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(laserArrowPath(orientation, cellSize));
  ctx.restore();
}

function drawSelectionRing(
  ctx: CanvasRenderingContext2D,
  cell: Cell,
  theme: Theme,
  cellSize: number,
): void {
  ctx.save();
  ctx.strokeStyle = theme.selectionRing;
  ctx.lineWidth = Math.max(2, cellSize * 0.05);
  ctx.beginPath();
  ctx.arc(
    (cell.col + 0.5) * cellSize,
    (cell.row + 0.5) * cellSize,
    cellSize * 0.46,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();
}
