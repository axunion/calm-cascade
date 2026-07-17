import { BOARD_SIZE, type Cell } from "../engine/board.ts";
import type { Sprite } from "../game/animations.ts";
import type { Particle } from "../game/particles.ts";
import { type BeamEffect, drawBeams, drawParticles } from "./effects.ts";
import { getScaledBackground, getScaledGem } from "./scaledBitmaps.ts";
import {
  bombIconPath,
  gemShapePath,
  laserArrowPath,
  prismIconPath,
  type Theme,
} from "./theme.ts";

export interface RenderOptions {
  cellSize: number;
  dpr: number;
  theme: Theme;
  colorBlindShapes: boolean;
  selected: Cell | null;
  beams: readonly BeamEffect[];
  particles: readonly Particle[];
  shake: { x: number; y: number };
}

// Draw order per spec/04 §1.3: clear -> shake translate -> board background
// -> gem sprites -> laser beams -> particles -> (restore) -> selection ring.
// The shake translate never reaches the selection ring - it stays put like
// the DOM HUD so it doesn't read as jittery.
export function renderBoard(
  ctx: CanvasRenderingContext2D,
  sprites: ReadonlyMap<number, Sprite>,
  options: RenderOptions,
): void {
  const {
    cellSize,
    dpr,
    theme,
    colorBlindShapes,
    selected,
    beams,
    particles,
    shake,
  } = options;
  const boardPx = cellSize * BOARD_SIZE;

  ctx.clearRect(0, 0, boardPx, boardPx);
  ctx.save();
  ctx.translate(shake.x, shake.y);
  drawBackground(ctx, theme, cellSize, dpr);
  drawGems(ctx, sprites, theme, cellSize, dpr, colorBlindShapes);
  drawBeams(ctx, beams, theme, cellSize);
  drawParticles(ctx, particles, theme, cellSize);
  ctx.restore();
  if (selected) {
    drawSelectionRing(ctx, selected, theme, cellSize);
  }
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  cellSize: number,
  dpr: number,
): void {
  const boardPx = cellSize * BOARD_SIZE;
  const background = getScaledBackground(theme, cellSize, dpr);
  if (background) {
    ctx.drawImage(background, 0, 0, boardPx, boardPx);
    return;
  }
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
  dpr: number,
  colorBlindShapes: boolean,
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
    const gemImage = getScaledGem(theme, sprite.kind, cellSize, dpr);
    if (gemImage) {
      const size = cellSize * 0.9;
      ctx.drawImage(gemImage, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = theme.gemColors[sprite.kind];
      ctx.fill(gemShapePath(sprite.kind, cellSize));
    }
    // Frost sits between the gem body and the color-blind cue - drawing it
    // first keeps the cue as the top-most layer so a frosted gem doesn't
    // lose the very cue that makes it legible without color (spec/03 §6).
    if (sprite.ice > 0) {
      drawFrost(ctx, cellSize);
    }
    if (colorBlindShapes) {
      if (gemImage) {
        drawGemGlyph(ctx, sprite.kind, cellSize);
      } else {
        drawGemOutline(ctx, sprite.kind, cellSize);
      }
    }
    if (sprite.special === "laserH" || sprite.special === "laserV") {
      drawLaserArrow(ctx, sprite.special === "laserH" ? "h" : "v", cellSize);
    } else if (sprite.special === "bomb") {
      drawBombIcon(ctx, cellSize);
    } else if (sprite.special === "prism") {
      drawPrismIcon(ctx, cellSize);
    }
    ctx.restore();
  });
}

// A translucent frost coat over the whole gem (spec/01 §7) - ice and special
// never coexist, so this never has to compose with an icon.
function drawFrost(ctx: CanvasRenderingContext2D, cellSize: number): void {
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.beginPath();
  ctx.arc(0, 0, cellSize * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// spec/03 §6 color-blind support, vector branch: stroke the same Path2D used
// for the fill so the shape's outline stands out against the fill color.
function drawGemOutline(
  ctx: CanvasRenderingContext2D,
  kind: number,
  cellSize: number,
): void {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = cellSize * 0.05;
  ctx.stroke(gemShapePath(kind, cellSize));
  ctx.restore();
}

// spec/03 §6 color-blind support, image branch: a small shape glyph over the
// gem image so the shape channel works even when the theme is image-based.
// Shrunk via ctx.scale, never a second gemShapePath(kind, differentCellSize)
// call - that would defeat the shapeCache's single-cellSize invalidation
// (spec/04 §1.3's shapeCache trap).
function drawGemGlyph(
  ctx: CanvasRenderingContext2D,
  kind: number,
  cellSize: number,
): void {
  ctx.save();
  ctx.scale(0.45, 0.45);
  const glyph = gemShapePath(kind, cellSize);
  ctx.fillStyle = "#ffffff";
  ctx.fill(glyph);
  ctx.strokeStyle = "rgba(20, 16, 28, 0.8)";
  // lineWidth is drawn under the 0.45 ctx.scale above, so it renders at
  // ~cellSize * 0.036 on screen - thin, but still legible over gem art.
  ctx.lineWidth = cellSize * 0.08;
  ctx.stroke(glyph);
  ctx.restore();
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

// Same fixed near-white stroke as the laser arrow - color-independent so the
// bud glyph reads over any gem color (spec/03 §6).
function drawBombIcon(ctx: CanvasRenderingContext2D, cellSize: number): void {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = Math.max(1.5, cellSize * 0.04);
  ctx.lineCap = "round";
  ctx.stroke(bombIconPath(cellSize));
  ctx.restore();
}

// Same fixed near-white stroke as the other special icons - color-independent
// so the faceted-diamond glyph reads over any gem color (spec/03 §6).
function drawPrismIcon(ctx: CanvasRenderingContext2D, cellSize: number): void {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = Math.max(1.5, cellSize * 0.04);
  ctx.lineCap = "round";
  ctx.stroke(prismIconPath(cellSize));
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
