import type { Special } from "../engine/board.ts";

// Sprite coordinates are cell-space float, not pixels (spec/04 §2.1) - a
// tween keeps animating correctly through a resize since it never deals in
// backing-store pixels.
export interface Sprite {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  kind: number;
  special: Special;
}

export type TweenProp = "x" | "y" | "scale" | "alpha";
export type EaseFn = (t: number) => number;

export interface Tween {
  sprite: Sprite;
  prop: TweenProp;
  from: number;
  to: number;
  elapsed: number;
  duration: number;
  ease: EaseFn;
  onDone?: () => void;
  delay: number;
}

export function linear(t: number): number {
  return t;
}

export function easeInQuad(t: number): number {
  return t * t;
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

const MAX_DT_MS = 50;

// A tab returning from the background shouldn't warp mid-cascade (spec/04 §7
// risk #6), so every dt fed into the loop is clamped first.
export function clampDt(rawDt: number): number {
  return Math.max(0, Math.min(MAX_DT_MS, rawDt));
}

export function tweenTo(
  sprite: Sprite,
  prop: TweenProp,
  to: number,
  duration: number,
  ease: EaseFn,
  onDone?: () => void,
  delay = 0,
): Tween {
  return {
    sprite,
    prop,
    from: sprite[prop],
    to,
    elapsed: 0,
    duration,
    ease,
    onDone,
    delay,
  };
}

export interface TweenStep {
  prop: TweenProp;
  to: number;
  duration: number;
  ease: EaseFn;
}

// Chains steps for one sprite via onDone, so a call site describes a
// sequence declaratively instead of hand-nesting onDone callbacks.
// `initialDelay` (spec/04 §2.5 laser sweep stagger) only holds up the first
// step - once it starts, the rest of the sequence follows immediately.
export function tweenSequence(
  tweens: Tween[],
  sprite: Sprite,
  steps: TweenStep[],
  onDone?: () => void,
  initialDelay = 0,
): void {
  if (steps.length === 0) {
    onDone?.();
    return;
  }
  function pushStep(index: number): void {
    const step = steps[index];
    const isLast = index === steps.length - 1;
    tweens.push(
      tweenTo(
        sprite,
        step.prop,
        step.to,
        step.duration,
        step.ease,
        () => {
          if (isLast) {
            onDone?.();
          } else {
            pushStep(index + 1);
          }
        },
        index === 0 ? initialDelay : 0,
      ),
    );
  }
  pushStep(0);
}

// Iterating backward while swap-removing finished tweens keeps the hot loop
// allocation-free (spec/04 §2.1): no filter(), no splice() in the middle.
export function updateTweens(tweens: Tween[], dt: number): void {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tween = tweens[i];
    if (tween.delay > 0) {
      tween.delay -= dt;
      continue;
    }
    tween.elapsed += dt;
    const t =
      tween.duration <= 0 ? 1 : Math.min(1, tween.elapsed / tween.duration);
    tween.sprite[tween.prop] =
      tween.from + (tween.to - tween.from) * tween.ease(t);
    if (t >= 1) {
      const onDone = tween.onDone;
      tweens[i] = tweens[tweens.length - 1];
      tweens.pop();
      onDone?.();
    }
  }
}

export interface Timings {
  reducedMotion: boolean;
  swap: number;
  swapEase: EaseFn;
  reject: number;
  rejectEase: EaseFn;
  clearAlpha: number;
  clearEase: EaseFn;
  clearScaleUp: number;
  clearScaleDown: number;
  shuffleOut: number;
  shuffleIn: number;
  fadeEase: EaseFn;
  bounce: number;
}

export const REDUCED_MOTION_MS = 80;

// spec/04 §2.2 table. Reduced motion collapses everything to a short linear
// crossfade with no bounce, regardless of tier.
export function getTimings(reducedMotion: boolean): Timings {
  if (reducedMotion) {
    return {
      reducedMotion: true,
      swap: REDUCED_MOTION_MS,
      swapEase: linear,
      reject: REDUCED_MOTION_MS,
      rejectEase: linear,
      clearAlpha: REDUCED_MOTION_MS,
      clearEase: linear,
      clearScaleUp: 0,
      clearScaleDown: 0,
      shuffleOut: REDUCED_MOTION_MS,
      shuffleIn: REDUCED_MOTION_MS,
      fadeEase: linear,
      bounce: 0,
    };
  }
  return {
    reducedMotion: false,
    swap: 160,
    swapEase: easeInOutQuad,
    reject: 180,
    rejectEase: easeOutQuad,
    clearAlpha: 220,
    clearEase: easeOutQuad,
    clearScaleUp: 70,
    clearScaleDown: 150,
    shuffleOut: 200,
    shuffleIn: 300,
    fadeEase: easeOutQuad,
    bounce: 40,
  };
}

export function fallDuration(distanceRows: number, timings: Timings): number {
  return timings.reducedMotion ? REDUCED_MOTION_MS : 120 + 40 * distanceRows;
}
