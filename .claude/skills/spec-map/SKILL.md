---
name: spec-map
description: Load before implementing or modifying anything under src/ in calm-cascade. Maps each module to the spec/ sections that govern it and lists the non-negotiable invariants, so only the relevant spec chapter needs to be read into context.
user-invocable: false
---

# spec-map — which spec governs what

Before touching a module, read its governing spec section (not the whole spec/ tree).

## Module → spec section

| Module | Read this first |
|---|---|
| `src/engine/board.ts`, `rng.ts` | spec/02 §3 (data model), spec/01 §1 (init board, reshuffle) |
| `src/engine/matches.ts` | spec/02 §3, spec/06 §3 (L/T = two groups) |
| `src/engine/swap.ts` | spec/01 §4.4 (laser swap validity), spec/02 §3 |
| `src/engine/specials.ts` | spec/01 §4.1–4.2 (spawn rules & positions) |
| `src/engine/lasers.ts` | spec/01 §4.3 (activation, chain fire) |
| `src/engine/cascade.ts` | spec/01 §2–3 (combo, scoring), spec/02 §3 (StepResult) |
| `src/game/gameLoop.ts` | spec/02 §4 (state machine), §6 (rAF shape) |
| `src/game/input.ts` | spec/04 §3 (thresholds, debounce, pointer capture) |
| `src/game/animations.ts` | spec/04 §2.1–2.2 (tween engine, easings) |
| `src/game/particles.ts` | spec/04 §2.3 (fixed pool 256, zero alloc) |
| `src/game/juice.ts` | spec/01 §5 (tier table), spec/02 §5 (JuiceEvent) |
| `src/game/audio.ts` | spec/04 §5 (lazy AudioContext, synth-only) |
| `src/render/*` | spec/04 §1 (DPR, draw order), spec/03 §5 (palette single source) |
| `src/store/puzzleStore.ts` | spec/02 §5 (state tiers, store shape) |
| `src/store/persistence.ts` | spec/02 §7 (key, debounce, try/catch) |
| `src/components/PuzzleGrid.tsx` | spec/02 §5 (canvas lifecycle), spec/04 §1 |
| `src/components/PuzzleUI.tsx`, dialogs | spec/03 §2–4 (HUD, Kobalte, touch targets) |
| `src/components/JuiceOverlay.tsx` | spec/02 §5 (event flow), spec/01 §5 |
| `src/styles/*` | spec/03 §1 (layout), §5–7 (theme, a11y, micro-interactions) |
| Tests | spec/06 (cases per module, boardFromStrings helper) |

## Non-negotiable invariants (violating these = bug, regardless of tests passing)

1. `src/engine/` is pure: no solid-js / DOM / `Math.random()` / `Date.now()` imports;
   RNG is always injected.
2. The rAF hot loop never reads Solid store proxies (use the plain settings snapshot)
   and never allocates per frame (swap-remove tweens, pooled particles).
3. Store writes only at step boundaries, wrapped in `batch()`.
4. Canvas input uses Pointer Events only; all coordinate math in CSS px.
5. `touch-action: none` on the canvas only — never body/html.
6. No text drawn on canvas; all text is DOM (JuiceOverlay / HUD).
7. Reduced motion (OS media query OR settings toggle) changes presentation only,
   never logical outcomes.
8. Spec ambiguity or contradiction discovered while coding → surface it and propose a
   spec amendment; do not silently diverge.
