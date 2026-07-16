import {
  BOARD_SIZE,
  type Board,
  type Cell,
  cellsEqual,
  createIdGenerator,
  type Gem,
  hasValidMove,
  idx,
  type NextId,
  reshuffle,
} from "../engine/board.ts";
import { resolveStep, type StepResult } from "../engine/cascade.ts";
import type { SpecialFire } from "../engine/fires.ts";
import type { MatchGroup } from "../engine/matches.ts";
import { mulberry32, type Rng } from "../engine/rng.ts";
import { stepScore } from "../engine/scoring.ts";
import { applySwap, isValidSwap } from "../engine/swap.ts";
import {
  BEAM_DURATION_MS,
  type BeamEffect,
  updateBeams,
} from "../render/effects.ts";
import type {
  JuiceEvent,
  PuzzleSettings,
  StepResultInput,
} from "../store/puzzleStore.ts";
import {
  easeInQuad,
  easeOutQuad,
  fallDuration,
  getTimings,
  linear,
  type Sprite,
  type Timings,
  type Tween,
  type TweenStep,
  tweenSequence,
  tweenTo,
  updateTweens,
} from "./animations.ts";
import { comboJuice } from "./juice.ts";
import {
  computeClearDelays,
  computeFireDelays,
  type LaserFire,
} from "./laserTiming.ts";
import { createParticleSystem, type Particle } from "./particles.ts";
import { createShakeSystem } from "./shake.ts";

// A small screen-shake add-on for bomb's "flower opening" bloom (spec/01
// §4.3) - much softer than a big combo's trauma, just enough to read as a
// soft thump rather than the sharp jolt an "explosion" word would suggest.
const BOMB_TRAUMA = 0.12;

export type Phase =
  | "IDLE"
  | "SWAPPING"
  | "SWAP_REJECT"
  | "RESOLVING"
  | "SHUFFLING";

export interface GameLoopCallbacks {
  onStepResolved(info: StepResultInput): void;
  onCascadeEnd(): void;
  onShuffle(): void;
}

export interface GameLoop {
  readonly board: Board;
  readonly phase: Phase;
  readonly sprites: ReadonlyMap<number, Sprite>;
  readonly beams: readonly BeamEffect[];
  readonly particles: readonly Particle[];
  readonly shake: { x: number; y: number };
  // Plain, non-reactive mirror of the store's settings (spec/02 §5): the
  // rAF loop reads this every frame instead of the Solid store proxy.
  // PuzzleGrid.tsx writes into it from a createEffect on settings changes.
  readonly settingsSnapshot: PuzzleSettings;
  requestSwap(a: Cell, b: Cell): void;
  update(dt: number): void;
}

interface SwapInfo {
  a: Cell;
  b: Cell;
}

function spriteFromGem(gem: Gem, row: number, col: number): Sprite {
  return {
    x: col,
    y: row,
    scale: 1,
    alpha: 1,
    kind: gem.kind,
    special: gem.special,
  };
}

function buildInitialSprites(board: Board): Map<number, Sprite> {
  const sprites = new Map<number, Sprite>();
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const gem = board[idx(row, col)];
      if (gem) {
        sprites.set(gem.id, spriteFromGem(gem, row, col));
      }
    }
  }
  return sprites;
}

// Juice text is positioned at the match centroid, expressed as a percentage
// of the (square, gutter-less) board box - no pixel rect needed (spec/02 §5).
function matchCentroidPercent(matchGroups: MatchGroup[]): {
  xPct: number;
  yPct: number;
} {
  let sumRow = 0;
  let sumCol = 0;
  let count = 0;
  for (const group of matchGroups) {
    for (const cell of group.cells) {
      sumRow += cell.row;
      sumCol += cell.col;
      count++;
    }
  }
  const avgRow = count > 0 ? sumRow / count : (BOARD_SIZE - 1) / 2;
  const avgCol = count > 0 ? sumCol / count : (BOARD_SIZE - 1) / 2;
  return {
    xPct: ((avgCol + 0.5) / BOARD_SIZE) * 100,
    yPct: ((avgRow + 0.5) / BOARD_SIZE) * 100,
  };
}

export function createGameLoop(
  initialBoard: Board,
  rng: Rng,
  nextId: NextId,
  initialSettings: PuzzleSettings,
  callbacks: GameLoopCallbacks,
): GameLoop {
  let board = initialBoard;
  let phase: Phase = "IDLE";
  const sprites = buildInitialSprites(board);
  const tweens: Tween[] = [];
  const beams: BeamEffect[] = [];
  // Cosmetic-only randomness (particle drift, shake wobble) must never share
  // `rng` with the deterministic engine calls below (resolveStep/reshuffle) -
  // shake.update() draws from it unconditionally every rAF frame regardless
  // of game state, so sharing a stream would make the daily challenge's
  // refill sequence depend on wall-clock frame timing instead of purely on
  // the swap sequence (spec/01 §8, spec/02 §3's determinism guarantee).
  const cosmeticRng = mulberry32(Date.now());
  const particles = createParticleSystem(cosmeticRng);
  const shakeSystem = createShakeSystem(cosmeticRng);
  const settingsSnapshot: PuzzleSettings = { ...initialSettings };

  let phaseTimer: number | null = null;
  let resolvingSub: "clearing" | "falling" | null = null;
  let shuffleSub: "out" | "in" | null = null;
  let pendingSwapForStep: SwapInfo | null = null;
  let pendingStep: StepResult | null = null;
  let combo = 0;
  const nextJuiceId = createIdGenerator();

  function timings(): Timings {
    return getTimings(settingsSnapshot.reducedMotion);
  }

  // A small flinch toward the target then back - the "no" wiggle of
  // spec/01 §5, expressed in cell-space rather than a fixed pixel amount.
  function queueRejectAxis(
    sprite: Sprite,
    prop: "x" | "y",
    home: number,
    toward: number,
    t: Timings,
  ): void {
    const mid = home + (toward - home) * 0.22;
    const half = t.reject / 2;
    tweenSequence(tweens, sprite, [
      { prop, to: mid, duration: half, ease: t.rejectEase },
      { prop, to: home, duration: half, ease: t.rejectEase },
    ]);
  }

  function queueRejectTween(
    sprite: Sprite,
    home: Cell,
    toward: Cell,
    t: Timings,
  ): void {
    if (home.col !== toward.col) {
      queueRejectAxis(sprite, "x", home.col, toward.col, t);
    }
    if (home.row !== toward.row) {
      queueRejectAxis(sprite, "y", home.row, toward.row, t);
    }
  }

  function queueClearTween(
    sprite: Sprite,
    gemId: number,
    t: Timings,
    delay: number,
  ): void {
    const deleteSprite = () => sprites.delete(gemId);
    if (t.reducedMotion) {
      // Reduced motion has no scale pop (spec/04 §2.2) - the alpha fade is
      // the only visible animation, so deletion follows it directly.
      tweens.push(
        tweenTo(
          sprite,
          "alpha",
          0,
          t.clearAlpha,
          t.clearEase,
          deleteSprite,
          delay,
        ),
      );
      return;
    }
    tweens.push(
      tweenTo(sprite, "alpha", 0, t.clearAlpha, t.clearEase, undefined, delay),
    );
    tweenSequence(
      tweens,
      sprite,
      [
        {
          prop: "scale",
          to: 1.15,
          duration: t.clearScaleUp,
          ease: easeOutQuad,
        },
        { prop: "scale", to: 0, duration: t.clearScaleDown, ease: easeOutQuad },
      ],
      deleteSprite,
      delay,
    );
  }

  // A fall/spawn landing is a fall tween followed by a small bounce; in
  // reduced motion the bounce steps collapse instantly since t.bounce is 0
  // (spec/04 §2.2), so no separate branch is needed here.
  function fallSteps(toRow: number, duration: number, t: Timings): TweenStep[] {
    return [
      {
        prop: "y",
        to: toRow,
        duration,
        ease: t.reducedMotion ? linear : easeInQuad,
      },
      { prop: "y", to: toRow - 0.08, duration: t.bounce, ease: easeOutQuad },
      { prop: "y", to: toRow, duration: t.bounce, ease: easeInQuad },
    ];
  }

  function animateLanding(
    sprite: Sprite,
    toRow: number,
    distanceRows: number,
    t: Timings,
  ): number {
    const duration = fallDuration(distanceRows, t);
    tweenSequence(tweens, sprite, fallSteps(toRow, duration, t));
    return duration + t.bounce * 2;
  }

  function reportStep(step: StepResult): void {
    const scoreDelta = stepScore(step.clearedGems.length, combo);
    const info = comboJuice(combo);
    const juice: JuiceEvent | null = info.text
      ? {
          id: nextJuiceId(),
          text: info.text,
          tier: info.tier,
          ...matchCentroidPercent(step.matchGroups),
        }
      : null;
    const lasersFired = step.fires.filter(
      (fire) => fire.special === "laserH" || fire.special === "laserV",
    ).length;
    const bombsDetonated = step.fires.filter(
      (fire) => fire.special === "bomb",
    ).length;
    const prismsFired = step.fires.filter(
      (fire) => fire.special === "prism",
    ).length;
    callbacks.onStepResolved({
      scoreDelta,
      combo,
      gemsCleared: step.clearedGems.length,
      lasersFired,
      bombsDetonated,
      prismsFired,
      juice,
    });
    // No reducedMotion guard here: updateShake() unconditionally zeroes
    // trauma every frame while reducedMotion is on, so it's the sole
    // gatekeeper and this stays correct either way.
    shakeSystem.addTrauma(info.trauma + bombsDetonated * BOMB_TRAUMA);
  }

  // gameLoop is the one place that converts the engine's generalized
  // SpecialFire[] (laser, bomb, prism) down to the laser-only shape
  // laserTiming.ts expects - that module's API stays laser-specific and
  // unchanged (spec/05 phase 10). Prism's clear has no stagger (spec/01
  // §4.3), so it's correctly left out of this conversion: every cell it
  // sweeps gets the default 0 clear delay, exactly like a plain match.
  function laserFiresOf(fires: SpecialFire[]): LaserFire[] {
    const laserFires: LaserFire[] = [];
    for (const fire of fires) {
      if (fire.special === "laserH" || fire.special === "laserV") {
        laserFires.push({
          cell: fire.cell,
          orientation: fire.special === "laserH" ? "h" : "v",
        });
      }
    }
    return laserFires;
  }

  interface LaserEffects {
    clearDelays: Map<number, number>;
    maxEndTime: number;
  }

  // Laser beams stagger their swept gems' clears by distance x 18ms and
  // chain-fired lasers hold their own beam until the sweep reaches them
  // (spec/04 §2.5). Reduced motion drops the stagger entirely - presentation
  // only, per the invariant that it never changes logical outcomes.
  function startLaserEffects(
    step: StepResult,
    swap: SwapInfo | null,
    t: Timings,
  ): LaserEffects {
    const laserFires = laserFiresOf(step.fires);
    if (laserFires.length === 0) {
      return { clearDelays: new Map(), maxEndTime: 0 };
    }
    const fireDelays = t.reducedMotion
      ? laserFires.map(() => 0)
      : computeFireDelays(laserFires, step.matchGroups, swap);
    const beamDuration = t.reducedMotion ? t.clearAlpha : BEAM_DURATION_MS;
    let maxEndTime = 0;

    laserFires.forEach((fire, i) => {
      const origin = step.clearedGems.find((c) =>
        cellsEqual(c.cell, fire.cell),
      );
      beams.push({
        cell: fire.cell,
        orientation: fire.orientation,
        kind: origin?.gem.kind ?? 0,
        delay: fireDelays[i],
        elapsed: 0,
        duration: beamDuration,
      });
      maxEndTime = Math.max(maxEndTime, fireDelays[i] + beamDuration);
    });

    return {
      clearDelays: computeClearDelays(laserFires, fireDelays),
      maxEndTime,
    };
  }

  function startClearPhase(step: StepResult, swap: SwapInfo | null): void {
    const t = timings();
    const { clearDelays, maxEndTime } = startLaserEffects(step, swap, t);
    let maxDuration = Math.max(t.clearAlpha, maxEndTime);

    const spawnParticles =
      settingsSnapshot.particles && !settingsSnapshot.reducedMotion;
    for (const { cell, gem } of step.clearedGems) {
      const sprite = sprites.get(gem.id);
      if (sprite) {
        const delay = clearDelays.get(idx(cell.row, cell.col)) ?? 0;
        queueClearTween(sprite, gem.id, t, delay);
        maxDuration = Math.max(maxDuration, delay + t.clearAlpha);
      }
      if (spawnParticles) {
        particles.burst(cell.col, cell.row, gem.kind);
      }
    }
    // A special piece born on an existing (surviving) cell only changes that
    // sprite's payload in place - it isn't cleared or moved (spec/01 §4.2.5).
    for (const spawn of step.specialSpawns) {
      const cellGem = board[idx(spawn.cell.row, spawn.cell.col)];
      const sprite = cellGem && sprites.get(cellGem.id);
      if (sprite) {
        sprite.special = spawn.special;
      }
    }
    pendingStep = step;
    resolvingSub = "clearing";
    phaseTimer = maxDuration;
    reportStep(step);
  }

  function beginFalling(): void {
    const step = pendingStep;
    pendingStep = null;
    if (!step) {
      return;
    }
    const t = timings();
    let maxDuration = 1;

    for (const fall of step.falls) {
      const sprite = sprites.get(fall.gem.id);
      if (!sprite) {
        continue;
      }
      const distance = fall.to.row - fall.from.row;
      maxDuration = Math.max(
        maxDuration,
        animateLanding(sprite, fall.to.row, distance, t),
      );
    }

    for (const spawn of step.spawns) {
      const startRow = spawn.to.row - spawn.fromAboveRows;
      const sprite = spriteFromGem(spawn.gem, startRow, spawn.to.col);
      sprites.set(spawn.gem.id, sprite);
      maxDuration = Math.max(
        maxDuration,
        animateLanding(sprite, spawn.to.row, spawn.fromAboveRows, t),
      );
    }

    resolvingSub = "falling";
    phaseTimer = maxDuration;
  }

  function beginShuffle(): void {
    phase = "SHUFFLING";
    resolvingSub = null;
    shuffleSub = "out";
    const t = timings();
    for (const sprite of sprites.values()) {
      tweens.push(tweenTo(sprite, "alpha", 0, t.shuffleOut, t.fadeEase));
    }
    phaseTimer = t.shuffleOut;
  }

  function performReshuffleAndFadeIn(): void {
    board = reshuffle(board, rng, nextId);
    sprites.clear();
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const gem = board[idx(row, col)];
        if (gem) {
          const sprite = spriteFromGem(gem, row, col);
          sprite.alpha = 0;
          sprites.set(gem.id, sprite);
        }
      }
    }
    callbacks.onShuffle();
    const t = timings();
    for (const sprite of sprites.values()) {
      tweens.push(tweenTo(sprite, "alpha", 1, t.shuffleIn, t.fadeEase));
    }
    shuffleSub = "in";
    phaseTimer = t.shuffleIn;
  }

  function runNextResolveStep(): void {
    const swapArg = pendingSwapForStep;
    pendingSwapForStep = null;
    const step = resolveStep(board, rng, nextId, swapArg);
    if (!step) {
      callbacks.onCascadeEnd();
      combo = 0;
      if (hasValidMove(board)) {
        phase = "IDLE";
        resolvingSub = null;
      } else {
        beginShuffle();
      }
      return;
    }
    combo += 1;
    board = step.board;
    startClearPhase(step, swapArg);
  }

  function advancePhase(): void {
    if (phase === "SWAPPING") {
      phase = "RESOLVING";
      runNextResolveStep();
      return;
    }
    if (phase === "SWAP_REJECT") {
      phase = "IDLE";
      return;
    }
    if (phase === "RESOLVING") {
      if (resolvingSub === "clearing") {
        beginFalling();
      } else {
        runNextResolveStep();
      }
      return;
    }
    if (phase === "SHUFFLING") {
      if (shuffleSub === "out") {
        performReshuffleAndFadeIn();
      } else {
        shuffleSub = null;
        phase = "IDLE";
      }
    }
  }

  function update(dt: number): void {
    updateTweens(tweens, dt);
    updateBeams(beams, dt);
    particles.update(dt);
    shakeSystem.update(dt, settingsSnapshot.reducedMotion);
    if (phaseTimer === null) {
      return;
    }
    phaseTimer -= dt;
    if (phaseTimer > 0) {
      return;
    }
    phaseTimer = null;
    advancePhase();
  }

  return {
    get board() {
      return board;
    },
    get phase() {
      return phase;
    },
    sprites,
    beams,
    particles: particles.particles,
    shake: shakeSystem.shake,
    settingsSnapshot,
    requestSwap(a, b) {
      if (phase !== "IDLE") {
        return;
      }
      const gemA = board[idx(a.row, a.col)];
      const gemB = board[idx(b.row, b.col)];
      if (!gemA || !gemB) {
        return;
      }
      const spriteA = sprites.get(gemA.id);
      const spriteB = sprites.get(gemB.id);
      if (!spriteA || !spriteB) {
        return;
      }

      const t = timings();
      if (!isValidSwap(board, a, b)) {
        phase = "SWAP_REJECT";
        queueRejectTween(spriteA, a, b, t);
        queueRejectTween(spriteB, b, a, t);
        phaseTimer = t.reject;
        return;
      }

      phase = "SWAPPING";
      board = applySwap(board, a, b);
      if (a.col !== b.col) {
        tweens.push(tweenTo(spriteA, "x", b.col, t.swap, t.swapEase));
        tweens.push(tweenTo(spriteB, "x", a.col, t.swap, t.swapEase));
      }
      if (a.row !== b.row) {
        tweens.push(tweenTo(spriteA, "y", b.row, t.swap, t.swapEase));
        tweens.push(tweenTo(spriteB, "y", a.row, t.swap, t.swapEase));
      }
      pendingSwapForStep = { a, b };
      phaseTimer = t.swap;
    },
    update,
  };
}
