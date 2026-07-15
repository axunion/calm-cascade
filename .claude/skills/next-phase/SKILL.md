---
name: next-phase
description: Advance the calm-cascade roadmap. Determines the first incomplete implementation phase from spec/05-implementation-plan.md, verifies nothing regressed, implements that phase, and runs its verification gate. Use whenever the user wants to continue roadmap work — "次のフェーズ", "フェーズを進めて", "ゲート確認", "実装を続けて", or asks what to work on next.
---

# next-phase — roadmap gate & advance

Drive development along `spec/05-implementation-plan.md` (each phase has a 完了マーカー
and a 検証ゲート). One invocation = find the first incomplete phase, implement it,
and pass its gate.

## Step 1 — Find the target phase

Read `spec/05-implementation-plan.md`. Each phase declares a **完了マーカー** — a
mechanically checkable condition (files that must exist, symbols/branches that must be
present). Check the markers against the repo state in phase order (do not ask the user
unless genuinely ambiguous). **The target phase is the first phase whose 完了マーカー
is not satisfied.**

Report the target phase and the evidence in one short paragraph.

## Step 2 — Regression gate (before starting new work)

Confirm previously completed phases still hold: run `pnpm check && pnpm test`.

If the regression gate is red, fix the regression first — do not start new phase work
on a broken base.

## Step 3 — Implement the target phase

1. Summarize the target phase's 作業 list from spec/05 in a few bullets.
2. Read the spec sections that govern that phase before writing code
   (use the module→spec map in `.claude/skills/spec-map/SKILL.md`).
3. Implement, writing tests alongside per spec/06 for every module spec/06 lists as a
   test target (engine/, game/input.ts, game/juice.ts, game/daily.ts,
   game/achievements.ts, render/themePack.ts, render/themeRegistry.ts,
   render/themeLoader.ts, store/persistence.ts).

## Step 4 — Verify the gate (independent)

Launch the **phase-gate-verifier** agent with the target phase number. It re-checks the
完了マーカー, runs the gate commands, checks spec/06 test coverage, and returns a
structured PASS/FAIL plus the manual checklist — do not run the gate commands yourself
in parallel; trust its report. Relay the manual checklist to the user verbatim.

Verdict FAIL → fix and re-launch the verifier; never report the phase complete without
a PASS.

## Step 5 — Compliance review

After the gate passes, launch the **spec-compliance-reviewer** agent scoped to the
phase's diff (`git diff` of the working tree). Fix any **Violation** findings and
re-run Step 4. **Drift** findings: fix if cheap, otherwise surface them to the user
with the commit proposal.

## Step 6 — Commit

Once the gate passes and violations are resolved, propose committing the phase as a
single commit via the ax-commit-x skill (the user approves the message there). This
closes the implement → test → gate → review → commit loop; do not batch multiple
phases into one commit.

## Rules

- Never skip a phase or reorder without the user's explicit ok (exception: spec/05's
  依存関係 section explicitly allows the two v2 tracks to proceed in parallel after
  phase 2).
- Honor the shared Calm acceptance criteria in spec/05's 進め方 section for every
  phase that touches UI.
- If implementation reveals the spec is wrong or incomplete, stop and surface it —
  propose a spec amendment rather than silently diverging.
