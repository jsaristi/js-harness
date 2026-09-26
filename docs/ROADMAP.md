# Roadmap

Where js-harness came from, what is decided, and what is next. Feature-level progress lives in
`odd/tasks/`; this file is the map above it. Written 2026-09-26, the day the repo was created.

## Origin

js-harness is the rebuild of an earlier harness (`D:\harness`, now a read-only reference). The
founding pre-plan, with the full reasoning and sources, is [preplan.md](preplan.md). The
bet: a stronger model needs a smaller harness — little instruction, many executable checks — on
top of gentle-ai (workflow, TDD, review), engram (memory), codegraph (code graph), context7 (docs)
and native `/goal` (autonomy loop). This repo builds only what those leave open.

## Measured starting point (2026-09-26)

First request of a one-word prompt, estimated tokens:

- Claude Code 2.1.283 in an empty folder: ~107.8k. Tools 77.4k — of which the claude.ai Magnific
  connector alone is 37.3k (150 tools) and nothing in the stack uses it; global `CLAUDE.md` 17.5k
  (the gentle-ai managed block is most of it); environment, MCP instructions and skills list 11k.
  Measured with `--print`, which defers no tools, so the tool figure is an upper bound.
- Codex CLI 0.157.1: ~14.5k of injected context measured (global `AGENTS.md` 7.3k). Through a
  custom provider Codex sent no tools and no base instructions, so this is partial.

## Decided

| Area | Decision |
|------|----------|
| Name, home | `js-harness`, `D:\js-harness`, `github.com/jsaristi/js-harness` (private) |
| Distribution | A zero-dependency npm package with a `js-harness` bin; semver, git tags, releases |
| Commands | `install`, `sync`, `status`, `update`, `upgrade`, `uninstall`, `check`, and a TUI |
| Reversibility | Every file written outside the repo is in a manifest (path + sha256); uninstall is exact |
| Per project | A project pins its version in a `harness.json` it commits (not built yet) |
| Review | gentle-ai RDD on every candidate; Sebastián pre-grants consent |
| Effort | `medium` by default, `high` for design; the cap is set in user settings |

## Phases

| Phase | State |
|-------|-------|
| F0 Safeguard and baseline | Done 2026-09-26 — old repos pushed, payload measured, old folders frozen |
| F1 Skeleton | Done — `AGENTS.md` (691 tokens), `check` gate, pre-commit (`odd/tasks/f1-skeleton.md`) |
| Install and update | Done and reviewed on `feat/install-update`, tried by hand in a sandbox (`odd/tasks/install-update.md`) |
| F2 Context diet | Next — measure the full per-turn payload; shrink what loads every turn; adopt gentle-ai v4 when released |
| F3 Task contract | A contract with an executable done-when, fitted to the ODD feature doc and `/goal` |
| F4 Sensors | Tests, diagnostics, budget and review wired to `check` and pre-commit |
| F5 Evals that discriminate | Tasks hard enough to separate configs — needs Sebastián's spend approval |
| F6 Codex parity | Same behavior on Codex, differences measured |
| F7 Future-model protocol | Measure payload, run evals, strip one component at a time per new model |

## Open decisions (Sebastián's)

1. Merge `feat/install-update` into `main` — a PR or a local merge.
2. Where upgrades come from: npm publish, or GitHub releases (a private repo needs auth to download).
3. Disconnecting the unused Magnific connector (the largest single per-turn item).
4. Whether the Gentleman persona stays part of the stack.
5. Spend ceiling for F5.
