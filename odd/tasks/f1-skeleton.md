# F1 — Skeleton

Locator: `odd/tasks/f1-skeleton.md` · Engram mirror: `odd/f1-skeleton/tasks`

## Objective
A new, minimal `js-harness` repo that can grow into an installable, versioned package.

## Why
Harness v2 is rebuilt from scratch (`D:\harness` PLAN.md decision 14, `docs/harness-v2-preplan.md`).
A stronger model needs a smaller harness: little instruction, executable checks.

## Scope
- In: this repo only — `AGENTS.md`, `bin/check.mjs` and its tests, pre-commit hook, `package.json`.
- Out: `install`/`sync`/`upgrade`/`uninstall` (next phase), npm publish, the old folders (read-only).

## Constraints
- Zero runtime dependencies — `bin/` must run on plain Node in any harness, no install step.
- Anything the harness writes must be reversible with git or by deleting a file (old PLAN.md decision 12).

## Acceptance criteria (done when)
- `node bin/check.mjs` exits 0 on this repo and non-zero when `AGENTS.md` exceeds its budget.
- `AGENTS.md` ≤ ~1.5k estimated tokens, written with the prompt audit applied.
- `git commit` runs `check` through `.githooks/pre-commit`.

## TDD
Mode: strict (source: user global config). Runner: `node --test`.

## Delivery
Strategy: ask-on-risk. Forecast: well under 400 authored lines — one slice.

## Tasks
- [x] T1 Scaffold: git repo, `package.json`, `.gitignore`, this document — route: inline (mechanical)
- [ ] T2 `check` command with tests (RED → GREEN) — route: delegated writer (2 non-trivial files)
- [ ] T3 `AGENTS.md` with the prompt audit applied — route: inline (one file, needs judgment)
- [ ] T4 Pre-commit hook wired to `check` — route: inline (mechanical)

## Progress
- 2026-09-26: document created; name `js-harness` chosen by Sebastián (free on npm and GitHub).
