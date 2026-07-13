import type { Rng } from "../engine/rng.ts";
import { easeInQuad } from "./animations.ts";

// Trauma model (spec/04 §2.4): trauma decays linearly and screen-shake
// amplitude scales with trauma squared (the same t*t curve as
// animations.ts's easeInQuad), so small trauma barely shows while large
// trauma (near 1) shakes hard.
export const TRAUMA_DECAY_PER_SECOND = 1.8;
export const SHAKE_MAX_PX = 6;

export function decayTrauma(trauma: number, dt: number): number {
  return Math.max(0, trauma - (dt / 1000) * TRAUMA_DECAY_PER_SECOND);
}

export function addTrauma(trauma: number, amount: number): number {
  return Math.min(1, trauma + amount);
}

export function shakeAmplitude(trauma: number): number {
  return easeInQuad(trauma) * SHAKE_MAX_PX;
}

export interface ShakeSystem {
  readonly shake: { x: number; y: number };
  addTrauma(amount: number): void;
  update(dt: number, reducedMotion: boolean): void;
}

// Mirrors particles.ts's createParticleSystem() shape: state lives behind a
// factory instead of loose variables in gameLoop's closure.
export function createShakeSystem(rng: Rng): ShakeSystem {
  let trauma = 0;
  const shake = { x: 0, y: 0 };

  return {
    shake,
    addTrauma(amount) {
      trauma = addTrauma(trauma, amount);
    },
    update(dt, reducedMotion) {
      if (reducedMotion) {
        trauma = 0;
        shake.x = 0;
        shake.y = 0;
        return;
      }
      trauma = decayTrauma(trauma, dt);
      const amplitude = shakeAmplitude(trauma);
      shake.x = (rng() * 2 - 1) * amplitude;
      shake.y = (rng() * 2 - 1) * amplitude;
    },
  };
}
