---
name: next-phase
description: Advance the calm-cascade roadmap. Determines the first incomplete implementation phase from spec/05-implementation-plan.md, verifies nothing regressed, implements that phase, and runs its verification gate. Use whenever the user wants to continue roadmap work — "次のフェーズ", "フェーズを進めて", "ゲート確認", "実装を続けて", or asks what to work on next.
---

# next-phase — roadmap gate & advance

Drive development along `spec/05-implementation-plan.md` (phases 0–7, each with a
verification gate). One invocation = find the first incomplete phase, implement it,
and pass its gate.

## Step 1 — Find the target phase

Read `spec/05-implementation-plan.md`, then infer progress from the repo state (do not
ask the user unless genuinely ambiguous). **The target phase is the first phase whose
"done" markers are not all satisfied** — if nothing is done yet, the target is Phase 0.

- Phase 0 done: `vite.config.ts` has `css.modules.localsConvention: "camelCaseOnly"`
  and `test: { environment: "node" }`, starter demo code removed,
  `src/{engine,game,render,store,components,styles}/` exist.
- Phase 1 done: all seven `src/engine/*.ts` modules exist with passing tests.
- Phase 2 done: `PuzzleGrid.tsx`, `render/theme.ts`, `render/renderBoard.ts`,
  `game/input.ts` (+ tests) exist.
- Phase 3 done: `game/animations.ts`, `JuiceOverlay.tsx`, RESOLVING/SHUFFLING implemented.
- Phase 4 done: laser rendering + beam effects in `render/effects.ts` wired up.
- Phase 5 done: `PuzzleUI.tsx`, both dialogs, theme switching.
- Phase 6 done: `game/particles.ts`, shake, `game/audio.ts`, haptics, reduced-motion paths.
- Phase 7 done: `store/persistence.ts`, aria-live, performance verified.

Report the target phase and the evidence in one short paragraph.

## Step 2 — Regression gate (before starting new work)

Confirm previously completed phases still hold. Scope the commands to what can exist:

- Target is **Phase 0** → skip this step entirely. The starter code fails lint by
  design and Phase 0's own work deletes it — do not "fix" starter files line by line;
  removing them IS the work.
- Target is **Phase 1** → run `pnpm check` (no tests exist yet; `vitest run` exits
  nonzero on an empty suite, so `pnpm test` is not meaningful before Phase 1 delivers
  the first tests).
- Target is **Phase 2+** → run `pnpm check && pnpm test`.

If the regression gate is red, fix the regression first — do not start new phase work
on a broken base.

## Step 3 — Implement the target phase

1. Summarize the target phase's 作業 list from spec/05 in a few bullets.
2. Read the spec sections that govern that phase before writing code
   (use the module→spec map in `.claude/skills/spec-map/SKILL.md`).
3. Implement, writing tests alongside per spec/06 where the phase touches `engine/`,
   `game/input.ts`, or `game/juice.ts`.

## Step 4 — Run the target phase's gate

Run the phase's 検証 items from spec/05. Items requiring a browser or device: perform
what is possible (e.g. `pnpm build`, `pnpm dev` smoke), and list the rest as a manual
checklist for the user instead of claiming them verified.

Gate red → fix and re-run; never report the phase complete with a red gate.

## Rules

- Never skip a phase or reorder without the user's explicit ok (exception: spec/05 allows
  phase 5 in parallel after phase 3).
- If implementation reveals the spec is wrong or incomplete, stop and surface it —
  propose a spec amendment rather than silently diverging.
- Commits are out of scope; the user triggers them separately (ax-commit-x).
