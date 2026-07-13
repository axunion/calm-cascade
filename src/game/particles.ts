import type { Rng } from "../engine/rng.ts";

// spec/04 §2.3: a fixed 256-slot pool, no per-frame allocation. `kind`
// mirrors game/animations.ts's Sprite convention (an index resolved to a
// theme color at draw time) rather than spec's literal "hue" field, since
// the palette is defined per-theme, not as raw hues.
export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: number;
}

const POOL_SIZE = 256;
const BURST_MIN = 6;
const BURST_MAX = 10;
const SPEED_MIN = 0.0015;
const SPEED_MAX = 0.004;
const GRAVITY_PER_MS2 = 0.000004;
const DRAG_PER_MS = 0.0015;
const LIFE_MIN_MS = 300;
const LIFE_MAX_MS = 550;
const SIZE_MIN = 0.05;
const SIZE_MAX = 0.11;

export interface ParticleSystem {
  readonly particles: readonly Particle[];
  burst(x: number, y: number, kind: number): void;
  update(dt: number): void;
}

function createPool(): Particle[] {
  const pool: Particle[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    pool.push({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 0,
      kind: 0,
    });
  }
  return pool;
}

// Same injected-RNG convention as engine/board.ts's reshuffle and
// engine/cascade.ts's resolveStep, threaded through from gameLoop's rng.
export function createParticleSystem(rng: Rng): ParticleSystem {
  const pool = createPool();
  // Ring cursor: the pool exhausting silently overwrites the oldest slot
  // (spec/04 §2.3) simply by always advancing in allocation order.
  let cursor = 0;

  function randRange(min: number, max: number): number {
    return min + rng() * (max - min);
  }

  function spawnOne(x: number, y: number, kind: number): void {
    const p = pool[cursor];
    cursor = (cursor + 1) % POOL_SIZE;
    const angle = rng() * Math.PI * 2;
    const speed = randRange(SPEED_MIN, SPEED_MAX);
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = randRange(LIFE_MIN_MS, LIFE_MAX_MS);
    p.maxLife = p.life;
    p.size = randRange(SIZE_MIN, SIZE_MAX);
    p.kind = kind;
  }

  return {
    particles: pool,
    burst(x, y, kind) {
      const count = Math.floor(randRange(BURST_MIN, BURST_MAX + 1));
      for (let i = 0; i < count; i++) {
        spawnOne(x, y, kind);
      }
    },
    update(dt) {
      for (const p of pool) {
        if (!p.active) {
          continue;
        }
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        p.vy += GRAVITY_PER_MS2 * dt;
        const drag = Math.max(0, 1 - DRAG_PER_MS * dt);
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    },
  };
}
