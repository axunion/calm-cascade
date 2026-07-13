import type { Cell } from "../engine/board.ts";
import { BOARD_SIZE } from "../engine/board.ts";
import { easeOutQuad } from "../game/animations.ts";
import type { Particle } from "../game/particles.ts";
import type { Theme } from "./theme.ts";

export const BEAM_DURATION_MS = 250;
const BEAM_MAX_WIDTH_FRACTION = 0.6;
const BEAM_MAX_ALPHA = 0.9;

// A laser's beam sweep (spec/01 §4.3, spec/04 §2.5). `delay` holds the beam
// invisible until the sweep that chain-fired it actually arrives; `elapsed`
// then drives the width/alpha animation below.
export interface BeamEffect {
  cell: Cell;
  orientation: "h" | "v";
  kind: number;
  delay: number;
  elapsed: number;
  duration: number;
}

// Advances delay/elapsed and swap-removes finished beams - same allocation-free
// shape as game/animations.ts's updateTweens (spec/04 §4).
export function updateBeams(beams: BeamEffect[], dt: number): void {
  for (let i = beams.length - 1; i >= 0; i--) {
    const beam = beams[i];
    if (beam.delay > 0) {
      beam.delay -= dt;
      continue;
    }
    beam.elapsed += dt;
    if (beam.elapsed >= beam.duration) {
      beams[i] = beams[beams.length - 1];
      beams.pop();
    }
  }
}

export function drawBeams(
  ctx: CanvasRenderingContext2D,
  beams: readonly BeamEffect[],
  theme: Theme,
  cellSize: number,
): void {
  const boardPx = cellSize * BOARD_SIZE;
  for (const beam of beams) {
    if (beam.delay > 0) {
      continue;
    }
    const t = Math.min(1, beam.elapsed / beam.duration);
    const width = easeOutQuad(t) * BEAM_MAX_WIDTH_FRACTION * cellSize;
    const alpha = BEAM_MAX_ALPHA * (1 - t);
    if (width <= 0 || alpha <= 0) {
      continue;
    }
    const center =
      (beam.orientation === "h" ? beam.cell.row : beam.cell.col) * cellSize +
      cellSize * 0.5;
    drawSweep(
      ctx,
      beam.orientation,
      center,
      width,
      alpha,
      boardPx,
      theme.gemColors[beam.kind],
    );
  }
}

// Layered flat fills rather than a CanvasGradient: the rAF hot loop must
// never allocate per frame (spec/04 §4), and createLinearGradient() would
// allocate a new gradient object on every frame a beam is on screen.
function drawSweep(
  ctx: CanvasRenderingContext2D,
  orientation: "h" | "v",
  center: number,
  width: number,
  alpha: number,
  boardPx: number,
  color: string,
): void {
  const from = center - width / 2;
  const coreWidth = Math.max(1, width * 0.25);
  const coreFrom = center - coreWidth / 2;

  ctx.save();
  ctx.globalAlpha = alpha * 0.55;
  ctx.fillStyle = color;
  fillBand(ctx, orientation, from, width, boardPx);

  ctx.globalAlpha = alpha * 0.85;
  ctx.fillStyle = "#ffffff";
  fillBand(ctx, orientation, coreFrom, coreWidth, boardPx);

  ctx.restore();
}

// Match-clear burst (spec/04 §2.3). Additive blending reads as a soft glow
// without allocating a CanvasGradient per particle per frame.
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: readonly Particle[],
  theme: Theme,
  cellSize: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of particles) {
    if (!p.active) {
      continue;
    }
    const alpha = p.life / p.maxLife;
    if (alpha <= 0) {
      continue;
    }
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = theme.gemColors[p.kind];
    ctx.beginPath();
    ctx.arc(
      (p.x + 0.5) * cellSize,
      (p.y + 0.5) * cellSize,
      p.size * cellSize,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}

function fillBand(
  ctx: CanvasRenderingContext2D,
  orientation: "h" | "v",
  from: number,
  size: number,
  boardPx: number,
): void {
  if (orientation === "h") {
    ctx.fillRect(0, from, boardPx, size);
  } else {
    ctx.fillRect(from, 0, size, boardPx);
  }
}
