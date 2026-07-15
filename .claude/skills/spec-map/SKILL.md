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
| `src/engine/board.ts`, `rng.ts` | spec/02 §3 (data model, seedFromString), spec/01 §1 (init board, reshuffle) |
| `src/engine/matches.ts` | spec/02 §3, spec/06 §3 (L/T = two groups) |
| `src/engine/swap.ts` | spec/01 §4.4 (special-pair swap validity), §7 (ice guard), spec/02 §3 |
| `src/engine/specials.ts` | spec/01 §4.1–4.2 (spawn rules, positions, priority prism > bomb > laser) |
| `src/engine/fires.ts` | spec/01 §4.3 (activation, effect areas, chain fire) |
| `src/engine/cascade.ts` | spec/01 §2 (combo), §7 (ice layer decrement), spec/02 §3 (StepResult) |
| `src/engine/scoring.ts` | spec/01 §3 (formula single source) |
| `src/engine/ice.ts` | spec/01 §7 (placement rules, daily-only) |
| `src/game/gameLoop.ts` | spec/02 §4 (state machine), §6 (rAF shape) |
| `src/game/input.ts` | spec/04 §3 (thresholds, debounce, pointer capture) |
| `src/game/animations.ts` | spec/04 §2.1–2.2 (tween engine, easings) |
| `src/game/particles.ts` | spec/04 §2.3 (fixed pool 256, zero alloc) |
| `src/game/juice.ts` | spec/01 §5 (tier table), spec/02 §5 (JuiceEvent) |
| `src/game/audio.ts` | spec/04 §5 (lazy AudioContext, synth-only) |
| `src/game/daily.ts` | spec/01 §8 (Today's Garden), spec/02 §3 (seed derivation), §8 (remount) |
| `src/game/achievements.ts` | spec/01 §9 (definitions, unlocksTheme contract) |
| `src/render/renderBoard.ts`, `effects.ts` | spec/04 §1 (DPR, draw order, image/vector branch), spec/03 §6 (colorBlindShapes) |
| `src/render/theme.ts` | spec/03 §5 (two axes), spec/04 §1.3 (shapeCache trap) |
| `src/render/themePack.ts`, `themeRegistry.ts`, `themeLoader.ts` | spec/04 §7.1–7.3 (manifest, discovery, fallback), spec/02 §8 (resolution flow) |
| `src/render/scaledBitmaps.ts` | spec/04 §7.4 (prescale cache invalidation) |
| `src/store/puzzleStore.ts` | spec/02 §5 (state tiers, store shape, achievement evaluation hook) |
| `src/store/persistence.ts` | spec/02 §7, spec/04 §7.5 (v2 schema, 1→2 migration) |
| `src/components/PuzzleGrid.tsx` | spec/02 §5 (canvas lifecycle), §8 (theme effect, remount), spec/04 §1 |
| `src/components/PuzzleUI.tsx`, dialogs | spec/03 §2–5 (HUD, Kobalte, touch targets, skin RadioGroup + lock) |
| `src/components/JuiceOverlay.tsx` | spec/02 §5 (event flow), spec/01 §5 |
| `src/components/AchievementToast.tsx` | spec/03 §8 (glass chip, serial queue, non-blocking) |
| `src/styles/*` | spec/03 §1 (layout), §5–8 (theme, a11y, micro-interactions, toast) |
| `themes/<name>/` | spec/04 §7.2 (manifest schema), themes/README.md |
| Tests | spec/06 (cases per module, boardFromStrings helper + suffix notation) |

## Non-negotiable invariants (violating these = bug, regardless of tests passing)

1. `src/engine/` is pure: no solid-js / DOM / `Math.random()` / `Date.now()` imports;
   RNG is always injected (daily mode reads the clock only in `game/daily.ts`).
2. The rAF hot loop never reads Solid store proxies (use the plain settings snapshot)
   and never allocates per frame (swap-remove tweens, pooled particles, prescaled
   bitmaps rebuilt only when theme or cellSize×DPR changes).
3. Store writes only at step boundaries, wrapped in `batch()`.
4. Canvas input uses Pointer Events only; all coordinate math in CSS px.
5. `touch-action: none` on the canvas only — never body/html.
6. No text drawn on canvas; all text is DOM (JuiceOverlay / HUD / AchievementToast).
7. Reduced motion (OS media query OR settings toggle) changes presentation only,
   never logical outcomes.
8. Theme resolution is async and fails soft: asset-level fallback to vector/classic,
   never a throw into gameplay; the hot loop reads only resolved plain `Theme` objects.
9. Special-piece icons (laser arrows, bomb/prism marks) are color-independent a11y
   cues — always drawn, never overridable by a theme manifest.
10. Persistence schema bumps must migrate old payloads by filling defaults — never
    reject and wipe existing settings/stats.
11. Spec ambiguity or contradiction discovered while coding → surface it and propose a
    spec amendment; do not silently diverge.
